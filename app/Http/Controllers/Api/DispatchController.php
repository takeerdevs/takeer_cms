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
     * Merchant uploads packing proof + bus waybill photo
     */
    public function intercity(Request $request, Order $order): JsonResponse
    {
        $this->authorizeMerchantOrder($request, $order);
        $this->ensurePhysicalOrder($order);
        $this->ensurePaidDispatchableOrder($order);

        $validated = $request->validate([
            'dispatch_video' => 'required|file|mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska|max:51200',
            'transport_receipt' => 'required|image|max:10240',
            'bus_company' => 'nullable|string|max:120',
            'waybill_tracking_number' => 'nullable|string|max:100',
        ]);

        $videoPath = $request->file('dispatch_video')->store('dispatch-proofs', 'public');
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
            'merchant_confirmed_at' => $order->merchant_confirmed_at ?: now(),
        ]);

        $pin = $order->delivery?->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        $delivery = Delivery::updateOrCreate([
            'order_id' => $order->id,
        ], [
            'delivery_type' => 'intercity_bus',
            'shipping_zone_id' => $order->delivery?->shipping_zone_id,
            'shipping_hotspot_id' => $order->delivery?->shipping_hotspot_id,
            'physical_address' => $order->delivery?->physical_address,
            'latitude' => $order->delivery?->latitude,
            'longitude' => $order->delivery?->longitude,
            'bus_company' => $busCompany,
            'waybill_photo_url' => $photoUrl,
            'waybill_tracking_number' => $trackingNumber,
            'delivery_status' => 'in_transit',
            'buyer_release_pin' => $pin,
        ]);

        $delivery->events()->create([
            'order_id' => $order->id,
            'status' => 'in_transit',
            'actor_type' => 'merchant',
            'actor_user_id' => $request->user()?->id,
            'proof_url' => $videoUrl,
            'proof_mime' => $request->file('dispatch_video')->getClientMimeType(),
            'proof_type' => str_starts_with((string) $request->file('dispatch_video')->getClientMimeType(), 'image/') ? 'photo' : 'video',
            'note' => 'Intercity dispatch confirmed.',
            'metadata' => [
                'mode' => 'intercity',
                'bus_company' => $busCompany,
                'waybill_tracking_number' => $trackingNumber,
                'waybill_photo_url' => $photoUrl,
            ],
        ]);

        // Trigger buyer SMS
        if (!empty($order->buyer?->phone_number)) {
            $this->smsService->sendIntercityDispatchNotification(
                $order->buyer->phone_number,
                (string) ($order->public_id ?: $order->id),
                $busCompany,
                $trackingNumber,
                $pin,
                $order->buyer_id
            );
        }

        return response()->json([
            'message' => 'Dispatch imehifadhiwa. Packing proof na risiti ya usafirishaji zimepakiwa.',
            'delivery' => $order->fresh('delivery')->delivery,
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
        $this->ensurePaidDispatchableOrder($order);

        $validated = $request->validate([
            'dispatch_video' => 'required|file|mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska|max:51200',
            'boda_phone' => 'nullable|string',
            'delivery_person_name' => 'nullable|string|max:120',
        ]);

        $videoPath = $request->file('dispatch_video')->store('dispatch-proofs', 'public');
        $videoUrl = Storage::disk('public')->url($videoPath);

        $order->update([
            'payment_status' => 'escrow_locked',
            'merchant_dispatch_video_url' => $videoUrl,
            'merchant_confirmed_at' => $order->merchant_confirmed_at ?: now(),
        ]);

        $pin = $order->delivery?->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        $delivery = Delivery::updateOrCreate([
            'order_id' => $order->id,
        ], [
            'delivery_type' => 'local_boda',
            'shipping_zone_id' => $order->delivery?->shipping_zone_id,
            'shipping_hotspot_id' => $order->delivery?->shipping_hotspot_id,
            'physical_address' => $order->delivery?->physical_address,
            'latitude' => $order->delivery?->latitude,
            'longitude' => $order->delivery?->longitude,
            'delivery_status' => 'with_boda',
            'buyer_release_pin' => $pin,
            'boda_phone' => $validated['boda_phone'] ?? null,
            'delivery_person_name' => $validated['delivery_person_name'] ?? null,
        ]);

        $delivery->events()->create([
            'order_id' => $order->id,
            'status' => 'with_boda',
            'actor_type' => 'merchant',
            'actor_user_id' => $request->user()?->id,
            'proof_url' => $videoUrl,
            'proof_mime' => $request->file('dispatch_video')->getClientMimeType(),
            'proof_type' => str_starts_with((string) $request->file('dispatch_video')->getClientMimeType(), 'image/') ? 'photo' : 'video',
            'note' => 'Local delivery dispatched.',
            'metadata' => [
                'mode' => 'local',
                'boda_phone' => $validated['boda_phone'] ?? null,
                'delivery_person_name' => $validated['delivery_person_name'] ?? null,
            ],
        ]);

        if (!empty($order->buyer?->phone_number)) {
            $this->smsService->sendLocalDispatchNotification(
                $order->buyer->phone_number,
                (string) ($order->public_id ?: $order->id),
                $pin,
                $validated['boda_phone'] ?? null,
                $order->buyer_id
            );
        }

        return response()->json([
            'message' => 'Local dispatch imehifadhiwa.',
            'pin' => $pin, // Returned to display to merchant/boda
            'delivery' => $order->fresh('delivery')->delivery,
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
            $order->requiresPhysicalFulfillment(),
            422,
            'Dispatch evidence inahitajika kwa physical products pekee.'
        );
    }

    private function ensurePaidDispatchableOrder(Order $order): void
    {
        abort_unless(
            in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked'], true),
            422,
            'Order must be paid before dispatch.'
        );

        abort_if(
            $order->delivery?->delivery_type === 'self_pickup',
            422,
            'Self-pickup orders are completed with the pickup PIN, not dispatch.'
        );
    }
}
