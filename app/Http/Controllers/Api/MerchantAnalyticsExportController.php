<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantAbandonedCheckoutAutomation;
use App\Models\MerchantCoupon;
use App\Models\MerchantGroupSaleCampaign;
use App\Models\MerchantReferralLink;
use App\Models\MerchantSmsCampaign;
use App\Models\Order;
use App\Models\Product;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class MerchantAnalyticsExportController extends Controller
{
    private const PAID_STATUSES = ['escrow_locked', 'resolved_merchant_paid'];
    private const RELEASED_STATUS = 'resolved_merchant_paid';

    public function orders(Request $request, Merchant $merchant)
    {
        $this->authorizeMerchant($request, $merchant);

        $query = $this->ordersQuery($request, $merchant)
            ->with(['buyer:id,name,phone', 'product:id,title,type,digital_delivery_type,digital_content_type']);

        return $this->csv("takeer-orders-{$merchant->username}.csv", [
            'order_id',
            'public_id',
            'created_at',
            'buyer_name',
            'buyer_phone',
            'item_title',
            'order_kind',
            'payment_status',
            'quantity',
            'subtotal',
            'discount_amount',
            'total_paid',
            'coupon_code',
            'referral_code',
            'referral_commission_amount',
            'source',
            'payment_gateway',
            'country_code',
        ], function ($handle) use ($query) {
            $query->orderByDesc('created_at')->cursor()->each(function (Order $order) use ($handle) {
                fputcsv($handle, [
                    $order->id,
                    $order->public_id,
                    $this->dateValue($order->created_at),
                    $order->buyer?->name ?: $order->customer_name,
                    $order->buyer?->phone ?: $order->customer_phone ?: $order->payment_phone,
                    $this->orderTitle($order),
                    $order->order_kind ?: $order->purchasable_type ?: 'product',
                    $order->payment_status,
                    (int) ($order->quantity ?: 1),
                    $this->money(((float) $order->unit_price) * (int) ($order->quantity ?: 1)),
                    $this->money($order->discount_amount),
                    $this->money($order->total_paid),
                    $order->coupon_code,
                    $order->referral_code,
                    $this->money($order->referral_commission_amount),
                    $order->source,
                    $order->payment_gateway,
                    $order->country_code,
                ]);
            });
        });
    }

    public function statement(Request $request, Merchant $merchant)
    {
        $this->authorizeMerchant($request, $merchant);

        $query = $this->ordersQuery($request, $merchant)
            ->whereIn('payment_status', self::PAID_STATUSES)
            ->with(['buyer:id,name,phone', 'product:id,title,type,digital_delivery_type,digital_content_type']);

        return $this->csv("takeer-statement-{$merchant->username}.csv", [
            'date',
            'order_id',
            'public_id',
            'buyer',
            'item_title',
            'payment_status',
            'payout_state',
            'gross_amount',
            'platform_fee',
            'net_amount',
            'currency',
            'transaction_reference',
            'coupon_code',
            'referral_code',
        ], function ($handle) use ($query) {
            $query->orderByDesc('created_at')->cursor()->each(function (Order $order) use ($handle) {
                $transaction = Transaction::query()
                    ->where('order_id', $order->id)
                    ->latest('id')
                    ->first();

                fputcsv($handle, [
                    $this->dateValue($order->created_at),
                    $order->id,
                    $order->public_id,
                    $order->buyer?->name ?: $order->customer_name ?: 'Customer',
                    $this->orderTitle($order),
                    $order->payment_status,
                    $order->payment_status === self::RELEASED_STATUS ? 'released' : 'pending_release',
                    $this->money($transaction?->gross_amount ?? $order->total_paid),
                    $this->money($transaction?->fee_amount ?? 0),
                    $this->money($transaction?->net_amount ?? $order->total_paid),
                    $transaction?->currency_code ?: $order->merchant?->currency?->code ?: 'TZS',
                    $transaction?->reference ?: $order->transaction_ref ?: $order->gateway_ref,
                    $order->coupon_code,
                    $order->referral_code,
                ]);
            });
        });
    }

    public function productPerformance(Request $request, Merchant $merchant)
    {
        $this->authorizeMerchant($request, $merchant);

        $range = $this->dateRange($request);
        $orderAggregate = Order::query()
            ->selectRaw('product_id, COUNT(*) as orders_count, SUM(total_paid) as gross_revenue')
            ->selectRaw("SUM(CASE WHEN payment_status = ? THEN total_paid ELSE 0 END) as released_revenue", [self::RELEASED_STATUS])
            ->selectRaw("SUM(CASE WHEN payment_status = ? THEN total_paid ELSE 0 END) as pending_revenue", ['escrow_locked'])
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('product_id')
            ->whereIn('payment_status', self::PAID_STATUSES)
            ->when($range['from'], fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
            ->when($range['to'], fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
            ->groupBy('product_id');

        $products = Product::query()
            ->from('products')
            ->leftJoinSub($orderAggregate, 'order_stats', 'order_stats.product_id', '=', 'products.id')
            ->where('products.merchant_id', $merchant->id)
            ->select([
                'products.id',
                'products.title',
                'products.type',
                'products.digital_delivery_type',
                'products.digital_content_type',
                'products.price',
                'products.discounted_price',
                'products.views_count',
            ])
            ->selectRaw('COALESCE(order_stats.orders_count, 0) as orders_count')
            ->selectRaw('COALESCE(order_stats.gross_revenue, 0) as gross_revenue')
            ->selectRaw('COALESCE(order_stats.released_revenue, 0) as released_revenue')
            ->selectRaw('COALESCE(order_stats.pending_revenue, 0) as pending_revenue')
            ->orderByDesc('gross_revenue');

        return $this->csv("takeer-product-performance-{$merchant->username}.csv", [
            'product_id',
            'title',
            'type',
            'delivery_type',
            'content_label',
            'views',
            'orders',
            'price',
            'discounted_price',
            'gross_revenue',
            'released_revenue',
            'pending_revenue',
        ], function ($handle) use ($products) {
            $products->cursor()->each(function ($product) use ($handle) {
                fputcsv($handle, [
                    $product->id,
                    $product->title,
                    $product->type,
                    $product->digital_delivery_type,
                    $product->digital_content_type,
                    (int) ($product->views_count ?? 0),
                    (int) ($product->orders_count ?? 0),
                    $this->money($product->price),
                    $this->money($product->discounted_price),
                    $this->money($product->gross_revenue),
                    $this->money($product->released_revenue),
                    $this->money($product->pending_revenue),
                ]);
            });
        });
    }

    public function campaigns(Request $request, Merchant $merchant)
    {
        $this->authorizeMerchant($request, $merchant);

        $range = $this->dateRange($request);

        return $this->csv("takeer-campaigns-{$merchant->username}.csv", [
            'campaign_type',
            'name',
            'code_or_slug',
            'status',
            'created_at',
            'starts_at',
            'ends_at',
            'clicks_or_reach',
            'redemptions_or_conversions',
            'revenue',
            'spend_or_credits',
            'landing_url',
        ], function ($handle) use ($merchant, $range) {
            MerchantCoupon::query()
                ->where('merchant_id', $merchant->id)
                ->when($range['from'], fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
                ->when($range['to'], fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
                ->orderByDesc('created_at')
                ->cursor()
                ->each(function (MerchantCoupon $coupon) use ($handle, $merchant) {
                    fputcsv($handle, [
                        'coupon',
                        $coupon->name,
                        $coupon->code,
                        $coupon->status,
                        $this->dateValue($coupon->created_at),
                        $this->dateValue($coupon->starts_at),
                        $this->dateValue($coupon->ends_at),
                        '',
                        (int) $coupon->times_used,
                        $this->money($coupon->orders()->whereIn('payment_status', self::PAID_STATUSES)->sum('total_paid')),
                        $this->discountLabel($coupon->discount_type, $coupon->discount_value),
                        route('campaign.show', ['merchant' => $merchant->username, 'code' => $coupon->code]),
                    ]);
                });

            MerchantReferralLink::query()
                ->where('merchant_id', $merchant->id)
                ->when($range['from'], fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
                ->when($range['to'], fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
                ->orderByDesc('created_at')
                ->cursor()
                ->each(function (MerchantReferralLink $referral) use ($handle) {
                    fputcsv($handle, [
                        'referral',
                        $referral->label,
                        $referral->code,
                        $referral->status,
                        $this->dateValue($referral->created_at),
                        $this->dateValue($referral->starts_at),
                        $this->dateValue($referral->ends_at),
                        (int) $referral->clicks_count,
                        (int) $referral->conversions_count,
                        $this->money($referral->revenue_amount),
                        $this->discountLabel($referral->reward_type, $referral->reward_value),
                        route('referral.follow', ['code' => $referral->code]),
                    ]);
                });

            MerchantGroupSaleCampaign::query()
                ->where('merchant_id', $merchant->id)
                ->when($range['from'], fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
                ->when($range['to'], fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
                ->orderByDesc('created_at')
                ->cursor()
                ->each(function (MerchantGroupSaleCampaign $campaign) use ($handle) {
                    fputcsv($handle, [
                        'group_sale',
                        $campaign->title,
                        $campaign->slug,
                        $campaign->status,
                        $this->dateValue($campaign->created_at),
                        $this->dateValue($campaign->starts_at),
                        $this->dateValue($campaign->ends_at),
                        (int) $campaign->reserved_quantity,
                        (int) $campaign->converted_quantity,
                        $this->money(((float) $campaign->campaign_price) * (int) $campaign->converted_quantity),
                        '',
                        route('group-sale.show', ['slug' => $campaign->slug]),
                    ]);
                });

            MerchantSmsCampaign::query()
                ->where('merchant_id', $merchant->id)
                ->when($range['from'], fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
                ->when($range['to'], fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
                ->orderByDesc('created_at')
                ->cursor()
                ->each(function (MerchantSmsCampaign $campaign) use ($handle) {
                    fputcsv($handle, [
                        'sms',
                        $campaign->name,
                        $campaign->audience_type,
                        $campaign->status,
                        $this->dateValue($campaign->created_at),
                        $this->dateValue($campaign->scheduled_at),
                        $this->dateValue($campaign->sent_at),
                        (int) $campaign->sent_count,
                        '',
                        '',
                        (int) $campaign->estimated_credits,
                        '',
                    ]);
                });

            MerchantAbandonedCheckoutAutomation::query()
                ->where('merchant_id', $merchant->id)
                ->orderByDesc('created_at')
                ->cursor()
                ->each(function (MerchantAbandonedCheckoutAutomation $automation) use ($handle) {
                    fputcsv($handle, [
                        'abandoned_checkout',
                        'Abandoned checkout recovery',
                        $automation->coupon_code,
                        $automation->is_enabled ? 'active' : 'paused',
                        $this->dateValue($automation->created_at),
                        '',
                        '',
                        $automation->recoveries()->count(),
                        $automation->recoveries()->where('status', 'sent')->count(),
                        '',
                        $automation->recoveries()->where('status', 'sent')->count(),
                        '',
                    ]);
                });
        });
    }

    private function authorizeMerchant(Request $request, Merchant $merchant): void
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()?->id, 403);
    }

    private function ordersQuery(Request $request, Merchant $merchant): Builder
    {
        $range = $this->dateRange($request);

        return Order::query()
            ->where('merchant_id', $merchant->id)
            ->when($range['from'], fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
            ->when($range['to'], fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
            ->when($request->filled('status'), fn (Builder $query) => $query->where('payment_status', $request->input('status')))
            ->when($request->filled('kind'), fn (Builder $query) => $query->where('order_kind', $request->input('kind')));
    }

    private function dateRange(Request $request): array
    {
        return [
            'from' => $request->filled('from') ? Carbon::parse($request->input('from'))->startOfDay() : null,
            'to' => $request->filled('to') ? Carbon::parse($request->input('to'))->endOfDay() : null,
        ];
    }

    private function csv(string $filename, array $headers, callable $writer)
    {
        return response()->streamDownload(function () use ($headers, $writer) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            $writer($handle);
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    private function orderTitle(Order $order): string
    {
        if ($order->product?->title) {
            return $order->product->title;
        }

        if ($order->purchasable_type && $order->purchasable_id) {
            return class_basename($order->purchasable_type).' #'.$order->purchasable_id;
        }

        return 'Order #'.$order->id;
    }

    private function dateValue(mixed $value): string
    {
        return $value ? Carbon::parse($value)->toDateTimeString() : '';
    }

    private function money(mixed $value): string
    {
        return number_format((float) ($value ?? 0), 2, '.', '');
    }

    private function discountLabel(?string $type, mixed $value): string
    {
        if (! $type || $value === null || $value === '') {
            return '';
        }

        return $type === 'percent' ? $this->money($value).'%' : $this->money($value);
    }
}
