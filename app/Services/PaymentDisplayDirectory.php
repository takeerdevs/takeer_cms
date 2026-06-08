<?php

namespace App\Services;

class PaymentDisplayDirectory
{
    public function tanzaniaMobileMoneyNetworks(): array
    {
        return [
            [
                'key' => 'mpesa',
                'name' => 'M-Pesa',
                'short_name' => 'M-Pesa',
                'provider_code' => 'MPESA-TZ',
                'cashin_utility_code' => 'VMCASHIN',
                'aliases' => ['Vodacom M-Pesa', 'Vodacom', 'Mpesa'],
            ],
            [
                'key' => 'airtel_money',
                'name' => 'Airtel Money',
                'short_name' => 'Airtel',
                'provider_code' => 'AIRTELMONEY',
                'cashin_utility_code' => 'AMCASHIN',
                'aliases' => ['Airtel', 'AirtelMoney'],
            ],
            [
                'key' => 'halopesa',
                'name' => 'HaloPesa',
                'short_name' => 'HaloPesa',
                'provider_code' => 'HALOPESATZ',
                'cashin_utility_code' => 'HPCASHIN',
                'aliases' => ['Halotel', 'Halopesa'],
            ],
            [
                'key' => 'mixx_by_yas',
                'name' => 'Mixx by Yas',
                'short_name' => 'Mixx',
                'provider_code' => 'TIGOPESATZ',
                'cashin_utility_code' => 'TPCASHIN',
                'aliases' => ['Tigo Pesa', 'Tigo', 'Yas', 'Mixx'],
            ],
        ];
    }

    public function tanzaniaBanks(): array
    {
        return collect([
            ['code' => 'ABSA', 'name' => 'ABSA Bank Tanzania', 'provider_code' => 'ABSA'],
            ['code' => 'BANCABC', 'name' => 'Access Bank Tanzania', 'provider_code' => 'BANCABC'],
            ['code' => 'AKIBA', 'name' => 'Akiba Commercial Bank', 'provider_code' => 'AKIBA COMMERCIAL BANK LTD'],
            ['code' => 'AMANABANK', 'name' => 'Amana Bank', 'provider_code' => 'AMANABANK'],
            ['code' => 'AZANIA', 'name' => 'Azania Bank', 'provider_code' => 'AZANIA BANK LIMITED'],
            ['code' => 'BOA', 'name' => 'Bank of Africa Tanzania', 'provider_code' => 'BANK OF AFRICA TANZANIA LIMITED'],
            ['code' => 'BANKOFBARODA', 'name' => 'Bank of Baroda Tanzania', 'provider_code' => 'BANKOFBARODA'],
            ['code' => 'BANKOFINDIA', 'name' => 'Bank of India Tanzania', 'provider_code' => 'BANKOFINDIA'],
            ['code' => 'CHINADASHENG', 'name' => 'China Dasheng Bank', 'provider_code' => 'CHINADASHENG'],
            ['code' => 'CITIBANK', 'name' => 'Citibank Tanzania', 'provider_code' => 'CITIBANK'],
            ['code' => 'CRDBBANK', 'name' => 'CRDB Bank', 'provider_code' => 'CRDBBANK'],
            ['code' => 'DCBBANK', 'name' => 'DCB Commercial Bank', 'provider_code' => 'DCBBANK'],
            ['code' => 'DTB', 'name' => 'Diamond Trust Bank', 'provider_code' => 'DTB'],
            ['code' => 'ECOBANK', 'name' => 'Ecobank Tanzania', 'provider_code' => 'ECOBANK'],
            ['code' => 'EQUITYBANK', 'name' => 'Equity Bank Tanzania', 'provider_code' => 'EQUITYBANK'],
            ['code' => 'EXIMBANK', 'name' => 'Exim Bank', 'provider_code' => 'EXIMBANK'],
            ['code' => 'FINCA', 'name' => 'Finca Microfinance Bank', 'provider_code' => 'FINCA'],
            ['code' => 'GTBANK', 'name' => 'Guaranty Trust Bank Tanzania', 'provider_code' => 'GUARANTY TRUST BANK (T) LTD'],
            ['code' => 'HABIBBANK', 'name' => 'Habib African Bank', 'provider_code' => 'HABIBBANK'],
            ['code' => 'IMBANK', 'name' => 'I&M Bank Tanzania', 'provider_code' => 'I&M BANK LIMITED'],
            ['code' => 'ICB', 'name' => 'International Commercial Bank Tanzania', 'provider_code' => 'ICB'],
            ['code' => 'KCB', 'name' => 'KCB Bank Tanzania', 'provider_code' => 'KCB BANK TANZANIA LIMITED'],
            ['code' => 'KILIMANJARO', 'name' => 'Coop Bank Tanzania', 'provider_code' => 'KILIMANJARO'],
            ['code' => 'LETSHEGO', 'name' => 'Letshego Bank Tanzania', 'provider_code' => 'LETSHEGO'],
            ['code' => 'MAENDELEO', 'name' => 'Maendeleo Bank', 'provider_code' => 'MAENDELEO BANK LTD'],
            ['code' => 'MKOMBOZI', 'name' => 'Mkombozi Commercial Bank', 'provider_code' => 'MKOMBOZI'],
            ['code' => 'MWALIMU', 'name' => 'Mwalimu Commercial Bank', 'provider_code' => 'MWALIMU COMMERCIAL BANK PLC'],
            ['code' => 'MWANGA', 'name' => 'Mwanga Hakika Microfinance Bank', 'provider_code' => 'MWANGA'],
            ['code' => 'NMB', 'name' => 'NMB Bank', 'provider_code' => 'NMB'],
            ['code' => 'NBC', 'name' => 'NBC Bank', 'provider_code' => 'NBC'],
            ['code' => 'NCBA', 'name' => 'NCBA Bank Tanzania', 'provider_code' => 'NCBA'],
            ['code' => 'PBZ', 'name' => "People's Bank of Zanzibar", 'provider_code' => 'PBZ'],
            ['code' => 'STANBIC', 'name' => 'Stanbic Bank Tanzania', 'provider_code' => 'STANBIC BANK TANZANIA LIMITED'],
            ['code' => 'TCB', 'name' => 'Tanzania Commercial Bank', 'provider_code' => 'TCB'],
            ['code' => 'UCHUMI', 'name' => 'Uchumi Commercial Bank', 'provider_code' => 'UCHUMI'],
            ['code' => 'UBA', 'name' => 'United Bank for Africa', 'provider_code' => 'UBA'],
        ])->map(function (array $bank) {
            $aliases = array_values(array_filter(array_unique([
                $bank['provider_code'] ?? null,
                $bank['name'] ?? null,
            ])));

            return [
                ...$bank,
                'key' => strtolower($bank['code']),
                'provider_code' => $bank['code'],
                'aliases' => $aliases,
            ];
        })->values()->all();
    }

    public function providerCodeForNetwork(?string $value): string
    {
        $needle = strtolower(str_replace([' ', '_', '-'], '', (string) $value));

        foreach ($this->tanzaniaMobileMoneyNetworks() as $network) {
            $values = array_merge([$network['key'], $network['name'], $network['short_name'], $network['provider_code']], $network['aliases'] ?? []);
            foreach ($values as $candidate) {
                if ($needle === strtolower(str_replace([' ', '_', '-'], '', (string) $candidate))) {
                    return $network['provider_code'];
                }
            }
        }

        return strtoupper((string) $value);
    }

    public function providerCodeForBank(?string $value): string
    {
        $needle = strtolower(str_replace([' ', '_', '-'], '', (string) $value));

        foreach ($this->tanzaniaBanks() as $bank) {
            $values = array_merge([$bank['key'], $bank['code'], $bank['name'], $bank['provider_code']], $bank['aliases'] ?? []);
            foreach ($values as $candidate) {
                if ($needle === strtolower(str_replace([' ', '_', '-'], '', (string) $candidate))) {
                    return $bank['provider_code'];
                }
            }
        }

        return strtoupper((string) $value);
    }

    public function cashinUtilityCodeForNetwork(?string $value): string
    {
        $needle = strtolower(str_replace([' ', '_', '-'], '', (string) $value));

        foreach ($this->tanzaniaMobileMoneyNetworks() as $network) {
            $values = array_merge([$network['key'], $network['name'], $network['short_name'], $network['provider_code']], $network['aliases'] ?? []);
            foreach ($values as $candidate) {
                if ($needle === strtolower(str_replace([' ', '_', '-'], '', (string) $candidate))) {
                    return $network['cashin_utility_code'] ?? 'CASHIN';
                }
            }
        }

        return 'CASHIN';
    }
}
