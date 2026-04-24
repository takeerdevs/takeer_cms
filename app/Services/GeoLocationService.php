<?php

namespace App\Services;

use App\Models\Country;
use GeoIp2\Database\Reader;
use Illuminate\Support\Facades\Cache;

class GeoLocationService
{
    protected $reader;

    public function __construct()
    {
        $this->reader = new Reader(storage_path('/geoip/GeoLite2-Country.mmdb'));
    }

    public function getCountry(string $ip): ?array
    {
        // Cache TTL: 1 hour (3600 seconds) - balance between performance and accuracy
        $ttl = 3600;

        // get country information from GeoIP database
        return Cache::remember("geoip:$ip", $ttl, function () use ($ip) {
            try {
                $record = $this->reader->country($ip);

                return [
                    'iso_code' => $record->country->isoCode,
                    'name' => $record->country->name,
                ];
            } catch (\Exception $e) {
                return null;
            }
        });
    }
}
