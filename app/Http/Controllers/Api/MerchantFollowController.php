<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantFollower;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantFollowController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $followed = MerchantFollower::query()
            ->where('user_id', $request->user()->id)
            ->with('merchant:id,username,display_name,avatar_url,bio,is_verified,business_category_key,business_subcategory_key')
            ->latest('followed_at')
            ->get()
            ->map(fn (MerchantFollower $follow) => [
                'id' => $follow->id,
                'followed_at' => $follow->followed_at?->toISOString(),
                'notification_preferences' => $this->preferences($follow),
                'merchant' => $this->merchantPayload($follow->merchant),
            ])
            ->values();

        return response()->json([
            'data' => $followed,
            'meta' => [
                'total' => $followed->count(),
            ],
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $merchant = Merchant::query()->where('username', $slug)->firstOrFail();

        return response()->json($this->payload($request, $merchant));
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $merchant = Merchant::query()->where('username', $slug)->firstOrFail();

        abort_if((int) $merchant->user_id === (int) $request->user()->id, 422, 'You cannot follow your own store.');

        MerchantFollower::query()->updateOrCreate(
            [
                'merchant_id' => $merchant->id,
                'user_id' => $request->user()->id,
            ],
            [
                'notification_preferences' => [
                    'posts' => true,
                    'offers' => true,
                    'sms' => true,
                    'whatsapp' => true,
                    'muted' => false,
                ],
                'followed_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Store followed.',
            ...$this->payload($request, $merchant),
        ], 201);
    }

    public function destroy(Request $request, string $slug): JsonResponse
    {
        $merchant = Merchant::query()->where('username', $slug)->firstOrFail();

        MerchantFollower::query()
            ->where('merchant_id', $merchant->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json([
            'message' => 'Store unfollowed.',
            ...$this->payload($request, $merchant),
        ]);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $merchant = Merchant::query()->where('username', $slug)->firstOrFail();
        $validated = $request->validate([
            'notification_preferences' => ['required', 'array'],
            'notification_preferences.posts' => ['nullable', 'boolean'],
            'notification_preferences.offers' => ['nullable', 'boolean'],
            'notification_preferences.sms' => ['nullable', 'boolean'],
            'notification_preferences.whatsapp' => ['nullable', 'boolean'],
            'notification_preferences.muted' => ['nullable', 'boolean'],
        ]);

        $follow = MerchantFollower::query()
            ->where('merchant_id', $merchant->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $follow->update([
            'notification_preferences' => [
                ...$this->preferences($follow),
                ...($validated['notification_preferences'] ?? []),
            ],
        ]);

        return response()->json([
            'message' => 'Follow preferences updated.',
            ...$this->payload($request, $merchant),
            'notification_preferences' => $this->preferences($follow->fresh()),
        ]);
    }

    private function payload(Request $request, Merchant $merchant): array
    {
        return [
            'is_owner' => (int) $merchant->user_id === (int) $request->user()->id,
            'is_following' => MerchantFollower::query()
                ->where('merchant_id', $merchant->id)
                ->where('user_id', $request->user()->id)
                ->exists(),
            'followers_count' => $merchant->followers()->count(),
        ];
    }

    private function preferences(MerchantFollower $follow): array
    {
        return [
            'posts' => (bool) ($follow->notification_preferences['posts'] ?? true),
            'offers' => (bool) ($follow->notification_preferences['offers'] ?? true),
            'sms' => (bool) ($follow->notification_preferences['sms'] ?? true),
            'whatsapp' => (bool) ($follow->notification_preferences['whatsapp'] ?? true),
            'muted' => (bool) ($follow->notification_preferences['muted'] ?? false),
        ];
    }

    private function merchantPayload(?Merchant $merchant): ?array
    {
        if (! $merchant) {
            return null;
        }

        $category = $merchant->businessCategory();

        return [
            'id' => $merchant->id,
            'name' => $merchant->display_name,
            'slug' => $merchant->username,
            'avatar_url' => $merchant->avatar_url,
            'bio' => $merchant->bio,
            'is_verified' => (bool) $merchant->is_verified,
            'business_category' => $category['subcategory_label'] ?? $category['label'] ?? null,
            'followers_count' => $merchant->followers()->count(),
        ];
    }
}
