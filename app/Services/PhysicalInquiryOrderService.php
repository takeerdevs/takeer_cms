<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PhysicalInquiryOrderService
{
    /**
     * Shared aggregate creation path for the existing quote-first checkout.
     * The caller prepares validated pricing/fulfillment snapshots; this service
     * owns the order, delivery, and initial order-chat records.
     */
    public function createFromCheckout(array $orderAttributes, ?array $deliveryAttributes = null): Order
    {
        $order = Order::create($orderAttributes);

        if ($deliveryAttributes !== null) {
            Delivery::create(array_merge(['order_id' => $order->id], $deliveryAttributes));
        }

        $this->initializeCheckoutChat($order);

        return $order->fresh(['delivery', 'product', 'merchant.user', 'buyer']);
    }

    public function create(array $input): Order
    {
        $buyer = $input['buyer'];
        $product = $input['product'];
        $merchant = $input['merchant'];
        $offer = $input['offer'];
        $quantity = (float) ($offer['quantity'] ?? 1);
        $unitPrice = (float) ($offer['unit_price'] ?? 0);
        $shippingFee = (float) ($offer['shipping_fee'] ?? 0);
        $total = (float) ($offer['total'] ?? (($unitPrice * $quantity) + $shippingFee));
        $currency = strtoupper((string) ($offer['currency_code'] ?? 'TZS'));

        $order = Order::create([
            'buyer_id' => $buyer->id,
            'user_address_id' => $input['user_address_id'] ?? null,
            'merchant_id' => $merchant->id,
            'social_commerce_request_id' => $input['social_commerce_request_id'] ?? null,
            'product_id' => $product->id,
            'variant_id' => $input['variant_id'] ?? null,
            'variant_snapshot' => $input['variant_snapshot'] ?? null,
            'purchasable_type' => 'product',
            'purchasable_id' => $product->id,
            'order_kind' => 'one_time',
            'quantity' => (int) ceil($quantity),
            'requested_quantity' => $quantity,
            'unit_price' => $unitPrice,
            'total_paid' => $total,
            'merchant_currency_code' => $currency,
            'customer_currency_code' => $currency,
            'merchant_unit_price' => $unitPrice,
            'customer_unit_price' => $unitPrice,
            'merchant_total_amount' => $total,
            'customer_total_amount' => $total,
            'merchant_shipping_fee' => $shippingFee,
            'customer_shipping_fee' => $shippingFee,
            'shipping_fee' => $shippingFee,
            'payment_status' => 'pending',
            'is_inquiry' => true,
            'inquiry_status' => 'quoted',
            'merchant_confirmed_at' => now(),
            'agreement_snapshot' => [
                'source' => 'social_commerce',
                'social_commerce_request_id' => $input['social_commerce_request_id'] ?? null,
                'offer_snapshot' => $offer,
                'buyer_acceptance' => $input['buyer_acceptance'] ?? null,
            ],
            'idempotency_key' => $input['idempotency_key'],
            'transaction_ref' => 'INQ-' . Str::upper(Str::random(10)),
            'account_phone' => $buyer->phone_number,
            'payment_phone' => $input['payment_phone'] ?? $buyer->phone_number,
            'country_code' => 'TZ',
            'source' => 'online',
            'expires_at' => now()->addDays(7),
        ]);

        Delivery::create([
            'order_id' => $order->id,
            'shipping_zone_id' => $input['shipping_zone_id'] ?? null,
            'delivery_type' => $offer['delivery_type'] ?? 'local_boda',
            'physical_address' => $input['physical_address'] ?? null,
            'latitude' => $input['buyer_lat'] ?? null,
            'longitude' => $input['buyer_lng'] ?? null,
            'delivery_status' => 'inquiry',
            'buyer_release_pin' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
        ]);

        $this->initializeChat($order, $buyer, $merchant->user, $product);
        return $order->fresh(['delivery', 'product', 'merchant', 'socialCommerceRequest']);
    }

    private function initializeChat(Order $order, User $buyer, User $merchantUser, Product $product): void
    {
        $title = $product->title;
        Message::create(['order_id' => $order->id, 'sender_id' => $buyer->id, 'receiver_id' => $merchantUser->id, 'type' => 'system', 'body' => "Takeer social-commerce offer accepted for {$title}. Confirm final delivery details in this order chat.", 'payload' => ['source' => 'social_commerce']]);
        Message::create(['order_id' => $order->id, 'sender_id' => $merchantUser->id, 'receiver_id' => $buyer->id, 'type' => 'system', 'body' => "The seller-confirmed offer for {$title} is ready. Payment is available through Takeer PSP checkout only.", 'payload' => ['source' => 'social_commerce']]);
    }

    private function initializeCheckoutChat(Order $order): void
    {
        $order->loadMissing(['product', 'delivery', 'merchant.user', 'buyer']);

        $merchantUser = $order->merchant?->user;
        $buyerUser = $order->buyer;
        if (!$merchantUser || !$buyerUser) {
            return;
        }

        $product = $order->product;
        $title = $product?->title ?? $order->resolved_purchasable?->title ?? 'order yako';
        $merchantBody = "Habari, order mpya imewekwa kwa ajili ya: {$title}.\n";
        $buyerBody = "Habari, order yako imeanzishwa kwa ajili ya: {$title}.\n";
        $deliveryType = $order->delivery?->delivery_type;
        $isPhysical = $product?->isPhysical() || $order->requiresPhysicalFulfillment();
        $isDigital = $product?->isDigital();
        $isService = $product?->isService();
        $isCustomDigital = $isDigital && ($product?->digital_delivery_type === 'custom_delivery');

        if ($isPhysical && $deliveryType === 'self_pickup') {
            $merchantBody .= 'Mteja amechagua KUCHUKUA DUKANI. Thibitisha stock/uwezo wa kutimiza order ili mteja aweze kulipa. Baada ya malipo, Takeer itamtumia mteja Pickup PIN.';
            $buyerBody .= 'Umechagua KUCHUKUA DUKANI. Subiri muuzaji athibitishe kuwa order ipo; baada ya hapo utaweza kulipia. Ukishalipa, Takeer itakutumia Pickup PIN.';
        } elseif ($isService && $order->is_inquiry) {
            $merchantBody .= 'Hii ni enquiry ya huduma. Tafadhali ongea na mteja hapa, mkubaliane mahitaji na bei ya huduma, kisha tuma offer ya mwisho.';
            $buyerBody .= 'Ombi lako la huduma limefika kwa muuzaji. Mtakubaliana mahitaji na bei hapa kwenye chat kabla ya malipo.';
        } elseif ($isDigital && $order->is_inquiry) {
            $merchantBody .= $isCustomDigital
                ? 'Hii ni enquiry ya digital custom work. Tafadhali ongea na mteja hapa, mkubaliane scope, files za kukabidhi, deadline, revisions, na bei ya mwisho kabla ya kutuma offer.'
                : 'Hii ni enquiry ya digital order. Tafadhali tumia chat kukubaliana access, format, deadline au mahitaji yoyote kabla ya kutuma offer ya mwisho.';
            $buyerBody .= $isCustomDigital
                ? 'Ombi lako la digital custom work limefika kwa muuzaji. Mtakubaliana scope, files za mwisho, deadline, revisions, na bei hapa kwenye chat kabla ya malipo.'
                : 'Ombi lako la digital order limefika kwa muuzaji. Mtakubaliana access, format, deadline au mahitaji yoyote hapa kwenye chat kabla ya malipo.';
        } elseif ($isPhysical && $order->is_inquiry) {
            $merchantBody .= 'Haya ni mapendekezo ya usafirishaji. Tafadhali hakiki/rekebisha gharama ya usafiri na uthibitishe stock/uwezo wa kutimiza order.';
            $buyerBody .= 'Tumeangalia eneo lako na kupata makadirio ya usafiri. Subiri muuzaji ahakiki gharama na kuthibitisha kuwa order ipo kabla ya kulipa.';
        } elseif ($order->is_inquiry) {
            $merchantBody .= 'Hii ni enquiry ya order. Tafadhali ongea na mteja hapa, mkubaliane mahitaji, muda, na bei ya mwisho kabla ya kutuma offer.';
            $buyerBody .= 'Ombi lako limefika kwa muuzaji. Mtakubaliana mahitaji, muda, na bei hapa kwenye chat kabla ya malipo.';
        } else {
            $merchantBody .= 'Malipo yamefanikiwa na yamethibitishwa na PSP. Tafadhali anza mchakato wa kutimiza order.';
            $buyerBody .= 'Malipo yamefanikiwa na yamethibitishwa na PSP. Muuzaji ataanza mchakato wa kukutumia order.';
        }

        Message::create([
            'order_id' => $order->id,
            'sender_id' => $buyerUser->id,
            'receiver_id' => $merchantUser->id,
            'type' => 'system',
            'body' => $merchantBody,
            'payload' => ['buyer_body' => $buyerBody, 'merchant_body' => $merchantBody, 'source' => 'physical_inquiry_service'],
        ]);
    }
}
