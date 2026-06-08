<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\MerchantPayoutCredential;
use App\Models\PaymentProviderChannel;

class PaymentChannelRouter
{
    public function __construct(
        private readonly PaymentProviderCatalogService $catalog,
    ) {}

    public function payoutChannelsForMerchant(Merchant $merchant): array
    {
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);
        $countryCode = strtoupper((string) ($merchant->country?->iso_alpha2 ?: 'TZ'));
        $businessCurrency = strtoupper((string) ($merchant->currency?->code ?: 'TZS'));

        return $this->catalog->payoutChannelsForCountry($countryCode)
            ->map(function (PaymentProviderChannel $channel) use ($businessCurrency) {
                $payload = $this->catalog->publicChannelToArray($channel);
                $payload['is_business_currency_supported'] = in_array($businessCurrency, $payload['currencies'] ?: [], true);
                return $payload;
            })
            ->values()
            ->all();
    }

    public function resolvePayoutChannel(
        Merchant $merchant,
        ?string $channelKey = null,
        ?string $method = null,
        ?string $currencyCode = null,
        ?int $credentialId = null,
    ): ?PaymentProviderChannel {
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);

        if ($credentialId) {
            $credential = MerchantPayoutCredential::query()
                ->with('channel.provider')
                ->where('merchant_id', $merchant->id)
                ->where('status', 'active')
                ->find($credentialId);

            if ($credential?->channel && $credential->channel->isAvailable()) {
                return $credential->channel;
            }
        }

        $countryCode = strtoupper((string) ($merchant->country?->iso_alpha2 ?: 'TZ'));
        $currencyCode = strtoupper((string) ($currencyCode ?: ''));
        $method = strtolower((string) ($method ?: ''));
        $channelKey = strtolower((string) ($channelKey ?: ''));

        $query = PaymentProviderChannel::query()
            ->with('provider')
            ->where('country_code', $countryCode)
            ->where('direction', 'payout')
            ->where('status', 'enabled')
            ->whereHas('provider', fn ($provider) => $provider->where('status', 'enabled'));

        if ($channelKey !== '') {
            $found = (clone $query)->whereRaw('lower(key) = ?', [$channelKey])->first();
            if ($found) {
                return $found;
            }
        }

        if ($method !== '') {
            $query->where('method', $method);
        }

        $channels = $query->orderBy('priority')->orderBy('name')->get();

        if ($currencyCode !== '') {
            $matchingCurrency = $channels->first(fn (PaymentProviderChannel $channel) => in_array($currencyCode, $channel->currencies ?: [], true));
            if ($matchingCurrency) {
                return $matchingCurrency;
            }
        }

        return $channels->first();
    }

    public function resolvePayinChannel(
        Merchant $merchant,
        ?string $countryCode = null,
        ?string $method = null,
        ?string $currencyCode = null,
    ): ?PaymentProviderChannel {
        $merchant->loadMissing(['country.defaultCurrency']);

        $countryCode = strtoupper((string) ($countryCode ?: $merchant->country?->iso_alpha2 ?: 'TZ'));
        $method = strtolower((string) ($method ?: ''));
        $currencyCode = strtoupper((string) ($currencyCode ?: $merchant->country?->defaultCurrency?->code ?: ''));

        $query = PaymentProviderChannel::query()
            ->with('provider')
            ->where('country_code', $countryCode)
            ->where('direction', 'payin')
            ->where('status', 'enabled')
            ->whereHas('provider', fn ($provider) => $provider->where('status', 'enabled'));

        if ($method !== '') {
            $query->where('method', $method);
        }

        $channels = $query->orderBy('priority')->orderBy('name')->get();

        if ($currencyCode !== '') {
            $matchingCurrency = $channels->first(fn (PaymentProviderChannel $channel) => in_array($currencyCode, $channel->currencies ?: [], true));
            if ($matchingCurrency) {
                return $matchingCurrency;
            }
        }

        return $channels->first();
    }

    public function payoutCredentialsForMerchant(Merchant $merchant): array
    {
        return MerchantPayoutCredential::query()
            ->with('channel.provider')
            ->where('merchant_id', $merchant->id)
            ->where('status', 'active')
            ->latest('is_default')
            ->latest()
            ->get()
            ->map(fn (MerchantPayoutCredential $credential) => $this->credentialToArray($credential))
            ->values()
            ->all();
    }

    public function credentialToArray(MerchantPayoutCredential $credential): array
    {
        $channel = $credential->channel;
        $masked = $credential->details_masked ?: [];

        return [
            'id' => $credential->id,
            'label' => $this->publicCredentialLabel($credential),
            'method' => $credential->method,
            'network' => $credential->network,
            'currency_code' => $credential->currency_code,
            'payment_provider_channel_id' => $credential->payment_provider_channel_id,
            'details' => $this->editableCredentialDetails($credential),
            'details_masked' => $masked,
            'verification_status' => $credential->verification_status,
            'is_default' => (bool) $credential->is_default,
            'status' => $credential->status,
            'channel_key' => $channel?->key,
            'channel' => $channel ? $this->catalog->publicChannelToArray($channel) : null,
        ];
    }

    private function editableCredentialDetails(MerchantPayoutCredential $credential): array
    {
        $details = $credential->details_encrypted ?: [];
        $masked = $credential->details_masked ?: [];

        if ($credential->method === 'mobile_money') {
            $name = trim((string) ($masked['name'] ?? ''));
            if ($name !== '' && (empty($details['first_name']) || empty($details['last_name']))) {
                $parts = preg_split('/\s+/', $name, 2) ?: [];
                $details['first_name'] = $details['first_name'] ?? ($parts[0] ?? '');
                $details['last_name'] = $details['last_name'] ?? ($parts[1] ?? '');
            }
        }

        return $details;
    }

    private function publicCredentialLabel(MerchantPayoutCredential $credential): string
    {
        $masked = $credential->details_masked ?: [];

        if ($credential->method === 'mobile_money') {
            return trim(($masked['network'] ?? 'Mobile money') . ' · ' . ($masked['phone_number'] ?? 'saved number'));
        }

        if ($credential->method === 'bank') {
            return trim(($masked['bank_code'] ?? 'Bank') . ' · ' . ($masked['account_number'] ?? 'saved account'));
        }

        return $this->catalog->publicChannelLabel((string) $credential->method);
    }

    public function channelSnapshot(PaymentProviderChannel $channel, ?MerchantPayoutCredential $credential = null): array
    {
        $channel->loadMissing('provider');

        return [
            'payment_provider_id' => $channel->payment_provider_id,
            'payment_provider_key' => $channel->provider?->key,
            'payment_provider_name' => $channel->provider?->name,
            'payment_provider_channel_id' => $channel->id,
            'payment_provider_channel_key' => $channel->key,
            'payment_provider_channel_name' => $channel->name,
            'direction' => $channel->direction,
            'method' => $channel->method,
            'network' => $channel->network,
            'country_code' => $channel->country_code,
            'currencies' => $channel->currencies ?: [],
            'status' => $channel->status,
            'fee_type' => $channel->fee_type,
            'fee_fixed' => (float) $channel->fee_fixed,
            'fee_percent_bps' => (int) $channel->fee_percent_bps,
            'fee_min' => (float) $channel->fee_min,
            'fee_max' => $channel->fee_max !== null ? (float) $channel->fee_max : null,
            'fx_margin_bps' => (int) $channel->fx_margin_bps,
            'settlement_note' => $channel->settlement_note,
            'provider_metadata' => $channel->provider_metadata ?: [],
            'merchant_payout_credential_id' => $credential?->id,
            'merchant_payout_credential_label' => $credential?->label,
            'merchant_payout_credential_masked' => $credential?->details_masked ?: null,
        ];
    }
}
