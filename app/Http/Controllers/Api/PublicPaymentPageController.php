<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentPage;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PublicPaymentPageController extends Controller
{
    /**
     * Show the public payment page.
     */
    public function show($slug, Request $request)
    {
        $page = PaymentPage::where('slug', $slug)
            ->where('is_active', true)
            ->with(['merchant', 'items.item'])
            ->firstOrFail();

        // Log a view (debounced by IP/Session for 1 hour)
        $cacheKey = "payment_page_view_{$page->id}_{$request->ip()}";
        if (!\Illuminate\Support\Facades\Cache::has($cacheKey)) {
            $page->views()->create([
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            \Illuminate\Support\Facades\Cache::put($cacheKey, true, now()->addHour());
        }

        return Inertia::render('Public/PaymentPage', [
            'page' => $page,
            'merchant' => $page->merchant,
        ]);
    }
}
