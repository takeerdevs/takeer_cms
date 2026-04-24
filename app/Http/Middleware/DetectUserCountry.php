<?php

namespace App\Http\Middleware;

use App\Models\Country;
use App\Services\GeoLocationService;
use Closure;
use Illuminate\Http\Request;

class DetectUserCountry
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        // Only detect country if not already set in session
        // This improves performance and provides stable experience
        if (!$request->session()->has('user_session_country')) {
            $geo = app(GeoLocationService::class);

            // Get the real client IP, trying multiple headers
            $ip = $this->getRealClientIp($request);

            $country = $geo->getCountry($ip);

            if ($country) {
                $countrydata = Country::where('iso_alpha2', $country['iso_code'])
                    ->with('defaultCurrency')->first();
                if ($countrydata === null) {
                    // set default country to USA
                    $countryd = [
                        'iso_alpha2' => 'US',
                        'name' => 'United States',
                        'defaultCurrency' => 'USD',
                        'default_tax_rate' => '0.00',
                        'tax_label' => 'Tax',
                        'apply_tax_by_default' => false,
                        'state_name' => 'State',
                        'city_name' => 'City',
                        'flag' => '🇺🇸',
                        'timezone' => 'UTC-05:00',
                        'phone_code' => '+1',
                        'continent' => 'North America',
                        'is_active' => true,
                    ];
                    $request->session()->put('user_session_country', $countryd);

                    // Set default language and currency
                    if (!$request->session()->has('user_session_language')) {
                        $request->session()->put('user_session_language', 'en');
                    }
                    if (!$request->session()->has('user_session_currency')) {
                        $request->session()->put('user_session_currency', 'USD');
                    }
                } else {
                    $countryd = [
                        'iso_alpha2' => $countrydata->iso_alpha2,
                        'name' => $countrydata->name,
                        'defaultCurrency' => $countrydata->defaultCurrency,
                        'default_tax_rate' => $countrydata->default_tax_rate,
                        'tax_label' => $countrydata->tax_label,
                        'apply_tax_by_default' => $countrydata->apply_tax_by_default,
                        'state_name' => $countrydata->state_name,
                        'city_name' => $countrydata->city_name,
                        'flag' => $countrydata->flag,
                        'timezone' => $countrydata->timezone,
                        'phone_code' => $countrydata->phone_code,
                        'continent' => $countrydata->continent,
                        'is_active' => $countrydata->is_active,
                    ];
                    $request->session()->put('user_session_country', $countryd);

                    // Set default language and currency based on country
                    if (!$request->session()->has('user_session_language')) {
                        $defaultLanguage = $countrydata->default_language ?? 'en';
                        $request->session()->put('user_session_language', $defaultLanguage);
                    }
                    if (!$request->session()->has('user_session_currency')) {
                        $defaultCurrency = $countrydata->defaultCurrency ? $countrydata->defaultCurrency->code : 'USD';
                        $request->session()->put('user_session_currency', $defaultCurrency);
                    }
                }
            }
        }

        return $next($request);
    }

    /**
     * Get the real client IP address, checking multiple headers used by different proxies/CDNs
     */
    protected function getRealClientIp(Request $request): string
    {
        // In development, use a test IP from Tanzania
        if (!app()->environment('production')) {
            return '169.255.184.29'; // Tanzania IP for testing
        }

        // Try different headers in order of priority
        // 1. CF-Connecting-IP (Cloudflare)
        if ($request->header('CF-Connecting-IP')) {
            return $request->header('CF-Connecting-IP');
        }

        // 2. True-Client-IP (Akamai, Cloudflare Enterprise)
        if ($request->header('True-Client-IP')) {
            return $request->header('True-Client-IP');
        }

        // 3. X-Real-IP (nginx, many reverse proxies)
        if ($request->header('X-Real-IP')) {
            return $request->header('X-Real-IP');
        }

        // 4. X-Forwarded-For (standard, but can contain multiple IPs)
        // Take the first IP in the chain (the original client)
        if ($request->header('X-Forwarded-For')) {
            $ips = explode(',', $request->header('X-Forwarded-For'));
            $clientIp = trim($ips[0]);
            if ($clientIp) {
                return $clientIp;
            }
        }

        // 5. Fallback to Laravel's ip() method
        return $request->ip();
    }
}

