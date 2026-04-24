<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ForwarderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tz = \App\Models\Country::where('iso_alpha2', 'TZ')->first();
        $ke = \App\Models\Country::where('iso_alpha2', 'KE')->first();
        $ug = \App\Models\Country::where('iso_alpha2', 'UG')->first();

        \App\Models\Forwarder::create([
            'name' => 'Silent Ocean',
            'address_line' => 'Guangzhou, Liwan District, Xicun, No. 123 Forwarding Center',
            'latitude' => 23.1291,
            'longitude' => 113.2644,
            'contact_phone' => '+86 138 0013 8000',
            'website' => 'https://silentocean.co.tz',
            'is_verified' => true,
            'country_id' => $tz?->id,
            'required_fields' => ['customer_id'],
            'rates_info' => 'Air: $12/kg (7-10 days) | Sea: $350/CBM (45 days)',
            'description' => 'Eneo maarufu kwa mizigo ya China kwenda Tanzania. Ofisi zetu zipo Guangzhou na Dar es Salaam.',
        ]);

        \App\Models\Forwarder::create([
            'name' => 'GSM Logistics',
            'address_line' => 'Dar es Salaam, Kurasini, Gerezani St.',
            'latitude' => -6.8235,
            'longitude' => 39.2695,
            'contact_phone' => '+255 754 000 000',
            'website' => 'https://gsmlogistics.co.tz',
            'is_verified' => true,
            'country_id' => $tz?->id,
            'required_fields' => ['customer_id', 'shipping_mark'],
            'rates_info' => 'Sea Cargo: $400/CBM kutoka Dubai/Turkiye.',
            'description' => 'Mawakala bingwa wa mizigo kutoka Uturuki na Dubai kuja Tanzania.',
        ]);

        \App\Models\Forwarder::create([
            'name' => 'African Cargo Line',
            'address_line' => 'Mombasa Port, Gate 10, Logistics Hub',
            'latitude' => -4.0435,
            'longitude' => 39.6682,
            'contact_phone' => '+254 711 000 000',
            'is_verified' => true,
            'country_id' => $ke?->id,
            'required_fields' => ['customer_id'],
            'rates_info' => 'Air: $10/kg | Sea: $320/CBM',
            'description' => 'Specialized in Dubai to Kenya shipping routes.',
        ]);

        \App\Models\Forwarder::create([
            'name' => 'Entebbe Logistics',
            'address_line' => 'Kampala, Industrial Area, Plot 45',
            'latitude' => 0.3163,
            'longitude' => 32.5822,
            'contact_phone' => '+256 700 000 000',
            'is_verified' => true,
            'country_id' => $ug?->id,
            'required_fields' => ['customer_id'],
            'rates_info' => 'Global shipping to Uganda via air and sea.',
            'description' => 'Quick forwarding services for Ugandan merchants.',
        ]);
    }
}
