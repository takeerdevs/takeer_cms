<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentPage;
use App\Support\SeoMeta;
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

        // Track traffic (Unified system)
        $page->recordImpression($request);
        $seo = SeoMeta::paymentPage($page);

        return Inertia::render('Public/PaymentPage', [
            'page' => $page,
            'merchant' => $page->merchant,
            'seo' => $seo,
        ])->withViewData('seo', $seo);
    }
}
