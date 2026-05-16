<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\ContentReport;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\ProductLicenseKey;
use App\Models\SubscriptionPlan;
use App\Models\TrackedLink;
use App\Services\PulseNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentReportModerationController extends Controller
{
    public function merchantIndex(Request $request): JsonResponse
    {
        $merchant = $this->resolveMerchant($request);

        $reports = ContentReport::with(['reporter:id,name,phone_number', 'reviewedBy:id,name'])
            ->where('merchant_id', $merchant->id)
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->paginate(30)
            ->through(fn(ContentReport $report) => $this->serializeReport($report));

        return response()->json($reports);
    }

    public function merchantResolve(Request $request, ContentReport $contentReport): JsonResponse
    {
        $merchant = $this->resolveMerchant($request);
        abort_if($contentReport->merchant_id !== $merchant->id, 403, 'Unauthorized.');

        $validated = $request->validate([
            'status' => 'required|in:under_review,resolved,dismissed',
            'resolution_note' => 'nullable|string|max:2000',
            'action_taken' => 'nullable|in:none,warn_content',
        ]);

        $resolved = in_array($validated['status'], ['resolved', 'dismissed'], true);
        $safetyState = $validated['status'] === 'under_review'
            ? 'under_review'
            : ($resolved ? 'reviewed' : $contentReport->safety_state);

        $contentReport->update([
            'status' => $validated['status'],
            'safety_state' => $safetyState,
            'reviewed_by_id' => $request->user()->id,
            'resolution_note' => $validated['resolution_note'] ?? null,
            'action_taken' => $validated['action_taken'] ?? 'none',
            'resolved_at' => $resolved ? now() : null,
        ]);

        return response()->json([
            'message' => 'Report updated.',
            'report' => $contentReport->fresh(),
        ]);
    }

    public function merchantAppeal(Request $request, ContentReport $contentReport): JsonResponse
    {
        $merchant = $this->resolveMerchant($request);
        abort_if($contentReport->merchant_id !== $merchant->id, 403, 'Unauthorized.');

        if (! in_array($contentReport->safety_state, ['restricted', 'appeal_rejected'], true)) {
            return response()->json([
                'message' => 'Only restricted content can be appealed.',
            ], 422);
        }

        $validated = $request->validate([
            'appeal_message' => 'required|string|min:20|max:3000',
        ]);

        $contentReport->update([
            'appeal_status' => 'pending',
            'appeal_message' => $validated['appeal_message'],
            'appealed_at' => now(),
            'appeal_reviewed_at' => null,
            'safety_state' => 'appeal_pending',
        ]);

        return response()->json([
            'message' => 'Appeal submitted for Takeer review.',
            'report' => $this->serializeReport($contentReport->fresh(['reporter', 'reviewedBy'])),
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $reports = ContentReport::with(['merchant:id,display_name,username', 'reporter:id,name,phone_number', 'reviewedBy:id,name'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->paginate(50)
            ->through(fn(ContentReport $report) => $this->serializeReport($report));

        return response()->json($reports);
    }

    public function adminResolve(Request $request, ContentReport $contentReport): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:under_review,resolved,dismissed',
            'resolution_note' => 'nullable|string|max:2000',
            'action_taken' => 'nullable|in:none,warn_content,restrict_item,restore_item,approve_appeal,reject_appeal,suspend_merchant,ban_reporter',
        ]);

        $resolved = in_array($validated['status'], ['resolved', 'dismissed'], true);
        $actionTaken = $validated['action_taken'] ?? 'none';
        $safetyState = $validated['status'] === 'under_review' ? 'under_review' : ($resolved ? 'reviewed' : $contentReport->safety_state);

        if ($actionTaken === 'suspend_merchant') {
            $merchant = Merchant::find($contentReport->merchant_id);
            if ($merchant) {
                $merchant->update(['is_suspended' => true]);
            }
        }

        if ($actionTaken === 'ban_reporter' && $contentReport->reporter_id) {
            $reporter = $contentReport->reporter;
            if ($reporter) {
                $reporter->update(['is_banned' => true]);
            }
        }

        if ($actionTaken === 'restrict_item') {
            $this->restrictReportedItem($contentReport, $validated['resolution_note'] ?? null);
            $safetyState = 'restricted';
        }

        if ($actionTaken === 'restore_item') {
            $this->restoreReportedItem($contentReport, $validated['resolution_note'] ?? null);
            $safetyState = 'restored';
        }

        if ($actionTaken === 'approve_appeal') {
            $this->restoreReportedItem($contentReport, $validated['resolution_note'] ?? null);
            $safetyState = 'restored';
        }

        if ($actionTaken === 'reject_appeal') {
            $safetyState = 'appeal_rejected';
        }

        $updates = [
            'status' => $validated['status'],
            'safety_state' => $safetyState,
            'reviewed_by_id' => $request->user()->id,
            'resolution_note' => $validated['resolution_note'] ?? null,
            'action_taken' => $actionTaken,
            'resolved_at' => $resolved ? now() : null,
        ];

        if ($actionTaken === 'approve_appeal') {
            $updates['appeal_status'] = 'approved';
            $updates['appeal_reviewed_at'] = now();
        } elseif ($actionTaken === 'reject_appeal') {
            $updates['appeal_status'] = 'rejected';
            $updates['appeal_reviewed_at'] = now();
        }

        $contentReport->update($updates);

        return response()->json([
            'message' => 'Report resolved.',
            'report' => $this->serializeReport($contentReport->fresh(['merchant', 'reporter', 'reviewedBy'])),
        ]);
    }

    private function restrictReportedItem(ContentReport $contentReport, ?string $note = null): void
    {
        match ($contentReport->item_type) {
            'post' => Post::withTrashed()->find($contentReport->item_id)?->delete(),
            'product' => Product::withTrashed()->find($contentReport->item_id)?->delete(),
            'bundle' => Bundle::withTrashed()->find($contentReport->item_id)?->delete(),
            'subscription_plan' => SubscriptionPlan::withTrashed()->find($contentReport->item_id)?->delete(),
            'content_item' => $this->restrictContentItem($contentReport, $note),
            'license_key' => ProductLicenseKey::find($contentReport->item_id)?->update([
                'status' => 'revoked',
                'revoked_at' => now(),
            ]),
            'tracked_link' => $this->restrictTrackedLink($contentReport, $note),
            default => null,
        };
    }

    private function restoreReportedItem(ContentReport $contentReport, ?string $note = null): void
    {
        match ($contentReport->item_type) {
            'post' => Post::withTrashed()->find($contentReport->item_id)?->restore(),
            'product' => Product::withTrashed()->find($contentReport->item_id)?->restore(),
            'bundle' => Bundle::withTrashed()->find($contentReport->item_id)?->restore(),
            'subscription_plan' => SubscriptionPlan::withTrashed()->find($contentReport->item_id)?->restore(),
            'content_item' => $this->restoreContentItem($contentReport, $note),
            'license_key' => ProductLicenseKey::find($contentReport->item_id)?->update([
                'status' => 'active',
                'revoked_at' => null,
            ]),
            'tracked_link' => $this->restoreTrackedLink($contentReport, $note),
            default => null,
        };
    }

    private function restrictContentItem(ContentReport $contentReport, ?string $note = null): void
    {
        $item = ContentItem::withTrashed()->find($contentReport->item_id);

        if (! $item) {
            return;
        }

        $item->update([
            'visibility' => 'archived',
            'moderation_status' => 'rejected',
            'moderation_notes' => $note ?: 'Restricted from content report #' . $contentReport->id,
        ]);
        $item->delete();
    }

    private function restoreContentItem(ContentReport $contentReport, ?string $note = null): void
    {
        $item = ContentItem::withTrashed()->find($contentReport->item_id);

        if (! $item) {
            return;
        }

        $item->restore();
        $item->update([
            'visibility' => 'published',
            'moderation_status' => 'approved',
            'moderation_notes' => $note,
        ]);
    }

    private function restrictTrackedLink(ContentReport $contentReport, ?string $note = null): void
    {
        $link = TrackedLink::find($contentReport->item_id);
        if (! $link) {
            return;
        }

        $link->update(['status' => 'disabled']);
        app(PulseNotificationService::class)->trackedLinkModerated($link->fresh(['merchant.user']), 'disabled', $note, $contentReport);
    }

    private function restoreTrackedLink(ContentReport $contentReport, ?string $note = null): void
    {
        $link = TrackedLink::find($contentReport->item_id);
        if (! $link) {
            return;
        }

        $link->update(['status' => 'active']);
        app(PulseNotificationService::class)->trackedLinkModerated($link->fresh(['merchant.user']), 'active', $note, $contentReport);
    }

    private function serializeReport(ContentReport $report): array
    {
        return [
            ...$report->toArray(),
            'item_summary' => $this->buildItemSummary($report),
        ];
    }

    private function buildItemSummary(ContentReport $report): ?array
    {
        $target = match ($report->item_type) {
            'post' => Post::withTrashed()->find($report->item_id),
            'product' => Product::withTrashed()->find($report->item_id),
            'content_item' => ContentItem::withTrashed()->find($report->item_id),
            'bundle' => Bundle::withTrashed()->find($report->item_id),
            'subscription_plan' => SubscriptionPlan::withTrashed()->find($report->item_id),
            'license_key' => ProductLicenseKey::find($report->item_id),
            'order' => Order::find($report->item_id),
            'tracked_link' => TrackedLink::find($report->item_id),
            default => null,
        };

        if (! $target) {
            return null;
        }

        return [
            'label' => $report->item_type === 'license_key'
                ? 'License key #' . $report->item_id
                : ($target->title ?? $target->name ?? $target->label ?? $target->destination_host ?? $target->public_id ?? ('#' . $report->item_id)),
            'deleted_at' => $target->deleted_at ?? null,
            'status' => $target->status ?? $target->payment_status ?? $target->visibility ?? null,
            'url' => $target->destination_url ?? null,
        ];
    }

    private function resolveMerchant(Request $request): Merchant
    {
        $merchant = $request->user()
            ->merchantProfiles()
            ->where('is_default', true)
            ->first() ?? $request->user()->merchantProfiles()->first();

        abort_unless($merchant, 403, 'Merchant profile not found.');

        return $merchant;
    }
}
