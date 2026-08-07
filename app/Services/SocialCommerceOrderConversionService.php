<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SocialCommerceRequest;
use App\Models\User;
use App\Events\SocialCommerceOfferAccepted;
use App\Events\SocialCommerceRequestConverted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SocialCommerceOrderConversionService
{
    public function __construct(
        private readonly PhysicalInquiryOrderService $physicalInquiryOrders,
        private readonly SocialCommerceAuditService $audit,
    ) {}

    public function accept(SocialCommerceRequest $request, User $buyer, array $data, ?Request $httpRequest = null): \App\Models\Order
    {
        if ((int) $request->buyer_id !== (int) $buyer->id) {
            throw ValidationException::withMessages(['request' => 'You are not allowed to accept this offer.']);
        }

        if (!$request->offer_expires_at?->isFuture()) {
            throw ValidationException::withMessages(['offer' => 'This offer has expired. Ask the seller for a new offer.']);
        }

        return DB::transaction(function () use ($request, $buyer, $data, $httpRequest): \App\Models\Order {
            $lockedRequest = SocialCommerceRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            if ($lockedRequest->order_id) {
                return $lockedRequest->order()->with(['delivery', 'product', 'merchant'])->firstOrFail();
            }
            if ($lockedRequest->status !== SocialCommerceRequest::OFFER_READY || !$lockedRequest->offer_expires_at?->isFuture()) {
                throw ValidationException::withMessages(['offer' => 'This offer is expired or no longer available.']);
            }

            $offer = (array) $lockedRequest->offer_snapshot;
            $product = Product::query()->whereKey($lockedRequest->product_id)->lockForUpdate()->first();
            if (!$product || !$lockedRequest->claimedMerchant || (int) $product->merchant_id !== (int) $lockedRequest->claimed_merchant_id || !$lockedRequest->claimedMerchant->canSellProducts()) {
                throw ValidationException::withMessages(['product' => 'The seller or product is no longer eligible.']);
            }
        if ($product->type !== 'physical') {
            throw ValidationException::withMessages(['product' => 'Only physical products can be converted from a social offer.']);
        }

        if (!empty($data['delivery_type']) && ($offer['delivery_type'] ?? null) !== $data['delivery_type']) {
            throw ValidationException::withMessages(['delivery_type' => 'Delivery method changed. Ask the seller to revise the offer.']);
        }

            $variantId = $offer['variant_id'] ?? null;
            $stock = $this->stockFor($product, $variantId);
            if ((float) ($offer['quantity'] ?? 1) > $stock) {
                throw ValidationException::withMessages(['quantity' => 'The confirmed stock is no longer available. Ask the seller to revise the offer.']);
            }

            $submittedShipping = array_key_exists('shipping_fee', $data) ? round((float) $data['shipping_fee'], 2) : (float) ($offer['shipping_fee'] ?? 0);
            if (abs($submittedShipping - (float) ($offer['shipping_fee'] ?? 0)) > 0.01) {
                throw ValidationException::withMessages(['shipping_fee' => 'Shipping changed. Ask the seller to revise the offer.']);
            }

            $physicalAddress = trim((string) ($data['physical_address'] ?? ''));
            if (mb_strlen($physicalAddress) < 3) {
                throw ValidationException::withMessages(['physical_address' => 'A final delivery address or landmark is required.']);
            }

            $order = $this->physicalInquiryOrders->create([
                'buyer' => $buyer,
                'merchant' => $lockedRequest->claimedMerchant,
                'product' => $product,
                'variant_id' => $variantId,
                'variant_snapshot' => $this->variantSnapshot($variantId, $product),
                'offer' => $offer,
                'social_commerce_request_id' => $lockedRequest->id,
                'idempotency_key' => 'social-offer:' . $lockedRequest->id . ':' . ($data['idempotency_key'] ?? $lockedRequest->idempotency_key),
                'physical_address' => $physicalAddress,
                'buyer_lat' => $data['buyer_lat'] ?? null,
                'buyer_lng' => $data['buyer_lng'] ?? null,
                'user_address_id' => $data['user_address_id'] ?? null,
                'payment_phone' => $data['payment_phone'] ?? $buyer->phone_number,
                'shipping_zone_id' => $data['shipping_zone_id'] ?? null,
                'buyer_acceptance' => [
                    'accepted_at' => now()->toISOString(),
                    'accepted_by_user_id' => $buyer->id,
                    'accept_terms' => (bool) ($data['accept_terms'] ?? false),
                    'legal_versions' => $data['legal_versions'] ?? [],
                    'delivery_context' => ['city' => $data['customer_city'] ?? null, 'region' => $data['customer_region'] ?? null],
                ],
            ]);

            $from = $lockedRequest->status;
            $lockedRequest->transitionTo(SocialCommerceRequest::CONVERTED);
            $lockedRequest->forceFill(['order_id' => $order->id, 'converted_at' => now(), 'closed_reason' => 'order_created', 'lock_version' => (int) $lockedRequest->lock_version + 1])->save();
            $this->audit->record($lockedRequest, 'social_order_created', $from, SocialCommerceRequest::CONVERTED, $httpRequest, $buyer->id, 'user', 'internal', ['order_id' => $order->id]);
            $converted = $lockedRequest->fresh(['product', 'claimedMerchant', 'order']);
            event(new SocialCommerceOfferAccepted($converted));
            event(new SocialCommerceRequestConverted($converted));

            return $order;
        });
    }

    private function stockFor(Product $product, ?int $variantId): float
    {
        if ($variantId) {
            $variant = ProductVariant::query()->whereKey($variantId)->where('product_id', $product->id)->where('is_active', true)->first();
            return $variant ? max(0, (float) ($variant->inventory_quantity ?? $variant->inventory_count)) : 0;
        }
        return max(0, (float) ($product->inventory_quantity ?? $product->inventory_count));
    }

    private function variantSnapshot(?int $variantId, Product $product): ?array
    {
        if (!$variantId) return null;
        $variant = ProductVariant::query()->whereKey($variantId)->where('product_id', $product->id)->first();
        return $variant ? ['id' => $variant->id, 'name' => $variant->name, 'sku' => $variant->sku, 'attributes' => $variant->attributes ?? []] : null;
    }
}
