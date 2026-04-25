<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\PaymentPage;
use App\Models\PaymentPageItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Str;

class PaymentPageController extends Controller
{
    public function index(Request $request, Merchant $merchant)
    {
        $pages = $merchant->paymentPages()
            ->withCount(['views', 'orders' => function($q) {
                $q->whereIn('payment_status', ['paid_pending_confirmation', 'awaiting_merchant_confirmation', 'escrow_locked', 'resolved_merchant_paid']);
            }])
            ->withSum(['orders as revenue' => function($q) {
                $q->whereIn('payment_status', ['paid_pending_confirmation', 'awaiting_merchant_confirmation', 'escrow_locked', 'resolved_merchant_paid']);
            }], 'total_paid')
            ->latest()
            ->get();

        return Inertia::render('Merchant/PaymentPages/Index', [
            'merchantUsername' => $merchant->username,
            'pages' => $pages,
        ]);
    }

    public function create(Merchant $merchant)
    {
        return Inertia::render('Merchant/PaymentPages/Editor', [
            'merchantUsername' => $merchant->username,
        ]);
    }

    public function store(Request $request, Merchant $merchant)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|unique:payment_pages,slug',
            'description' => 'nullable|string',
            'amount' => 'nullable|numeric',
            'currency' => 'required|string|size:3',
            'theme_color' => 'required|string',
            'items' => 'nullable|array',
            'items.*.id' => 'required',
            'items.*.type' => 'required|string',
        ]);

        $page = $merchant->paymentPages()->create($request->only([
            'title', 'slug', 'description', 'amount', 'currency', 'theme_color', 'settings'
        ]));

        if ($request->has('items')) {
            foreach ($request->items as $index => $item) {
                $page->items()->create([
                    'item_type' => $item['type'],
                    'item_id' => $item['id'],
                    'sort_order' => $index,
                ]);
            }
        }

        return redirect()->route('merchant.payment-pages.index', $merchant->username)
            ->with('success', 'Ukurasa wa malipo umetengenezwa tayari!');
    }

    public function edit(Merchant $merchant, PaymentPage $paymentPage)
    {
        $paymentPage->load('items.item');
        return Inertia::render('Merchant/PaymentPages/Editor', [
            'merchantUsername' => $merchant->username,
            'pageData' => $paymentPage,
        ]);
    }

    public function update(Request $request, Merchant $merchant, PaymentPage $paymentPage)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|unique:payment_pages,slug,' . $paymentPage->id,
            'amount' => 'nullable|numeric',
            'items' => 'nullable|array',
        ]);

        $paymentPage->update($request->only([
            'title', 'slug', 'description', 'amount', 'currency', 'theme_color', 'settings', 'is_active'
        ]));

        if ($request->has('items')) {
            $paymentPage->items()->delete();
            foreach ($request->items as $index => $item) {
                $paymentPage->items()->create([
                    'item_type' => $item['type'],
                    'item_id' => $item['id'],
                    'sort_order' => $index,
                ]);
            }
        }

        return redirect()->route('merchant.payment-pages.index', $merchant->username)
            ->with('success', 'Ukurasa wa malipo umesasishwa!');
    }

    public function destroy(Merchant $merchant, PaymentPage $paymentPage)
    {
        $paymentPage->delete();
        return redirect()->back()->with('success', 'Ukurasa umefutwa.');
    }

    public function searchAttachables(Request $request, Merchant $merchant)
    {
        $q = $request->input('q');
        $user = $request->user();

        $products = $user->products()
            ->where('title', 'like', "%{$q}%")
            ->take(10)
            ->get(['id', 'title', 'type'])
            ->map(fn($p) => ['id' => $p->id, 'title' => $p->title, 'type' => \App\Models\Product::class, 'sub' => $p->type]);

        $bundles = $merchant->bundles()
            ->where('title', 'like', "%{$q}%")
            ->take(5)
            ->get(['id', 'title'])
            ->map(fn($b) => ['id' => $b->id, 'title' => $b->title, 'type' => \App\Models\Bundle::class, 'sub' => 'bundle']);

        return response()->json([
            'results' => $products->concat($bundles),
        ]);
    }
}
