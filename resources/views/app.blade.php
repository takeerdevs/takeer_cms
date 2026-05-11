<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    @php
        $viewSeo = isset($seo) && is_array($seo) ? $seo : [];
        $propSeo = isset($page['props']['seo']) && is_array($page['props']['seo']) ? $page['props']['seo'] : [];
        $seo = !empty($viewSeo) ? $viewSeo : $propSeo;
        $seoTitle = $seo['title'] ?? config('app.name', 'Takeer');
        $seoDescription = $seo['description'] ?? "Create a business profile, offer services, sell physical or digital products, accept bookings, and manage customer interactions from one place.";
        $seoCanonical = $seo['canonical'] ?? url()->current();
        $seoType = $seo['type'] ?? 'website';
        $seoSiteName = $seo['site_name'] ?? config('app.name', 'Takeer');
        $seoImage = $seo['image'] ?? null;
        $structuredData = $seo['structured_data'] ?? [];
    @endphp
    <meta charset="utf-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta data-takeer-server-seo="true" name="description" content="{{ $seoDescription }}">
    <meta data-takeer-server-seo="true" name="robots" content="{{ $seo['robots'] ?? 'index,follow' }}">
    <link data-takeer-server-seo="true" rel="canonical" href="{{ $seoCanonical }}">
    <meta data-takeer-server-seo="true" property="og:title" content="{{ $seoTitle }}">
    <meta data-takeer-server-seo="true" property="og:description" content="{{ $seoDescription }}">
    <meta data-takeer-server-seo="true" property="og:type" content="{{ $seoType }}">
    <meta data-takeer-server-seo="true" property="og:url" content="{{ $seoCanonical }}">
    <meta data-takeer-server-seo="true" property="og:site_name" content="{{ $seoSiteName }}">
    @if ($seoImage)
        <meta data-takeer-server-seo="true" property="og:image" content="{{ $seoImage }}">
        <meta data-takeer-server-seo="true" name="twitter:image" content="{{ $seoImage }}">
    @endif
    <meta data-takeer-server-seo="true" name="twitter:card" content="{{ $seo['twitter_card'] ?? ($seoImage ? 'summary_large_image' : 'summary') }}">
    <meta data-takeer-server-seo="true" name="twitter:title" content="{{ $seoTitle }}">
    <meta data-takeer-server-seo="true" name="twitter:description" content="{{ $seoDescription }}">
    <meta name="theme-color" content="#0284c7">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title inertia>{{ $seoTitle }}</title>
    @foreach ($structuredData as $schema)
        <script data-takeer-server-seo="true" type="application/ld+json">{!! json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) !!}</script>
    @endforeach
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
    @routes
</head>

<body class="font-sans antialiased">
    @inertia
</body>

</html>
