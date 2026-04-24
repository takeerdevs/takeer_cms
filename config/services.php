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

];
