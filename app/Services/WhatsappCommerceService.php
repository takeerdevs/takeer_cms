<?php

namespace App\Services;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\MerchantWhatsappAccount;
use App\Models\MerchantWhatsappAutomation;
use App\Models\MerchantWhatsappEvent;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class WhatsappCommerceService
{
    public function configured(): bool
    {
        return (bool) config('services.whatsapp_cloud.access_token')
            && (bool) config('services.whatsapp_cloud.phone_number_id');
    }

    public function embeddedSignupConfigured(): bool
    {
        return (bool) config('services.meta.client_id')
            && (bool) config('services.meta.client_secret')
            && (bool) config('services.whatsapp_cloud.configuration_id');
    }

    public function connectEmbeddedSignup(Merchant $merchant, array $payload, ?int $userId = null): MerchantWhatsappAccount
    {
        $code = (string) ($payload['code'] ?? '');
        $sessionInfo = $payload['session_info'] ?? [];
        $phoneNumberId = (string) ($payload['phone_number_id'] ?? data_get($sessionInfo, 'phone_number_id', ''));
        $wabaId = (string) ($payload['waba_id'] ?? data_get($sessionInfo, 'waba_id', ''));
        $businessId = (string) data_get($sessionInfo, 'business_id', '');

        if ($code === '' || $phoneNumberId === '') {
            throw new \InvalidArgumentException('Embedded Signup did not return a code and phone number ID.');
        }

        $token = $this->exchangeEmbeddedSignupCode($code);
        $phone = $this->fetchPhoneNumber($phoneNumberId, $token);

        if ($wabaId !== '') {
            $this->subscribeWabaToWebhooks($wabaId, $token);
        }

        return MerchantWhatsappAccount::query()->updateOrCreate(
            ['phone_number_id' => $phoneNumberId],
            [
                'merchant_id' => $merchant->id,
                'connected_by' => $userId,
                'business_account_id' => $wabaId ?: config('services.whatsapp_cloud.business_account_id'),
                'display_phone_number' => $phone['display_phone_number'] ?? null,
                'verified_name' => $phone['verified_name'] ?? null,
                'access_token' => $token,
                'status' => 'connected',
                'metadata' => [
                    'provider_mode' => 'embedded_signup',
                    'business_id' => $businessId ?: null,
                    'session_info' => $sessionInfo,
                ],
            ]
        );
    }

    public function normalizeWebhook(array $payload): Collection
    {
        if (! empty($payload['message_id']) || ! empty($payload['phone_number_id'])) {
            return collect([$payload]);
        }

        return collect($payload['entry'] ?? [])->flatMap(function (array $entry) {
            return collect($entry['changes'] ?? [])->flatMap(function (array $change) {
                $value = $change['value'] ?? [];
                $metadata = $value['metadata'] ?? [];
                $contacts = collect($value['contacts'] ?? [])->keyBy('wa_id');

                return collect($value['messages'] ?? [])->map(function (array $message) use ($metadata, $contacts, $value) {
                    $from = (string) ($message['from'] ?? '');
                    $contact = $contacts->get($from, []);

                    return [
                        'phone_number_id' => (string) ($metadata['phone_number_id'] ?? ''),
                        'display_phone_number' => $metadata['display_phone_number'] ?? null,
                        'message_id' => (string) ($message['id'] ?? ''),
                        'from_phone' => $from,
                        'profile_name' => $contact['profile']['name'] ?? null,
                        'text' => $message['text']['body'] ?? $message['button']['text'] ?? $message['interactive']['button_reply']['title'] ?? '',
                        'type' => $message['type'] ?? null,
                        'raw_value' => $value,
                    ];
                });
            });
        })->filter(fn (array $event) => $event['phone_number_id'] !== '' && $event['message_id'] !== '')->values();
    }

    public function validSignature(Request $request): bool
    {
        $secret = (string) config('services.whatsapp_cloud.app_secret');
        if ($secret === '') return true;

        $signature = (string) $request->header('X-Hub-Signature-256', '');
        if (! str_starts_with($signature, 'sha256=')) return false;

        return hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret), $signature);
    }

    public function handleMessage(array $payload): ?MerchantWhatsappEvent
    {
        $phoneNumberId = (string) ($payload['phone_number_id'] ?? '');
        $messageId = (string) ($payload['message_id'] ?? '');
        $messageText = trim((string) ($payload['text'] ?? ''));

        if ($phoneNumberId === '' || $messageId === '') {
            return null;
        }

        $account = MerchantWhatsappAccount::query()
            ->where('phone_number_id', $phoneNumberId)
            ->where('status', 'connected')
            ->first();

        if (! $account) {
            $configuredPhoneNumberId = (string) config('services.whatsapp_cloud.phone_number_id');
            if ($configuredPhoneNumberId !== '' && $configuredPhoneNumberId === $phoneNumberId) {
                $account = MerchantWhatsappAccount::query()->where('phone_number_id', $phoneNumberId)->first();
            }
        }

        if (! $account) return null;

        $account->forceFill(['last_webhook_at' => now()])->save();
        $automation = $this->matchingAutomation($account, $messageText);
        $matchedKeyword = $automation ? $this->matchedKeyword($automation, $messageText) : null;

        return DB::transaction(function () use ($payload, $account, $automation, $messageId, $messageText, $matchedKeyword) {
            $event = MerchantWhatsappEvent::query()->firstOrCreate(
                ['provider_message_id' => $messageId],
                [
                    'merchant_id' => $account->merchant_id,
                    'automation_id' => $automation?->id,
                    'whatsapp_account_id' => $account->id,
                    'from_phone' => $payload['from_phone'] ?? null,
                    'profile_name' => $payload['profile_name'] ?? null,
                    'message_text' => $messageText ?: null,
                    'matched_keyword' => $matchedKeyword,
                    'status' => $automation ? 'matched' : 'ignored',
                    'received_at' => now(),
                    'payload' => $payload,
                ]
            );

            if ($event->wasRecentlyCreated && $automation) {
                $automation->increment('received_count');
                $automation->increment('matched_count');
                $sendResult = $this->sendAutomationReply($account, $automation, $event);
                $event->forceFill($sendResult)->save();
                $automation->forceFill(['last_triggered_at' => now()])->save();
                $automation->increment(in_array($sendResult['status'], ['sent', 'simulated'], true) ? 'sent_count' : 'failed_count');
            } elseif ($event->wasRecentlyCreated) {
                MerchantWhatsappAutomation::query()
                    ->where('merchant_id', $account->merchant_id)
                    ->where(function ($query) use ($account) {
                        $query->whereNull('whatsapp_account_id')->orWhere('whatsapp_account_id', $account->id);
                    })
                    ->increment('received_count');
            }

            return $event->fresh();
        });
    }

    public function destinationUrl(Merchant $merchant, string $type, ?int $id): string
    {
        return match ($type) {
            'product' => optional(Product::query()->where('merchant_id', $merchant->id)->find($id), fn (Product $product) => route('product.show', $product, false)) ?? '/m/'.$merchant->username,
            'bundle' => optional(Bundle::query()->where('merchant_id', $merchant->id)->find($id), fn (Bundle $bundle) => route('bundle.show', $bundle, false)) ?? '/m/'.$merchant->username,
            'subscription_plan' => optional(SubscriptionPlan::query()->where('merchant_id', $merchant->id)->find($id), fn (SubscriptionPlan $plan) => route('subscription-plan.show', $plan, false)) ?? '/m/'.$merchant->username,
            'post' => optional(Post::query()->where('merchant_id', $merchant->id)->find($id), fn (Post $post) => route('post.show', $post->public_id ?: $post->id, false)) ?? '/m/'.$merchant->username,
            'content_item' => optional(ContentItem::query()->where('merchant_id', $merchant->id)->find($id), fn (ContentItem $item) => route('content.show', $item->slug ?: $item->id, false)) ?? '/m/'.$merchant->username,
            default => '/m/'.$merchant->username,
        };
    }

    public function normalizePhone(?string $phone): string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        if (str_starts_with($digits, '0')) return '255'.substr($digits, 1);

        return $digits;
    }

    private function matchingAutomation(MerchantWhatsappAccount $account, string $messageText): ?MerchantWhatsappAutomation
    {
        return MerchantWhatsappAutomation::query()
            ->where('merchant_id', $account->merchant_id)
            ->where(function ($query) use ($account) {
                $query->whereNull('whatsapp_account_id')->orWhere('whatsapp_account_id', $account->id);
            })
            ->latest()
            ->get()
            ->first(fn (MerchantWhatsappAutomation $automation) => $automation->isActiveNow() && $this->matchedKeyword($automation, $messageText) !== null);
    }

    private function matchedKeyword(MerchantWhatsappAutomation $automation, string $messageText): ?string
    {
        $normalized = Str::lower(trim($messageText));
        foreach (collect($automation->trigger_keywords ?: [])->map(fn ($keyword) => Str::lower(trim((string) $keyword)))->filter() as $keyword) {
            if ($automation->match_mode === 'exact' && $normalized === $keyword) return $keyword;
            if ($automation->match_mode !== 'exact' && Str::contains($normalized, $keyword)) return $keyword;
        }

        return null;
    }

    private function sendAutomationReply(MerchantWhatsappAccount $account, MerchantWhatsappAutomation $automation, MerchantWhatsappEvent $event): array
    {
        $destinationUrl = $automation->destination_url ?: $this->destinationUrl($automation->merchant, $automation->destination_type, $automation->destination_id);
        $trackedUrl = url('/wa/t/'.$event->id).'?to='.rawurlencode(url($destinationUrl));
        $message = Str::of($automation->response_message)
            ->replace('{{link}}', $trackedUrl)
            ->replace('{{keyword}}', (string) $event->matched_keyword)
            ->replace('{{name}}', (string) $event->profile_name)
            ->toString();

        $token = $account->access_token ?: (string) config('services.whatsapp_cloud.access_token');
        if (! $token) {
            return [
                'status' => 'simulated',
                'response_message' => $message,
                'destination_url' => $trackedUrl,
                'provider_response_id' => 'sim_wa_'.Str::random(18),
                'sent_at' => now(),
            ];
        }

        $response = Http::asJson()
            ->timeout(20)
            ->withToken($token)
            ->post($this->graphBase().'/'.$account->phone_number_id.'/messages', [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $event->from_phone,
                'type' => 'text',
                'text' => [
                    'preview_url' => true,
                    'body' => $message,
                ],
            ]);

        if ($response->successful()) {
            return [
                'status' => 'sent',
                'response_message' => $message,
                'destination_url' => $trackedUrl,
                'provider_response_id' => $response->json('messages.0.id'),
                'sent_at' => now(),
            ];
        }

        return [
            'status' => 'failed',
            'response_message' => $message,
            'destination_url' => $trackedUrl,
            'error_message' => Str::limit($response->body(), 1000),
        ];
    }

    private function graphBase(): string
    {
        return rtrim((string) config('services.whatsapp_cloud.graph_api_base_url', 'https://graph.facebook.com'), '/')
            .'/'.config('services.whatsapp_cloud.graph_version', 'v24.0');
    }

    private function exchangeEmbeddedSignupCode(string $code): string
    {
        $response = Http::timeout(20)->get($this->graphBase().'/oauth/access_token', [
            'client_id' => config('services.meta.client_id'),
            'client_secret' => config('services.meta.client_secret'),
            'code' => $code,
        ]);

        if (! $response->successful() || ! $response->json('access_token')) {
            throw new \RuntimeException('WhatsApp Embedded Signup token exchange failed: '.Str::limit($response->body(), 800));
        }

        return (string) $response->json('access_token');
    }

    private function fetchPhoneNumber(string $phoneNumberId, string $token): array
    {
        $response = Http::timeout(20)
            ->withToken($token)
            ->get($this->graphBase().'/'.$phoneNumberId, [
                'fields' => 'id,display_phone_number,verified_name,quality_rating,code_verification_status',
            ]);

        if (! $response->successful()) {
            return [];
        }

        return $response->json() ?: [];
    }

    private function subscribeWabaToWebhooks(string $wabaId, string $token): void
    {
        Http::timeout(20)
            ->withToken($token)
            ->post($this->graphBase().'/'.$wabaId.'/subscribed_apps');
    }
}
