<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessTryOnSession;
use App\Models\Merchant;
use App\Models\Product;
use App\Models\ProductTryOnAsset;
use App\Models\TryOnSession;
use App\Services\TryOnStorageService;
use App\Services\AiCreditService;
use App\Support\MerchantPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class VirtualTryOnController extends Controller
{
    public function store(Request $request, Product $product, TryOnStorageService $storage, AiCreditService $credits): JsonResponse
    {
        abort_unless($product->type === 'physical' && (bool) $product->try_on_enabled, 404);

        $maxMb = max(1, min(25, (int) config('services.try_on.max_portrait_mb', 10)));
        $validated = $request->validate([
            'portrait' => [
                'required',
                'file',
                'max:'.($maxMb * 1024),
                'mimetypes:image/jpeg,image/png,image/webp',
                'dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
            ],
            'variant_id' => ['nullable', 'integer'],
            'consent' => ['accepted'],
        ]);

        $variantId = $validated['variant_id'] ?? null;
        if ($variantId) {
            abort_unless(
                $product->variants()->whereKey($variantId)->where('is_active', true)->exists(),
                422,
                'Selected product variant is not available.'
            );
        }

        $assetQuery = $product->tryOnAssets()->where('is_active', true);
        $hasAsset = $variantId
            ? $assetQuery->where(function ($query) use ($variantId) {
                $query->where('product_variant_id', $variantId)->orWhereNull('product_variant_id');
            })->exists()
            : $assetQuery->whereNull('product_variant_id')->exists();

        abort_unless($hasAsset, 422, 'This product is not ready for virtual try-on yet.');

        $reservation = null;
        if ($request->user()) {
            $access = $credits->accessFor($request->user(), 'virtual_try_on');
            if (! $access['allowed']) {
                return response()->json([
                    'message' => 'Virtual try-on needs an AI plan or more credits.',
                    'code' => 'ai_access_required',
                    'access' => $access,
                ], 402);
            }

            $reservation = $credits->reserveTask(
                $request->user(),
                'virtual_try_on',
                'virtual-try-on:'.Str::uuid(),
            );
        }

        $plainToken = Str::random(64);
        $publicId = (string) Str::uuid();
        $stored = null;
        try {
            $stored = $storage->storeUpload(
                $request->file('portrait'),
                'try-on/portraits',
                strtolower((string) ($request->file('portrait')->extension() ?: 'jpg'))
            );

            $session = TryOnSession::create([
                'public_id' => $publicId,
                'product_id' => $product->id,
                'product_variant_id' => $variantId,
                'user_id' => $request->user()?->id,
                'access_token_hash' => hash('sha256', $plainToken),
                'portrait_disk' => $stored['disk'],
                'portrait_path' => $stored['path'],
                'portrait_mime' => $request->file('portrait')->getMimeType(),
                'portrait_size' => $request->file('portrait')->getSize(),
                'status' => 'pending',
                'expires_at' => now()->addHours(max(1, (int) config('services.try_on.session_ttl_hours', 24))),
                'metadata' => [
                    'consent_at' => now()->toISOString(),
                    'source' => 'product_detail',
                    'ai_credit_reservation_id' => $reservation?->id,
                    'ai_credit_amount' => $reservation ? (float) $reservation->amount : 0,
                ],
            ]);
        } catch (\Throwable $exception) {
            if ($stored) {
                $storage->delete($stored['disk'], $stored['path']);
            }
            if ($reservation) {
                $credits->release($reservation, ['reason' => 'session_creation_failed']);
            }
            throw $exception;
        }

        ProcessTryOnSession::dispatch($session->id)->afterCommit();

        return response()->json([
            'session_id' => $session->public_id,
            'token' => $plainToken,
            'status' => $session->status,
            'poll_url' => route('try-on.session.status', ['session' => $session->public_id, 'token' => $plainToken]),
            'expires_at' => $session->expires_at?->toISOString(),
        ], 202);
    }

    public function status(Request $request, string $session): JsonResponse
    {
        $tryOnSession = $this->findSession($session, $request);
        $this->authorizeSession($request, $tryOnSession);

        if ($tryOnSession->isExpired()) {
            return response()->json(['message' => 'This try-on session has expired.'], 410);
        }

        return response()->json($this->sessionPayload($tryOnSession, $request));
    }

    public function result(Request $request, string $session, TryOnStorageService $storage): Response
    {
        $tryOnSession = $this->findSession($session, $request);
        $this->authorizeSession($request, $tryOnSession);
        abort_unless($tryOnSession->status === 'completed' && $tryOnSession->result_path, 409, 'Try-on result is not ready.');
        abort_unless(! $tryOnSession->isExpired(), 410, 'This try-on result has expired.');

        return $storage->response(
            $tryOnSession->result_disk ?: $storage->diskName(),
            (string) $tryOnSession->result_path,
            $tryOnSession->result_mime ?: 'image/jpeg',
            'takeer-try-on-'.$tryOnSession->public_id.'.jpg'
        );
    }

    public function assetImage(ProductTryOnAsset $asset, TryOnStorageService $storage): Response
    {
        abort_unless($asset->is_active && $asset->product?->type === 'physical', 404);

        return $storage->response(
            $asset->disk,
            $asset->garment_path,
            $asset->mime ?: 'image/png',
            'garment-'.$asset->id.'.'.($asset->mime === 'image/jpeg' ? 'jpg' : 'png')
        );
    }

    public function merchantConfig(Request $request, Product $product): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->authorizeMerchantProduct($product, $merchant);

        $product->load(['tryOnAssets.variant', 'variants:id,product_id,name,is_active']);

        return response()->json([
            'enabled' => (bool) $product->try_on_enabled,
            'eligible' => $product->type === 'physical',
            'assets' => $product->tryOnAssets->map(fn (ProductTryOnAsset $asset) => $this->assetPayload($asset))->values(),
            'variants' => $product->variants->map(fn ($variant) => [
                'id' => $variant->id,
                'name' => $variant->name,
                'is_active' => (bool) $variant->is_active,
            ])->values(),
        ]);
    }

    public function uploadAsset(Request $request, Product $product, TryOnStorageService $storage): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->authorizeMerchantProduct($product, $merchant);
        abort_unless($product->type === 'physical', 422, 'Virtual try-on is only available for physical products.');

        $validated = $request->validate([
            'garment' => [
                'required',
                'file',
                'max:10240',
                'mimetypes:image/jpeg,image/png,image/webp',
                'dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
            ],
            'variant_id' => ['nullable', 'integer'],
        ]);

        $variantId = $validated['variant_id'] ?? null;
        if ($variantId) {
            abort_unless($product->variants()->whereKey($variantId)->exists(), 422, 'Selected variant does not belong to this product.');
        }

        $existing = $product->tryOnAssets()
            ->when($variantId, fn ($query) => $query->where('product_variant_id', $variantId), fn ($query) => $query->whereNull('product_variant_id'))
            ->where('is_active', true)
            ->latest('id')
            ->first();

        if ($existing) {
            Storage::disk($existing->disk)->delete($existing->garment_path);
            $existing->update(['is_active' => false]);
        }

        $file = $request->file('garment');
        $stored = $storage->storeUpload($file, 'try-on/garments', strtolower((string) ($file->extension() ?: 'png')));
        $asset = $product->tryOnAssets()->create([
            'product_variant_id' => $variantId,
            'disk' => $stored['disk'],
            'garment_path' => $stored['path'],
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
            'metadata' => [
                'category' => 'upper_body',
                'upload_note' => 'For best results, use a front-facing transparent PNG of the garment.',
            ],
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Try-on garment saved.',
            'asset' => $this->assetPayload($asset),
        ], 201);
    }

    public function updateConfig(Request $request, Product $product): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->authorizeMerchantProduct($product, $merchant);
        abort_unless($product->type === 'physical', 422, 'Virtual try-on is only available for physical products.');

        $validated = $request->validate(['enabled' => ['required', 'boolean']]);
        if ($validated['enabled'] && ! $product->tryOnAssets()->where('is_active', true)->exists()) {
            return response()->json(['message' => 'Upload a garment image before enabling virtual try-on.'], 422);
        }

        $product->update(['try_on_enabled' => (bool) $validated['enabled']]);

        return response()->json([
            'message' => $product->try_on_enabled ? 'Virtual try-on enabled.' : 'Virtual try-on disabled.',
            'enabled' => (bool) $product->try_on_enabled,
        ]);
    }

    public function deleteAsset(Request $request, Product $product, ProductTryOnAsset $asset): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->authorizeMerchantProduct($product, $merchant);
        abort_unless($asset->product_id === $product->id, 404);

        Storage::disk($asset->disk)->delete($asset->garment_path);
        $asset->delete();
        if (! $product->tryOnAssets()->where('is_active', true)->exists()) {
            $product->update(['try_on_enabled' => false]);
        }

        return response()->json(['message' => 'Try-on garment removed.']);
    }

    private function findSession(string $publicId, Request $request): TryOnSession
    {
        $token = (string) $request->query('token', $request->input('token', ''));
        abort_unless($token !== '', 401, 'Try-on session token is required.');

        return TryOnSession::query()->where('public_id', $publicId)->firstOrFail();
    }

    private function authorizeSession(Request $request, TryOnSession $session): void
    {
        $token = (string) $request->query('token', $request->input('token', ''));
        abort_unless($session->hasAccessToken($token), 403, 'Invalid try-on session token.');
    }

    private function sessionPayload(TryOnSession $session, Request $request): array
    {
        $payload = [
            'session_id' => $session->public_id,
            'status' => $session->status,
            'error_message' => $session->status === 'failed' ? $session->error_message : null,
            'expires_at' => $session->expires_at?->toISOString(),
            'completed_at' => $session->completed_at?->toISOString(),
        ];

        if ($session->status === 'completed' && $session->result_path) {
            $payload['result_url'] = route('try-on.session.result', [
                'session' => $session->public_id,
                'token' => (string) $request->query('token', $request->input('token', '')),
            ]);
        }

        return $payload;
    }

    private function assetPayload(ProductTryOnAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'product_variant_id' => $asset->product_variant_id,
            'variant_name' => $asset->variant?->name,
            'original_name' => $asset->original_name,
            'mime' => $asset->mime,
            'size' => $asset->size,
            'is_active' => (bool) $asset->is_active,
            'preview_url' => route('try-on.asset.image', ['asset' => $asset->id]),
        ];
    }

    private function merchantFromRequest(Request $request): Merchant
    {
        $activeMerchant = $request->attributes->get('active_merchant');
        if ($activeMerchant instanceof Merchant) {
            return $activeMerchant;
        }

        $routeMerchant = $request->route('merchant');
        if ($routeMerchant instanceof Merchant) {
            return $routeMerchant;
        }

        $user = $request->user();
        abort_unless($user, 403, 'Merchant profile not found.');
        $merchantId = $request->input('merchant_id') ?? $request->query('merchant_id') ?? session('active_merchant_id');
        $merchant = $merchantId
            ? MerchantPermissions::accessibleMerchantsFor($user)->firstWhere('id', (int) $merchantId)
            : ($user->merchantProfiles()->where('is_default', true)->first() ?? $user->merchantProfiles()->first());

        abort_unless($merchant, 403, 'Merchant profile not found.');

        return $merchant;
    }

    private function authorizeMerchantProduct(Product $product, Merchant $merchant): void
    {
        abort_unless((int) $product->merchant_id === (int) $merchant->id, 403, 'Unauthorized product access.');
    }
}
