<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => '/auth/google/callback',
    ],

    'google_calendar' => [
        'enabled' => env('GOOGLE_CALENDAR_ENABLED', false),
        'redirect' => env('GOOGLE_CALENDAR_REDIRECT_URI', '/merchant/integrations/google-calendar/callback'),
        'default_calendar_id' => env('GOOGLE_CALENDAR_DEFAULT_ID', 'primary'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'beem_africa' => [
        'api_key' => env('BEEM_AFRICA_API_KEY'),
        'secret_key' => env('BEEM_AFRICA_SECRET_KEY'),
        'sender_id' => env('BEEM_AFRICA_SENDER_ID', 'TAKEER'),
    ],

    'service_messaging' => [
        'sms_provider' => env('SERVICE_SMS_PROVIDER', 'pending'),
        'whatsapp_provider' => env('SERVICE_WHATSAPP_PROVIDER', 'pending'),
        'email_provider' => env('SERVICE_EMAIL_PROVIDER', 'pending'),
    ],

    'platform_notifications' => [
        'sms_provider' => env('PLATFORM_SMS_PROVIDER', 'beem_africa'),
        'whatsapp_provider' => env('PLATFORM_WHATSAPP_PROVIDER', 'whatsapp_business'),
        'email_provider' => env('PLATFORM_EMAIL_PROVIDER', 'laravel_mail'),
    ],

    'openrouter' => [
        'api_key' => env('OPENROUTER_API_KEY'),
        'ocr_model' => env('OPENROUTER_OCR_MODEL', 'google/gemini-2.5-flash'),
        'simulate_ocr' => env('OPENROUTER_SIMULATE_OCR', true),
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'flash_model' => 'gemini-1.5-flash',
        'pro_model' => 'gemini-1.5-pro',
    ],

    'flaresolverr' => [
        'url' => env('FLARESOLVERR_URL'),
        'timeout' => (int) env('FLARESOLVERR_TIMEOUT', 15000),
    ],

    /*
    |--------------------------------------------------------------------------
    | AzamPay — Tanzania Payment Gateway
    |--------------------------------------------------------------------------
    */
    'azampay' => [
        'authenticator_base_url' => env('AZAMPAY_AUTHENTICATOR_BASE_URL', 'https://authenticator-sandbox.azampay.co.tz'),
        'checkout_base_url'      => env('AZAMPAY_CHECKOUT_BASE_URL', 'https://sandbox.azampay.co.tz'),
        'client_id'              => env('AZAMPAY_CLIENT_ID'),
        'client_secret'          => env('AZAMPAY_CLIENT_SECRET'),
        'token'                  => env('AZAMPAY_TOKEN'), // X-API-Key static header
        'app_name'               => env('APP_NAME', 'Takeer'),
    ],

    'flutterwave' => [
        'client_id' => env('FLUTTERWAVE_CLIENT_ID'),
        'secret_key' => env('FLUTTERWAVE_SECRET_KEY'),
        'encryption_key' => env('FLUTTERWAVE_ENCRYPTION_KEY'),
        'secret_hash' => env('FLUTTERWAVE_SECRET_HASH'),
        'base_url' => env('FLUTTERWAVE_BASE_URL', 'https://api.flutterwave.com/v3'),
    ],

    'open_exchange_rates' => [
        'url' => env('OPEN_EXCHANGE_RATES_URL', 'https://openexchangerates.org/api/latest.json'),
        'key' => env('OPEN_EXCHANGE_RATES_KEY'),
        'cache_ttl' => env('OPEN_EXCHANGE_RATES_CACHE_TTL', 86400),
    ],

];
