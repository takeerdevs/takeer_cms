<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
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

        $url = (string) ($order->product->url ?? '');

        if (!$url) {
            return response()->json(['message' => 'Link ya bidhaa haikupatikana.'], 404);
        }

        [$isPrivateReference, $resolvedTarget] = $this->resolveDigitalTarget($url);

        // 4. If it's an external link (e.g. Google Drive), just return it
        if (!$isPrivateReference) {
            return response()->json([
                'type' => 'external',
                'url' => $resolvedTarget,
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
                $temporaryUrl = $disk->temporaryUrl($path, now()->addMinutes(10), [
                    'ResponseContentDisposition' => 'attachment; filename="' . basename($path) . '"',
                ]);
                
                $size = $disk->size($path);
                
                return response()->json([
                    'type' => 'signed',
                    'url' => $temporaryUrl,
                    'size' => $size,
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
                'message' => 'Link yako ya kupakua imeandaliwa.'
            ], 200, [
                'Cache-Control' => 'no-store, private',
            ]);
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

        $url = (string) ($order->product->url ?? '');
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

        // Logic to send SMS would go here
        // For now, we simulate success
        
        return response()->json([
            'message' => 'Kiungo cha kupakua kimetumwa kwenye namba yako ya simu.',
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
}
