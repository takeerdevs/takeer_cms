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

        $regionCode = self::regionCode($country);

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

    /**
     * Return common persisted forms for matching older local-format records.
     */
    public static function variantsForLookup(string $phone, $country = null): array
    {
        $phoneUtil = PhoneNumberUtil::getInstance();
        $regionCode = self::regionCode($country);
        $digits = preg_replace('/\D+/', '', $phone);
        $variants = array_filter([$phone, $digits]);

        $formatted = self::formatToE164($phone, $country);
        if ($formatted !== '') {
            $variants[] = $formatted;
            $variants[] = ltrim($formatted, '+');
        }

        try {
            $numberProto = $phoneUtil->parse($phone, $regionCode);
            if ($phoneUtil->isValidNumber($numberProto)) {
                $e164 = $phoneUtil->format($numberProto, PhoneNumberFormat::E164);
                $national = preg_replace('/\D+/', '', $phoneUtil->format($numberProto, PhoneNumberFormat::NATIONAL));
                $significant = $phoneUtil->getNationalSignificantNumber($numberProto);

                $variants[] = $e164;
                $variants[] = ltrim($e164, '+');
                $variants[] = $national;
                $variants[] = $significant;

                if ($significant !== '' && ! str_starts_with($significant, '0')) {
                    $variants[] = '0' . $significant;
                }
            }
        } catch (NumberParseException $e) {
            // Keep the simple variants above.
        }

        return array_values(array_unique(array_filter($variants)));
    }

    private static function regionCode($country): string
    {
        if ($country instanceof Country) {
            return strtoupper($country->iso_alpha2);
        }

        if (is_string($country) && strlen($country) === 2) {
            return strtoupper($country);
        }

        return 'TZ';
    }
}
