<?php

/**
 * Payment Gateway Configuration
 * ─────────────────────────────
 * Defines enabled payment gateways per country, in priority order.
 * Priority 1 = first tried. If a gateway fails, the registry falls back
 * to the next enabled gateway for the same country (future feature).
 *
 * Adding a new country:
 *   1. Add the country code key with an array of gateway configs.
 *   2. Create the driver class implementing PaymentGatewayInterface.
 *   3. Register the driver name in GatewayRegistry::$driverMap.
 *
 * Adding a second gateway for an existing country:
 *   Just add another entry to the country's array with a higher priority number.
 *
 * Admin dashboard (future):
 *   This config file will be replaced by a `payment_gateways` DB table,
 *   managed via the admin UI. Only GatewayRegistry::resolveForCountry()
 *   needs updating — no changes to drivers or controllers.
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Default Country Fallback
    |--------------------------------------------------------------------------
    | Used when GeoIP, session, and phone-prefix detection all fail.
    */
    'default_country' => 'TZ',

    /*
    |--------------------------------------------------------------------------
    | Tanzania (TZ)
    |--------------------------------------------------------------------------
    | AzamPay supports: Airtel, Tigo/Yas, Vodacom, Halotel, CRDB Bank, NMB Bank
    */
    'TZ' => [
        [
            'driver'   => 'flutterwave',
            'priority' => 1,
            'enabled'  => true,
            'label'    => 'Flutterwave (Mobile Money)',
        ],
        [
            'driver'   => 'azampay',
            'priority' => 2,
            'enabled'  => true,
            'label'    => 'AzamPay',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Kenya (KE) — not yet integrated
    |--------------------------------------------------------------------------
    */
    // 'KE' => [
    //     [
    //         'driver'   => 'mpesa_ke',
    //         'priority' => 1,
    //         'enabled'  => true,
    //         'label'    => 'M-Pesa Kenya',
    //     ],
    // ],

    /*
    |--------------------------------------------------------------------------
    | Uganda (UG) — not yet integrated
    |--------------------------------------------------------------------------
    */
    // 'UG' => [
    //     [
    //         'driver'   => 'mtn_ug',
    //         'priority' => 1,
    //         'enabled'  => true,
    //         'label'    => 'MTN Mobile Money Uganda',
    //     ],
    // ],

    /*
    |--------------------------------------------------------------------------
    | Nigeria (NG) — not yet integrated
    |--------------------------------------------------------------------------
    */
    // 'NG' => [
    //     [
    //         'driver'   => 'flutterwave',
    //         'priority' => 1,
    //         'enabled'  => true,
    //         'label'    => 'Flutterwave',
    //     ],
    // ],

];
