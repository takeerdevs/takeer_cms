<?php

namespace App\Services;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\MerchantSocialAccount;
use App\Models\MerchantSocialDmCampaign;
use App\Models\MerchantSocialDmEvent;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SocialDmAutomationService
{
    public function handleComment(array $payload): ?MerchantSocialDmEvent
    {
        $platform = strtolower((string) ($payload['platform'] ?? 'instagram'));
        $accountId = (string) ($payload['account_id'] ?? $payload['ig_user_id'] ?? '');
        $commentId = (string) ($payload['comment_id'] ?? $payload['id'] ?? '');
        $postId = (string) ($payload['post_id'] ?? $payload['media_id'] ?? '');
        $commentText = trim((string) ($payload['text'] ?? $payload['comment_text'] ?? ''));

        if ($accountId === '' || $commentId === '') {
            return null;
        }

        $account = MerchantSocialAccount::query()
            ->where('platform', $platform)
            ->where('provider_account_id', $accountId)
            ->where('status', 'connected')
            ->first();

        if (! $account) {
            return null;
        }

        $account->forceFill(['last_webhook_at' => now()])->save();

        $campaign = $this->matchingCampaign($account, $postId, $commentText);
        $matchedKeyword = $campaign ? $this->matchedKeyword($campaign, $commentText) : null;

        return DB::transaction(function () use ($payload, $platform, $account, $campaign, $commentId, $postId, $commentText, $matchedKeyword) {
            $event = MerchantSocialDmEvent::query()->firstOrCreate(
                ['platform' => $platform, 'provider_comment_id' => $commentId],
                [
                    'merchant_id' => $account->merchant_id,
                    'campaign_id' => $campaign?->id,
                    'social_account_id' => $account->id,
                    'provider_post_id' => $postId ?: null,
                    'commenter_provider_id' => $payload['commenter_id'] ?? null,
                    'commenter_username' => $payload['commenter_username'] ?? null,
                    'comment_text' => $commentText ?: null,
                    'matched_keyword' => $matchedKeyword,
                    'status' => $campaign ? 'matched' : 'ignored',
                    'received_at' => now(),
                    'payload' => $payload,
                ]
            );

            if ($event->wasRecentlyCreated && $campaign) {
                $campaign->increment('comments_count');
                $campaign->increment('matched_count');

                $sendResult = $this->sendPrivateReply($account, $campaign, $commentId, $event);
                $event->forceFill($sendResult)->save();

                $campaign->forceFill(['last_triggered_at' => now()])->save();
                $campaign->increment(in_array($sendResult['status'], ['dm_sent', 'dm_simulated'], true) ? 'dm_sent_count' : 'dm_failed_count');
            } elseif ($event->wasRecentlyCreated) {
                MerchantSocialDmCampaign::query()
                    ->where('social_account_id', $account->id)
                    ->where('platform', $platform)
                    ->where(function ($query) use ($postId) {
                        $query->whereNull('post_provider_id');
                        if ($postId !== '') {
                            $query->orWhere('post_provider_id', $postId);
                        }
                    })
                    ->increment('comments_count');
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

    private function matchingCampaign(MerchantSocialAccount $account, string $postId, string $commentText): ?MerchantSocialDmCampaign
    {
        return MerchantSocialDmCampaign::query()
            ->where('merchant_id', $account->merchant_id)
            ->where('platform', $account->platform)
            ->where(function ($query) use ($account) {
                $query->whereNull('social_account_id')->orWhere('social_account_id', $account->id);
            })
            ->where(function ($query) use ($postId) {
                $query->whereNull('post_provider_id');
                if ($postId !== '') {
                    $query->orWhere('post_provider_id', $postId);
                }
            })
            ->latest()
            ->get()
            ->first(fn (MerchantSocialDmCampaign $campaign) => $campaign->isActiveNow() && $this->matchedKeyword($campaign, $commentText) !== null);
    }

    private function matchedKeyword(MerchantSocialDmCampaign $campaign, string $commentText): ?string
    {
        $normalizedText = Str::lower(trim($commentText));
        $keywords = collect($campaign->trigger_keywords ?: [])->map(fn ($keyword) => Str::lower(trim((string) $keyword)))->filter();

        if ($keywords->isEmpty()) {
            return $normalizedText !== '' ? '*' : null;
        }

        foreach ($keywords as $keyword) {
            if ($campaign->match_mode === 'exact' && $normalizedText === $keyword) {
                return $keyword;
            }

            if ($campaign->match_mode !== 'exact' && Str::contains($normalizedText, $keyword)) {
                return $keyword;
            }
        }

        return null;
    }

    private function sendPrivateReply(MerchantSocialAccount $account, MerchantSocialDmCampaign $campaign, string $commentId, MerchantSocialDmEvent $event): array
    {
        $destinationUrl = $campaign->destination_url ?: $this->destinationUrl($campaign->merchant, $campaign->destination_type, $campaign->destination_id);
        $trackedUrl = url('/dm/t/'.$event->id).'?to='.rawurlencode(url($destinationUrl));
        $message = Str::of($campaign->dm_message)
            ->replace('{{link}}', $trackedUrl)
            ->replace('{{keyword}}', (string) $event->matched_keyword)
            ->replace('{{username}}', (string) $event->commenter_username)
            ->toString();

        if (! $account->access_token) {
            return [
                'status' => 'dm_simulated',
                'dm_message' => $message,
                'destination_url' => $trackedUrl,
                'provider_message_id' => 'sim_'.Str::random(18),
                'sent_at' => now(),
            ];
        }

        try {
            $response = Http::asJson()
                ->withToken($account->access_token)
                ->post('https://graph.instagram.com/v24.0/'.$account->provider_account_id.'/messages', [
                    'recipient' => ['comment_id' => $commentId],
                    'message' => ['text' => $message],
                ]);

            if ($response->successful()) {
                return [
                    'status' => 'dm_sent',
                    'dm_message' => $message,
                    'destination_url' => $trackedUrl,
                    'provider_message_id' => $response->json('message_id'),
                    'sent_at' => now(),
                ];
            }

            return [
                'status' => 'dm_failed',
                'dm_message' => $message,
                'destination_url' => $trackedUrl,
                'error_message' => Str::limit($response->body(), 1000),
            ];
        } catch (\Throwable $exception) {
            return [
                'status' => 'dm_failed',
                'dm_message' => $message,
                'destination_url' => $trackedUrl,
                'error_message' => Str::limit($exception->getMessage(), 1000),
            ];
        }
    }
}
