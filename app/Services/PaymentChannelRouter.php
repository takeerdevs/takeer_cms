<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\PaymentProviderChannel;

/**
 * Resolves provider channels for customer pay-ins.
 *
 * Seller payout beneficiaries are intentionally not resolved here. They are
 * created and verified by the PSP and referenced through the seller payment
 * profile attached to an order settlement.
 */
class PaymentChannelRouter
{
    public function __construct(
        private readonly PaymentProviderCatalogService $catalog,
    ) {}

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
            $matchingCurrency = $channels->first(
                fn (PaymentProviderChannel $channel) => in_array($currencyCode, $channel->currencies ?: [], true)
            );
            if ($matchingCurrency) {
                return $matchingCurrency;
            }
        }

        return $channels->first();
    }

    public function channelSnapshot(PaymentProviderChannel $channel): array
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
        ];
    }
}
