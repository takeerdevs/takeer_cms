<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductLicenseActivation;
use App\Models\ProductLicenseKey;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductLicenseKeyController extends Controller
{
    public function validateActivation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'license_key' => 'required|string|max:160',
            'product_id' => 'nullable|integer|exists:products,id',
            'product_slug' => 'nullable|string|max:255',
            'device_id' => 'nullable|string|max:160',
            'app_version' => 'nullable|string|max:80',
            'site_url' => 'nullable|string|max:2048',
        ]);

        if (empty($validated['product_id']) && empty($validated['product_slug'])) {
            return response()->json([
                'valid' => false,
                'reason' => 'product_required',
                'message' => 'Send product_id or product_slug with the license key.',
            ], 422);
        }

        $license = ProductLicenseKey::query()
            ->with(['product:id,merchant_id,title,slug,type,digital_content_type,license_key_enabled,license_activation_limit'])
            ->where('key_hash', hash('sha256', trim($validated['license_key'])))
            ->whereHas('product', function (Builder $query) use ($validated): void {
                $query->where('type', 'digital')
                    ->where('digital_content_type', 'software')
                    ->where('license_key_enabled', true);

                if (!empty($validated['product_id'])) {
                    $query->whereKey($validated['product_id']);
                } else {
                    $query->where('slug', $validated['product_slug']);
                }
            })
            ->first();

        if (!$license) {
            return response()->json([
                'valid' => false,
                'reason' => 'not_found',
                'message' => 'License key is not valid for this product.',
            ]);
        }

        if ($license->status !== 'active') {
            return response()->json([
                'valid' => false,
                'reason' => $license->status === 'revoked' ? 'revoked' : 'inactive',
                'message' => 'License key is not active.',
                'license' => $this->publicLicensePayload($license),
            ]);
        }

        $deviceId = trim((string) ($validated['device_id'] ?? ''));
        $deviceFingerprint = $deviceId !== ''
            ? $deviceId
            : implode('|', array_filter([$request->ip(), substr((string) $request->userAgent(), 0, 255), $validated['site_url'] ?? null]));
        $deviceHash = hash('sha256', $license->id.'|'.$deviceFingerprint);
        $activationLimit = max(1, (int) ($license->product?->license_activation_limit ?? 1));
        $activation = ProductLicenseActivation::query()
            ->where('product_license_key_id', $license->id)
            ->where('device_hash', $deviceHash)
            ->first();

        if (!$activation) {
            $activeDeviceCount = ProductLicenseActivation::query()
                ->where('product_license_key_id', $license->id)
                ->where('status', 'active')
                ->count();

            if ($activeDeviceCount >= $activationLimit) {
                return response()->json([
                    'valid' => false,
                    'reason' => 'activation_limit_reached',
                    'message' => "License activation limit reached. This license allows {$activationLimit} device(s).",
                    'license' => $this->publicLicensePayload($license),
                ], 403);
            }

            $activation = new ProductLicenseActivation([
                'product_license_key_id' => $license->id,
                'product_id' => $license->product_id,
                'merchant_id' => $license->merchant_id,
                'user_id' => $license->user_id,
                'device_hash' => $deviceHash,
                'device_id' => $deviceId !== '' ? $deviceId : null,
                'status' => 'active',
                'activated_at' => now(),
            ]);
        }

        $activationMeta = array_filter([
            'device_id' => $deviceId !== '' ? $deviceId : null,
            'app_version' => $validated['app_version'] ?? null,
            'site_url' => $validated['site_url'] ?? null,
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
        ]);

        $activation->fill([
            'site_url' => $validated['site_url'] ?? null,
            'app_version' => $validated['app_version'] ?? null,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
            'last_seen_at' => now(),
        ])->save();

        $license->forceFill([
            'activation_count' => ((int) $license->activation_count) + 1,
            'last_activated_at' => now(),
            'last_activation_ip' => $request->ip(),
            'activation_meta' => $activationMeta ?: null,
        ])->save();

        return response()->json([
            'valid' => true,
            'reason' => 'active',
            'message' => 'License key is active.',
            'license' => $this->publicLicensePayload($license->fresh('product:id,merchant_id,title,slug,type,digital_content_type,license_key_enabled,license_activation_limit')),
            'offline_license' => $this->offlineLicensePayload($license->fresh('product:id,title,slug'), now()->addDays(30)),
        ]);
    }

    public function index(Request $request, Merchant $merchant, Product $product): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);
        $this->authorizeSoftwareProduct($product);

        $keys = $product->licenseKeys()
            ->with([
                'user:id,name,username,email',
                'order:id,public_id,total_paid,payment_status',
                'activations' => fn ($query) => $query->latest('last_seen_at')->limit(5),
            ])
            ->latest('issued_at')
            ->latest('id')
            ->get();

        return response()->json([
            'data' => $keys->map(fn (ProductLicenseKey $license) => $this->licensePayload($license))->values(),
            'analytics' => [
                'total_keys' => $keys->count(),
                'active_keys' => $keys->where('status', 'active')->count(),
                'revoked_keys' => $keys->where('status', 'revoked')->count(),
                'total_validations' => (int) $keys->sum(fn (ProductLicenseKey $license) => (int) ($license->activation_count ?? 0)),
                'active_devices' => ProductLicenseActivation::query()
                    ->where('product_id', $product->id)
                    ->where('status', 'active')
                    ->count(),
            ],
        ]);
    }

    public function downloadOfflineLicense(Request $request, Order $order)
    {
        abort_unless($request->user() && (int) $order->buyer_id === (int) $request->user()->id, 403);

        $license = ProductLicenseKey::query()
            ->with('product:id,title,slug')
            ->where('order_id', $order->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->latest('issued_at')
            ->latest('id')
            ->first();

        abort_unless($license, 404);

        $payload = $this->offlineLicensePayload($license, now()->addYear());
        $filename = Str::slug($license->product?->title ?: 'takeer-software').'-license.json';

        return response()->streamDownload(function () use ($payload): void {
            echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        }, $filename, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function revoke(Request $request, Merchant $merchant, Product $product, ProductLicenseKey $license): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);
        $this->authorizeSoftwareProduct($product);
        abort_unless((int) $license->product_id === (int) $product->id, 404);

        $license->forceFill([
            'status' => 'revoked',
            'revoked_at' => now(),
        ])->save();

        return response()->json([
            'message' => 'License key imezimwa.',
            'license_key' => $this->licensePayload($license->fresh(['user:id,name,username,email', 'order:id,public_id,total_paid,payment_status'])),
        ]);
    }

    public function regenerate(Request $request, Merchant $merchant, Product $product, ProductLicenseKey $license): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);
        $this->authorizeSoftwareProduct($product);
        abort_unless((int) $license->product_id === (int) $product->id, 404);

        $key = $this->generateLicenseKey($product->license_key_prefix);
        $license->forceFill([
            'license_key' => $key,
            'key_hash' => hash('sha256', $key),
            'status' => 'active',
            'issued_at' => now(),
            'revoked_at' => null,
        ])->save();

        return response()->json([
            'message' => 'License key mpya imetengenezwa.',
            'license_key' => $this->licensePayload($license->fresh(['user:id,name,username,email', 'order:id,public_id,total_paid,payment_status'])),
        ]);
    }

    private function authorizeMerchantProduct(Request $request, Merchant $merchant, Product $product): void
    {
        $user = $request->user();
        abort_unless($user && (int) $merchant->user_id === (int) $user->id, 403);
        abort_unless((int) $product->merchant_id === (int) $merchant->id, 404);
    }

    private function authorizeSoftwareProduct(Product $product): void
    {
        abort_unless($product->isDigital() && ($product->digital_content_type ?? '') === 'software', 422, 'License keys are only available for software/code products.');
    }

    private function licensePayload(ProductLicenseKey $license): array
    {
        return [
            'id' => $license->id,
            'key' => $license->license_key,
            'masked_key' => $this->maskLicenseKey($license->license_key),
            'status' => $license->status,
            'activation_count' => (int) ($license->activation_count ?? 0),
            'active_device_count' => $license->activations()
                ->where('status', 'active')
                ->count(),
            'last_activated_at' => $license->last_activated_at?->toISOString(),
            'last_activation_ip' => $license->last_activation_ip,
            'activation_meta' => $license->activation_meta,
            'activations' => $license->relationLoaded('activations')
                ? $license->activations->map(fn (ProductLicenseActivation $activation) => [
                    'id' => $activation->id,
                    'device_id' => $activation->device_id,
                    'site_url' => $activation->site_url,
                    'app_version' => $activation->app_version,
                    'status' => $activation->status,
                    'last_seen_at' => $activation->last_seen_at?->toISOString(),
                    'activated_at' => $activation->activated_at?->toISOString(),
                ])->values()->all()
                : [],
            'issued_at' => $license->issued_at?->toISOString(),
            'revoked_at' => $license->revoked_at?->toISOString(),
            'buyer' => $license->user ? [
                'id' => $license->user->id,
                'name' => $license->user->name,
                'username' => $license->user->username,
                'email' => $license->user->email,
            ] : null,
            'order' => $license->order ? [
                'id' => $license->order->id,
                'public_id' => $license->order->public_id,
                'total_paid' => $license->order->total_paid,
                'payment_status' => $license->order->payment_status,
            ] : null,
        ];
    }

    private function publicLicensePayload(ProductLicenseKey $license): array
    {
        return [
            'id' => $license->id,
            'status' => $license->status,
            'issued_at' => $license->issued_at?->toISOString(),
            'revoked_at' => $license->revoked_at?->toISOString(),
            'activation_count' => (int) ($license->activation_count ?? 0),
            'last_activated_at' => $license->last_activated_at?->toISOString(),
            'activation_limit' => (int) ($license->product?->license_activation_limit ?? 1),
            'active_device_count' => $license->activations()
                ->where('status', 'active')
                ->count(),
            'product' => $license->product ? [
                'id' => $license->product->id,
                'title' => $license->product->title,
                'slug' => $license->product->slug,
            ] : null,
        ];
    }

    private function offlineLicensePayload(ProductLicenseKey $license, $expiresAt): array
    {
        $payload = [
            'issuer' => 'Takeer',
            'license_key' => $license->license_key,
            'license_id' => $license->id,
            'status' => $license->status,
            'issued_at' => $license->issued_at?->toISOString(),
            'expires_at' => $expiresAt?->toISOString(),
            'product' => [
                'id' => $license->product?->id,
                'title' => $license->product?->title,
                'slug' => $license->product?->slug,
            ],
        ];

        $payload['signature'] = hash_hmac('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES), $this->signingKey());

        return $payload;
    }

    private function signingKey(): string
    {
        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) {
            return base64_decode(substr($key, 7)) ?: $key;
        }

        return $key;
    }

    private function maskLicenseKey(?string $key): string
    {
        $key = (string) $key;
        if (strlen($key) <= 10) {
            return $key;
        }

        return substr($key, 0, 6).'...'.substr($key, -4);
    }

    private function generateLicenseKey(?string $prefix = null): string
    {
        $prefix = trim((string) $prefix);
        $prefix = $prefix !== '' ? strtoupper(preg_replace('/[^A-Z0-9]/i', '', $prefix)) : 'TAKEER';
        $prefix = substr($prefix, 0, 12);

        do {
            $key = $prefix.'-'.collect(range(1, 4))
                ->map(fn () => strtoupper(Str::random(5)))
                ->implode('-');
            $hash = hash('sha256', $key);
        } while (ProductLicenseKey::query()->where('key_hash', $hash)->exists());

        return $key;
    }
}
