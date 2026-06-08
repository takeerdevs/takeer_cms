<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantPayoutCredential;
use App\Models\PaymentProviderChannel;
use App\Services\PaymentChannelRouter;
use App\Services\StepUpVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MerchantPayoutCredentialController extends Controller
{
    public function index(Merchant $merchant): JsonResponse
    {
        return response()->json([
            'credentials' => app(PaymentChannelRouter::class)->payoutCredentialsForMerchant($merchant),
            'channels' => app(PaymentChannelRouter::class)->payoutChannelsForMerchant($merchant),
        ]);
    }

    public function store(Request $request, Merchant $merchant): JsonResponse
    {
        return $this->saveCredential($request, $merchant);
    }

    public function update(Request $request, Merchant $merchant, MerchantPayoutCredential $credential): JsonResponse
    {
        abort_unless((int) $credential->merchant_id === (int) $merchant->id, 404);

        return $this->saveCredential($request, $merchant, $credential);
    }

    public function destroy(Request $request, Merchant $merchant, MerchantPayoutCredential $credential): JsonResponse
    {
        abort_unless((int) $credential->merchant_id === (int) $merchant->id, 404);
        $this->requireStepUp($request);

        $credential->update(['status' => 'disabled']);

        return response()->json(['message' => 'Payout credential disabled.']);
    }

    private function saveCredential(Request $request, Merchant $merchant, ?MerchantPayoutCredential $credential = null): JsonResponse
    {
        $this->requireStepUp($request);

        $validated = $request->validate([
            'payment_provider_channel_id' => 'required|integer|exists:payment_provider_channels,id',
            'currency_code' => 'required|string|size:3',
            'details' => 'required|array',
            'label' => 'nullable|string|max:120',
            'is_default' => 'nullable|boolean',
            'verification_code' => 'nullable|string|max:32',
        ]);

        $channel = PaymentProviderChannel::query()
            ->with('provider')
            ->where('direction', 'payout')
            ->where('status', '!=', 'disabled')
            ->findOrFail($validated['payment_provider_channel_id']);

        $currencyCode = strtoupper($validated['currency_code']);
        if (! in_array($currencyCode, $channel->currencies ?: [], true)) {
            return response()->json(['message' => 'Currency is not supported by this payout channel.'], 422);
        }

        $details = $this->validatedDetails($channel, $validated['details'], $credential?->details_encrypted ?: []);
        $masked = $this->maskDetails($channel, $details);
        $label = trim((string) ($validated['label'] ?? '')) ?: $this->credentialLabel($channel, $masked);

        $saved = DB::transaction(function () use ($merchant, $credential, $channel, $currencyCode, $details, $masked, $label, $validated) {
            if ($validated['is_default'] ?? false) {
                MerchantPayoutCredential::query()
                    ->where('merchant_id', $merchant->id)
                    ->update(['is_default' => false]);
            }

            $record = $credential ?: new MerchantPayoutCredential(['merchant_id' => $merchant->id]);
            $record->fill([
                'payment_provider_channel_id' => $channel->id,
                'label' => $label,
                'method' => $channel->method,
                'network' => $details['network'] ?? $channel->network,
                'currency_code' => $currencyCode,
                'details_encrypted' => $details,
                'details_masked' => $masked,
                'verification_status' => 'verified',
                'verified_at' => now(),
                'is_default' => (bool) ($validated['is_default'] ?? ($credential?->is_default ?? false)),
                'status' => 'active',
            ])->save();

            return $record->fresh(['channel.provider']);
        });

        return response()->json([
            'message' => 'Payout credential saved.',
            'credential' => app(PaymentChannelRouter::class)->credentialToArray($saved),
        ]);
    }

    private function requireStepUp(Request $request): void
    {
        $stepUp = app(StepUpVerificationService::class);
        $code = (string) $request->input('verification_code', '');
        if ($code === '') {
            throw ValidationException::withMessages([
                'verification_code' => 'Verification code is required to update payout credentials.',
            ]);
        }

        if (! $stepUp->verify($request, 'merchant_payout_credential', $code, markSession: false, totpWindow: 0)) {
            throw ValidationException::withMessages([
                'verification_code' => 'Verification code is not valid or has expired.',
            ]);
        }
    }

    private function validatedDetails(PaymentProviderChannel $channel, array $input, array $existingDetails = []): array
    {
        $schema = $channel->required_fields_schema ?: [];
        $details = [];

        foreach ($schema as $field) {
            $key = (string) ($field['key'] ?? '');
            if ($key === '') {
                continue;
            }

            $value = trim((string) data_get($input, $key, ''));
            if (($value === '' || $this->looksMasked($value)) && array_key_exists($key, $existingDetails)) {
                $value = trim((string) $existingDetails[$key]);
            }
            if (($field['required'] ?? false) && $value === '') {
                throw ValidationException::withMessages([
                    "details.{$key}" => "{$field['label']} is required.",
                ]);
            }

            if ($value !== '') {
                $details[$key] = $field['type'] === 'phone'
                    ? preg_replace('/[\s\-\(\)]/', '', $value)
                    : $value;
            }
        }

        return $details;
    }

    private function looksMasked(string $value): bool
    {
        return str_contains($value, '•')
            || str_contains($value, '*')
            || preg_match('/^\s*(x{2,}|X{2,})/u', $value) === 1;
    }

    private function maskDetails(PaymentProviderChannel $channel, array $details): array
    {
        if ($channel->method === 'mobile_money') {
            $phone = (string) ($details['phone_number'] ?? '');

            return [
                'name' => trim(($details['first_name'] ?? '') . ' ' . ($details['last_name'] ?? '')),
                'network' => $details['network'] ?? $channel->network,
                'phone_number' => $phone ? '•••• ' . substr($phone, -4) : null,
            ];
        }

        if ($channel->method === 'bank') {
            $account = (string) ($details['account_number'] ?? '');

            return [
                'bank_code' => $details['bank_code'] ?? null,
                'account_name' => $details['account_name'] ?? null,
                'account_number' => $account ? '•••• ' . substr($account, -4) : null,
                'branch' => $details['branch'] ?? null,
            ];
        }

        return collect($details)
            ->map(fn ($value) => is_string($value) && strlen($value) > 4 ? '•••• ' . substr($value, -4) : $value)
            ->all();
    }

    private function credentialLabel(PaymentProviderChannel $channel, array $masked): string
    {
        if ($channel->method === 'mobile_money') {
            return trim(($masked['network'] ?? 'Mobile money') . ' · ' . ($masked['phone_number'] ?? 'saved number'));
        }

        if ($channel->method === 'bank') {
            return trim(($masked['bank_code'] ?? 'Bank') . ' · ' . ($masked['account_number'] ?? 'saved account'));
        }

        return app(\App\Services\PaymentProviderCatalogService::class)->publicChannelLabel((string) $channel->method);
    }
}
