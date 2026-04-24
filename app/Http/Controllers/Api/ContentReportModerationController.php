<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentReport;
use App\Models\Merchant;
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
            ->paginate(30);

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

        $contentReport->update([
            'status' => $validated['status'],
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

    public function adminIndex(Request $request): JsonResponse
    {
        $reports = ContentReport::with(['merchant:id,display_name,username', 'reporter:id,name,phone_number', 'reviewedBy:id,name'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->paginate(50);

        return response()->json($reports);
    }

    public function adminResolve(Request $request, ContentReport $contentReport): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:under_review,resolved,dismissed',
            'resolution_note' => 'nullable|string|max:2000',
            'action_taken' => 'nullable|in:none,warn_content,suspend_merchant,ban_reporter',
        ]);

        $resolved = in_array($validated['status'], ['resolved', 'dismissed'], true);
        $actionTaken = $validated['action_taken'] ?? 'none';

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

        $contentReport->update([
            'status' => $validated['status'],
            'reviewed_by_id' => $request->user()->id,
            'resolution_note' => $validated['resolution_note'] ?? null,
            'action_taken' => $actionTaken,
            'resolved_at' => $resolved ? now() : null,
        ]);

        return response()->json([
            'message' => 'Report resolved.',
            'report' => $contentReport->fresh(['merchant', 'reporter', 'reviewedBy']),
        ]);
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
