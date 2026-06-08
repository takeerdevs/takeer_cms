<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\PaymentProvider;
use App\Models\PaymentProviderChannel;

class PaymentProviderCatalogService
{
    public function __construct(private readonly PaymentDisplayDirectory $displayDirectory)
    {
    }

    public function ensureDefaults(): void
    {
        foreach ($this->defaultProviders() as $providerConfig) {
            $provider = PaymentProvider::query()->firstOrNew(['key' => $providerConfig['key']]);
            $provider->fill(
                $provider->exists
                    ? [
                        'name' => $providerConfig['name'],
                        'driver' => $providerConfig['driver'] ?? $providerConfig['key'],
                        'logo_url' => $providerConfig['logo_url'] ?? null,
                        'metadata' => $providerConfig['metadata'] ?? [],
                    ]
                    : [
                    'name' => $providerConfig['name'],
                    'driver' => $providerConfig['driver'] ?? $providerConfig['key'],
                    'status' => $providerConfig['status'] ?? 'enabled',
                    'logo_url' => $providerConfig['logo_url'] ?? null,
                    'metadata' => $providerConfig['metadata'] ?? [],
                ]
            );
            $provider->save();

            foreach ($providerConfig['countries'] ?? [] as $country) {
                $providerCountry = $provider->countries()->firstOrNew(['country_code' => strtoupper($country['country_code'])]);
                $providerCountry->fill(
                    $providerCountry->exists
                        ? [
                            'supported_directions' => $country['supported_directions'] ?? ['payin', 'payout'],
                            'supported_currencies' => $country['supported_currencies'] ?? [],
                            'metadata' => $country['metadata'] ?? [],
                        ]
                        : [
                        'enabled' => (bool) ($country['enabled'] ?? true),
                        'supported_directions' => $country['supported_directions'] ?? ['payin', 'payout'],
                        'supported_currencies' => $country['supported_currencies'] ?? [],
                        'metadata' => $country['metadata'] ?? [],
                    ]
                );
                $providerCountry->save();
            }

            foreach ($providerConfig['channels'] ?? [] as $channel) {
                $providerChannel = PaymentProviderChannel::query()->firstOrNew(['key' => $channel['key']]);
                $providerChannel->payment_provider_id = $provider->id;
                $payload = $providerChannel->exists
                    ? $this->defaultChannelPayload($channel)
                    : $this->channelPayload($channel);
                if ($providerChannel->exists && ! empty($providerChannel->limits)) {
                    unset($payload['limits']);
                }
                $providerChannel->fill($payload);
                $providerChannel->save();
            }
        }

        $this->backfillLegacyWithdrawalChannels();
    }

    public function payoutChannelsForCountry(string $countryCode)
    {
        $this->ensureDefaults();

        return PaymentProviderChannel::query()
            ->with('provider')
            ->where('country_code', strtoupper($countryCode))
            ->where('direction', 'payout')
            ->whereIn('status', ['enabled', 'degraded'])
            ->whereHas('provider', fn ($query) => $query->where('status', 'enabled'))
            ->orderBy('priority')
            ->orderBy('name')
            ->get();
    }

    public function payinChannelsForCountry(string $countryCode)
    {
        $this->ensureDefaults();

        return PaymentProviderChannel::query()
            ->with('provider')
            ->where('country_code', strtoupper($countryCode))
            ->where('direction', 'payin')
            ->whereIn('status', ['enabled', 'degraded'])
            ->whereHas('provider', fn ($query) => $query->where('status', 'enabled'))
            ->orderBy('priority')
            ->orderBy('name')
            ->get();
    }

    public function feePolicyChannelOptions()
    {
        $this->ensureDefaults();

        return PaymentProviderChannel::query()
            ->with('provider:id,key,name,status')
            ->orderBy('country_code')
            ->orderBy('direction')
            ->orderBy('priority')
            ->orderBy('name')
            ->get()
            ->map(fn (PaymentProviderChannel $channel) => [
                'id' => $channel->id,
                'key' => $channel->key,
                'name' => $channel->name,
                'provider_key' => $channel->provider?->key,
                'provider_name' => $channel->provider?->name,
                'provider_status' => $channel->provider?->status,
                'country_code' => $channel->country_code,
                'direction' => $channel->direction,
                'method' => $channel->method,
                'network' => $channel->network,
                'currencies' => $channel->currencies ?: [],
                'status' => $channel->status,
            ])
            ->values();
    }

    public function channelToArray(PaymentProviderChannel $channel): array
    {
        $provider = $channel->provider;
        $currencies = $channel->currencies ?: [];

        return [
            'id' => $channel->id,
            'key' => $channel->key,
            'label' => $channel->name,
            'name' => $channel->name,
            'provider' => $provider?->key,
            'provider_name' => $provider?->name,
            'provider_id' => $provider?->id,
            'method' => $channel->method,
            'network' => $channel->network,
            'direction' => $channel->direction,
            'country_code' => $channel->country_code,
            'currency_code' => $currencies[0] ?? 'TZS',
            'currencies' => $currencies,
            'status' => $channel->status,
            'priority' => $channel->priority,
            'required_fields_schema' => $channel->required_fields_schema ?: [],
            'supported_networks' => $channel->supported_networks ?: [],
            'supported_banks' => $channel->supported_banks ?: [],
            'limits' => $channel->limits ?: [],
            'fx_margin_bps' => (int) $channel->fx_margin_bps,
            'fee_type' => $channel->fee_type,
            'fee_fixed' => (float) $channel->fee_fixed,
            'fee_percent_bps' => (int) $channel->fee_percent_bps,
            'fee_min' => (float) $channel->fee_min,
            'fee_max' => $channel->fee_max !== null ? (float) $channel->fee_max : null,
            'settlement_note' => $channel->settlement_note,
            'provider_metadata' => $channel->provider_metadata ?: [],
        ];
    }

    public function publicChannelToArray(PaymentProviderChannel $channel): array
    {
        $payload = $this->channelToArray($channel);
        $label = $this->publicChannelLabel((string) ($payload['method'] ?? ''), (string) ($payload['direction'] ?? 'payout'));

        $payload['label'] = $label;
        $payload['name'] = $label;
        unset($payload['provider'], $payload['provider_name'], $payload['provider_metadata']);

        return $payload;
    }

    public function publicChannelLabel(string $method, string $direction = 'payout'): string
    {
        $method = strtolower($method);
        $direction = strtolower($direction);

        return match ($method) {
            'mobile_money' => $direction === 'payin' ? 'Mobile money checkout' : 'Mobile money',
            'bank' => 'Bank transfer',
            'paypal' => 'PayPal',
            default => 'Payout channel',
        };
    }

    public function defaultProviders(): array
    {
        $tzNetworks = $this->displayDirectory->tanzaniaMobileMoneyNetworks();
        $tzBanks = $this->tanzaniaBanks();

        return [
            [
                'key' => 'selcom',
                'name' => 'Selcom',
                'driver' => 'selcom',
                'status' => 'enabled',
                'countries' => [
                    ['country_code' => 'TZ', 'supported_directions' => ['payin', 'payout'], 'supported_currencies' => ['TZS', 'USD']],
                ],
                'channels' => [
                    [
                        'key' => 'tz_selcom_payout_mobile_money_tzs',
                        'country_code' => 'TZ',
                        'direction' => 'payout',
                        'method' => 'mobile_money',
                        'name' => 'Selcom Mobile Money',
                        'currencies' => ['TZS'],
                        'limits' => ['min_withdrawal_amount' => 1000, 'max_withdrawal_amount' => null],
                        'priority' => 10,
                        'supported_networks' => $tzNetworks,
                        'required_fields_schema' => $this->mobileMoneyPayoutFields($tzNetworks),
                        'settlement_note' => 'Mobile money payouts are usually near real-time, subject to provider availability.',
                    ],
                    [
                        'key' => 'tz_selcom_payout_bank_tzs',
                        'country_code' => 'TZ',
                        'direction' => 'payout',
                        'method' => 'bank',
                        'name' => 'Selcom Bank Transfer',
                        'currencies' => ['TZS', 'USD'],
                        'limits' => ['min_withdrawal_amount' => 5000, 'max_withdrawal_amount' => null],
                        'priority' => 20,
                        'supported_banks' => $tzBanks,
                        'required_fields_schema' => $this->bankPayoutFields(),
                        'settlement_note' => 'Bank payouts can take a few minutes up to 2 business days depending on the receiving bank.',
                    ],
                    [
                        'key' => 'tz_selcom_payin_mobile_money_tzs',
                        'country_code' => 'TZ',
                        'direction' => 'payin',
                        'method' => 'mobile_money',
                        'name' => 'Selcom Mobile Money Checkout',
                        'currencies' => ['TZS'],
                        'priority' => 10,
                        'supported_networks' => $tzNetworks,
                        'required_fields_schema' => $this->mobileMoneyPayinFields($tzNetworks),
                    ],
                ],
            ],
            [
                'key' => 'azampay',
                'name' => 'AzamPay',
                'driver' => 'azampay',
                'status' => 'enabled',
                'countries' => [
                    ['country_code' => 'TZ', 'supported_directions' => ['payin', 'payout'], 'supported_currencies' => ['TZS']],
                ],
                'channels' => [
                    [
                        'key' => 'tz_azampay_payin_mobile_money_tzs',
                        'country_code' => 'TZ',
                        'direction' => 'payin',
                        'method' => 'mobile_money',
                        'name' => 'AzamPay Mobile Money Checkout',
                        'currencies' => ['TZS'],
                        'priority' => 15,
                        'supported_networks' => $tzNetworks,
                        'required_fields_schema' => $this->mobileMoneyPayinFields($tzNetworks),
                    ],
                    [
                        'key' => 'tz_azampay_payout_mobile_money_tzs',
                        'country_code' => 'TZ',
                        'direction' => 'payout',
                        'method' => 'mobile_money',
                        'name' => 'AzamPay Mobile Money',
                        'currencies' => ['TZS'],
                        'limits' => ['min_withdrawal_amount' => 1000, 'max_withdrawal_amount' => null],
                        'priority' => 30,
                        'supported_networks' => $tzNetworks,
                        'required_fields_schema' => $this->mobileMoneyPayoutFields($tzNetworks),
                    ],
                ],
            ],
            [
                'key' => 'dpo',
                'name' => 'DPO',
                'driver' => 'dpo',
                'status' => 'disabled',
                'countries' => [
                    ['country_code' => 'KE', 'enabled' => false, 'supported_directions' => ['payin', 'payout'], 'supported_currencies' => ['KES', 'USD']],
                ],
                'channels' => [
                    [
                        'key' => 'ke_dpo_payin_mobile_money_kes',
                        'country_code' => 'KE',
                        'direction' => 'payin',
                        'method' => 'mobile_money',
                        'network' => 'mpesa',
                        'name' => 'DPO M-Pesa Checkout',
                        'currencies' => ['KES'],
                        'priority' => 10,
                        'supported_networks' => [['key' => 'mpesa', 'name' => 'M-Pesa', 'provider_code' => 'mpesa']],
                        'required_fields_schema' => $this->mobileMoneyPayinFields([['key' => 'mpesa', 'name' => 'M-Pesa']]),
                    ],
                    [
                        'key' => 'ke_dpo_payout_bank_kes',
                        'country_code' => 'KE',
                        'direction' => 'payout',
                        'method' => 'bank',
                        'name' => 'DPO Bank Transfer',
                        'currencies' => ['KES', 'USD'],
                        'limits' => ['min_withdrawal_amount' => 500, 'max_withdrawal_amount' => null],
                        'priority' => 20,
                        'required_fields_schema' => $this->bankPayoutFields(),
                    ],
                ],
            ],
        ];
    }

    private function channelPayload(array $channel): array
    {
        return [
            ...$this->defaultChannelPayload($channel),
            'status' => $channel['status'] ?? 'enabled',
            'priority' => (int) ($channel['priority'] ?? 100),
            'fee_type' => $channel['fee_type'] ?? 'fixed_plus_percent',
            'fee_fixed' => max(0, (float) ($channel['fee_fixed'] ?? 0)),
            'fee_percent_bps' => max(0, (int) ($channel['fee_percent_bps'] ?? 0)),
            'fee_min' => max(0, (float) ($channel['fee_min'] ?? 0)),
            'fee_max' => $channel['fee_max'] ?? null,
            'fx_margin_bps' => max(0, (int) ($channel['fx_margin_bps'] ?? 0)),
            'settlement_note' => $channel['settlement_note'] ?? null,
        ];
    }

    private function defaultChannelPayload(array $channel): array
    {
        return [
            'country_code' => strtoupper($channel['country_code']),
            'direction' => $channel['direction'],
            'method' => $channel['method'],
            'network' => $channel['network'] ?? null,
            'name' => $channel['name'],
            'logo_url' => $channel['logo_url'] ?? null,
            'currencies' => $channel['currencies'] ?? ['TZS'],
            'required_fields_schema' => $channel['required_fields_schema'] ?? [],
            'supported_networks' => $channel['supported_networks'] ?? [],
            'supported_banks' => $channel['supported_banks'] ?? [],
            'limits' => $channel['limits'] ?? [],
            'provider_metadata' => $channel['provider_metadata'] ?? [],
        ];
    }

    private function mobileMoneyPayoutFields(array $networks): array
    {
        return [
            ['key' => 'first_name', 'label' => 'First Name', 'type' => 'text', 'required' => true],
            ['key' => 'last_name', 'label' => 'Last Name', 'type' => 'text', 'required' => true],
            ['key' => 'network', 'label' => 'Carrier', 'type' => 'select', 'required' => true, 'options' => $networks],
            ['key' => 'phone_number', 'label' => 'Phone Number', 'type' => 'phone', 'format' => 'tz_mobile', 'required' => true],
        ];
    }

    private function mobileMoneyPayinFields(array $networks): array
    {
        return [
            ['key' => 'network', 'label' => 'Mobile Network', 'type' => 'select', 'required' => false, 'options' => $networks],
            ['key' => 'phone_number', 'label' => 'Payment Number', 'type' => 'phone', 'format' => 'mobile', 'required' => true],
        ];
    }

    private function bankPayoutFields(): array
    {
        return [
            ['key' => 'bank_code', 'label' => 'Bank', 'type' => 'bank_select', 'required' => true],
            ['key' => 'account_name', 'label' => 'Account Name', 'type' => 'text', 'required' => true],
            ['key' => 'account_number', 'label' => 'Account Number', 'type' => 'text', 'required' => true],
            ['key' => 'branch', 'label' => 'Branch', 'type' => 'text', 'required' => false],
            ['key' => 'swift_code', 'label' => 'SWIFT Code', 'type' => 'text', 'required' => false],
        ];
    }

    private function tanzaniaBanks(): array
    {
        return $this->displayDirectory->tanzaniaBanks();
    }

    private function backfillLegacyWithdrawalChannels(): void
    {
        $raw = AdminSetting::get('withdrawal_payout_channels', null);
        $legacyChannels = is_string($raw) ? json_decode($raw, true) : null;
        if (! is_array($legacyChannels) || empty($legacyChannels)) {
            return;
        }

        $provider = PaymentProvider::query()->firstOrCreate(
            ['key' => 'manual'],
            ['name' => 'Manual Provider', 'driver' => 'manual', 'status' => 'enabled']
        );

        foreach ($legacyChannels as $legacy) {
            if (! is_array($legacy)) {
                continue;
            }
            $key = (string) ($legacy['key'] ?? '');
            if ($key === '') {
                continue;
            }

            $channel = PaymentProviderChannel::query()->firstOrNew(['key' => $key]);
            if ($channel->exists) {
                continue;
            }

            $channel->payment_provider_id = $provider->id;
            $channel->fill($this->channelPayload([
                    'key' => $key,
                    'country_code' => (string) ($legacy['country_code'] ?? 'TZ'),
                    'direction' => 'payout',
                    'method' => (string) ($legacy['method'] ?? 'bank'),
                    'name' => (string) ($legacy['label'] ?? 'Payout channel'),
                    'currencies' => [(string) ($legacy['currency_code'] ?? 'TZS')],
                    'priority' => 90,
                    'fee_type' => (string) ($legacy['fee_type'] ?? 'fixed_plus_percent'),
                    'fee_fixed' => (float) ($legacy['fee_fixed'] ?? 0),
                    'fee_percent_bps' => (int) ($legacy['fee_percent_bps'] ?? 0),
                    'fee_min' => (float) ($legacy['fee_min'] ?? 0),
                    'fee_max' => $legacy['fee_max'] ?? null,
                    'fx_margin_bps' => (int) ($legacy['fx_margin_bps'] ?? 0),
            ]))->save();
        }
    }
}
