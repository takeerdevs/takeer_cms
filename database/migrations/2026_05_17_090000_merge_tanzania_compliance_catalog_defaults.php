<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $country = DB::table('countries')
            ->where('iso_alpha2', 'TZ')
            ->select(['id', 'settings'])
            ->first();

        if (! $country) {
            return;
        }

        $settings = $this->decodeSettings($country->settings);
        $settings['tax_calendar_defaults'] = $this->mergeDefaults(
            is_array($settings['tax_calendar_defaults'] ?? null) ? $settings['tax_calendar_defaults'] : [],
            $this->tanzaniaDefaults()
        );

        DB::table('countries')
            ->where('id', $country->id)
            ->update(['settings' => json_encode($settings)]);
    }

    public function down(): void
    {
        $country = DB::table('countries')
            ->where('iso_alpha2', 'TZ')
            ->select(['id', 'settings'])
            ->first();

        if (! $country) {
            return;
        }

        $settings = $this->decodeSettings($country->settings);
        $generatedKeys = collect($this->tanzaniaDefaults())->pluck('key')->all();

        $settings['tax_calendar_defaults'] = collect($settings['tax_calendar_defaults'] ?? [])
            ->reject(fn ($item) => in_array($item['key'] ?? null, $generatedKeys, true))
            ->values()
            ->all();

        if (count($settings['tax_calendar_defaults']) === 0) {
            unset($settings['tax_calendar_defaults']);
        }

        DB::table('countries')
            ->where('id', $country->id)
            ->update(['settings' => json_encode($settings)]);
    }

    private function decodeSettings(?string $settings): array
    {
        $decoded = json_decode((string) $settings, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function mergeDefaults(array $existing, array $defaults): array
    {
        $existingKeys = collect($existing)
            ->pluck('key')
            ->filter()
            ->all();

        $missing = collect($defaults)
            ->reject(fn ($default) => in_array($default['key'] ?? null, $existingKeys, true))
            ->values()
            ->all();

        return array_values(array_merge($existing, $missing));
    }

    private function tanzaniaDefaults(): array
    {
        return [
            [
                'key' => 'annual_return_estimate',
                'title' => 'Annual return estimate',
                'type' => 'annual_return',
                'authority' => 'TRA / BRELA / Accountant',
                'remind_days_before' => 30,
                'suggested_frequency' => 'yearly',
                'recurrence_frequency' => 'years',
                'recurrence_interval' => 1,
                'sector_tags' => ['company', 'all businesses'],
                'applies_when' => 'The business is registered and has annual tax or company registry filing obligations.',
                'description' => 'Set this once your accountant gives you the expected filing or return date.',
            ],
            [
                'key' => 'pdpc_registration',
                'title' => 'PDPC data protection registration',
                'type' => 'data_protection',
                'authority' => 'PDPC',
                'remind_days_before' => 90,
                'suggested_frequency' => 'every 5 years',
                'recurrence_frequency' => 'years',
                'recurrence_interval' => 5,
                'sector_tags' => ['customer data', 'digital business'],
                'applies_when' => 'The business collects or processes personal data and is required or advised to register.',
                'description' => 'For businesses collecting or processing personal data. Registration validity is generally five years from certificate issue.',
            ],
            [
                'key' => 'tcra_certificate',
                'title' => 'TCRA certificate / licence renewal',
                'type' => 'sector_regulator',
                'authority' => 'TCRA',
                'remind_days_before' => 45,
                'suggested_frequency' => 'yearly or licence-specific',
                'recurrence_frequency' => 'years',
                'recurrence_interval' => 1,
                'sector_tags' => ['telecom', 'broadcasting', 'content', 'postal'],
                'applies_when' => 'The business operates in communications, broadcasting, postal, content, or other TCRA-regulated activities.',
                'description' => 'Use the due date and fee schedule shown on the issued certificate or licence.',
            ],
            [
                'key' => 'vat_payment',
                'title' => 'VAT filing/payment reminder',
                'type' => 'tax_filing',
                'authority' => 'TRA',
                'remind_days_before' => 7,
                'suggested_frequency' => 'monthly where registered',
                'recurrence_frequency' => 'months',
                'recurrence_interval' => 1,
                'sector_tags' => ['vat registered'],
                'applies_when' => 'The business is VAT registered or has been advised to file VAT returns.',
                'description' => 'Enable only if the business is registered or advised to file VAT.',
            ],
            [
                'key' => 'paye_sdl',
                'title' => 'PAYE / SDL payroll tax reminder',
                'type' => 'payroll_tax',
                'authority' => 'TRA',
                'remind_days_before' => 7,
                'suggested_frequency' => 'monthly where applicable',
                'recurrence_frequency' => 'months',
                'recurrence_interval' => 1,
                'sector_tags' => ['employer', 'payroll'],
                'applies_when' => 'The business has employees or payroll obligations.',
                'description' => 'Use when the business has employees or payroll obligations.',
            ],
            [
                'key' => 'withholding_tax',
                'title' => 'Withholding tax filing/payment reminder',
                'type' => 'tax_filing',
                'authority' => 'TRA',
                'remind_days_before' => 7,
                'suggested_frequency' => 'monthly where applicable',
                'recurrence_frequency' => 'months',
                'recurrence_interval' => 1,
                'sector_tags' => ['contractors', 'professional services', 'rent'],
                'applies_when' => 'The business makes payments that require withholding tax.',
                'description' => 'Track withholding tax returns and payment references for qualifying supplier or service payments.',
            ],
            [
                'key' => 'business_licence_renewal',
                'title' => 'Business licence renewal',
                'type' => 'local_government',
                'authority' => 'BRELA / Local Government Authority',
                'remind_days_before' => 30,
                'suggested_frequency' => 'yearly or licence-specific',
                'recurrence_frequency' => 'years',
                'recurrence_interval' => 1,
                'sector_tags' => ['trading', 'retail', 'services'],
                'applies_when' => 'The business holds a Class A, Class B, municipal, or other operating licence.',
                'description' => 'Use the expiry date on the issued business licence or local authority permit.',
            ],
            [
                'key' => 'tmda_pharmacy_permit',
                'title' => 'TMDA / Pharmacy permit renewal',
                'type' => 'sector_regulator',
                'authority' => 'TMDA / Pharmacy Council',
                'remind_days_before' => 45,
                'suggested_frequency' => 'licence-specific',
                'recurrence_frequency' => 'years',
                'recurrence_interval' => 1,
                'sector_tags' => ['pharmacy', 'medicine', 'cosmetics', 'medical devices'],
                'applies_when' => 'The business sells or handles medicines, medical devices, cosmetics, or other regulated health products.',
                'description' => 'Track product, premises, pharmacy, or sector permits using the expiry dates shown on issued documents.',
            ],
            [
                'key' => 'nssf_wcf_reminder',
                'title' => 'NSSF / WCF employment contribution reminder',
                'type' => 'payroll_tax',
                'authority' => 'NSSF / WCF',
                'remind_days_before' => 7,
                'suggested_frequency' => 'monthly where applicable',
                'recurrence_frequency' => 'months',
                'recurrence_interval' => 1,
                'sector_tags' => ['employer', 'workplace'],
                'applies_when' => 'The business has employees and statutory social security or workers compensation obligations.',
                'description' => 'Track contribution due dates and proof of payment for employment-related statutory schemes.',
            ],
            [
                'key' => 'import_export_permit',
                'title' => 'Import / export permit or customs reminder',
                'type' => 'import_export',
                'authority' => 'TRA / TANCIS / Sector Authority',
                'remind_days_before' => 14,
                'suggested_frequency' => 'shipment or permit-specific',
                'recurrence_frequency' => 'none',
                'recurrence_interval' => 1,
                'sector_tags' => ['importer', 'exporter', 'cross-border trade'],
                'applies_when' => 'The business imports, exports, or holds permits tied to shipments or regulated goods.',
                'description' => 'Track permit expiries, customs payment references, and shipment-related compliance dates.',
            ],
        ];
    }
};
