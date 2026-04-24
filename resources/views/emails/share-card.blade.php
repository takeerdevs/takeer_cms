<!DOCTYPE html>
<html lang="sw">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1920">
    <title>Takeer Share Card</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-black w-[1080px] h-[1920px] m-0 p-0 overflow-hidden flex flex-col items-center justify-between p-20">
    <!-- Background Blur Layer -->
    <div class="absolute inset-0 z-0">
        <img src="{{ $media_url }}" class="w-full h-full object-cover blur-3xl opacity-40 scale-110">
        <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60"></div>
    </div>

    <!-- Content Layer -->
    <div class="relative z-10 w-full h-full flex flex-col items-center justify-between">
        
        <!-- Header: Merchant Info -->
        <div class="w-full flex items-center gap-6">
            <div class="h-24 w-24 rounded-full bg-brand-500 border-4 border-white/20 flex items-center justify-center text-white text-4xl font-bold overflow-hidden bg-[#0284c7]">
                @if($merchant_avatar)
                    <img src="{{ $merchant_avatar }}" class="w-full h-full object-cover">
                @else
                    {{ strtoupper(substr($merchant_name, 0, 1)) }}
                @endif
            </div>
            <div class="flex flex-col">
                <span class="text-white text-5xl font-black tracking-tight">@ {{ $merchant_name }}</span>
                <span class="text-white/60 text-2xl font-medium uppercase tracking-[0.2em]">Takeer Merchant</span>
            </div>
        </div>

        <!-- Main Product Image Card -->
        <div class="w-full h-[1000px] rounded-[60px] overflow-hidden shadow-2xl border border-white/10 relative">
            <img src="{{ $media_url }}" class="w-full h-full object-cover">
            <!-- Glassmorphism Price Tag -->
            @if($price)
                <div class="absolute bottom-10 right-10 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full px-10 py-5">
                    <span class="text-white text-6xl font-black">TZS {{ number_format($price) }}</span>
                </div>
            @endif
        </div>

        <!-- Footer: Product Details & QR -->
        <div class="w-full bg-white rounded-[60px] p-12 flex items-center justify-between shadow-2xl">
            <div class="flex flex-col gap-4">
                <h2 class="text-gray-900 text-6xl font-black leading-tight max-w-[600px] truncate">
                    {{ $title }}
                </h2>
                <div class="flex items-center gap-4">
                    <span class="bg-[#0284c7] text-white text-2xl font-bold px-6 py-2 rounded-full">REF: #{{ $post_id }}</span>
                    <span class="text-gray-400 text-2xl font-bold uppercase tracking-widest">Scan to Buy</span>
                </div>
            </div>
            
            <!-- QR Code Placeholder (will be rendered as image) -->
            <div class="bg-white p-4 rounded-3xl border-4 border-gray-100">
                <img src="data:image/svg+xml;base64,{{ base64_encode($qr_code) }}" width="200" height="200">
            </div>
        </div>

        <!-- Branded Watermark -->
        <div class="w-full flex justify-center pb-4 opacity-50">
            <span class="text-white text-3xl font-black tracking-[0.5em] uppercase">TAKEER Marketplace</span>
        </div>
    </div>
</body>
</html>
