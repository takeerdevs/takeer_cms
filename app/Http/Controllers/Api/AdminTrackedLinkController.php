<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentReport;
use App\Models\TrackedLink;
use App\Services\PulseNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminTrackedLinkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'active', 'paused', 'disabled'])],
            'merchant_id' => ['nullable', 'integer', 'min:1'],
            'q' => ['nullable', 'string', 'max:160'],
            'reported' => ['nullable', 'boolean'],
        ]);

        $reportedIds = ContentReport::query()
            ->where('item_type', 'tracked_link')
            ->whereIn('status', ['open', 'under_review'])
            ->select('item_id');

        $links = TrackedLink::query()
            ->with('merchant:id,display_name,username')
            ->withCount([
                'reports as open_reports_count' => fn ($query) => $query->whereIn('status', ['open', 'under_review']),
                'reports as total_reports_count',
            ])
            ->when(($data['status'] ?? 'all') !== 'all', fn ($query) => $query->where('status', $data['status']))
            ->when(! empty($data['merchant_id']), fn ($query) => $query->where('merchant_id', (int) $data['merchant_id']))
            ->when(! empty($data['reported']), fn ($query) => $query->whereIn('id', $reportedIds))
            ->when(! empty($data['q']), function ($query) use ($data) {
                $term = trim((string) $data['q']);
                $query->where(function ($inner) use ($term) {
                    $inner->where('code', 'like', "%{$term}%")
                        ->orWhere('destination_url', 'like', "%{$term}%")
                        ->orWhere('destination_host', 'like', "%{$term}%")
                        ->orWhere('label', 'like', "%{$term}%");
                });
            })
            ->latest()
            ->paginate(50)
            ->through(fn (TrackedLink $link) => $this->serializeLink($link));

        return response()->json($links);
    }

    public function update(Request $request, TrackedLink $trackedLink, PulseNotificationService $notifications): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'paused', 'disabled'])],
            'moderation_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $metadata = $trackedLink->metadata ?: [];
        if (! empty($data['moderation_note'])) {
            $metadata['moderation_note'] = $data['moderation_note'];
            $metadata['moderated_by'] = $request->user()?->id;
            $metadata['moderated_at'] = now()->toISOString();
        }

        $trackedLink->update([
            'status' => $data['status'],
            'metadata' => $metadata,
        ]);

        $report = null;
        if ($data['status'] === 'disabled' && $trackedLink->merchant_id) {
            $report = ContentReport::query()->firstOrCreate(
                [
                    'merchant_id' => $trackedLink->merchant_id,
                    'item_type' => 'tracked_link',
                    'item_id' => $trackedLink->id,
                    'reason_code' => 'admin_disabled_link',
                ],
                [
                    'reporter_id' => $request->user()?->id,
                    'reason' => 'other',
                    'report_context' => 'tracked_link',
                    'notes' => $data['moderation_note'] ?? 'Disabled by Takeer safety review.',
                    'status' => 'resolved',
                    'safety_state' => 'restricted',
                    'evidence_url' => route('tracked-links.follow', $trackedLink->code),
                    'metadata' => [
                        'destination_url' => $trackedLink->destination_url,
                        'destination_host' => $trackedLink->destination_host,
                    ],
                    'reviewed_by_id' => $request->user()?->id,
                    'action_taken' => 'restrict_item',
                    'resolution_note' => $data['moderation_note'] ?? null,
                    'resolved_at' => now(),
                ]
            );
        }

        if (in_array($data['status'], ['active', 'disabled'], true)) {
            $notifications->trackedLinkModerated($trackedLink->fresh(['merchant.user']), $data['status'], $data['moderation_note'] ?? null, $report);
        }

        return response()->json([
            'message' => 'Tracked link updated.',
            'tracked_link' => $this->serializeLink($trackedLink->fresh(['merchant'])),
        ]);
    }

    private function serializeLink(TrackedLink $link): array
    {
        return [
            'id' => $link->id,
            'code' => $link->code,
            'tracked_url' => route('tracked-links.follow', $link->code),
            'destination_url' => $link->destination_url,
            'destination_host' => $link->destination_host,
            'label' => $link->label,
            'link_type' => $link->link_type,
            'source_surface' => $link->source_surface,
            'entity_type' => $link->entity_type,
            'entity_id' => $link->entity_id,
            'clicks_count' => $link->clicks_count,
            'last_clicked_at' => $link->last_clicked_at?->toISOString(),
            'status' => $link->status,
            'merchant' => $link->merchant ? [
                'id' => $link->merchant->id,
                'display_name' => $link->merchant->display_name,
                'username' => $link->merchant->username,
            ] : null,
            'open_reports_count' => (int) ($link->open_reports_count ?? 0),
            'total_reports_count' => (int) ($link->total_reports_count ?? 0),
            'metadata' => $link->metadata ?: [],
            'created_at' => $link->created_at?->toISOString(),
        ];
    }
}
