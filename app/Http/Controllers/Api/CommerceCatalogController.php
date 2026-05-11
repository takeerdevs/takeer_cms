<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BundleResource;
use App\Http\Resources\ContentItemResource;
use App\Http\Resources\SubscriptionPlanResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\SubscriptionPlan;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CommerceCatalogController extends Controller
{
    public function showContentItem(Request $request, ContentItem $contentItem, EntitlementService $entitlementService): JsonResponse
    {
        abort_if($contentItem->visibility !== 'published', 404);

        $user = $request->user();
        $isOwner = $user?->merchantProfiles()->where('id', $contentItem->merchant_id)->exists() ?? false;
        $isFree = $contentItem->price === null;
        $hasAccess = $isOwner || $isFree || ($user && $entitlementService->hasAccess($user->id, 'content_item', $contentItem->id));
        $previewBody = null;
        if (!$hasAccess) {
            if ($contentItem->format === 'plain_text') {
                $previewBody = 'Unlock this short post to read the full text.';
            } else {
                $previewBody = Str::limit(trim(strip_tags((string) $contentItem->body)), 220);
            }
        }

        $payload = ContentItemResource::make($contentItem->loadMissing('merchant'))->resolve($request);
        $payload['excerpt'] = trim((string) preg_replace('/\s*Tap unlock to continue\.\s*$/i', '', (string) ($payload['excerpt'] ?? '')));
        if (!$hasAccess && $contentItem->price !== null && $contentItem->format === 'plain_text') {
            $payload['excerpt'] = null;
        }
        $payload['body'] = $hasAccess ? $contentItem->body : null;

        return response()->json([
            'content_item' => $payload,
            'has_access' => (bool) $hasAccess,
            'preview_body' => $previewBody,
            'locked_reason' => $hasAccess ? null : 'Purchase or subscribe to unlock the full content.',
        ]);
    }

    public function showBundle(Bundle $bundle): JsonResponse
    {
        abort_if($bundle->status !== 'published', 404);

        return response()->json([
            'bundle' => BundleResource::make($bundle->loadMissing(['merchant', 'items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts'])),
        ]);
    }

    public function showSubscriptionPlan(SubscriptionPlan $subscriptionPlan): JsonResponse
    {
        abort_if($subscriptionPlan->status !== 'active', 404);

        return response()->json([
            'subscription_plan' => SubscriptionPlanResource::make($subscriptionPlan->loadMissing(['merchant', 'items'])),
        ]);
    }
}
