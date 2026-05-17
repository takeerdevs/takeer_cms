<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\RetailAuditLog;
use App\Support\MerchantPermissions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class MerchantAuditService
{
    private const REDACTED = '[redacted]';

    public function record(Request $request, Merchant|int $merchant, string $action, string $description, array $metadata = []): ?RetailAuditLog
    {
        $user = $request->user();
        $merchantId = $merchant instanceof Merchant ? $merchant->id : $merchant;
        $staff = $user && $merchant instanceof Merchant
            ? MerchantPermissions::staffFor($user, $merchant)
            : null;

        return RetailAuditLog::create([
            'merchant_id' => $merchantId,
            'staff_id' => $request->attributes->get('active_staff')?->id ?? $staff?->id,
            'user_id' => $user?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => [
                ...$this->requestMetadata($request),
                ...$this->redact($metadata),
            ],
        ]);
    }

    public function recordModelChange(Request $request, Model $model, string $event): ?RetailAuditLog
    {
        $merchantId = $this->merchantIdFor($model);
        if (!$merchantId || !$request->user()) {
            return null;
        }

        $merchant = Merchant::find($merchantId);
        if (!$merchant) {
            return null;
        }

        $label = class_basename($model);
        $action = 'MERCHANT_' . strtoupper($label) . '_' . strtoupper($event);
        $description = "{$label} {$event}.";
        $changed = $event === 'updated'
            ? array_values(array_diff(array_keys($model->getChanges()), ['updated_at']))
            : array_keys($model->getAttributes());

        if ($event === 'updated' && empty($changed)) {
            return null;
        }

        return $this->record($request, $merchant, $action, $description, [
            'target_type' => $model::class,
            'target_id' => $model->getKey(),
            'event' => $event,
            'before' => $event === 'created' ? null : $this->modelOriginal($model),
            'after' => $event === 'deleted' ? null : $this->modelCurrent($model),
            'changed' => $changed,
        ]);
    }

    public function modelSnapshot(Model $model): array
    {
        return $this->redact($model->getAttributes());
    }

    private function modelOriginal(Model $model): array
    {
        $changes = $model->getChanges();

        if (empty($changes)) {
            return $this->modelSnapshot($model);
        }

        return $this->redact(Arr::only($model->getOriginal(), array_keys($changes)));
    }

    private function modelCurrent(Model $model): array
    {
        $changes = $model->getChanges();

        return $this->redact(empty($changes) ? $model->getAttributes() : Arr::only($model->getAttributes(), array_keys($changes)));
    }

    private function merchantIdFor(Model $model): ?int
    {
        if ($model instanceof Merchant) {
            return (int) $model->id;
        }

        foreach (['merchant_id', 'merchant_profile_id'] as $field) {
            $value = $model->getAttribute($field);
            if ($value) {
                return (int) $value;
            }
        }

        return null;
    }

    private function requestMetadata(Request $request): array
    {
        return [
            'ip' => $request->ip(),
            'user_agent' => str($request->userAgent() ?? '')->limit(500)->toString(),
            'route' => optional($request->route())->getName() ?: $request->path(),
            'method' => $request->method(),
            'occurred_at' => now()->toISOString(),
        ];
    }

    private function redact(array $payload): array
    {
        return collect($payload)
            ->mapWithKeys(function ($value, $key) {
                $keyString = strtolower((string) $key);
                if (str_contains($keyString, 'password')
                    || str_contains($keyString, 'token')
                    || str_contains($keyString, 'secret')
                    || str_contains($keyString, 'pin')
                    || str_contains($keyString, 'key_hash')
                    || $keyString === 'pin_hash'
                ) {
                    return [$key => self::REDACTED];
                }

                if (is_array($value)) {
                    return [$key => $this->redact($value)];
                }

                return [$key => $value];
            })
            ->all();
    }
}
