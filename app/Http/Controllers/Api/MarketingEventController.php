<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\AdminSetting;
use App\Models\ContentItem;
use App\Models\MarketingEvent;
use App\Models\Merchant;
use App\Models\MerchantReferralLink;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MarketingEventController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if ($request->user()?->is_admin && AdminSetting::get('analytics_exclude_admins', '1') === '1') {
            $sessionId = $this->normalizeSessionId($request->input('session_id') ?? $request->cookie('takeer_attribution_session'));

            return response()
                ->json(['ok' => true, 'session_id' => $sessionId, 'skipped' => true], 202)
                ->cookie('takeer_attribution_session', $sessionId, 60 * 24 * 30, null, null, false, false, false, 'Lax');
        }

        $data = $request->validate([
            'session_id' => ['nullable', 'string', 'max:80'],
            'event_type' => ['required', 'string', 'max:80', Rule::in($this->eventTypes())],
            'entity_type' => ['nullable', 'string', 'max:80', Rule::in($this->entityTypes())],
            'entity_id' => ['nullable', 'integer', 'min:1'],
            'merchant_id' => ['nullable', 'integer', 'min:1'],
            'merchant_username' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', 'string', 'max:80'],
            'source_url' => ['nullable', 'string', 'max:1000'],
            'landing_url' => ['nullable', 'string', 'max:1000'],
            'referrer_url' => ['nullable', 'string', 'max:1000'],
            'utm_source' => ['nullable', 'string', 'max:120'],
            'utm_medium' => ['nullable', 'string', 'max:120'],
            'utm_campaign' => ['nullable', 'string', 'max:160'],
            'utm_content' => ['nullable', 'string', 'max:160'],
            'utm_term' => ['nullable', 'string', 'max:160'],
            'referral_code' => ['nullable', 'string', 'max:80'],
            'coupon_code' => ['nullable', 'string', 'max:64'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'metadata' => ['nullable', 'array'],
        ]);

        $sessionId = $this->normalizeSessionId($data['session_id'] ?? $request->cookie('takeer_attribution_session'));
        $entity = $this->resolveEntity($data['entity_type'] ?? null, $data['entity_id'] ?? null);
        $merchant = $this->resolveMerchant($data, $entity);
        $referralCode = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', (string) ($data['referral_code'] ?? $request->cookie('takeer_referral_code', ''))));
        $referralLink = $referralCode !== ''
            ? MerchantReferralLink::query()->where('code', $referralCode)->first()
            : null;

        $event = MarketingEvent::query()->create([
            'merchant_id' => $merchant?->id,
            'user_id' => $request->user()?->id,
            'session_id' => $sessionId,
            'event_type' => $data['event_type'],
            'entity_type' => $data['entity_type'] ?? null,
            'entity_id' => $data['entity_id'] ?? null,
            'source' => $this->normalizeSource($data),
            'source_url' => $data['source_url'] ?? null,
            'landing_url' => $data['landing_url'] ?? null,
            'referrer_url' => $data['referrer_url'] ?? $request->headers->get('referer'),
            'utm_source' => $data['utm_source'] ?? null,
            'utm_medium' => $data['utm_medium'] ?? null,
            'utm_campaign' => $data['utm_campaign'] ?? null,
            'utm_content' => $data['utm_content'] ?? null,
            'utm_term' => $data['utm_term'] ?? null,
            'merchant_referral_link_id' => $referralLink?->id,
            'referral_code' => $referralLink?->code ?: ($referralCode ?: null),
            'coupon_code' => isset($data['coupon_code']) ? strtoupper((string) $data['coupon_code']) : null,
            'value' => $data['value'] ?? null,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'metadata' => $data['metadata'] ?? [],
        ]);

        return response()
            ->json(['ok' => true, 'session_id' => $sessionId, 'event_id' => $event->id], 201)
            ->cookie('takeer_attribution_session', $sessionId, 60 * 24 * 30, null, null, false, false, false, 'Lax');
    }

    private function eventTypes(): array
    {
        return [
            'page_view',
            'feed_view',
            'search_performed',
            'search_result_clicked',
            'storefront_view',
            'product_view',
            'product_click',
            'post_view',
            'post_click',
            'content_view',
            'bundle_view',
            'subscription_plan_view',
            'creator_followed',
            'video_played',
            'audio_played',
            'download_clicked',
            'download_link_sent',
            'gallery_viewed',
            'gallery_original_downloaded',
            'document_read',
            'software_release_downloaded',
            'license_file_downloaded',
            'live_event_joined',
            'coupon_applied',
            'checkout_started',
            'checkout_completed',
            'referral_landing',
            'sms_click',
        ];
    }

    private function entityTypes(): array
    {
        return ['merchant', 'product', 'post', 'content_item', 'bundle', 'subscription_plan'];
    }

    private function resolveEntity(?string $type, ?int $id): mixed
    {
        if (!$type || !$id) {
            return null;
        }

        return match ($type) {
            'merchant' => Merchant::query()->find($id),
            'product' => Product::query()->find($id),
            'post' => Post::query()->find($id),
            'content_item' => ContentItem::query()->find($id),
            'bundle' => Bundle::query()->find($id),
            'subscription_plan' => SubscriptionPlan::query()->find($id),
            default => null,
        };
    }

    private function resolveMerchant(array $data, mixed $entity): ?Merchant
    {
        if (!empty($data['merchant_id'])) {
            return Merchant::query()->find((int) $data['merchant_id']);
        }

        if (!empty($data['merchant_username'])) {
            return Merchant::query()
                ->where('username', $data['merchant_username'])
                ->orWhere('display_name', $data['merchant_username'])
                ->first();
        }

        if ($entity instanceof Merchant) {
            return $entity;
        }

        if ($entity && isset($entity->merchant_id)) {
            return Merchant::query()->find((int) $entity->merchant_id);
        }

        return null;
    }

    private function normalizeSessionId(?string $sessionId): string
    {
        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $sessionId);

        return $sessionId !== '' ? Str::limit($sessionId, 80, '') : 'atk_'.Str::random(32);
    }

    private function normalizeSource(array $data): ?string
    {
        $source = trim((string) ($data['source'] ?? ''));
        if ($source !== '') {
            return Str::limit($source, 80, '');
        }

        if (!empty($data['utm_source'])) {
            return 'utm:'.$data['utm_source'];
        }

        if (!empty($data['referral_code'])) {
            return 'referral';
        }

        return null;
    }
}
