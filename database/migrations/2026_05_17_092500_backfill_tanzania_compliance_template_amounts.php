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

        $settings['tax_calendar_defaults'] = collect($settings['tax_calendar_defaults'])
            ->map(function ($template) {
                $template['currency_code'] ??= 'TZS';
                $template['estimated_amount'] ??= null;

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
};
