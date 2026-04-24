<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Merchant;
use App\Models\Order;
use App\Services\SmsService;
use App\Services\WaybillOcrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DispatchController extends Controller
{
    public function __construct(
        private SmsService $smsService,
        private WaybillOcrService $waybillOcrService
    )
    {
    }

    /**
     * POST /api/merchant/dispatch/{order}/intercity
     * Merchant uploads dispatch video + bus waybill photo
     */
    public function intercity(Request $request, Order $order): JsonResponse
    {
        $this->authorizeMerchantOrder($request, $order);
        $this->ensurePhysicalOrder($order);

        $validated = $request->validate([
            'dispatch_video' => 'required|file|mimetypes:video/mp4,video/quicktime,video/webm,video/x-matroska|max:51200',
            'transport_receipt' => 'required|image|max:10240',
            'bus_company' => 'nullable|string|max:120',
            'waybill_tracking_number' => 'nullable|string|max:100',
        ]);

        $videoPath = $request->file('dispatch_video')->store('dispatch-videos', 'public');
        $photoPath = $request->file('transport_receipt')->store('dispatch-receipts', 'public');

        $videoUrl = Storage::disk('public')->url($videoPath);
        $photoUrl = Storage::disk('public')->url($photoPath);
        $trackingNumber = trim((string) ($validated['waybill_tracking_number'] ?? ''));
        $busCompany = trim((string) ($validated['bus_company'] ?? ''));
        $ocr = null;

        if ($trackingNumber === '' || $busCompany === '') {
            try {
                $ocr = $this->waybillOcrService->extractFromReceipt($photoUrl);
                if ($busCompany === '' && !empty($ocr['bus_company'])) {
                    $busCompany = (string) $ocr['bus_company'];
                }
                if ($trackingNumber === '' && !empty($ocr['waybill_tracking_number'])) {
                    $trackingNumber = (string) $ocr['waybill_tracking_number'];
                }
            } catch (\Throwable $e) {
                Log::warning('Waybill OCR extraction failed', [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $trackingNumber = $trackingNumber !== '' ? $trackingNumber : ('BUS-' . strtoupper((string) str()->random(8)));
        $busCompany = $busCompany !== '' ? $busCompany : 'Intercity Bus';

        $order->update([
            'payment_status' => 'escrow_locked',
            'merchant_dispatch_video_url' => $videoUrl,
        ]);

        $pin = $order->delivery?->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        Delivery::updateOrCreate([
            'order_id' => $order->id,
        ], [
            'bus_company' => $busCompany,
            'waybill_photo_url' => $photoUrl,
            'waybill_tracking_number' => $trackingNumber,
            'delivery_status' => 'in_transit',
            'buyer_release_pin' => $pin,
        ]);

        // Trigger buyer SMS
        if (!empty($order->buyer?->phone_number)) {
            $this->smsService->sendDispatchNotification(
                $order->buyer->phone_number,
                $busCompany,
                $trackingNumber,
                $pin,
                $order->buyer_id
            );
        }

        return response()->json([
            'message' => 'Dispatch imehifadhiwa. Video na risiti ya usafirishaji zimepakiwa.',
            'delivery' => $order->delivery,
            'ocr' => $ocr,
        ]);
    }

    /**
     * POST /api/merchant/dispatch/{order}/local
     * Merchant assigns boda phone number
     */
    public function local(Request $request, Order $order): JsonResponse
    {
        $this->authorizeMerchantOrder($request, $order);
        $this->ensurePhysicalOrder($order);

        $validated = $request->validate([
            'dispatch_video' => 'required|file|mimetypes:video/mp4,video/quicktime,video/webm,video/x-matroska|max:51200',
            'boda_phone' => 'nullable|string',
        ]);

        $videoPath = $request->file('dispatch_video')->store('dispatch-videos', 'public');
        $videoUrl = Storage::disk('public')->url($videoPath);

        $order->update([
            'payment_status' => 'escrow_locked',
            'merchant_dispatch_video_url' => $videoUrl,
        ]);

        $pin = $order->delivery?->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        Delivery::updateOrCreate([
            'order_id' => $order->id,
        ], [
            'delivery_status' => 'awaiting_boda',
            'buyer_release_pin' => $pin,
            'boda_phone' => $validated['boda_phone'] ?? null,
        ]);

        return response()->json([
            'message' => 'Local dispatch imehifadhiwa.',
            'pin' => $pin, // Returned to display to merchant/boda
        ]);
    }

    private function authorizeMerchantOrder(Request $request, Order $order): Merchant
    {
        $merchant = Merchant::query()->findOrFail($order->merchant_id);
        abort_unless($merchant->user_id === $request->user()->id, 403);
        return $merchant;
    }

    private function ensurePhysicalOrder(Order $order): void
    {
        abort_unless(
            $order->purchasable_type === 'product' && $order->product && $order->product->type === 'physical',
            422,
            'Dispatch evidence inahitajika kwa physical products pekee.'
        );
    }
}
