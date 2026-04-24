<?php

namespace App\Services;

use App\Models\Country;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\NumberParseException;

class PhoneService
{
    /**
     * Standardize a phone number to E.164 format (+255676783762)
     * 
     * @param string $phone Local or full number (e.g., "0676783762", "+255676...")
     * @param Country|string $country ISO Alpha-2 code (e.g., "TZ", "US") or Country model
     */
    public static function formatToE164(string $phone, $country): string
    {
        $phoneUtil = PhoneNumberUtil::getInstance();

        // 1. Resolve ISO alpha2 code
        $regionCode = 'TZ'; // Standard fallback
        if ($country instanceof Country) {
            $regionCode = strtoupper($country->iso_alpha2);
        } elseif (is_string($country) && strlen($country) === 2) {
            $regionCode = strtoupper($country);
        }

        try {
            // 2. Parse number in the context of the guessed region
            // libphonenumber handles local trunk prefixes (like leading 0) automatically
            $numberProto = $phoneUtil->parse($phone, $regionCode);

            if ($phoneUtil->isValidNumber($numberProto)) {
                return $phoneUtil->format($numberProto, PhoneNumberFormat::E164);
            }
        } catch (NumberParseException $e) {
            // Handle Parse Error - Fallback to simple cleaning if validation fails
        }

        // 3. Fallback (if parsing fails but it looks already formatted or usable)
        $cleaned = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($phone, '+')) {
            return '+' . $cleaned;
        }

        return '';
    }
}
