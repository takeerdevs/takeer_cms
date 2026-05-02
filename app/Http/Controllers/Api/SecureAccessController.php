<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BundleItem;
use App\Models\BundleLessonAsset;
use App\Models\ContentItem;
use App\Services\EntitlementService;
use App\Services\MediaUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class SecureAccessController extends Controller
{
    public function contentAccessLink(Request $request, int $contentItem, EntitlementService $entitlementService): JsonResponse
    {
        $item = ContentItem::withTrashed()->findOrFail($contentItem);

        $user = $request->user();
        $isOwner = $user?->merchantProfiles()->where('id', $item->merchant_id)->exists() ?? false;
        $isFree = $item->price === null;
        $hasEntitlement = $user ? $entitlementService->hasAccess($user->id, 'content_item', $item->id) : false;
        $hasAccess = $isOwner || $isFree || $hasEntitlement;
        $isPublished = $item->visibility === 'published';

        abort_unless($hasAccess && ($isPublished || $isOwner || $hasEntitlement), 403, 'You do not have access to this content.');

        $url = URL::temporarySignedRoute(
            'api.content-items.secure-body',
            now()->addMinutes(10),
            [
                'contentItem' => $item->id,
                'user' => $user->id,
            ]
        );

        return response()->json([
            'url' => $url,
            'expires_at' => now()->addMinutes(10)->toISOString(),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function contentBody(Request $request, int $contentItem, MediaUploadService $mediaService): JsonResponse
    {
        $item = ContentItem::withTrashed()->findOrFail($contentItem);
        abort_unless($request->hasValidSignature(), 403, 'Signed access is invalid or expired.');
        abort_unless((int) $request->query('user') === (int) $request->user()->id, 403, 'Signed access is not valid for this user.');

        $body = (string) ($item->body ?? '');
        $fileUrl = null;
        if (preg_match('/private:\/\/([^\s]+)/', $body, $matches)) {
            $fileUrl = $mediaService->getSignedUrl($matches[1], 60);
        }

        return response()->json([
            'id' => $item->id,
            'title' => $item->title,
            'body' => $item->body,
            'format' => $item->format,
            'file_url' => $fileUrl,
        ], 200, [
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
            'X-Robots-Tag' => 'noindex, noarchive, nosnippet',
        ]);
    }

    public function bundleItemMaterialAccessLink(
        Request $request,
        BundleItem $bundleItem,
        int $materialIndex,
        EntitlementService $entitlementService,
        MediaUploadService $mediaService
    ): JsonResponse {
        $bundleItem->loadMissing('bundle');
        $bundle = $bundleItem->bundle;
        abort_unless($bundle, 404, 'Bundle not found.');

        $user = $request->user();
        $isOwner = $user?->merchantProfiles()->where('id', $bundle->merchant_id)->exists() ?? false;
        $hasBundleAccess = $user ? $entitlementService->hasAccess($user->id, 'bundle', $bundle->id) : false;
        $hasItemAccess = $user ? $entitlementService->hasAccess($user->id, $bundleItem->item_type, (int) $bundleItem->item_id) : false;

        abort_unless($isOwner || $hasBundleAccess || $hasItemAccess, 403, 'You do not have access to this material.');

        $materials = $bundleItem->supporting_materials ?? [];
        $material = $materials[$materialIndex] ?? null;
        abort_unless(is_array($material) && !empty($material['url']), 404, 'Material not found.');

        $url = (string) $material['url'];
        if (str_starts_with($url, 'private://')) {
            $url = $mediaService->getSignedUrl(substr($url, strlen('private://')), 60);
        }

        return response()->json([
            'url' => $url,
            'name' => $material['name'] ?? 'Material',
            'expires_at' => now()->addMinutes(60)->toISOString(),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function bundleLessonAssetAccessLink(
        Request $request,
        BundleLessonAsset $asset,
        EntitlementService $entitlementService,
        MediaUploadService $mediaService
    ): JsonResponse {
        $asset->loadMissing('lesson.module.bundle');
        $bundle = $asset->lesson?->module?->bundle;
        abort_unless($bundle, 404, 'Course material not found.');

        $user = $request->user();
        $isOwner = $user?->merchantProfiles()->where('id', $bundle->merchant_id)->exists() ?? false;
        $hasBundleAccess = $user ? $entitlementService->hasAccess($user->id, 'bundle', $bundle->id) : false;
        $hasAssetAccess = false;

        if ($asset->asset_type !== 'file' && $asset->asset_id) {
            $hasAssetAccess = $user ? $entitlementService->hasAccess($user->id, $asset->asset_type, (int) $asset->asset_id) : false;
        }

        abort_unless($isOwner || $hasBundleAccess || $hasAssetAccess || $asset->lesson?->is_preview, 403, 'You do not have access to this course material.');

        if ($asset->asset_type !== 'file') {
            return response()->json([
                'url' => null,
                'name' => $asset->name ?? 'Course item',
                'asset_type' => $asset->asset_type,
                'asset_id' => $asset->asset_id,
            ])->header('Cache-Control', 'no-store, private');
        }

        $url = (string) $asset->url;
        abort_unless($url !== '', 404, 'Course material file not found.');

        if (str_starts_with($url, 'private://')) {
            $url = $mediaService->getSignedUrl(substr($url, strlen('private://')), 60);
        }

        return response()->json([
            'url' => $url,
            'name' => $asset->name ?? 'Course material',
            'expires_at' => now()->addMinutes(60)->toISOString(),
        ])->header('Cache-Control', 'no-store, private');
    }
}
