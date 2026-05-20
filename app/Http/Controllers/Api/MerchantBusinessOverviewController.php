<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\BundleCohortEnrollment;
use App\Models\Merchant;
use App\Models\MerchantStaff;
use App\Models\OfferingGroup;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\RetailBookkeepingEntry;
use App\Models\ServiceRequest;
use App\Models\ServiceSession;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantBusinessOverviewController extends Controller
{
    public function show(Request $request, Merchant $merchant): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'min:7', 'max:365'],
        ]);

        $days = (int) ($validated['days'] ?? 30);
        $from = CarbonImmutable::now()->subDays($days - 1)->startOfDay();
        $now = now();

        $paidStatuses = ['escrow_locked', 'resolved_merchant_paid', 'held', 'paid'];
        $orders = Order::query()
            ->where('merchant_id', $merchant->id)
            ->where('created_at', '>=', $from)
            ->with('product:id,title,type,module_key')
            ->latest()
            ->get();
        $paidOrders = $orders->whereIn('payment_status', $paidStatuses);

        $products = Product::query()->where('merchant_id', $merchant->id)->get(['id', 'type', 'module_key', 'inventory_count']);
        $serviceRequests = ServiceRequest::query()->where('merchant_id', $merchant->id)->where('created_at', '>=', $from)->get();
        $upcomingBookings = ServiceRequest::query()
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '>=', $now)
            ->whereIn('status', ['pending', 'contacted', 'quoted', 'confirmed'])
            ->count();
        $upcomingSessions = ServiceSession::query()
            ->where('merchant_id', $merchant->id)
            ->where('starts_at', '>=', $now)
            ->whereIn('status', ['open', 'full'])
            ->count();

        $income = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchant->id)
            ->where('entry_type', 'income')
            ->where('status', '!=', 'void')
            ->where('transaction_date', '>=', $from->toDateString())
            ->sum('amount');
        $expenses = RetailBookkeepingEntry::query()
            ->where('merchant_id', $merchant->id)
            ->where('entry_type', 'expense')
            ->where('status', '!=', 'void')
            ->where('transaction_date', '>=', $from->toDateString())
            ->sum('amount');

        $customerKeys = collect()
            ->merge($orders->map(fn (Order $order) => $order->buyer_id ? "user:{$order->buyer_id}" : ($order->customer_phone ? "phone:{$order->customer_phone}" : null)))
            ->merge($serviceRequests->map(fn (ServiceRequest $item) => $item->buyer_id ? "user:{$item->buyer_id}" : ($item->customer_phone ?: $item->customer_email)))
            ->filter()
            ->unique();

        $moduleRevenue = $paidOrders
            ->groupBy(fn (Order $order) => $order->product?->module_key ?: $this->commerceBucket($order))
            ->map(fn ($rows, string $key) => [
                'key' => $key,
                'label' => $this->moduleLabel($key),
                'orders' => $rows->count(),
                'revenue' => (float) $rows->sum(fn (Order $order) => (float) $order->total_paid),
            ])
            ->sortByDesc('revenue')
            ->values();

        return response()->json([
            'window' => [
                'days' => $days,
                'from' => $from->toISOString(),
                'to' => $now->toISOString(),
            ],
            'summary' => [
                'revenue' => (float) $paidOrders->sum(fn (Order $order) => (float) $order->total_paid),
                'orders' => $orders->count(),
                'paid_orders' => $paidOrders->count(),
                'average_order_value' => $paidOrders->count() > 0
                    ? round((float) $paidOrders->sum(fn (Order $order) => (float) $order->total_paid) / $paidOrders->count(), 2)
                    : 0,
                'customers' => $customerKeys->count(),
                'service_requests' => $serviceRequests->count(),
                'upcoming_bookings' => $upcomingBookings,
                'upcoming_sessions' => $upcomingSessions,
                'bookkeeping_profit' => (float) $income - (float) $expenses,
            ],
            'catalog' => [
                'physical' => $products->where('type', 'physical')->count(),
                'digital' => $products->where('type', 'digital')->count(),
                'services' => $products->where('type', 'service')->count(),
                'posts' => Post::query()->where('merchant_id', $merchant->id)->count(),
                'bundles' => Bundle::query()->where('merchant_id', $merchant->id)->count(),
                'offerings' => OfferingGroup::query()->where('merchant_id', $merchant->id)->count(),
                'subscriptions' => SubscriptionPlan::query()->where('merchant_id', $merchant->id)->count(),
                'low_stock' => $products->where('type', 'physical')->filter(fn (Product $product) => (int) ($product->inventory_count ?? 0) <= 3)->count(),
            ],
            'learning' => [
                'enrollments' => BundleCohortEnrollment::query()
                    ->whereHas('cohort.bundle', fn ($query) => $query->where('merchant_id', $merchant->id))
                    ->count(),
                'active_members' => UserSubscription::query()
                    ->where('merchant_id', $merchant->id)
                    ->where('status', 'active')
                    ->where(fn ($query) => $query->whereNull('current_period_end')->orWhere('current_period_end', '>', $now))
                    ->count(),
            ],
            'operations' => [
                'active_staff' => MerchantStaff::query()->where('merchant_id', $merchant->id)->where('is_active', true)->count(),
                'pending_service_requests' => ServiceRequest::query()->where('merchant_id', $merchant->id)->where('status', 'pending')->count(),
                'pending_orders' => Order::query()->where('merchant_id', $merchant->id)->whereIn('payment_status', ['awaiting_payment', 'awaiting_merchant_confirmation', 'escrow_locked'])->count(),
                'bookkeeping_income' => (float) $income,
                'bookkeeping_expenses' => (float) $expenses,
                'bookkeeping_pending_review' => RetailBookkeepingEntry::query()->where('merchant_id', $merchant->id)->where('review_status', 'pending')->count(),
            ],
            'module_revenue' => $moduleRevenue,
            'recent_activity' => $orders->take(8)->map(fn (Order $order) => [
                'type' => 'order',
                'label' => $order->offering_group_selection['group']['title'] ?? $order->product?->title ?? 'Order',
                'status' => $order->payment_status,
                'amount' => (float) ($order->total_paid ?? 0),
                'created_at' => $order->created_at?->toISOString(),
            ])->values(),
        ]);
    }

    private function commerceBucket(Order $order): string
    {
        if ($order->purchasable_type === 'bundle') return 'courses';
        if ($order->purchasable_type === 'offering_group') return 'offerings';
        if ($order->purchasable_type === 'subscription_plan') return 'subscriptions';
        if ($order->product?->type === 'service') return 'services';
        if ($order->product?->type === 'digital') return 'digital_products';
        return 'products';
    }

    private function moduleLabel(string $key): string
    {
        return match ($key) {
            'menu' => 'Menu',
            'rooms' => 'Rooms',
            'tour_departures' => 'Tours',
            'rentals' => 'Rentals',
            'workshops' => 'Workshops',
            'appointments' => 'Appointments',
            'reservations' => 'Reservations',
            'custom_orders' => 'Custom orders',
            'courses' => 'Courses',
            'subscriptions' => 'Subscriptions',
            'offerings' => 'Offering Groups',
            'digital_products' => 'Digital',
            'services' => 'Services',
            default => 'Products',
        };
    }
}
