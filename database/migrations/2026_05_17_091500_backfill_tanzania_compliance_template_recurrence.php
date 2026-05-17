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
        if (! is_array($settings['tax_calendar_defaults'] ?? null)) {
            return;
        }

        $recurrence = $this->recurrenceDefaults();
        $settings['tax_calendar_defaults'] = collect($settings['tax_calendar_defaults'])
            ->map(function ($template) use ($recurrence) {
                $key = $template['key'] ?? null;
                if (! $key || ! isset($recurrence[$key])) {
                    return $template;
                }

                $template['recurrence_frequency'] ??= $recurrence[$key]['recurrence_frequency'];
                $template['recurrence_interval'] ??= $recurrence[$key]['recurrence_interval'];

                return $template;
            })
            ->values()
            ->all();

        DB::table('countries')
            ->where('id', $country->id)
            ->update(['settings' => json_encode($settings)]);
    }

    public function down(): void
    {
        // Keep admin-managed country settings intact on rollback.
    }

    private function decodeSettings(?string $settings): array
    {
        $decoded = json_decode((string) $settings, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function recurrenceDefaults(): array
    {
        return [
            'annual_return_estimate' => ['recurrence_frequency' => 'years', 'recurrence_interval' => 1],
            'pdpc_registration' => ['recurrence_frequency' => 'years', 'recurrence_interval' => 5],
            'tcra_certificate' => ['recurrence_frequency' => 'years', 'recurrence_interval' => 1],
            'vat_payment' => ['recurrence_frequency' => 'months', 'recurrence_interval' => 1],
            'paye_sdl' => ['recurrence_frequency' => 'months', 'recurrence_interval' => 1],
            'withholding_tax' => ['recurrence_frequency' => 'months', 'recurrence_interval' => 1],
            'business_licence_renewal' => ['recurrence_frequency' => 'years', 'recurrence_interval' => 1],
            'tmda_pharmacy_permit' => ['recurrence_frequency' => 'years', 'recurrence_interval' => 1],
            'nssf_wcf_reminder' => ['recurrence_frequency' => 'months', 'recurrence_interval' => 1],
            'import_export_permit' => ['recurrence_frequency' => 'none', 'recurrence_interval' => 1],
        ];
    }
};
