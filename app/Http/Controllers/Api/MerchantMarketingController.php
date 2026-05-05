<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\MerchantAbandonedCheckoutAutomation;
use App\Models\MerchantCoupon;
use App\Models\MarketingEvent;
use App\Models\MerchantCustomer;
use App\Models\MerchantGroupSaleCampaign;
use App\Models\MerchantGroupSaleParticipant;
use App\Models\MerchantReferralLink;
use App\Models\MerchantSmsBalance;
use App\Models\MerchantSmsCampaign;
use App\Models\MerchantSmsCampaignRecipient;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MerchantMarketingController extends Controller
{
    public function index(Request $request, Merchant $merchant): JsonResponse
    {
        $coupons = MerchantCoupon::query()
            ->where('merchant_id', $merchant->id)
            ->latest()
            ->get()
            ->map(fn (MerchantCoupon $coupon) => $this->serializeCoupon($coupon));

        $couponIds = $coupons->pluck('id')->filter()->values();
        $couponRevenue = $couponIds->isEmpty()
            ? 0
            : (float) Order::query()
                ->where('merchant_id', $merchant->id)
                ->whereIn('merchant_coupon_id', $couponIds)
                ->whereIn('payment_status', ['resolved_merchant_paid', 'escrow_locked'])
                ->sum('total_paid');

        $referralLinks = MerchantReferralLink::query()
            ->where('merchant_id', $merchant->id)
            ->with(['orders' => fn ($query) => $query
                ->latest()
                ->limit(10)
                ->with('buyer:id,name,phone_number')])
            ->latest()
            ->get()
            ->map(fn (MerchantReferralLink $link) => $this->serializeReferralLink($link));

        $referralOrderQuery = Order::query()
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('merchant_referral_link_id');
        $groupSales = MerchantGroupSaleCampaign::query()
            ->where('merchant_id', $merchant->id)
            ->with(['product.unitType:id,name,code,symbol,allows_decimal'])
            ->latest()
            ->get()
            ->map(fn (MerchantGroupSaleCampaign $campaign) => $this->serializeGroupSaleCampaign($campaign));

        return response()->json([
            'summary' => [
                'active_coupons' => $coupons->where('status', 'active')->count(),
                'coupon_redemptions' => $coupons->sum('times_used'),
                'coupon_revenue' => $couponRevenue,
                'active_referrals' => $referralLinks->where('status', 'active')->count(),
                'referral_clicks' => $referralLinks->sum('clicks_count'),
                'referral_conversions' => $referralLinks->sum('conversions_count'),
                'referral_revenue' => $referralLinks->sum('revenue_amount'),
                'referral_commission_pending' => (float) (clone $referralOrderQuery)
                    ->whereIn('referral_commission_status', ['pending', 'approved'])
                    ->sum('referral_commission_amount'),
                'referral_commission_paid' => (float) (clone $referralOrderQuery)
                    ->where('referral_commission_status', 'paid')
                    ->sum('referral_commission_amount'),
                'sms_credits' => $this->smsBalance($merchant)->credits,
                'scheduled_campaigns' => MerchantSmsCampaign::where('merchant_id', $merchant->id)->where('status', 'scheduled')->count(),
                'sms_sent' => MerchantSmsCampaign::where('merchant_id', $merchant->id)->sum('sent_count'),
                'active_group_sales' => $groupSales->where('status', 'active')->count(),
                'group_sale_reservations' => $groupSales->sum('reserved_quantity'),
            ],
            'analytics' => $this->marketingAnalytics($merchant),
            'coupons' => $coupons->values(),
            'referral_links' => $referralLinks->values(),
            'group_sales' => $groupSales->values(),
            'sms_balance' => $this->serializeSmsBalance($this->smsBalance($merchant)),
            'abandoned_checkout_automation' => $this->serializeAbandonedAutomation($this->abandonedAutomation($merchant)),
            'sms_campaigns' => MerchantSmsCampaign::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (MerchantSmsCampaign $campaign) => $this->serializeSmsCampaign($campaign)),
            'sms_audiences' => $this->smsAudiences($merchant),
            'sms_targets' => $this->smsTargets($merchant),
            'marketing_targets' => $this->marketingTargets($merchant),
            'sms_packages' => [
                ['id' => 'starter', 'name' => 'Starter SMS', 'credits' => 500, 'price' => 15000],
                ['id' => 'growth', 'name' => 'Growth SMS', 'credits' => 2500, 'price' => 65000],
                ['id' => 'scale', 'name' => 'Scale SMS', 'credits' => 10000, 'price' => 240000],
            ],
        ]);
    }

    public function followReferral(Request $request, string $code)
    {
        $normalizedCode = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $code));
        $link = MerchantReferralLink::query()
            ->where('code', $normalizedCode)
            ->with('merchant:id,username')
            ->firstOrFail();

        abort_unless($link->isActiveNow(), 404);

        $link->increment('clicks_count');
        $link->forceFill(['last_clicked_at' => now()])->save();

        return redirect($this->referralTargetUrl($link))
            ->withCookie(cookie('takeer_referral_code', $link->code, 60 * 24 * 30, null, null, false, false, false, 'Lax'));
    }

    public function showGroupSale(string $slug)
    {
        $campaign = MerchantGroupSaleCampaign::query()
            ->where('slug', $slug)
            ->with(['merchant:id,username,display_name,avatar_url', 'product.unitType:id,name,code,symbol,allows_decimal', 'product.images'])
            ->firstOrFail();

        return \Inertia\Inertia::render('GroupSaleCampaign', [
            'campaign' => $this->serializePublicGroupSaleCampaign($campaign),
        ]);
    }

    public function joinGroupSale(Request $request, string $slug): JsonResponse
    {
        $campaign = MerchantGroupSaleCampaign::query()
            ->where('slug', $slug)
            ->with('merchant:id,username,display_name')
            ->firstOrFail();

        if (! $campaign->isJoinable()) {
            return response()->json(['message' => 'This group-sale campaign is not accepting reservations.'], 422);
        }

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'phone' => ['required_without:email', 'nullable', 'string', 'max:32'],
            'email' => ['required_without:phone', 'nullable', 'email', 'max:160'],
            'quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'wants_sms_updates' => ['nullable', 'boolean'],
        ]);

        $participant = DB::transaction(function () use ($request, $campaign, $data) {
            $participant = MerchantGroupSaleParticipant::query()->create([
                'campaign_id' => $campaign->id,
                'user_id' => $request->user()?->id,
                'name' => $data['name'] ?? $request->user()?->name,
                'phone' => $data['phone'] ?? $request->user()?->phone_number,
                'email' => $data['email'] ?? $request->user()?->email,
                'quantity' => (int) $data['quantity'],
                'status' => 'joined',
                'wants_sms_updates' => (bool) ($data['wants_sms_updates'] ?? true),
                'joined_at' => now(),
            ]);

            $campaign->increment('reserved_quantity', (int) $data['quantity']);
            if ($campaign->fresh()->reserved_quantity >= $campaign->goal_quantity && $campaign->status === 'active') {
                $campaign->update(['status' => 'successful']);
            }

            return $participant;
        });

        $freshCampaign = $campaign->fresh(['merchant:id,username,display_name,avatar_url', 'product.unitType:id,name,code,symbol,allows_decimal', 'product.images']);
        if ($freshCampaign?->status === 'successful') {
            $this->notifySuccessfulGroupSaleParticipants($freshCampaign);
            $participant = $participant->fresh();
            $freshCampaign = $freshCampaign->fresh(['merchant:id,username,display_name,avatar_url', 'product.unitType:id,name,code,symbol,allows_decimal', 'product.images']);
        }

        return response()->json([
            'message' => 'You joined this group-sale campaign.',
            'participant' => [
                'id' => $participant->id,
                'quantity' => $participant->quantity,
                'status' => $participant->status,
            ],
            'campaign' => $this->serializePublicGroupSaleCampaign($freshCampaign),
        ], 201);
    }

    public function showCampaignLanding(Merchant $merchant, string $code)
    {
        $normalizedCode = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $code));
        abort_if($normalizedCode === '', 404);

        $coupon = MerchantCoupon::query()
            ->where('merchant_id', $merchant->id)
            ->where('code', $normalizedCode)
            ->first();
        $referral = MerchantReferralLink::query()
            ->where('merchant_id', $merchant->id)
            ->where('code', $normalizedCode)
            ->first();

        abort_unless($coupon || $referral, 404);

        $targetType = $coupon && $coupon->applies_to_type !== 'all'
            ? $coupon->applies_to_type
            : ($referral?->target_type ?? 'storefront');
        $targetId = $coupon && $coupon->applies_to_type !== 'all'
            ? $coupon->applies_to_id
            : $referral?->target_id;
        $target = $this->campaignTarget($merchant, $targetType, $targetId);
        $targetPath = $this->campaignTargetPath($merchant, $targetType, $targetId);
        $ctaUrl = $this->appendCampaignParams($targetPath, $coupon, $referral);

        return \Inertia\Inertia::render('CampaignLanding', [
            'campaign' => [
                'code' => $normalizedCode,
                'kind' => $coupon ? 'coupon' : 'referral',
                'title' => $coupon?->name ?: $referral?->label ?: ($coupon ? 'Special offer' : 'Creator campaign'),
                'description' => $coupon?->description ?: 'A focused campaign from this creator on Takeer.',
                'discount_label' => $coupon ? $this->discountLabel($coupon) : null,
                'coupon' => $coupon ? $this->serializeCoupon($coupon) : null,
                'referral' => $referral ? $this->serializeReferralLink($referral) : null,
                'is_active_now' => $coupon ? $coupon->isActiveNow() : ($referral?->isActiveNow() ?? false),
                'starts_at' => ($coupon?->starts_at ?: $referral?->starts_at)?->toISOString(),
                'ends_at' => ($coupon?->ends_at ?: $referral?->ends_at)?->toISOString(),
                'cta_url' => url($ctaUrl),
                'target' => $target,
                'merchant' => [
                    'id' => $merchant->id,
                    'username' => $merchant->username,
                    'display_name' => $merchant->display_name,
                    'avatar_url' => $merchant->avatar_url,
                    'storefront_url' => url('/m/'.$merchant->username),
                ],
            ],
        ]);
    }

    public function followSmsLink(Request $request, string $code)
    {
        $trackingCode = preg_replace('/[^a-zA-Z0-9_-]/', '', $code);
        abort_if($trackingCode === '', 404);

        $recipient = MerchantSmsCampaignRecipient::query()
            ->where('tracking_code', $trackingCode)
            ->with(['campaign.merchant:id,username'])
            ->firstOrFail();

        $campaign = $recipient->campaign;
        $merchant = $campaign?->merchant;
        abort_unless($campaign && $merchant, 404);

        $sessionId = $request->cookie('takeer_attribution_session') ?: 'atk_'.Str::random(32);
        $sessionId = Str::limit(preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId), 80, '');
        $landingUrl = $recipient->landing_url ?: $this->smsCampaignLandingUrl($campaign);

        $recipient->forceFill(['clicked_at' => $recipient->clicked_at ?: now()])->save();

        MarketingEvent::query()->create([
            'merchant_id' => $campaign->merchant_id,
            'user_id' => $recipient->user_id,
            'session_id' => $sessionId,
            'event_type' => 'sms_click',
            'entity_type' => 'merchant',
            'entity_id' => $campaign->merchant_id,
            'source' => 'sms',
            'source_url' => url('/sms/t/'.$trackingCode),
            'landing_url' => url($landingUrl),
            'referrer_url' => $request->headers->get('referer'),
            'utm_source' => 'takeer_sms',
            'utm_medium' => 'sms',
            'utm_campaign' => 'sms_'.$campaign->id,
            'utm_content' => 'recipient_'.$recipient->id,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'metadata' => [
                'sms_campaign_id' => $campaign->id,
                'sms_campaign_recipient_id' => $recipient->id,
                'tracking_code' => $trackingCode,
            ],
        ]);

        $separator = str_contains($landingUrl, '?') ? '&' : '?';

        return redirect($landingUrl.$separator.http_build_query([
            'source' => 'sms',
            'utm_source' => 'takeer_sms',
            'utm_medium' => 'sms',
            'utm_campaign' => 'sms_'.$campaign->id,
            'sms_campaign' => $campaign->id,
            'sms_recipient' => $recipient->id,
        ]))->withCookie(cookie('takeer_attribution_session', $sessionId, 60 * 24 * 30, null, null, false, false, false, 'Lax'));
    }

    public function buySmsPackage(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $request->validate([
            'package_id' => ['required', Rule::in(['starter', 'growth', 'scale'])],
        ]);

        $package = collect($this->smsPackages())->firstWhere('id', $data['package_id']);
        $balance = $this->smsBalance($merchant);
        $balance->increment('credits', (int) $package['credits']);
        $balance->increment('lifetime_purchased', (int) $package['credits']);

        return response()->json([
            'message' => 'SMS credits added. Payment integration can be connected next.',
            'sms_balance' => $this->serializeSmsBalance($balance->fresh()),
        ]);
    }

    public function estimateSmsAudience(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $request->validate([
            'audience_type' => ['required', Rule::in($this->audienceTypes())],
            'audience_ref_id' => ['nullable', 'integer', 'min:1'],
            'message' => ['nullable', 'string', 'max:640'],
        ]);

        $recipients = $this->resolveSmsRecipients($merchant, $data['audience_type'], $data['audience_ref_id'] ?? null);
        $creditsPerRecipient = $this->creditsPerMessage($data['message'] ?? '');

        return response()->json([
            'recipient_count' => $recipients->count(),
            'credits_per_recipient' => $creditsPerRecipient,
            'estimated_credits' => $recipients->count() * $creditsPerRecipient,
            'sample' => $recipients->take(3)->values(),
        ]);
    }

    public function storeSmsCampaign(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'audience_type' => ['required', Rule::in($this->audienceTypes())],
            'audience_ref_id' => ['nullable', 'integer', 'min:1'],
            'message' => ['required', 'string', 'min:3', 'max:640'],
            'send_mode' => ['required', Rule::in(['draft', 'send_now', 'schedule'])],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
        ]);

        $recipients = $this->resolveSmsRecipients($merchant, $data['audience_type'], $data['audience_ref_id'] ?? null);
        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'No SMS-capable customers found for this audience.'], 422);
        }

        $creditsPerRecipient = $this->creditsPerMessage($data['message']);
        $estimatedCredits = $recipients->count() * $creditsPerRecipient;
        $status = match ($data['send_mode']) {
            'send_now' => 'sending',
            'schedule' => 'scheduled',
            default => 'draft',
        };

        if ($data['send_mode'] === 'schedule' && empty($data['scheduled_at'])) {
            return response()->json(['message' => 'Choose a scheduled send time.'], 422);
        }

        if ($data['send_mode'] === 'send_now' && $this->smsBalance($merchant)->credits < $estimatedCredits) {
            return response()->json(['message' => 'Not enough SMS credits for this campaign.'], 422);
        }

        $campaign = DB::transaction(function () use ($request, $merchant, $data, $recipients, $estimatedCredits, $status) {
            $campaign = MerchantSmsCampaign::query()->create([
                'merchant_id' => $merchant->id,
                'created_by' => $request->user()?->id,
                'name' => $data['name'],
                'audience_type' => $data['audience_type'],
                'audience_ref_id' => $data['audience_ref_id'] ?? null,
                'message' => $data['message'],
                'status' => $status,
                'estimated_recipients' => $recipients->count(),
                'estimated_credits' => $estimatedCredits,
                'scheduled_at' => $data['send_mode'] === 'schedule' ? $data['scheduled_at'] : null,
                'metadata' => [
                    'provider' => 'simulated',
                    'provider_mode' => 'queued_intent',
                    'credits_per_recipient' => $this->creditsPerMessage($data['message']),
                    'created_send_mode' => $data['send_mode'],
                ],
            ]);

            $landingUrl = $this->smsCampaignLandingUrl($campaign);
            $recipients->each(fn ($recipient) => $campaign->recipients()->create([
                'user_id' => $recipient['user_id'] ?? null,
                'name' => $recipient['name'] ?? null,
                'phone' => $recipient['phone'],
                'tracking_code' => $this->newSmsTrackingCode(),
                'landing_url' => $landingUrl,
            ]));

            return $campaign;
        });

        if ($data['send_mode'] === 'send_now') {
            $this->simulateSmsDispatch($merchant, $campaign);
        }

        return response()->json([
            'message' => $data['send_mode'] === 'send_now' ? 'SMS campaign simulated as sent.' : 'SMS campaign saved.',
            'campaign' => $this->serializeSmsCampaign($campaign->fresh()),
            'sms_balance' => $this->serializeSmsBalance($this->smsBalance($merchant)),
        ], 201);
    }

    public function updateAbandonedCheckoutAutomation(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'delay_minutes' => ['required', 'integer', 'min:30', 'max:10080'],
            'max_age_days' => ['required', 'integer', 'min:1', 'max:30'],
            'coupon_code' => ['nullable', 'string', 'max:64'],
            'message' => ['required', 'string', 'min:8', 'max:640'],
        ]);

        $couponCode = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', (string) ($data['coupon_code'] ?? '')));
        if ($couponCode !== '') {
            $exists = MerchantCoupon::query()
                ->where('merchant_id', $merchant->id)
                ->where('code', $couponCode)
                ->exists();
            abort_unless($exists, 422, 'Choose a coupon code that belongs to this merchant.');
        }

        $automation = $this->abandonedAutomation($merchant);
        $automation->update([
            'created_by' => $automation->created_by ?: $request->user()?->id,
            'is_enabled' => (bool) $data['is_enabled'],
            'delay_minutes' => (int) $data['delay_minutes'],
            'max_age_days' => (int) $data['max_age_days'],
            'coupon_code' => $couponCode ?: null,
            'message' => $data['message'],
        ]);

        return response()->json([
            'message' => 'Abandoned checkout automation updated.',
            'automation' => $this->serializeAbandonedAutomation($automation->fresh()),
        ]);
    }

    public function store(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $this->validatedCouponData($request, $merchant);
        $coupon = MerchantCoupon::query()->create($data + ['merchant_id' => $merchant->id]);

        return response()->json([
            'message' => 'Coupon imeundwa.',
            'coupon' => $this->serializeCoupon($coupon),
        ], 201);
    }

    public function update(Request $request, Merchant $merchant, MerchantCoupon $coupon): JsonResponse
    {
        abort_unless((int) $coupon->merchant_id === (int) $merchant->id, 404);

        $coupon->update($this->validatedCouponData($request, $merchant, $coupon));

        return response()->json([
            'message' => 'Coupon imesasishwa.',
            'coupon' => $this->serializeCoupon($coupon->fresh()),
        ]);
    }

    public function destroy(Merchant $merchant, MerchantCoupon $coupon): JsonResponse
    {
        abort_unless((int) $coupon->merchant_id === (int) $merchant->id, 404);
        $coupon->delete();

        return response()->json(['message' => 'Coupon imefutwa.']);
    }

    public function storeReferral(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $this->validatedReferralData($request, $merchant);
        $link = MerchantReferralLink::query()->create($data + [
            'merchant_id' => $merchant->id,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Referral link imeundwa.',
            'referral_link' => $this->serializeReferralLink($link),
        ], 201);
    }

    public function updateReferral(Request $request, Merchant $merchant, MerchantReferralLink $referralLink): JsonResponse
    {
        abort_unless((int) $referralLink->merchant_id === (int) $merchant->id, 404);
        $referralLink->update($this->validatedReferralData($request, $merchant, $referralLink));

        return response()->json([
            'message' => 'Referral link imesasishwa.',
            'referral_link' => $this->serializeReferralLink($referralLink->fresh()),
        ]);
    }

    public function destroyReferral(Merchant $merchant, MerchantReferralLink $referralLink): JsonResponse
    {
        abort_unless((int) $referralLink->merchant_id === (int) $merchant->id, 404);
        $referralLink->delete();

        return response()->json(['message' => 'Referral link imefutwa.']);
    }

    public function payReferralCommissions(Request $request, Merchant $merchant, MerchantReferralLink $referralLink): JsonResponse
    {
        abort_unless((int) $referralLink->merchant_id === (int) $merchant->id, 404);

        $data = $request->validate([
            'status' => ['required', Rule::in(['paid', 'void'])],
            'order_ids' => ['nullable', 'array'],
            'order_ids.*' => ['integer', 'min:1'],
        ]);

        $orders = Order::query()
            ->where('merchant_id', $merchant->id)
            ->where('merchant_referral_link_id', $referralLink->id)
            ->whereIn('referral_commission_status', ['pending', 'approved'])
            ->where('referral_commission_amount', '>', 0)
            ->when(!empty($data['order_ids']), fn ($query) => $query->whereIn('id', $data['order_ids']))
            ->get();

        if ($orders->isEmpty()) {
            return response()->json(['message' => 'No unpaid referral commissions found for this link.'], 422);
        }

        $total = (float) $orders->sum('referral_commission_amount');
        Order::query()
            ->whereIn('id', $orders->pluck('id'))
            ->update([
                'referral_commission_status' => $data['status'],
                'referral_commission_paid_at' => $data['status'] === 'paid' ? now() : null,
            ]);

        $freshLink = $referralLink->fresh();
        $freshLink->load(['orders' => fn ($query) => $query->latest()->limit(10)->with('buyer:id,name,phone_number')]);

        return response()->json([
            'message' => $data['status'] === 'paid'
                ? 'Referral commissions marked as paid.'
                : 'Referral commissions marked as void.',
            'orders_count' => $orders->count(),
            'amount' => $total,
            'referral_link' => $this->serializeReferralLink($freshLink),
        ]);
    }

    public function storeGroupSale(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $this->validatedGroupSaleData($request, $merchant);
        $campaign = MerchantGroupSaleCampaign::query()->create($data + ['merchant_id' => $merchant->id]);

        return response()->json([
            'message' => 'Group-sale campaign imeundwa.',
            'group_sale' => $this->serializeGroupSaleCampaign($campaign->load('product.unitType:id,name,code,symbol,allows_decimal')),
        ], 201);
    }

    public function updateGroupSale(Request $request, Merchant $merchant, MerchantGroupSaleCampaign $groupSale): JsonResponse
    {
        abort_unless((int) $groupSale->merchant_id === (int) $merchant->id, 404);
        $wasSuccessful = $groupSale->status === 'successful';
        $groupSale->update($this->validatedGroupSaleData($request, $merchant, $groupSale));
        $freshGroupSale = $groupSale->fresh('product.unitType:id,name,code,symbol,allows_decimal');
        if (! $wasSuccessful && $freshGroupSale->status === 'successful') {
            $this->notifySuccessfulGroupSaleParticipants($freshGroupSale);
            $freshGroupSale = $freshGroupSale->fresh('product.unitType:id,name,code,symbol,allows_decimal');
        }

        return response()->json([
            'message' => 'Group-sale campaign imesasishwa.',
            'group_sale' => $this->serializeGroupSaleCampaign($freshGroupSale),
        ]);
    }

    public function destroyGroupSale(Merchant $merchant, MerchantGroupSaleCampaign $groupSale): JsonResponse
    {
        abort_unless((int) $groupSale->merchant_id === (int) $merchant->id, 404);
        $groupSale->delete();

        return response()->json(['message' => 'Group-sale campaign imefutwa.']);
    }

    private function validatedCouponData(Request $request, Merchant $merchant, ?MerchantCoupon $coupon = null): array
    {
        $data = $request->validate([
            'code' => [
                'required',
                'string',
                'max:64',
                Rule::unique('merchant_coupons', 'code')
                    ->where('merchant_id', $merchant->id)
                    ->ignore($coupon?->id),
            ],
            'name' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'discount_type' => ['required', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['required', 'numeric', 'min:0.01'],
            'minimum_order_amount' => ['nullable', 'numeric', 'min:0'],
            'maximum_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'applies_to_type' => ['required', Rule::in(['all', 'product', 'bundle', 'subscription_plan', 'post', 'content_item'])],
            'applies_to_id' => ['nullable', 'integer', 'min:1'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_customer' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'status' => ['required', Rule::in(['active', 'paused', 'expired'])],
        ]);

        $data['code'] = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $data['code']));
        $data['applies_to_id'] = $data['applies_to_type'] === 'all' ? null : ($data['applies_to_id'] ?? null);

        if ($data['applies_to_type'] !== 'all' && ! $data['applies_to_id']) {
            abort(422, 'Choose the offer this coupon applies to, or set it to All offers.');
        }

        return $data;
    }

    private function validatedReferralData(Request $request, Merchant $merchant, ?MerchantReferralLink $referralLink = null): array
    {
        $data = $request->validate([
            'code' => [
                'nullable',
                'string',
                'max:80',
                Rule::unique('merchant_referral_links', 'code')->ignore($referralLink?->id),
            ],
            'label' => ['nullable', 'string', 'max:140'],
            'target_type' => ['required', Rule::in(['storefront', 'product', 'bundle', 'subscription_plan', 'post', 'content_item'])],
            'target_id' => ['nullable', 'integer', 'min:1'],
            'reward_type' => ['required', Rule::in(['none', 'percent', 'fixed'])],
            'reward_value' => ['nullable', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'status' => ['required', Rule::in(['active', 'paused', 'expired'])],
        ]);

        $data['code'] = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $data['code'] ?? ''));
        if ($data['code'] === '') {
            $data['code'] = $this->suggestReferralCode($merchant);
        }
        $data['target_id'] = $data['target_type'] === 'storefront' ? null : ($data['target_id'] ?? null);
        $data['reward_value'] = $data['reward_type'] === 'none' ? 0 : (float) ($data['reward_value'] ?? 0);

        if ($data['target_type'] !== 'storefront' && ! $data['target_id']) {
            abort(422, 'Choose the exact offer this referral link should open, or target Storefront.');
        }

        if (! $this->targetBelongsToMerchant($merchant, $data['target_type'], $data['target_id'] ?? null)) {
            abort(422, 'Selected referral target does not belong to this merchant.');
        }

        return $data;
    }

    private function validatedGroupSaleData(Request $request, Merchant $merchant, ?MerchantGroupSaleCampaign $campaign = null): array
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'min:1'],
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1200'],
            'campaign_price' => ['required', 'numeric', 'min:0'],
            'regular_price' => ['nullable', 'numeric', 'min:0'],
            'goal_quantity' => ['required', 'integer', 'min:2', 'max:100000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['required', 'date', 'after:now'],
            'status' => ['required', Rule::in(['draft', 'active', 'successful', 'expired', 'cancelled'])],
            'allow_sms_updates' => ['nullable', 'boolean'],
        ]);

        if (! Product::query()->where('merchant_id', $merchant->id)->whereKey($data['product_id'])->exists()) {
            abort(422, 'Choose a product that belongs to this merchant.');
        }

        if ($campaign && (int) $data['goal_quantity'] < (int) $campaign->reserved_quantity) {
            abort(422, 'Goal cannot be lower than existing reservations.');
        }

        $data['allow_sms_updates'] = (bool) ($data['allow_sms_updates'] ?? true);

        return $data;
    }

    private function suggestReferralCode(Merchant $merchant): string
    {
        $prefix = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string) ($merchant->username ?: 'takeer'))) ?: 'TAKEER';

        do {
            $code = $prefix.'-'.strtoupper(Str::random(5));
        } while (MerchantReferralLink::query()->where('code', $code)->exists());

        return $code;
    }

    private function targetBelongsToMerchant(Merchant $merchant, string $targetType, ?int $targetId): bool
    {
        return match ($targetType) {
            'storefront' => true,
            'product' => Product::query()->where('merchant_id', $merchant->id)->whereKey($targetId)->exists(),
            'bundle' => Bundle::query()->where('merchant_id', $merchant->id)->whereKey($targetId)->exists(),
            'subscription_plan' => SubscriptionPlan::query()->where('merchant_id', $merchant->id)->whereKey($targetId)->exists(),
            'post' => Post::query()->where('merchant_id', $merchant->id)->whereKey($targetId)->exists(),
            'content_item' => ContentItem::query()->where('merchant_id', $merchant->id)->whereKey($targetId)->exists(),
            default => false,
        };
    }

    private function marketingAnalytics(Merchant $merchant): array
    {
        $paidStatuses = ['resolved_merchant_paid', 'escrow_locked'];
        $paidOrders = fn () => Order::query()
            ->where('merchant_id', $merchant->id)
            ->whereIn('payment_status', $paidStatuses);

        $totalOrders = (clone $paidOrders())->count();
        $totalRevenue = (float) (clone $paidOrders())->sum('total_paid');
        $smsAttributedOrderIds = MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'checkout_completed')
            ->where('source', 'sms')
            ->whereNotNull('order_id')
            ->distinct()
            ->pluck('order_id');
        $smsAttributedRevenue = (float) (clone $paidOrders())
            ->whereIn('id', $smsAttributedOrderIds)
            ->sum('total_paid');

        $sourceRows = [
            [
                'key' => 'direct',
                'label' => 'Direct / organic',
                'orders' => (clone $paidOrders())
                    ->whereNull('merchant_coupon_id')
                    ->whereNull('merchant_referral_link_id')
                    ->whereNull('group_sale_campaign_id')
                    ->when($smsAttributedOrderIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $smsAttributedOrderIds))
                    ->count(),
                'revenue' => (float) (clone $paidOrders())
                    ->whereNull('merchant_coupon_id')
                    ->whereNull('merchant_referral_link_id')
                    ->whereNull('group_sale_campaign_id')
                    ->when($smsAttributedOrderIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $smsAttributedOrderIds))
                    ->sum('total_paid'),
                'note' => 'Normal checkout, storefront, feed, or direct product visits.',
            ],
            [
                'key' => 'sms',
                'label' => 'SMS attributed',
                'orders' => $smsAttributedOrderIds->count(),
                'revenue' => $smsAttributedRevenue,
                'note' => 'Orders from buyers who clicked a tracked Takeer SMS link before checkout.',
            ],
            [
                'key' => 'coupons',
                'label' => 'Coupon assisted',
                'orders' => (clone $paidOrders())->whereNotNull('merchant_coupon_id')->count(),
                'revenue' => (float) (clone $paidOrders())->whereNotNull('merchant_coupon_id')->sum('total_paid'),
                'note' => 'Orders where a promo code was applied.',
            ],
            [
                'key' => 'referrals',
                'label' => 'Referral links',
                'orders' => (clone $paidOrders())->whereNotNull('merchant_referral_link_id')->count(),
                'revenue' => (float) (clone $paidOrders())->whereNotNull('merchant_referral_link_id')->sum('total_paid'),
                'note' => 'Orders connected to creator, affiliate, or customer links.',
            ],
            [
                'key' => 'group_sales',
                'label' => 'Group sales',
                'orders' => (clone $paidOrders())->whereNotNull('group_sale_campaign_id')->count(),
                'revenue' => (float) (clone $paidOrders())->whereNotNull('group_sale_campaign_id')->sum('total_paid'),
                'note' => 'Orders converted from group-buy campaigns.',
            ],
        ];

        $sourceRows = collect($sourceRows)
            ->map(fn (array $row) => $row + [
                'share' => $totalRevenue > 0 ? round(((float) $row['revenue'] / $totalRevenue) * 100, 1) : 0,
            ])
            ->values()
            ->all();

        $productViews = (int) Product::query()->where('merchant_id', $merchant->id)->sum('views_count');
        $trackedProductViews = (int) MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'product_view')
            ->count();
        $productOrders = (clone $paidOrders())->whereNotNull('product_id')->count();
        $postViews = (int) Post::query()->where('merchant_id', $merchant->id)->sum('views_count');
        $trackedPostViews = (int) MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'post_view')
            ->count();
        $postOrders = (clone $paidOrders())->where('purchasable_type', 'post')->count();
        $storefrontViews = (int) MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'storefront_view')
            ->count();
        $checkoutStarts = (int) MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'checkout_started')
            ->count();
        $checkoutCompleted = (int) MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'checkout_completed')
            ->count();
        $knownBuyerOrders = (clone $paidOrders())->whereNotNull('buyer_id')->count();
        $knownBuyerSessions = (int) MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('user_id')
            ->distinct('session_id')
            ->count('session_id');
        $identifiedUsers = collect()
            ->merge(MarketingEvent::query()
                ->where('merchant_id', $merchant->id)
                ->whereNotNull('user_id')
                ->distinct()
                ->pluck('user_id'))
            ->merge((clone $paidOrders())
                ->whereNotNull('buyer_id')
                ->distinct()
                ->pluck('buyer_id'))
            ->filter()
            ->unique()
            ->count();
        $abandonedCheckouts = $this->abandonedCheckoutEvents($merchant)->count();
        $referralClicks = (int) MerchantReferralLink::query()->where('merchant_id', $merchant->id)->sum('clicks_count');
        $referralConversions = (int) MerchantReferralLink::query()->where('merchant_id', $merchant->id)->sum('conversions_count');
        $smsCampaigns = MerchantSmsCampaign::query()->where('merchant_id', $merchant->id);
        $smsSent = (int) (clone $smsCampaigns)->sum('sent_count');

        $topProductRows = (clone $paidOrders())
            ->whereNotNull('product_id')
            ->select('product_id', DB::raw('COUNT(*) as orders_count'), DB::raw('SUM(total_paid) as revenue'))
            ->groupBy('product_id')
            ->orderByDesc(DB::raw('SUM(total_paid)'))
            ->limit(5)
            ->get();
        $productTitles = Product::query()
            ->whereIn('id', $topProductRows->pluck('product_id')->filter()->values())
            ->pluck('title', 'id');

        $topProducts = $topProductRows
            ->map(fn ($row) => [
                'id' => (int) $row->product_id,
                'title' => $productTitles[$row->product_id] ?? 'Product #'.$row->product_id,
                'orders' => (int) $row->orders_count,
                'revenue' => (float) $row->revenue,
            ])
            ->values();

        $topReferrals = MerchantReferralLink::query()
            ->where('merchant_id', $merchant->id)
            ->orderByDesc('revenue_amount')
            ->orderByDesc('conversions_count')
            ->limit(5)
            ->get()
            ->map(fn (MerchantReferralLink $link) => [
                'id' => $link->id,
                'label' => $link->label ?: $link->code,
                'code' => $link->code,
                'clicks' => (int) $link->clicks_count,
                'conversions' => (int) $link->conversions_count,
                'revenue' => (float) $link->revenue_amount,
                'conversion_rate' => $link->clicks_count > 0 ? round(($link->conversions_count / $link->clicks_count) * 100, 1) : 0,
            ])
            ->values();

        $topCoupons = MerchantCoupon::query()
            ->where('merchant_id', $merchant->id)
            ->orderByDesc('times_used')
            ->limit(5)
            ->get()
            ->map(function (MerchantCoupon $coupon) use ($paidStatuses) {
                $revenue = (float) Order::query()
                    ->where('merchant_id', $coupon->merchant_id)
                    ->where('merchant_coupon_id', $coupon->id)
                    ->whereIn('payment_status', $paidStatuses)
                    ->sum('total_paid');

                return [
                    'id' => $coupon->id,
                    'code' => $coupon->code,
                    'redemptions' => (int) $coupon->times_used,
                    'revenue' => $revenue,
                ];
            })
            ->values();

        $groupSaleTotals = MerchantGroupSaleCampaign::query()
            ->where('merchant_id', $merchant->id)
            ->selectRaw('COUNT(*) as campaigns_count, SUM(reserved_quantity) as reservations, SUM(converted_quantity) as conversions')
            ->first();

        return [
            'window_label' => 'All time',
            'revenue_total' => $totalRevenue,
            'orders_total' => $totalOrders,
            'source_revenue' => $sourceRows,
            'funnels' => [
                [
                    'key' => 'storefront',
                    'label' => 'Storefront to checkout',
                    'views' => $storefrontViews,
                    'orders' => $checkoutStarts,
                    'conversion_rate' => $storefrontViews > 0 ? round(($checkoutStarts / $storefrontViews) * 100, 1) : 0,
                    'note' => 'Uses storefront visits and checkout starts tracked by the attribution layer.',
                ],
                [
                    'key' => 'checkout',
                    'label' => 'Checkout starts to paid',
                    'views' => $checkoutStarts,
                    'orders' => $checkoutCompleted,
                    'conversion_rate' => $checkoutStarts > 0 ? round(($checkoutCompleted / $checkoutStarts) * 100, 1) : 0,
                    'note' => 'Shows checkout completion from tracked sessions and created orders.',
                ],
                [
                    'key' => 'products',
                    'label' => 'Product visits to orders',
                    'views' => max($productViews, $trackedProductViews),
                    'orders' => $productOrders,
                    'conversion_rate' => max($productViews, $trackedProductViews) > 0 ? round(($productOrders / max($productViews, $trackedProductViews)) * 100, 1) : 0,
                    'note' => 'Uses product impressions plus attribution product-view events.',
                ],
                [
                    'key' => 'premium_posts',
                    'label' => 'Premium posts',
                    'views' => max($postViews, $trackedPostViews),
                    'orders' => $postOrders,
                    'conversion_rate' => max($postViews, $trackedPostViews) > 0 ? round(($postOrders / max($postViews, $trackedPostViews)) * 100, 1) : 0,
                    'note' => 'Uses post views and paid post unlocks.',
                ],
                [
                    'key' => 'referrals',
                    'label' => 'Referral clicks to sales',
                    'views' => $referralClicks,
                    'orders' => $referralConversions,
                    'conversion_rate' => $referralClicks > 0 ? round(($referralConversions / $referralClicks) * 100, 1) : 0,
                    'note' => 'Uses referral link clicks and converted orders.',
                ],
                [
                    'key' => 'sms',
                    'label' => 'SMS delivery',
                    'views' => $smsSent,
                    'orders' => null,
                    'conversion_rate' => null,
                    'note' => 'Delivery is tracked now; checkout attribution can be added when real provider callbacks are wired.',
                ],
            ],
            'campaign_performance' => [
                'coupons' => [
                    'redemptions' => (int) MerchantCoupon::query()->where('merchant_id', $merchant->id)->sum('times_used'),
                    'revenue' => (float) (clone $paidOrders())->whereNotNull('merchant_coupon_id')->sum('total_paid'),
                ],
                'referrals' => [
                    'clicks' => $referralClicks,
                    'conversions' => $referralConversions,
                    'revenue' => (float) MerchantReferralLink::query()->where('merchant_id', $merchant->id)->sum('revenue_amount'),
                ],
                'group_sales' => [
                    'campaigns' => (int) ($groupSaleTotals?->campaigns_count ?? 0),
                    'reservations' => (int) ($groupSaleTotals?->reservations ?? 0),
                    'conversions' => (int) ($groupSaleTotals?->conversions ?? 0),
                ],
                'sms' => [
                    'campaigns' => (int) (clone $smsCampaigns)->count(),
                    'sent' => $smsSent,
                    'scheduled' => (int) (clone $smsCampaigns)->where('status', 'scheduled')->count(),
                    'clicks' => (int) MarketingEvent::query()
                        ->where('merchant_id', $merchant->id)
                        ->where('event_type', 'sms_click')
                        ->count(),
                    'orders' => $smsAttributedOrderIds->count(),
                    'revenue' => $smsAttributedRevenue,
                ],
                'abandoned_checkouts' => [
                    'recoverable' => $abandonedCheckouts,
                    'sms_recipients' => $this->resolveSmsRecipients($merchant, 'abandoned_checkouts')->count(),
                ],
            ],
            'identity_coverage' => [
                'identified_buyers' => $identifiedUsers,
                'identified_orders' => $knownBuyerOrders,
                'identified_order_rate' => $totalOrders > 0 ? round(($knownBuyerOrders / $totalOrders) * 100, 1) : 0,
                'linked_sessions' => $knownBuyerSessions,
                'confidence' => 'deterministic',
                'note' => 'Anonymous device sessions are stitched to a buyer after login, checkout, or phone-based account creation.',
            ],
            'top_products' => $topProducts,
            'top_referrals' => $topReferrals,
            'top_coupons' => $topCoupons,
            'tracking_gaps' => [
                'Pre-checkout cross-device attribution still needs login, checkout, or phone verification.',
            ],
        ];
    }

    private function smsBalance(Merchant $merchant): MerchantSmsBalance
    {
        return MerchantSmsBalance::query()->firstOrCreate(['merchant_id' => $merchant->id]);
    }

    private function abandonedAutomation(Merchant $merchant): MerchantAbandonedCheckoutAutomation
    {
        return MerchantAbandonedCheckoutAutomation::query()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            [
                'delay_minutes' => 60,
                'max_age_days' => 7,
                'message' => 'Habari! Uliacha checkout bila kukamilisha. Rudi Takeer ukamilishe order yako.',
            ]
        );
    }

    private function serializeAbandonedAutomation(MerchantAbandonedCheckoutAutomation $automation): array
    {
        return [
            'id' => $automation->id,
            'is_enabled' => (bool) $automation->is_enabled,
            'delay_minutes' => (int) $automation->delay_minutes,
            'max_age_days' => (int) $automation->max_age_days,
            'coupon_code' => $automation->coupon_code,
            'message' => $automation->message,
            'last_run_at' => $automation->last_run_at?->toISOString(),
            'sent_count' => (int) $automation->recoveries()->where('status', 'sent')->count(),
        ];
    }

    private function smsPackages(): array
    {
        return [
            ['id' => 'starter', 'name' => 'Starter SMS', 'credits' => 500, 'price' => 15000],
            ['id' => 'growth', 'name' => 'Growth SMS', 'credits' => 2500, 'price' => 65000],
            ['id' => 'scale', 'name' => 'Scale SMS', 'credits' => 10000, 'price' => 240000],
        ];
    }

    private function audienceTypes(): array
    {
        return [
            'all_customers',
            'repeat_buyers',
            'inactive_customers',
            'active_subscribers',
            'product_buyers',
            'subscription_members',
            'group_sale_waiters',
            'abandoned_checkouts',
        ];
    }

    private function smsAudiences(Merchant $merchant): array
    {
        return [
            ['type' => 'all_customers', 'label' => 'All customers', 'count' => $this->resolveSmsRecipients($merchant, 'all_customers')->count()],
            ['type' => 'repeat_buyers', 'label' => 'Repeat buyers', 'count' => $this->resolveSmsRecipients($merchant, 'repeat_buyers')->count()],
            ['type' => 'inactive_customers', 'label' => 'Inactive customers', 'count' => $this->resolveSmsRecipients($merchant, 'inactive_customers')->count()],
            ['type' => 'active_subscribers', 'label' => 'Active subscribers', 'count' => $this->resolveSmsRecipients($merchant, 'active_subscribers')->count()],
            ['type' => 'product_buyers', 'label' => 'Product buyers', 'requires_ref' => true, 'count' => null],
            ['type' => 'subscription_members', 'label' => 'Subscription members', 'requires_ref' => true, 'count' => null],
            ['type' => 'group_sale_waiters', 'label' => 'Group-sale waiters', 'count' => $this->resolveSmsRecipients($merchant, 'group_sale_waiters')->count()],
            ['type' => 'abandoned_checkouts', 'label' => 'Abandoned checkouts', 'count' => $this->resolveSmsRecipients($merchant, 'abandoned_checkouts')->count()],
        ];
    }

    private function smsTargets(Merchant $merchant): array
    {
        return [
            'products' => Product::query()
                ->where('merchant_id', $merchant->id)
                ->with('unitType:id,name,code,symbol,allows_decimal')
                ->latest()
                ->limit(100)
                ->get(['id', 'title', 'type', 'price', 'discounted_price', 'product_unit_type_id', 'sellable_quantity'])
                ->map(fn (Product $product) => [
                    'id' => $product->id,
                    'label' => $product->title,
                    'meta' => trim(($product->type ?: 'product').' · TZS '.number_format((float) ($product->discounted_price ?: $product->price ?: 0)).$this->unitPriceSuffix($product)),
                ])
                ->values(),
            'subscription_plans' => SubscriptionPlan::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->limit(100)
                ->get(['id', 'name', 'price', 'billing_interval', 'status'])
                ->map(fn (SubscriptionPlan $plan) => [
                    'id' => $plan->id,
                    'label' => $plan->name,
                    'meta' => trim(($plan->status ?: 'plan').' · TZS '.number_format((float) ($plan->price ?: 0)).' / '.($plan->billing_interval ?: 'month')),
                ])
                ->values(),
        ];
    }

    private function marketingTargets(Merchant $merchant): array
    {
        return [
            'products' => $this->productTargets($merchant),
            'bundles' => Bundle::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->limit(100)
                ->get(['id', 'title', 'price', 'slug', 'is_course', 'status'])
                ->map(fn (Bundle $bundle) => [
                    'id' => $bundle->id,
                    'label' => $bundle->title,
                    'meta' => trim(($bundle->is_course ? 'course' : 'bundle').' · TZS '.number_format((float) ($bundle->price ?: 0))),
                ])
                ->values(),
            'subscription_plans' => $this->subscriptionPlanTargets($merchant),
            'posts' => Post::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->limit(100)
                ->get(['id', 'public_id', 'caption', 'title', 'restricted_price'])
                ->map(fn (Post $post) => [
                    'id' => $post->id,
                    'label' => $post->title ?: Str::limit((string) $post->caption, 64),
                    'meta' => 'post · TZS '.number_format((float) ($post->restricted_price ?: 0)),
                ])
                ->values(),
            'content_items' => ContentItem::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->limit(100)
                ->get(['id', 'title', 'price', 'slug', 'visibility'])
                ->map(fn (ContentItem $item) => [
                    'id' => $item->id,
                    'label' => $item->title,
                    'meta' => trim(($item->visibility ?: 'content').' · TZS '.number_format((float) ($item->price ?: 0))),
                ])
                ->values(),
        ];
    }

    private function productTargets(Merchant $merchant)
    {
        return Product::query()
            ->where('merchant_id', $merchant->id)
            ->with('unitType:id,name,code,symbol,allows_decimal')
            ->latest()
            ->limit(100)
            ->get(['id', 'title', 'type', 'price', 'discounted_price', 'product_unit_type_id', 'sellable_quantity'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'label' => $product->title,
                'meta' => trim(($product->type ?: 'product').' · TZS '.number_format((float) ($product->discounted_price ?: $product->price ?: 0)).$this->unitPriceSuffix($product)),
                'unit_label' => $this->productUnitLabel($product),
            ])
            ->values();
    }

    private function subscriptionPlanTargets(Merchant $merchant)
    {
        return SubscriptionPlan::query()
            ->where('merchant_id', $merchant->id)
            ->latest()
            ->limit(100)
            ->get(['id', 'name', 'price', 'billing_interval', 'status'])
            ->map(fn (SubscriptionPlan $plan) => [
                'id' => $plan->id,
                'label' => $plan->name,
                'meta' => trim(($plan->status ?: 'plan').' · TZS '.number_format((float) ($plan->price ?: 0)).' / '.($plan->billing_interval ?: 'month')),
            ])
            ->values();
    }

    private function resolveSmsRecipients(Merchant $merchant, string $audienceType, ?int $audienceRefId = null)
    {
        $baseCustomers = fn () => MerchantCustomer::query()
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('phone')
            ->where('phone', '!=', '');

        $recipients = match ($audienceType) {
            'repeat_buyers' => $baseCustomers()->where('order_count', '>', 1)->get(),
            'inactive_customers' => $baseCustomers()
                ->where(function ($query) {
                    $query->whereNull('last_purchase_at')->orWhere('last_purchase_at', '<', now()->subDays(60));
                })
                ->get(),
            'active_subscribers' => UserSubscription::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'active')
                ->where(function ($query) {
                    $query->whereNull('current_period_end')->orWhere('current_period_end', '>', now());
                })
                ->with('user:id,name,phone_number')
                ->get()
                ->map(fn ($subscription) => [
                    'user_id' => $subscription->user_id,
                    'name' => $subscription->user?->name,
                    'phone' => $subscription->user?->phone_number,
                ]),
            'product_buyers' => Order::query()
                ->where('merchant_id', $merchant->id)
                ->where('purchasable_type', 'product')
                ->when($audienceRefId, fn ($query) => $query->where('purchasable_id', $audienceRefId))
                ->whereIn('payment_status', ['resolved_merchant_paid', 'escrow_locked'])
                ->with('buyer:id,name,phone_number')
                ->get()
                ->map(fn ($order) => [
                    'user_id' => $order->buyer_id,
                    'name' => $order->buyer?->name,
                    'phone' => $order->buyer?->phone_number ?: $order->customer_phone,
                ]),
            'subscription_members' => UserSubscription::query()
                ->where('merchant_id', $merchant->id)
                ->when($audienceRefId, fn ($query) => $query->where('subscription_plan_id', $audienceRefId))
                ->where('status', 'active')
                ->with('user:id,name,phone_number')
                ->get()
                ->map(fn ($subscription) => [
                    'user_id' => $subscription->user_id,
                    'name' => $subscription->user?->name,
                    'phone' => $subscription->user?->phone_number,
                ]),
            'group_sale_waiters' => MerchantGroupSaleParticipant::query()
                ->whereHas('campaign', fn ($query) => $query->where('merchant_id', $merchant->id))
                ->whereIn('status', ['joined', 'notified'])
                ->where('wants_sms_updates', true)
                ->get()
                ->map(fn (MerchantGroupSaleParticipant $participant) => [
                    'user_id' => $participant->user_id,
                    'name' => $participant->name,
                    'phone' => $participant->phone,
                ]),
            'abandoned_checkouts' => $this->abandonedCheckoutEvents($merchant)
                ->whereNotNull('user_id')
                ->with('user:id,name,phone_number')
                ->get()
                ->map(fn (MarketingEvent $event) => [
                    'user_id' => $event->user_id,
                    'name' => $event->user?->name,
                    'phone' => $event->user?->phone_number,
                ]),
            default => $baseCustomers()->get(),
        };

        return collect($recipients)
            ->map(fn ($entry) => $entry instanceof MerchantCustomer ? [
                'user_id' => $entry->user_id,
                'name' => $entry->name,
                'phone' => $entry->phone,
            ] : $entry)
            ->filter(fn ($entry) => !empty($entry['phone']))
            ->unique(fn ($entry) => preg_replace('/\D+/', '', (string) $entry['phone']))
            ->values();
    }

    private function abandonedCheckoutEvents(Merchant $merchant)
    {
        return MarketingEvent::query()
            ->where('merchant_id', $merchant->id)
            ->where('event_type', 'checkout_started')
            ->whereNull('order_id')
            ->where('created_at', '<=', now()->subMinutes(30))
            ->where('created_at', '>=', now()->subDays(14));
    }

    private function creditsPerMessage(string $message): int
    {
        $length = mb_strlen($message);
        return max(1, (int) ceil($length / 160));
    }

    private function newSmsTrackingCode(): string
    {
        do {
            $code = 'sms_'.Str::lower(Str::random(24));
        } while (MerchantSmsCampaignRecipient::query()->where('tracking_code', $code)->exists());

        return $code;
    }

    private function smsMessageWithTrackingLink(MerchantSmsCampaign $campaign, MerchantSmsCampaignRecipient $recipient): string
    {
        if (! $recipient->tracking_code) {
            $recipient->forceFill([
                'tracking_code' => $this->newSmsTrackingCode(),
                'landing_url' => $recipient->landing_url ?: $this->smsCampaignLandingUrl($campaign),
            ])->save();
        }

        return trim($campaign->message)."\n".url('/sms/t/'.$recipient->tracking_code);
    }

    private function smsCampaignLandingUrl(MerchantSmsCampaign $campaign): string
    {
        $merchantPath = '/m/'.$campaign->merchant?->username;

        return match ($campaign->audience_type) {
            'product_buyers' => $campaign->audience_ref_id ? '/product/'.$campaign->audience_ref_id : $merchantPath,
            'subscription_members' => $campaign->audience_ref_id ? '/plan/'.$campaign->audience_ref_id : $merchantPath,
            default => $merchantPath,
        };
    }

    private function simulateSmsDispatch(Merchant $merchant, MerchantSmsCampaign $campaign): void
    {
        DB::transaction(function () use ($merchant, $campaign) {
            $balance = $this->smsBalance($merchant);
            $credits = (int) $campaign->estimated_credits;

            if ($balance->credits < $credits) {
                throw new \RuntimeException('Not enough SMS credits for this campaign.');
            }

            $sent = 0;
            $campaign->recipients()->where('status', 'pending')->get()->each(function ($recipient) use ($campaign, &$sent) {
                $message = $this->smsMessageWithTrackingLink($campaign, $recipient);
                $log = NotificationLog::query()->create([
                    'user_id' => $recipient->user_id,
                    'channel' => 'sms',
                    'recipient' => $recipient->phone,
                    'phone' => $recipient->phone,
                    'message' => $message,
                    'status' => 'sent',
                    'gateway' => 'simulated',
                    'metadata' => [
                        'campaign_id' => $campaign->id,
                        'campaign_name' => $campaign->name,
                        'tracking_code' => $recipient->tracking_code,
                        'tracking_url' => url('/sms/t/'.$recipient->tracking_code),
                    ],
                ]);

                $recipient->update([
                    'status' => 'sent',
                    'notification_log_id' => $log->id,
                    'sent_at' => now(),
                ]);
                $sent++;
            });

            $balance->decrement('credits', $credits);
            $balance->increment('lifetime_used', $credits);
            $campaign->update([
                'status' => 'sent',
                'sent_count' => $sent,
                'failed_count' => 0,
                'sent_at' => now(),
            ]);
        });
    }

    private function serializeSmsBalance(MerchantSmsBalance $balance): array
    {
        return [
            'credits' => (int) $balance->credits,
            'lifetime_purchased' => (int) $balance->lifetime_purchased,
            'lifetime_used' => (int) $balance->lifetime_used,
        ];
    }

    private function serializeSmsCampaign(MerchantSmsCampaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'name' => $campaign->name,
            'audience_type' => $campaign->audience_type,
            'audience_ref_id' => $campaign->audience_ref_id,
            'message' => $campaign->message,
            'status' => $campaign->status,
            'estimated_recipients' => (int) $campaign->estimated_recipients,
            'estimated_credits' => (int) $campaign->estimated_credits,
            'sent_count' => (int) $campaign->sent_count,
            'failed_count' => (int) $campaign->failed_count,
            'scheduled_at' => $campaign->scheduled_at?->toISOString(),
            'sent_at' => $campaign->sent_at?->toISOString(),
            'created_at' => $campaign->created_at?->toISOString(),
            'metadata' => $campaign->metadata ?? [],
            'pending_count' => (int) $campaign->recipients()->where('status', 'pending')->count(),
            'provider_mode' => $campaign->metadata['provider_mode'] ?? 'queued_intent',
        ];
    }

    private function serializeCoupon(MerchantCoupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'name' => $coupon->name,
            'description' => $coupon->description,
            'discount_type' => $coupon->discount_type,
            'discount_value' => (float) $coupon->discount_value,
            'minimum_order_amount' => $coupon->minimum_order_amount !== null ? (float) $coupon->minimum_order_amount : null,
            'maximum_discount_amount' => $coupon->maximum_discount_amount !== null ? (float) $coupon->maximum_discount_amount : null,
            'applies_to_type' => $coupon->applies_to_type,
            'applies_to_id' => $coupon->applies_to_id !== null ? (int) $coupon->applies_to_id : null,
            'usage_limit' => $coupon->usage_limit,
            'usage_limit_per_customer' => $coupon->usage_limit_per_customer,
            'times_used' => (int) $coupon->times_used,
            'starts_at' => $coupon->starts_at?->toISOString(),
            'ends_at' => $coupon->ends_at?->toISOString(),
            'status' => $coupon->status,
            'is_active_now' => $coupon->isActiveNow(),
            'campaign_url' => url('/campaign/'.$coupon->merchant?->username.'/'.$coupon->code),
            'created_at' => $coupon->created_at?->toISOString(),
        ];
    }

    private function serializeReferralLink(MerchantReferralLink $link): array
    {
        $commissionSummary = $this->referralCommissionSummary($link);

        return [
            'id' => $link->id,
            'code' => $link->code,
            'label' => $link->label,
            'target_type' => $link->target_type,
            'target_id' => $link->target_id !== null ? (int) $link->target_id : null,
            'reward_type' => $link->reward_type,
            'reward_value' => (float) $link->reward_value,
            'clicks_count' => (int) $link->clicks_count,
            'conversions_count' => (int) $link->conversions_count,
            'revenue_amount' => (float) $link->revenue_amount,
            'commission_pending' => $commissionSummary['pending'],
            'commission_paid' => $commissionSummary['paid'],
            'commission_void' => $commissionSummary['void'],
            'commission_orders' => $commissionSummary['orders'],
            'last_clicked_at' => $link->last_clicked_at?->toISOString(),
            'last_converted_at' => $link->last_converted_at?->toISOString(),
            'starts_at' => $link->starts_at?->toISOString(),
            'ends_at' => $link->ends_at?->toISOString(),
            'status' => $link->status,
            'is_active_now' => $link->isActiveNow(),
            'url' => url('/r/'.$link->code),
            'campaign_url' => url('/campaign/'.$link->merchant?->username.'/'.$link->code),
            'target_url' => $this->referralTargetUrl($link),
            'created_at' => $link->created_at?->toISOString(),
        ];
    }

    private function serializeGroupSaleCampaign(MerchantGroupSaleCampaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'product_id' => $campaign->product_id,
            'product_title' => $campaign->product?->title,
            'slug' => $campaign->slug,
            'title' => $campaign->title,
            'description' => $campaign->description,
            'campaign_price' => (float) $campaign->campaign_price,
            'regular_price' => $campaign->regular_price !== null ? (float) $campaign->regular_price : null,
            'unit_label' => $this->productUnitLabel($campaign->product),
            'goal_quantity' => (int) $campaign->goal_quantity,
            'reserved_quantity' => (int) $campaign->reserved_quantity,
            'converted_quantity' => (int) $campaign->converted_quantity,
            'progress_percent' => $campaign->progressPercent(),
            'starts_at' => $campaign->starts_at?->toISOString(),
            'ends_at' => $campaign->ends_at?->toISOString(),
            'status' => $campaign->status,
            'allow_sms_updates' => (bool) $campaign->allow_sms_updates,
            'is_joinable' => $campaign->isJoinable(),
            'is_checkout_open' => $campaign->status === 'successful' || $campaign->reserved_quantity >= $campaign->goal_quantity,
            'url' => url('/group-sale/'.$campaign->slug),
            'created_at' => $campaign->created_at?->toISOString(),
        ];
    }

    private function notifySuccessfulGroupSaleParticipants(MerchantGroupSaleCampaign $campaign): void
    {
        if (! $campaign->allow_sms_updates) {
            return;
        }

        $campaign->loadMissing('merchant:id,display_name,username', 'product:id,slug');
        $message = sprintf(
            '%s group sale is ready. Buy now for TSh %s: %s',
            $campaign->title,
            number_format((float) $campaign->campaign_price),
            url('/product/'.$campaign->product?->slug.'?group_sale='.$campaign->slug)
        );

        DB::transaction(function () use ($campaign, $message) {
            $campaign->participants()
                ->where('status', 'joined')
                ->where('wants_sms_updates', true)
                ->whereNotNull('phone')
                ->get()
                ->each(function (MerchantGroupSaleParticipant $participant) use ($campaign, $message) {
                    NotificationLog::query()->create([
                        'user_id' => $participant->user_id,
                        'channel' => 'sms',
                        'recipient' => $participant->phone,
                        'phone' => $participant->phone,
                        'message' => $message,
                        'status' => 'sent',
                        'gateway' => 'simulated',
                        'metadata' => [
                            'group_sale_campaign_id' => $campaign->id,
                            'group_sale_slug' => $campaign->slug,
                            'purpose' => 'group_sale_success',
                        ],
                    ]);

                    $participant->update(['status' => 'notified']);
                });
        });
    }

    private function serializePublicGroupSaleCampaign(MerchantGroupSaleCampaign $campaign): array
    {
        return $this->serializeGroupSaleCampaign($campaign) + [
            'merchant' => [
                'username' => $campaign->merchant?->username,
                'display_name' => $campaign->merchant?->display_name,
                'avatar_url' => $campaign->merchant?->avatar_url,
            ],
            'product' => [
                'id' => $campaign->product?->id,
                'title' => $campaign->product?->title,
                'slug' => $campaign->product?->slug,
                'image_url' => $campaign->product?->image_url,
                'unit_type' => $campaign->product?->unitType ? [
                    'id' => $campaign->product->unitType->id,
                    'name' => $campaign->product->unitType->name,
                    'code' => $campaign->product->unitType->code,
                    'symbol' => $campaign->product->unitType->symbol,
                    'allows_decimal' => (bool) $campaign->product->unitType->allows_decimal,
                ] : null,
                'sellable_quantity' => $campaign->product?->sellable_quantity !== null ? (float) $campaign->product->sellable_quantity : 1,
            ],
        ];
    }

    private function unitPriceSuffix(?Product $product): string
    {
        $unitLabel = $this->productUnitLabel($product);

        return $unitLabel ? ' / '.$unitLabel : '';
    }

    private function productUnitLabel(?Product $product): ?string
    {
        if (!$product?->unitType) {
            return null;
        }

        $quantity = (float) ($product->sellable_quantity ?: 1);
        $unit = $product->unitType->symbol ?: $product->unitType->name;

        return $quantity !== 1.0
            ? rtrim(rtrim(number_format($quantity, 3, '.', ''), '0'), '.').' '.$unit
            : $unit;
    }

    private function referralCommissionSummary(MerchantReferralLink $link): array
    {
        $orders = $link->relationLoaded('orders')
            ? $link->orders
            : $link->orders()->latest()->limit(10)->with('buyer:id,name,phone_number')->get();

        $allOrders = Order::query()
            ->where('merchant_referral_link_id', $link->id)
            ->get(['id', 'public_id', 'buyer_id', 'total_paid', 'referral_commission_amount', 'referral_commission_status', 'referral_commission_paid_at', 'created_at']);

        return [
            'pending' => (float) $allOrders
                ->whereIn('referral_commission_status', ['pending', 'approved'])
                ->sum('referral_commission_amount'),
            'paid' => (float) $allOrders
                ->where('referral_commission_status', 'paid')
                ->sum('referral_commission_amount'),
            'void' => (float) $allOrders
                ->where('referral_commission_status', 'void')
                ->sum('referral_commission_amount'),
            'orders' => $orders->map(fn (Order $order) => [
                'id' => $order->id,
                'public_id' => $order->public_id,
                'buyer_name' => $order->buyer?->name,
                'total_paid' => (float) $order->total_paid,
                'commission_amount' => (float) $order->referral_commission_amount,
                'commission_status' => $order->referral_commission_status,
                'commission_paid_at' => $order->referral_commission_paid_at?->toISOString(),
                'created_at' => $order->created_at?->toISOString(),
            ])->values(),
        ];
    }

    private function campaignTarget(Merchant $merchant, string $targetType, ?int $targetId): array
    {
        $target = match ($targetType) {
            'product' => Product::query()->with('images')->where('merchant_id', $merchant->id)->find($targetId),
            'bundle' => Bundle::query()->where('merchant_id', $merchant->id)->find($targetId),
            'subscription_plan' => SubscriptionPlan::query()->where('merchant_id', $merchant->id)->find($targetId),
            'post' => Post::query()->where('merchant_id', $merchant->id)->find($targetId),
            'content_item' => ContentItem::query()->where('merchant_id', $merchant->id)->find($targetId),
            default => null,
        };

        if (!$target) {
            return [
                'type' => 'storefront',
                'id' => $merchant->id,
                'title' => $merchant->display_name ?: $merchant->username,
                'description' => $merchant->bio ?: 'Explore this creator storefront on Takeer.',
                'price' => null,
                'image_url' => $merchant->avatar_url,
                'url' => url('/m/'.$merchant->username),
            ];
        }

        return [
            'type' => $targetType,
            'id' => $target->id,
            'title' => $target->title ?? $target->name ?? 'Campaign offer',
            'description' => $target->description ?? $target->excerpt ?? $target->caption ?? null,
            'price' => isset($target->price) ? (float) $target->price : (isset($target->restricted_price) ? (float) $target->restricted_price : null),
            'image_url' => $target->image_url ?? $target->avatar_url ?? null,
            'url' => url($this->campaignTargetPath($merchant, $targetType, $targetId)),
        ];
    }

    private function campaignTargetPath(Merchant $merchant, string $targetType, ?int $targetId): string
    {
        return match ($targetType) {
            'product' => ($target = Product::query()->where('merchant_id', $merchant->id)->find($targetId))?->slug ? '/product/'.$target->slug : '/m/'.$merchant->username,
            'bundle' => ($target = Bundle::query()->where('merchant_id', $merchant->id)->find($targetId))?->slug ? '/bundle/'.$target->slug : '/m/'.$merchant->username,
            'subscription_plan' => ($target = SubscriptionPlan::query()->where('merchant_id', $merchant->id)->find($targetId))?->slug ? '/plan/'.$target->slug : '/m/'.$merchant->username,
            'post' => ($target = Post::query()->where('merchant_id', $merchant->id)->find($targetId))?->public_id ? '/p/'.$target->public_id : '/m/'.$merchant->username,
            'content_item' => ($target = ContentItem::query()->where('merchant_id', $merchant->id)->find($targetId))?->slug ? '/content/'.$target->slug : '/m/'.$merchant->username,
            default => '/m/'.$merchant->username,
        };
    }

    private function appendCampaignParams(string $path, ?MerchantCoupon $coupon, ?MerchantReferralLink $referral): string
    {
        $params = [
            'source' => 'campaign',
            'utm_source' => 'takeer_campaign',
            'utm_medium' => 'landing_page',
        ];

        if ($coupon) {
            $params['coupon'] = $coupon->code;
            $params['utm_campaign'] = 'coupon_'.$coupon->code;
        }

        if ($referral) {
            $params['ref'] = $referral->code;
            $params['utm_campaign'] = $params['utm_campaign'] ?? 'referral_'.$referral->code;
        }

        return $path.(str_contains($path, '?') ? '&' : '?').http_build_query($params);
    }

    private function discountLabel(MerchantCoupon $coupon): string
    {
        return $coupon->discount_type === 'fixed'
            ? 'TSh '.number_format((float) $coupon->discount_value).' off'
            : number_format((float) $coupon->discount_value).'% off';
    }

    private function referralTargetUrl(MerchantReferralLink $link): string
    {
        $storefrontPath = '/m/'.$link->merchant?->username;
        $path = match ($link->target_type) {
            'product' => ($target = Product::query()->find($link->target_id))?->slug ? '/product/'.$target->slug : $storefrontPath,
            'bundle' => ($target = Bundle::query()->find($link->target_id))?->slug ? '/bundle/'.$target->slug : $storefrontPath,
            'subscription_plan' => ($target = SubscriptionPlan::query()->find($link->target_id))?->slug ? '/plan/'.$target->slug : $storefrontPath,
            'post' => ($target = Post::query()->find($link->target_id))?->public_id ? '/p/'.$target->public_id : $storefrontPath,
            'content_item' => ($target = ContentItem::query()->find($link->target_id))?->slug ? '/content/'.$target->slug : $storefrontPath,
            default => $storefrontPath,
        };

        return url($path).(str_contains($path, '?') ? '&' : '?').'ref='.$link->code;
    }
}
