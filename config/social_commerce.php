<?php

return [
    'enabled' => (bool) env('SOCIAL_COMMERCE_ENABLED', true),
    'buyer_entry_enabled' => (bool) env('SOCIAL_COMMERCE_BUYER_ENTRY_ENABLED', true),
    'supported_platforms' => ['instagram', 'facebook_marketplace'],
    'allowed_hosts' => [
        'instagram.com', 'www.instagram.com', 'm.instagram.com',
        'facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com',
    ],
    'request_expiry_hours' => (int) env('SOCIAL_COMMERCE_REQUEST_EXPIRY_HOURS', 72),
    'claimed_onboarding_grace_days' => (int) env('SOCIAL_COMMERCE_ONBOARDING_GRACE_DAYS', 7),
    'offer_expiry_hours' => (int) env('SOCIAL_COMMERCE_OFFER_EXPIRY_HOURS', 48),
    'reminder_hours' => [24, 48],
    'max_requests_per_buyer_per_day' => (int) env('SOCIAL_COMMERCE_MAX_REQUESTS_PER_BUYER_DAY', 10),
    'max_invites_per_request' => (int) env('SOCIAL_COMMERCE_MAX_INVITES_PER_REQUEST', 3),
    'max_invites_per_contact_per_day' => (int) env('SOCIAL_COMMERCE_MAX_INVITES_PER_CONTACT_DAY', 5),
    'preview_timeout_seconds' => (int) env('SOCIAL_COMMERCE_PREVIEW_TIMEOUT', 8),
    'preview_max_html_bytes' => (int) env('SOCIAL_COMMERCE_PREVIEW_MAX_HTML_BYTES', 2_000_000),
    'preview_max_image_bytes' => (int) env('SOCIAL_COMMERCE_PREVIEW_MAX_IMAGE_BYTES', 5_242_880),
    'preview_media_retention_days' => (int) env('SOCIAL_COMMERCE_PREVIEW_MEDIA_RETENTION_DAYS', 30),
    'claim_token_bytes' => max(32, (int) env('SOCIAL_COMMERCE_CLAIM_TOKEN_BYTES', 32)),
    'meta_preview_enabled' => (bool) env('SOCIAL_COMMERCE_META_PREVIEW_ENABLED', false),
    'meta_messaging_enabled' => (bool) env('SOCIAL_COMMERCE_META_MESSAGING_ENABLED', false),
    'seller_sms_enabled' => (bool) env('SOCIAL_COMMERCE_SELLER_SMS_ENABLED', true),
    'connected_merchant_fast_path_enabled' => (bool) env('SOCIAL_COMMERCE_CONNECTED_FAST_PATH_ENABLED', false),
    'admin_review_value_threshold' => (float) env('SOCIAL_COMMERCE_ADMIN_REVIEW_VALUE_THRESHOLD', 1_000_000),
];
