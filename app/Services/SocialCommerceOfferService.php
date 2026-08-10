<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SocialCommerceRequest;
use App\Models\User;
use App\Events\SocialCommerceOnboardingCompleted;
use App\Events\SocialCommerceOfferReady;
use App\Events\SocialCommerceRequestClosed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SocialCommerceOfferService
{
    public function __construct(
        private readonly SocialCommerceAuditService $audit,
        private readonly SocialCommerceFastPathService $fastPath,
    ) {}

    public function matchProduct(SocialCommerceRequest $request, User $user, int $productId, ?Request $httpRequest = null): SocialCommerceRequest
    {
        $merchant = $this->merchantFor($request, $user);
        $product = Product::query()->whereKey($productId)->where('merchant_id', $merchant->id)->firstOrFail();
        $this->assertSellableProduct($merchant, $product);

        if (in_array($request->status, [SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING], true) && !$merchant->canSellProducts()) {
            throw ValidationException::withMessages(['merchant' => 'Complete merchant and PSP onboarding before offering a product.']);
        }

        return DB::transaction(function () use ($request, $product, $httpRequest, $user): SocialCommerceRequest {
            $locked = SocialCommerceRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $from = $locked->status;
            if ($from === SocialCommerceRequest::CLAIMED || $from === SocialCommerceRequest::ONBOARDING) {
                $locked->transitionTo(SocialCommerceRequest::PRODUCT_SETUP);
            }
            if (!in_array($locked->status, [SocialCommerceRequest::PRODUCT_SETUP, SocialCommerceRequest::OFFER_READY], true)) {
                throw ValidationException::withMessages(['request' => 'This request is not ready for product setup.']);
            }
            $locked->update(['product_id' => $product->id]);
            $this->fastPath->mapRequestProduct($locked->fresh(['claimedMerchant']), $product, $user);
            $this->audit->record($locked, 'social_product_matched', $from, $locked->status, $httpRequest, $user->id, 'user', 'internal', ['product_id' => $product->id]);
            $matched = $locked->fresh(['product', 'claimedMerchant']);
            if ($from === SocialCommerceRequest::ONBOARDING) {
                event(new SocialCommerceOnboardingCompleted($matched));
            }
            return $matched;
        });
    }

    public function createProduct(SocialCommerceRequest $request, User $user, array $data, ?Request $httpRequest = null): SocialCommerceRequest
    {
        $merchant = $this->merchantFor($request, $user);
        if (!$merchant->canSellProducts()) {
            throw ValidationException::withMessages(['merchant' => 'Complete merchant and PSP onboarding before creating a product.']);
        }

        return DB::transaction(function () use ($request, $merchant, $data, $httpRequest, $user): SocialCommerceRequest {
            $product = Product::create([
                'merchant_id' => $merchant->id,
                'created_by_user_id' => $user->id,
                'type' => 'physical',
                'title' => trim((string) $data['title']),
                'slug' => Str::slug($data['title']) . '-' . Str::lower(Str::random(5)),
                'price' => $data['price'] ?? 0,
                'currency_id' => $data['currency_id'] ?? $merchant->currency_id,
                'inventory_count' => $data['inventory_count'] ?? 0,
                'buffer_stock' => $data['buffer_stock'] ?? 0,
                'fulfillment_mode' => $data['fulfillment_mode'] ?? 'merchant_fulfilled',
                'source_details' => ['origin' => 'social_commerce_request', 'request_public_id' => $request->public_id],
            ]);
            $this->audit->record($request, 'social_product_created', $request->status, $request->status, $httpRequest, $user->id, 'user', 'internal', ['product_id' => $product->id]);
            $request->update(['product_id' => $product->id]);
            $this->fastPath->mapRequestProduct($request->fresh(['claimedMerchant']), $product, $user);
            return $request->fresh(['product', 'claimedMerchant']);
        });
    }

    public function createOffer(SocialCommerceRequest $request, User $user, array $data, ?Request $httpRequest = null): SocialCommerceRequest
    {
        $merchant = $this->merchantFor($request, $user);
        if (!$merchant->canSellProducts()) {
            throw ValidationException::withMessages(['merchant' => 'This merchant profile is not eligible to sell.']);
        }

        $product = Product::query()->whereKey((int) ($data['product_id'] ?? $request->product_id))->where('merchant_id', $merchant->id)->firstOrFail();
        $this->assertSellableProduct($merchant, $product);
        $quantity = (float) ($data['quantity'] ?? $request->requested_quantity ?? 1);
        if ($quantity <= 0 || $quantity > $this->stockFor($product, $data['variant_id'] ?? null)) {
            throw ValidationException::withMessages(['quantity' => 'The confirmed quantity is not currently in stock.']);
        }

        $expiresAt = now()->addHours((int) config('social_commerce.offer_expiry_hours', 48));
        return DB::transaction(function () use ($request, $product, $merchant, $data, $quantity, $expiresAt, $httpRequest, $user): SocialCommerceRequest {
            $locked = SocialCommerceRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            if (!in_array($locked->status, [SocialCommerceRequest::PRODUCT_SETUP, SocialCommerceRequest::OFFER_READY], true)) {
                throw ValidationException::withMessages(['request' => 'This request is not ready for an offer.']);
            }
            $unitPrice = round((float) $data['unit_price'], 2);
            $shippingFee = round((float) ($data['shipping_fee'] ?? 0), 2);
            $discount = round((float) ($data['discount'] ?? 0), 2);
            if ($discount > round($unitPrice * $quantity + $shippingFee, 2)) {
                throw ValidationException::withMessages(['discount' => 'The discount cannot exceed the quoted product and delivery value.']);
            }
            $snapshot = [
                'revision' => (int) data_get($locked->offer_snapshot, 'revision', 0) + 1,
                'request_public_id' => $locked->public_id,
                'merchant_id' => $merchant->id,
                'product_id' => $product->id,
                'variant_id' => $data['variant_id'] ?? null,
                'product_title' => $product->title,
                'sku' => $data['sku'] ?? null,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'shipping_fee' => $shippingFee,
                'discount' => $discount,
                'total' => round(($unitPrice * $quantity) + $shippingFee - $discount, 2),
                'currency_code' => strtoupper((string) ($data['currency_code'] ?? 'TZS')),
                'stock_confirmed' => true,
                'delivery_type' => $data['delivery_type'] ?? 'local_boda',
                'destination_summary' => $data['destination_summary'] ?? $locked->destination_summary,
                'delivery_estimate' => $data['delivery_estimate'] ?? null,
                'return_policy' => $data['return_policy'] ?? null,
                'seller_confirmed_at' => now()->toISOString(),
                'offer_expires_at' => $expiresAt->toISOString(),
                'source_url_hash' => $locked->url_hash,
                'platform' => $locked->platform,
                'terms_version' => $data['terms_version'] ?? null,
            ];
            $from = $locked->status;
            if ($locked->status === SocialCommerceRequest::PRODUCT_SETUP) {
                $locked->transitionTo(SocialCommerceRequest::OFFER_READY);
            }
            $locked->forceFill(['product_id' => $product->id, 'offer_snapshot' => $snapshot, 'offer_expires_at' => $expiresAt, 'offer_ready_at' => now(), 'lock_version' => (int) $locked->lock_version + 1])->save();
            $this->audit->record($locked, 'social_offer_ready', $from, SocialCommerceRequest::OFFER_READY, $httpRequest, $user->id, 'user', 'internal', ['revision' => $snapshot['revision'], 'product_id' => $product->id]);
            $ready = $locked->fresh(['product', 'claimedMerchant', 'buyer']);
            event(new SocialCommerceOfferReady($ready));
            return $ready;
        });
    }

    public function sendOffer(SocialCommerceRequest $request, User $user, ?Request $httpRequest = null): SocialCommerceRequest
    {
        $merchant = $this->merchantFor($request, $user);
        if ($request->status !== SocialCommerceRequest::OFFER_READY || !$request->offer_expires_at?->isFuture()) {
            throw ValidationException::withMessages(['offer' => 'This offer is expired or not ready to send.']);
        }
        $this->audit->record($request, 'social_offer_sent', $request->status, $request->status, $httpRequest, $user->id, 'user', 'internal', ['revision' => data_get($request->offer_snapshot, 'revision')]);
        \App\Jobs\SendSocialCommerceOfferToBuyer::dispatch($request->id);
        return $request->fresh(['product', 'claimedMerchant', 'buyer']);
    }

    public function decline(SocialCommerceRequest $request, User $user, string $reason, ?Request $httpRequest = null): SocialCommerceRequest
    {
        $this->merchantFor($request, $user);
        return DB::transaction(function () use ($request, $user, $reason, $httpRequest): SocialCommerceRequest {
            $locked = $this->audit->transition($request, SocialCommerceRequest::DECLINED, 'social_request_declined', $httpRequest, $user->id, 'internal', ['reason' => $reason]);
            $locked->update(['declined_at' => now(), 'closed_reason' => $reason]);
            $declined = $locked->fresh();
            event(new SocialCommerceRequestClosed($declined));
            return $declined;
        });
    }

    public function merchantFor(SocialCommerceRequest $request, User $user)
    {
        $merchant = $request->claimedMerchant;
        if (!$merchant || (int) $merchant->user_id !== (int) $user->id || $merchant->is_suspended || !$merchant->is_active) {
            throw ValidationException::withMessages(['merchant' => 'You do not have access to this merchant request.']);
        }
        return $merchant;
    }

    private function assertSellableProduct($merchant, Product $product): void
    {
        if ($product->type !== 'physical' || (int) $product->merchant_id !== (int) $merchant->id || $product->trashed()) {
            throw ValidationException::withMessages(['product_id' => 'Select a physical product owned by the claimed merchant.']);
        }
    }

    private function stockFor(Product $product, ?int $variantId): float
    {
        if ($variantId) {
            $variant = ProductVariant::query()->whereKey($variantId)->where('product_id', $product->id)->where('is_active', true)->first();
            return $variant ? max(0, (float) ($variant->inventory_quantity ?? $variant->inventory_count)) : 0;
        }
        return max(0, (float) ($product->inventory_quantity ?? $product->inventory_count));
    }
}
