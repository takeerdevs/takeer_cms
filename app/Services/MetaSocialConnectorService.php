<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\MerchantSocialAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MetaSocialConnectorService
{
    public function authorizationUrl(string $state): string
    {
        $loginType = (string) config('services.meta.login_type', 'instagram');
        $clientId = (string) config('services.meta.client_id');
        $redirectUri = $this->redirectUri();
        $scopes = implode(',', (array) config('services.meta.scopes', []));

        $baseUrl = $loginType === 'facebook'
            ? 'https://www.facebook.com/'.$this->graphVersion().'/dialog/oauth'
            : 'https://www.instagram.com/oauth/authorize';

        $params = [
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => $scopes,
            'state' => $state,
        ];

        if ($loginType === 'instagram') {
            $params['enable_fb_login'] = 0;
            $params['force_authentication'] = 1;
            if (config('services.meta.configuration_id')) {
                $params['config_id'] = config('services.meta.configuration_id');
            }
        }

        return $baseUrl.'?'.http_build_query($params);
    }

    public function configured(): bool
    {
        return (bool) config('services.meta.client_id')
            && (bool) config('services.meta.client_secret')
            && (bool) $this->redirectUri();
    }

    public function connectFromCode(Merchant $merchant, string $code, ?int $userId = null): Collection
    {
        $loginType = (string) config('services.meta.login_type', 'instagram');

        return $loginType === 'facebook'
            ? $this->connectFacebookLogin($merchant, $code, $userId)
            : $this->connectInstagramLogin($merchant, $code, $userId);
    }

    public function recentMedia(MerchantSocialAccount $account, int $limit = 30): Collection
    {
        if (! $account->access_token) {
            return collect();
        }

        $response = Http::timeout(20)
            ->withToken($account->access_token)
            ->get($this->instagramGraphBase().'/'.$account->provider_account_id.'/media', [
                'fields' => 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count',
                'limit' => max(1, min($limit, 100)),
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Meta media import failed: '.Str::limit($response->body(), 800));
        }

        return collect($response->json('data') ?: [])->map(fn (array $media) => [
            'id' => $media['id'] ?? null,
            'caption' => $media['caption'] ?? null,
            'media_type' => $media['media_type'] ?? null,
            'media_url' => $media['media_url'] ?? null,
            'thumbnail_url' => $media['thumbnail_url'] ?? $media['media_url'] ?? null,
            'permalink' => $media['permalink'] ?? null,
            'timestamp' => $media['timestamp'] ?? null,
            'comments_count' => (int) ($media['comments_count'] ?? 0),
            'like_count' => (int) ($media['like_count'] ?? 0),
        ])->filter(fn ($media) => ! empty($media['id']))->values();
    }

    public function normalizeCommentWebhook(array $payload): Collection
    {
        if (! empty($payload['comment_id']) || ! empty($payload['account_id'])) {
            return collect([$payload]);
        }

        return collect($payload['entry'] ?? [])
            ->flatMap(function (array $entry) {
                return collect($entry['changes'] ?? [])->map(function (array $change) use ($entry) {
                    $value = $change['value'] ?? [];
                    $from = $value['from'] ?? [];

                    return [
                        'platform' => ($entry['object'] ?? null) === 'page' ? 'facebook' : 'instagram',
                        'account_id' => (string) ($entry['id'] ?? $value['ig_id'] ?? $value['page_id'] ?? ''),
                        'post_id' => (string) ($value['media_id'] ?? $value['post_id'] ?? $value['parent_id'] ?? ''),
                        'comment_id' => (string) ($value['id'] ?? $value['comment_id'] ?? ''),
                        'commenter_id' => (string) ($from['id'] ?? $value['from_id'] ?? ''),
                        'commenter_username' => $from['username'] ?? $from['name'] ?? $value['username'] ?? null,
                        'text' => $value['text'] ?? $value['message'] ?? '',
                        'raw_field' => $change['field'] ?? null,
                        'raw_value' => $value,
                    ];
                });
            })
            ->filter(fn (array $event) => $event['account_id'] !== '' && $event['comment_id'] !== '')
            ->values();
    }

    public function validSignature(Request $request): bool
    {
        $appSecret = (string) config('services.meta.client_secret');
        if ($appSecret === '') {
            return true;
        }

        $signature = (string) $request->header('X-Hub-Signature-256', '');
        if (! str_starts_with($signature, 'sha256=')) {
            return false;
        }

        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $appSecret);

        return hash_equals($expected, $signature);
    }

    private function connectInstagramLogin(Merchant $merchant, string $code, ?int $userId): Collection
    {
        $shortToken = Http::asForm()
            ->timeout(20)
            ->post('https://api.instagram.com/oauth/access_token', [
                'client_id' => config('services.meta.client_id'),
                'client_secret' => config('services.meta.client_secret'),
                'grant_type' => 'authorization_code',
                'redirect_uri' => $this->redirectUri(),
                'code' => $code,
            ]);

        if (! $shortToken->successful()) {
            throw new \RuntimeException('Meta token exchange failed: '.Str::limit($shortToken->body(), 800));
        }

        $token = (string) $shortToken->json('access_token');
        $longToken = Http::timeout(20)->get($this->instagramGraphBase().'/access_token', [
            'grant_type' => 'ig_exchange_token',
            'client_secret' => config('services.meta.client_secret'),
            'access_token' => $token,
        ]);

        if ($longToken->successful() && $longToken->json('access_token')) {
            $token = (string) $longToken->json('access_token');
        }

        $profile = Http::timeout(20)
            ->withToken($token)
            ->get($this->instagramGraphBase().'/me', [
                'fields' => 'id,user_id,username,name,account_type,profile_picture_url',
            ]);

        if (! $profile->successful()) {
            throw new \RuntimeException('Meta profile lookup failed: '.Str::limit($profile->body(), 800));
        }

        $accountId = (string) ($profile->json('user_id') ?: $profile->json('id'));
        $account = MerchantSocialAccount::query()->updateOrCreate(
            ['platform' => 'instagram', 'provider_account_id' => $accountId],
            [
                'merchant_id' => $merchant->id,
                'connected_by' => $userId,
                'username' => $profile->json('username'),
                'display_name' => $profile->json('name') ?: $profile->json('username'),
                'account_type' => $profile->json('account_type') ?: 'professional',
                'access_token' => $token,
                'token_expires_at' => now()->addSeconds((int) ($longToken->json('expires_in') ?: 5184000)),
                'status' => 'connected',
                'metadata' => [
                    'login_type' => 'instagram',
                    'profile_picture_url' => $profile->json('profile_picture_url'),
                ],
            ]
        );

        return collect([$account]);
    }

    private function connectFacebookLogin(Merchant $merchant, string $code, ?int $userId): Collection
    {
        $tokenResponse = Http::timeout(20)
            ->get($this->facebookGraphBase().'/oauth/access_token', [
                'client_id' => config('services.meta.client_id'),
                'client_secret' => config('services.meta.client_secret'),
                'redirect_uri' => $this->redirectUri(),
                'code' => $code,
            ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException('Meta token exchange failed: '.Str::limit($tokenResponse->body(), 800));
        }

        $userToken = (string) $tokenResponse->json('access_token');
        $pages = Http::timeout(20)
            ->withToken($userToken)
            ->get($this->facebookGraphBase().'/me/accounts', [
                'fields' => 'id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}',
                'limit' => 100,
            ]);

        if (! $pages->successful()) {
            throw new \RuntimeException('Meta page lookup failed: '.Str::limit($pages->body(), 800));
        }

        return collect($pages->json('data') ?: [])
            ->filter(fn (array $page) => ! empty($page['instagram_business_account']['id']))
            ->map(function (array $page) use ($merchant, $userId) {
                $ig = $page['instagram_business_account'];

                return MerchantSocialAccount::query()->updateOrCreate(
                    ['platform' => 'instagram', 'provider_account_id' => (string) $ig['id']],
                    [
                        'merchant_id' => $merchant->id,
                        'connected_by' => $userId,
                        'username' => $ig['username'] ?? null,
                        'display_name' => $ig['name'] ?? $ig['username'] ?? $page['name'] ?? null,
                        'account_type' => 'business',
                        'access_token' => $page['access_token'] ?? null,
                        'status' => 'connected',
                        'metadata' => [
                            'login_type' => 'facebook',
                            'page_id' => $page['id'] ?? null,
                            'page_name' => $page['name'] ?? null,
                            'tasks' => $page['tasks'] ?? [],
                            'profile_picture_url' => $ig['profile_picture_url'] ?? null,
                        ],
                    ]
                );
            })
            ->values();
    }

    private function redirectUri(): string
    {
        return (string) (config('services.meta.redirect_uri') ?: url('/merchant/social/meta/callback'));
    }

    private function graphVersion(): string
    {
        return (string) config('services.meta.graph_version', 'v24.0');
    }

    private function instagramGraphBase(): string
    {
        return 'https://graph.instagram.com/'.$this->graphVersion();
    }

    private function facebookGraphBase(): string
    {
        return rtrim((string) config('services.meta.graph_api_base_url', 'https://graph.facebook.com'), '/').'/'.$this->graphVersion();
    }
}
