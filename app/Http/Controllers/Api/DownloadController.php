<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Order;
use App\Models\Entitlement;
use App\Services\GalleryImageService;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadController extends Controller
{
    /**
     * Generate a secure, short-lived download link for a purchased digital product.
     * GET /api/orders/{order}/download
     */
    public function download(Request $request, Order $order)
    {
        $authorization = $this->authorizeDownload($request, $order);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $deliveryType = $order->product->digital_delivery_type ?? 'file';
        $isVideoStream = $deliveryType === 'video_stream';
        $isAudioStream = $deliveryType === 'audio_stream';
        $isGalleryPack = $deliveryType === 'gallery_pack';
        $isLiveEvent = $deliveryType === 'live_event';
        $isCustomDelivery = $deliveryType === 'custom_delivery';
        $licensePayload = $this->licenseKeyPayload($request, $order);

        if ($isCustomDelivery) {
            if (!$order->custom_delivery_file_url) {
                return response()->json([
                    'type' => 'custom_pending',
                    'digital_content_type' => $order->product->digital_content_type,
                    'digital_usage_license' => $order->product->digital_usage_license,
                    'digital_access_instructions' => $order->product->digital_access_instructions,
                    'message' => 'Merchant bado anaandaa custom delivery yako.',
                ], 202, [
                    'Cache-Control' => 'no-store, private',
                ]);
            }

            [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget((string) $order->custom_delivery_file_url);

            if (!$isPrivateReference) {
                $order->markDigitalAccessed('custom_delivery');

                return response()->json([
                    'type' => 'external',
                    'url' => $resolvedTarget,
                    'digital_content_type' => $order->product->digital_content_type,
                    'digital_usage_license' => $order->product->digital_usage_license,
                    'digital_access_instructions' => $order->custom_delivery_message ?: $order->product->digital_access_instructions,
                    'message' => 'Custom delivery yako ipo tayari.',
                ], 200, ['Cache-Control' => 'no-store, private']);
            }

            try {
                $disk = Storage::disk('s3');
                if ($disk->exists($resolvedTarget)) {
                    $order->markDigitalAccessed('custom_delivery');

                    return response()->json([
                        'type' => 'signed',
                        'url' => $disk->temporaryUrl($resolvedTarget, now()->addMinutes(10), [
                            'ResponseContentDisposition' => 'attachment; filename="' . ($order->custom_delivery_file_name ?: basename($resolvedTarget)) . '"',
                        ]),
                        'size' => $disk->size($resolvedTarget),
                        'digital_content_type' => $order->product->digital_content_type,
                        'digital_usage_license' => $order->product->digital_usage_license,
                        'digital_access_instructions' => $order->custom_delivery_message ?: $order->product->digital_access_instructions,
                        'message' => 'Custom delivery yako ipo tayari.',
                    ], 200, ['Cache-Control' => 'no-store, private']);
                }
            } catch (\Exception $e) {
                // S3 might not be configured or we are in local dev.
            }

            if (Storage::disk('local')->exists($resolvedTarget)) {
                $order->markDigitalAccessed('custom_delivery');

                return response()->json([
                    'type' => 'direct',
                    'url' => URL::temporarySignedRoute('web.download.custom-local', now()->addMinutes(10), [
                        'order' => $order->id,
                        'user' => $request->user()->id,
                    ]),
                    'size' => Storage::disk('local')->size($resolvedTarget),
                    'digital_content_type' => $order->product->digital_content_type,
                    'digital_usage_license' => $order->product->digital_usage_license,
                    'digital_access_instructions' => $order->custom_delivery_message ?: $order->product->digital_access_instructions,
                    'message' => 'Custom delivery yako ipo tayari.',
                ], 200, ['Cache-Control' => 'no-store, private']);
            }

            return response()->json(['message' => 'Custom delivery file haikupatikana.'], 404);
        }

        if ($isLiveEvent) {
            $order->markDigitalAccessed('live_event_access');

            return response()->json([
                'type' => 'live_event',
                'url' => route('product.show', ['product' => $order->product->slug ?: $order->product->id]),
                'digital_content_type' => $order->product->digital_content_type,
                'digital_usage_license' => $order->product->digital_usage_license,
                'digital_access_instructions' => $order->product->digital_access_instructions,
                'software_license_key' => $licensePayload,
                'message' => 'Live event/webinar yako ipo tayari ndani ya Takeer.',
            ], 200, [
                'Cache-Control' => 'no-store, private',
            ]);
        }

        if ($isGalleryPack) {
            $order->markDigitalAccessed('gallery_access');

            return response()->json([
                'type' => 'gallery',
                'url' => route('product.show', ['product' => $order->product->slug ?: $order->product->id]),
                'digital_content_type' => $order->product->digital_content_type,
                'digital_usage_license' => $order->product->digital_usage_license,
                'digital_access_instructions' => $order->product->digital_access_instructions,
                'software_license_key' => $licensePayload,
                'message' => 'Gallery pack yako ipo tayari ndani ya Takeer.',
            ], 200, [
                'Cache-Control' => 'no-store, private',
            ]);
        }

        if (($isVideoStream || $isAudioStream) && !($order->product->allow_download ?? false)) {
            $order->markDigitalAccessed($isAudioStream ? 'audio_stream' : 'video_stream');
            $hlsUrl = (!$isAudioStream && $order->product->premium_video_hls_path)
                ? route('product.video.hls', [
                    'product' => $order->product->slug ?: $order->product->id,
                    'path' => basename($order->product->premium_video_hls_path),
                ])
                : null;

            return response()->json([
                'type' => 'stream',
                'stream_kind' => $isAudioStream ? 'audio' : 'video',
                'url' => $isAudioStream
                    ? route('product.audio.stream', ['product' => $order->product->slug ?: $order->product->id])
                    : route('product.video.stream', ['product' => $order->product->slug ?: $order->product->id]),
                'hls_url' => $hlsUrl,
                'stream_status' => $isAudioStream ? null : $order->product->premium_video_status,
                'digital_content_type' => $order->product->digital_content_type,
                'digital_usage_license' => $order->product->digital_usage_license,
                'digital_access_instructions' => $order->product->digital_access_instructions,
                'software_license_key' => $licensePayload,
                'message' => $isAudioStream ? 'Audio hii inasikilizwa ndani ya Takeer.' : 'Video hii inatazamwa ndani ya Takeer.',
            ], 200, [
                'Cache-Control' => 'no-store, private',
            ]);
        }

        $url = (string) ($isVideoStream
            ? $order->product->paid_video_url
            : ($isAudioStream ? $order->product->paid_audio_url : $order->product->url));

        if (!$url) {
            return response()->json(['message' => 'Link ya bidhaa haikupatikana.'], 404);
        }

        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        // 4. If it's an external link (e.g. Google Drive), just return it
        if (!$isPrivateReference) {
            $order->markDigitalAccessed('external_link');

            return response()->json([
                'type' => 'external',
                'url' => $resolvedTarget,
                'digital_content_type' => $order->product->digital_content_type,
                'digital_usage_license' => $order->product->digital_usage_license,
                'digital_access_instructions' => $order->product->digital_access_instructions,
                'software_license_key' => $licensePayload,
                'message' => 'Hii ni link ya nje. Ihifadhiwe kwa uangalifu kwa kuwa mfumo wa nje unaweza kuruhusu kushirikishwa.'
            ], 200, [
                'Cache-Control' => 'no-store, private',
            ]);
        }

        // 5. It's a direct upload stored privately.
        $path = $resolvedTarget;

        // Try generating a temporary signed URL (S3)
        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($path)) {
                $order->markDigitalAccessed('download');

                $temporaryUrl = $disk->temporaryUrl($path, now()->addMinutes(10), [
                    'ResponseContentDisposition' => 'attachment; filename="' . basename($path) . '"',
                ]);
                
                $size = $disk->size($path);
                
                return response()->json([
                    'type' => 'signed',
                    'url' => $temporaryUrl,
                    'size' => $size,
                    'is_course' => false,
                    'digital_content_type' => $order->product->digital_content_type,
                    'digital_usage_license' => $order->product->digital_usage_license,
                    'digital_access_instructions' => $order->product->digital_access_instructions,
                    'software_license_key' => $licensePayload,
                    'message' => 'Link yako ya kupakua imeandaliwa (itadumu kwa dakika 10).'
                ], 200, [
                    'Cache-Control' => 'no-store, private',
                ]);
            }
        } catch (\Exception $e) {
            // S3 might not be configured or we are in local dev
        }

        // Fallback for local development environment
        $localDisk = Storage::disk('local');
        if ($localDisk->exists($path)) {
            $order->markDigitalAccessed('download');

            $temporaryLocalUrl = URL::temporarySignedRoute(
                'web.download.local',
                now()->addMinutes(10),
                [
                    'order' => $order->id,
                    'user' => $request->user()->id,
                ]
            );

            $size = $localDisk->size($path);

            return response()->json([
                'type' => 'direct',
                'url' => $temporaryLocalUrl,
                'size' => $size,
                'digital_content_type' => $order->product->digital_content_type,
                'digital_usage_license' => $order->product->digital_usage_license,
                'digital_access_instructions' => $order->product->digital_access_instructions,
                'software_license_key' => $licensePayload,
                'message' => 'Link yako ya kupakua imeandaliwa.'
            ], 200, [
                'Cache-Control' => 'no-store, private',
            ]);
        }

        return response()->json(['message' => 'Faili halikupatikana kwenye mfumo.'], 404);
    }

    public function entitlementAccess(Request $request, Entitlement $entitlement): JsonResponse
    {
        $authorization = $this->authorizeEntitlementDigitalAccess($request, $entitlement);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $product = Product::find($entitlement->item_id);
        if (!$product || !$product->isDigital()) {
            return response()->json(['message' => 'Bidhaa hii ya digital haikupatikana.'], 404);
        }

        $order = null;
        if ($entitlement->source_type === 'order' && $entitlement->source_id) {
            $order = Order::with('product')->find($entitlement->source_id);
            if ($order && (int) $order->buyer_id === (int) $request->user()->id) {
                return $this->download($request, $order);
            }
        }

        $deliveryType = $product->digital_delivery_type ?? 'file';
        $isVideoStream = $deliveryType === 'video_stream';
        $isAudioStream = $deliveryType === 'audio_stream';
        $isGalleryPack = $deliveryType === 'gallery_pack';
        $isLiveEvent = $deliveryType === 'live_event';

        if ($deliveryType === 'custom_delivery') {
            return response()->json([
                'type' => 'custom_pending',
                'digital_content_type' => $product->digital_content_type,
                'digital_usage_license' => $product->digital_usage_license,
                'digital_access_instructions' => $product->digital_access_instructions,
                'message' => 'Custom delivery inapatikana kwa manunuzi ya moja kwa moja ya bidhaa hii.',
            ], 422, ['Cache-Control' => 'no-store, private']);
        }

        if ($isLiveEvent) {
            return response()->json([
                'type' => 'live_event',
                'url' => route('product.show', ['product' => $product->slug ?: $product->id]),
                'digital_content_type' => $product->digital_content_type,
                'digital_usage_license' => $product->digital_usage_license,
                'digital_access_instructions' => $product->digital_access_instructions,
                'message' => 'Live event/webinar yako ipo tayari ndani ya Takeer.',
            ], 200, ['Cache-Control' => 'no-store, private']);
        }

        if ($isGalleryPack) {
            return response()->json([
                'type' => 'gallery',
                'url' => route('product.show', ['product' => $product->slug ?: $product->id]),
                'digital_content_type' => $product->digital_content_type,
                'digital_usage_license' => $product->digital_usage_license,
                'digital_access_instructions' => $product->digital_access_instructions,
                'message' => 'Gallery pack yako ipo tayari ndani ya Takeer.',
            ], 200, ['Cache-Control' => 'no-store, private']);
        }

        if (($isVideoStream || $isAudioStream) && !($product->allow_download ?? false)) {
            $hlsUrl = (!$isAudioStream && $product->premium_video_hls_path)
                ? route('product.video.hls', [
                    'product' => $product->slug ?: $product->id,
                    'path' => basename($product->premium_video_hls_path),
                ])
                : null;

            return response()->json([
                'type' => 'stream',
                'stream_kind' => $isAudioStream ? 'audio' : 'video',
                'url' => $isAudioStream
                    ? route('product.audio.stream', ['product' => $product->slug ?: $product->id])
                    : route('product.video.stream', ['product' => $product->slug ?: $product->id]),
                'hls_url' => $hlsUrl,
                'stream_status' => $isAudioStream ? null : $product->premium_video_status,
                'digital_content_type' => $product->digital_content_type,
                'digital_usage_license' => $product->digital_usage_license,
                'digital_access_instructions' => $product->digital_access_instructions,
                'message' => $isAudioStream ? 'Audio hii inasikilizwa ndani ya Takeer.' : 'Video hii inatazamwa ndani ya Takeer.',
            ], 200, ['Cache-Control' => 'no-store, private']);
        }

        $url = (string) ($isVideoStream
            ? $product->paid_video_url
            : ($isAudioStream ? $product->paid_audio_url : ($product->download_link ?: $product->url)));

        if (!$url) {
            return response()->json(['message' => 'Link ya bidhaa haikupatikana.'], 404);
        }

        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$isPrivateReference) {
            return response()->json([
                'type' => 'external',
                'url' => $resolvedTarget,
                'digital_content_type' => $product->digital_content_type,
                'digital_usage_license' => $product->digital_usage_license,
                'digital_access_instructions' => $product->digital_access_instructions,
                'message' => 'Hii ni link ya nje. Ihifadhiwe kwa uangalifu kwa kuwa mfumo wa nje unaweza kuruhusu kushirikishwa.',
            ], 200, ['Cache-Control' => 'no-store, private']);
        }

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($resolvedTarget)) {
                return response()->json([
                    'type' => 'signed',
                    'url' => $disk->temporaryUrl($resolvedTarget, now()->addMinutes(10), [
                        'ResponseContentDisposition' => 'attachment; filename="' . basename($resolvedTarget) . '"',
                    ]),
                    'size' => $disk->size($resolvedTarget),
                    'is_course' => false,
                    'digital_content_type' => $product->digital_content_type,
                    'digital_usage_license' => $product->digital_usage_license,
                    'digital_access_instructions' => $product->digital_access_instructions,
                    'message' => 'Link yako ya kupakua imeandaliwa (itadumu kwa dakika 10).',
                ], 200, ['Cache-Control' => 'no-store, private']);
            }
        } catch (\Exception $e) {
            // S3 might not be configured or we are in local dev.
        }

        if (Storage::disk('local')->exists($resolvedTarget)) {
            return response()->json([
                'type' => 'direct',
                'url' => URL::temporarySignedRoute('web.download.entitlement-local', now()->addMinutes(10), [
                    'entitlement' => $entitlement->id,
                    'user' => $request->user()->id,
                ]),
                'size' => Storage::disk('local')->size($resolvedTarget),
                'digital_content_type' => $product->digital_content_type,
                'digital_usage_license' => $product->digital_usage_license,
                'digital_access_instructions' => $product->digital_access_instructions,
                'message' => 'Link yako ya kupakua imeandaliwa.',
            ], 200, ['Cache-Control' => 'no-store, private']);
        }

        return response()->json(['message' => 'Faili halikupatikana kwenye mfumo.'], 404);
    }

    /**
     * Local development fallback to stream the file directly.
     * GET /api/orders/{order}/download/local
     */
    public function downloadLocal(Request $request, Order $order): StreamedResponse|JsonResponse
    {
        if (!$request->hasValidSignature() || (int) $request->query('user') !== (int) $request->user()->id) {
            return response()->json(['message' => 'Kiungo hiki si halali au muda wake umeisha.'], 403);
        }

        $authorization = $this->authorizeDownload($request, $order);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $deliveryType = $order->product->digital_delivery_type ?? 'file';
        $url = (string) ($deliveryType === 'video_stream'
            ? $order->product->paid_video_url
            : ($deliveryType === 'audio_stream' ? $order->product->paid_audio_url : $order->product->url));
        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$url || !$isPrivateReference) {
            abort(404);
        }

        $path = $resolvedTarget;
        
        if (!Storage::disk('local')->exists($path)) {
            abort(404);
        }

        $mimeType = Storage::disk('local')->mimeType($path);
        
        return Storage::disk('local')->download($path, basename($path), [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }

    public function downloadCustomLocal(Request $request, Order $order): StreamedResponse|JsonResponse
    {
        if (!$request->hasValidSignature() || (int) $request->query('user') !== (int) $request->user()->id) {
            return response()->json(['message' => 'Kiungo hiki si halali au muda wake umeisha.'], 403);
        }

        $authorization = $this->authorizeDownload($request, $order);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        if (($order->product->digital_delivery_type ?? null) !== 'custom_delivery' || !$order->custom_delivery_file_url) {
            abort(404);
        }

        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget((string) $order->custom_delivery_file_url);
        if (!$isPrivateReference || !Storage::disk('local')->exists($resolvedTarget)) {
            abort(404);
        }

        return Storage::disk('local')->download($resolvedTarget, $order->custom_delivery_file_name ?: basename($resolvedTarget), [
            'Content-Type' => $order->custom_delivery_file_mime ?: Storage::disk('local')->mimeType($resolvedTarget),
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }

    public function downloadEntitlementLocal(Request $request, Entitlement $entitlement): StreamedResponse|JsonResponse
    {
        if (!$request->hasValidSignature() || (int) $request->query('user') !== (int) $request->user()->id) {
            return response()->json(['message' => 'Kiungo hiki si halali au muda wake umeisha.'], 403);
        }

        $authorization = $this->authorizeEntitlementDigitalAccess($request, $entitlement);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $product = Product::find($entitlement->item_id);
        $deliveryType = $product?->digital_delivery_type ?? 'file';
        $url = (string) ($deliveryType === 'video_stream'
            ? $product?->paid_video_url
            : ($deliveryType === 'audio_stream' ? $product?->paid_audio_url : ($product?->download_link ?: $product?->url)));
        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$url || !$isPrivateReference || !Storage::disk('local')->exists($resolvedTarget)) {
            abort(404);
        }

        $mimeType = Storage::disk('local')->mimeType($resolvedTarget);

        return Storage::disk('local')->download($resolvedTarget, basename($resolvedTarget), [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }

    public function streamProductVideo(Request $request, Product $product)
    {
        $authorization = $this->authorizeProductVideoStream($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $url = (string) ($product->paid_video_url ?? '');
        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$url) {
            return response()->json(['message' => 'Video haikupatikana.'], 404);
        }

        if (!$isPrivateReference) {
            return redirect()->away($resolvedTarget);
        }

        $path = $resolvedTarget;

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($path)) {
                return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(20)));
            }
        } catch (\Exception $e) {
            // S3 might not be configured or we are in local dev.
        }

        if (!Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'Video haikupatikana kwenye mfumo.'], 404);
        }

        $mimeType = $product->paid_video_mime ?: Storage::disk('local')->mimeType($path) ?: 'video/mp4';

        return Storage::disk('local')->response($path, basename($path), [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.basename($path).'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function streamProductAudio(Request $request, Product $product)
    {
        $authorization = $this->authorizeProductAudioStream($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $url = (string) ($product->paid_audio_url ?? '');
        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$url) {
            return response()->json(['message' => 'Audio haikupatikana.'], 404);
        }

        if (!$isPrivateReference) {
            return redirect()->away($resolvedTarget);
        }

        $path = $resolvedTarget;

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($path)) {
                return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(20)));
            }
        } catch (\Exception $e) {
            // S3 might not be configured or we are in local dev.
        }

        if (!Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'Audio haikupatikana kwenye mfumo.'], 404);
        }

        $mimeType = $product->paid_audio_mime ?: Storage::disk('local')->mimeType($path) ?: 'audio/mpeg';

        return Storage::disk('local')->response($path, basename($path), [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.basename($path).'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function readProductDocument(Request $request, Product $product)
    {
        $authorization = $this->authorizeProductDigitalAccess($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        if (($product->digital_delivery_type ?? 'file') !== 'file') {
            return response()->json(['message' => 'Document reader haipatikani kwa delivery mode hii.'], 400);
        }

        $url = (string) ($product->download_link ?: $product->url ?: '');
        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$url || strtolower(pathinfo(parse_url($resolvedTarget, PHP_URL_PATH) ?: $resolvedTarget, PATHINFO_EXTENSION)) !== 'pdf') {
            return response()->json(['message' => 'PDF haikupatikana kwa kusoma online.'], 404);
        }

        if (!$isPrivateReference) {
            return redirect()->away($resolvedTarget);
        }

        $path = $resolvedTarget;

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($path)) {
                return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(20), [
                    'ResponseContentDisposition' => 'inline; filename="' . basename($path) . '"',
                    'ResponseContentType' => 'application/pdf',
                ]));
            }
        } catch (\Exception) {
            // S3 might not be configured or we are in local dev.
        }

        if (!Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'PDF haikupatikana kwenye mfumo.'], 404);
        }

        return Storage::disk('local')->response($path, basename($path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.basename($path).'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function streamProductGalleryItem(Request $request, Product $product, int $index)
    {
        $authorization = $this->authorizeProductGalleryAccess($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $product->loadMissing('merchant');
        $this->refreshLegacyGalleryPreview($product, $index);

        $items = collect($product->paid_gallery_items ?: [])->values();
        $item = $items->get($index);
        $previewUrl = (string) ($item['preview_url'] ?? '');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $request->user()->id;
        if ($previewUrl === '' && !$isOwner && !($product->allow_download ?? false)) {
            return response()->json(['message' => 'Preview bado haijaandaliwa.'], 404);
        }

        $url = (string) ($previewUrl ?: ($item['url'] ?? ''));
        $mime = (string) (($item['preview_mime'] ?? null) ?: ($item['mime'] ?? ''));

        return $this->serveGalleryImage($url, $mime, false);
    }

    private function refreshLegacyGalleryPreview(Product $product, int $index): void
    {
        $items = collect($product->paid_gallery_items ?: [])->values();
        $item = $items->get($index);
        if (!is_array($item)) {
            return;
        }

        $previewUrl = (string) ($item['preview_url'] ?? '');
        if (!str_contains($previewUrl, 'premium-gallery/previews/') || str_contains($previewUrl, '-v2.webp')) {
            return;
        }

        $watermark = 'Takeer / @'.($product->merchant?->username ?: $product->title);
        $prepared = app(GalleryImageService::class)->prepareItem($item, $watermark);
        if (($prepared['preview_url'] ?? null) === $previewUrl) {
            return;
        }

        $items[$index] = $prepared;
        $product->forceFill(['paid_gallery_items' => $items->values()->all()])->saveQuietly();
    }

    public function downloadProductGalleryOriginal(Request $request, Product $product, int $index)
    {
        $authorization = $this->authorizeProductGalleryAccess($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $product->loadMissing('merchant');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $request->user()->id;
        if (!$isOwner && !($product->allow_download ?? false)) {
            return response()->json(['message' => 'Creator amezima kupakua original images.'], 403);
        }

        $items = collect($product->paid_gallery_items ?: [])->values();
        $item = $items->get($index);
        $url = (string) ($item['url'] ?? '');
        $mime = (string) ($item['mime'] ?? '');

        return $this->serveGalleryImage($url, $mime, true);
    }

    private function serveGalleryImage(string $url, string $mime, bool $download)
    {
        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        if (!$url || !$isPrivateReference) {
            abort(404);
        }

        $diskName = null;
        $disk = null;
        foreach (['s3', 'local'] as $candidate) {
            try {
                if (Storage::disk($candidate)->exists($resolvedTarget)) {
                    $diskName = $candidate;
                    $disk = Storage::disk($candidate);
                    break;
                }
            } catch (\Exception) {
                // Disk may not be configured in local development.
            }
        }

        if (!$disk) {
            abort(404);
        }

        if ($diskName === 's3') {
            $options = $download
                ? ['ResponseContentDisposition' => 'attachment; filename="' . basename($resolvedTarget) . '"']
                : ['ResponseContentDisposition' => 'inline; filename="' . basename($resolvedTarget) . '"'];

            return redirect()->away($disk->temporaryUrl($resolvedTarget, now()->addMinutes(20), $options));
        }

        $mimeType = $mime ?: $disk->mimeType($resolvedTarget) ?: 'image/jpeg';
        $disposition = $download ? 'attachment' : 'inline';

        return $disk->response($resolvedTarget, basename($resolvedTarget), [
            'Content-Type' => $mimeType,
            'Content-Disposition' => $disposition.'; filename="'.basename($resolvedTarget).'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function streamProductVideoHls(Request $request, Product $product, string $path)
    {
        $authorization = $this->authorizeProductVideoStream($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $hlsPath = trim((string) ($product->premium_video_hls_path ?? ''), '/');
        if ($hlsPath === '') {
            return response()->json(['message' => 'Video bado inaandaliwa.'], 404);
        }

        $requested = trim(str_replace('\\', '/', $path), '/');
        if ($requested === '' || str_contains($requested, '..')) {
            abort(404);
        }

        $baseDir = trim(dirname($hlsPath), '. /');
        $targetPath = $baseDir.'/'.$requested;
        $diskName = $product->premium_video_hls_disk ?: 'local';
        $disk = Storage::disk($diskName);

        if (!$disk->exists($targetPath)) {
            abort(404);
        }

        $extension = strtolower(pathinfo($targetPath, PATHINFO_EXTENSION));
        $contentType = match ($extension) {
            'm3u8' => 'application/vnd.apple.mpegurl',
            'ts' => 'video/mp2t',
            'm4s' => 'video/iso.segment',
            'mp4' => 'video/mp4',
            'key' => 'application/octet-stream',
            default => $disk->mimeType($targetPath) ?: 'application/octet-stream',
        };

        return response($disk->get($targetPath), 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => $extension === 'm3u8' ? 'no-store, private' : 'private, max-age=300',
        ]);
    }

    /**
     * Send download link to user via SMS (simulated).
     * POST /api/orders/{order}/send-download-link
     */
    public function sendDownloadLink(Request $request, Order $order): JsonResponse
    {
        $authorization = $this->authorizeDownload($request, $order);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $order->loadMissing(['buyer', 'product']);
        $phone = $order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone;
        if (!$phone) {
            return response()->json(['message' => 'Namba ya simu haikupatikana kwa oda hii.'], 422);
        }

        $sent = app(SmsService::class)->sendDigitalDeliveryNotification(
            $phone,
            (string) ($order->product->title ?? 'bidhaa yako'),
            url('/orders'),
            $order->buyer_id,
        );
        
        return response()->json([
            'message' => $sent
                ? 'Kiungo kimetumwa kwenye namba yako ya simu.'
                : 'Tumeandaa notification kwenye outbox, lakini provider hajathibitisha kutuma SMS.',
            'sent' => $sent,
        ]);
    }

    private function authorizeDownload(Request $request, Order $order): JsonResponse|true
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Hauruhusiwi kupakua bidhaa hii.'], 403);
        }

        if (!$order->product || !$order->product->isDigital()) {
            return response()->json(['message' => 'Hii si bidhaa ya kimtandao.'], 400);
        }

        if (!in_array($order->payment_status, ['escrow_locked', 'resolved_merchant_paid'])) {
            return response()->json(['message' => 'Tafadhali kamilisha malipo kwanza.'], 402);
        }

        return true;
    }

    private function licenseKeyPayload(Request $request, Order $order): ?array
    {
        $product = $order->product;
        if (!$product || ($product->digital_content_type ?? null) !== 'software') {
            return null;
        }

        $license = \App\Models\ProductLicenseKey::query()
            ->where('product_id', $product->id)
            ->where('order_id', $order->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->latest('issued_at')
            ->latest('id')
            ->first();

        return $license ? [
            'id' => $license->id,
            'key' => $license->license_key,
            'status' => $license->status,
            'issued_at' => $license->issued_at?->toISOString(),
            'offline_license_url' => route('api.orders.license-file', ['order' => $order->id]),
        ] : null;
    }

    private function authorizeProductVideoStream(Request $request, Product $product): JsonResponse|true
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia kwanza.'], 401);
        }

        if (!$product->isDigital() || ($product->digital_delivery_type ?? 'file') !== 'video_stream') {
            return response()->json(['message' => 'Hii si premium video.'], 400);
        }

        $product->loadMissing('merchant');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $user->id;
        $hasEntitlement = $this->hasActiveProductEntitlement((int) $user->id, (int) $product->id);

        if (!$isOwner && !$hasEntitlement) {
            return response()->json(['message' => 'Nunua video hii kwanza ili kuitazama.'], 403);
        }

        return true;
    }

    private function authorizeProductAudioStream(Request $request, Product $product): JsonResponse|true
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia kwanza.'], 401);
        }

        if (!$product->isDigital() || ($product->digital_delivery_type ?? 'file') !== 'audio_stream') {
            return response()->json(['message' => 'Hii si premium audio.'], 400);
        }

        $product->loadMissing('merchant');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $user->id;
        $hasEntitlement = $this->hasActiveProductEntitlement((int) $user->id, (int) $product->id);

        if (!$isOwner && !$hasEntitlement) {
            return response()->json(['message' => 'Nunua audio hii kwanza ili kuisikiliza.'], 403);
        }

        return true;
    }

    private function authorizeProductGalleryAccess(Request $request, Product $product): JsonResponse|true
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia kwanza.'], 401);
        }

        if (!$product->isDigital() || ($product->digital_delivery_type ?? 'file') !== 'gallery_pack') {
            return response()->json(['message' => 'Hii si gallery pack.'], 400);
        }

        $product->loadMissing('merchant');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $user->id;
        $hasEntitlement = $this->hasActiveProductEntitlement((int) $user->id, (int) $product->id);

        if (!$isOwner && !$hasEntitlement) {
            return response()->json(['message' => 'Nunua gallery pack hii kwanza.'], 403);
        }

        return true;
    }

    private function authorizeProductDigitalAccess(Request $request, Product $product): JsonResponse|true
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia kwanza.'], 401);
        }

        if (!$product->isDigital()) {
            return response()->json(['message' => 'Hii si bidhaa ya digital.'], 400);
        }

        $product->loadMissing('merchant');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $user->id;
        $hasEntitlement = $this->hasActiveProductEntitlement((int) $user->id, (int) $product->id);

        if (!$isOwner && !$hasEntitlement) {
            return response()->json(['message' => 'Nunua bidhaa hii kwanza ili kuifungua.'], 403);
        }

        return true;
    }

    /**
     * Resolve whether a digital target is a private stored file or an external URL.
     * Supports both normalized `private://path` and legacy raw `digital-products/...` values.
     *
     * @return array{0: bool, 1: string}
     */
    private function resolveDigitalTarget(string $value): array
    {
        $trimmed = trim($value);

        if ($trimmed === '') {
            return [false, ''];
        }

        if (str_starts_with($trimmed, 'private://')) {
            return [true, ltrim(str_replace('private://', '', $trimmed), '/')];
        }

        // Any explicit URI scheme (http, https, ftp, etc.) should be treated as external.
        if (preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $trimmed)) {
            return [false, $trimmed];
        }

        // Legacy behavior: raw storage paths were persisted directly for private uploads.
        return [true, ltrim($trimmed, '/')];
    }

    private function authorizeEntitlementDigitalAccess(Request $request, Entitlement $entitlement): JsonResponse|true
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia kwanza.'], 401);
        }

        if ((int) $entitlement->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Hauruhusiwi kufungua bidhaa hii.'], 403);
        }

        if ($entitlement->item_type !== 'product' || !$this->entitlementIsActive($entitlement)) {
            return response()->json(['message' => 'Access ya bidhaa hii haipo active kwa sasa.'], 403);
        }

        return true;
    }

    private function hasActiveProductEntitlement(int $userId, int $productId): bool
    {
        return Entitlement::query()
            ->where('user_id', $userId)
            ->where('item_type', 'product')
            ->where('item_id', $productId)
            ->where('status', 'active')
            ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    private function entitlementIsActive(Entitlement $entitlement): bool
    {
        return $entitlement->status === 'active'
            && (!$entitlement->starts_at || $entitlement->starts_at->lte(now()))
            && (!$entitlement->expires_at || $entitlement->expires_at->gt(now()));
    }
}
