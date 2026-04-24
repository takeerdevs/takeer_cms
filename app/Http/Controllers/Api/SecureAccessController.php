<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentItem;
use App\Services\EntitlementService;
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
        $hasAccess = $isOwner || $isFree || $entitlementService->hasAccess($user->id, 'content_item', $item->id);
        $isPublished = $item->visibility === 'published';

        abort_unless($hasAccess && ($isPublished || $isOwner), 403, 'You do not have access to this content.');

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

    public function contentBody(Request $request, int $contentItem): JsonResponse
    {
        $item = ContentItem::withTrashed()->findOrFail($contentItem);
        abort_unless($request->hasValidSignature(), 403, 'Signed access is invalid or expired.');
        abort_unless((int) $request->query('user') === (int) $request->user()->id, 403, 'Signed access is not valid for this user.');

        return response()->json([
            'id' => $item->id,
            'title' => $item->title,
            'body' => $item->body,
            'format' => $item->format,
        ], 200, [
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
            'X-Robots-Tag' => 'noindex, noarchive, nosnippet',
        ]);
    }
}
