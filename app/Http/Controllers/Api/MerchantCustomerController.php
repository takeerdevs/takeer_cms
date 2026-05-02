<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MerchantCustomer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MerchantCustomerController extends Controller
{
    /**
     * List all customers for the merchant.
     */
    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $query = $request->input('q');

        $customersQuery = MerchantCustomer::where('merchant_id', $merchant->id)
            ->with('user')
            ->orderByDesc('total_spent');

        if (filled($query)) {
            $customersQuery->where(function($q) use ($query) {
                $q->where('name', 'LIKE', "%{$query}%")
                  ->orWhere('phone', 'LIKE', "%{$query}%");
            });
        }

        $customers = $customersQuery->paginate(20);

        return response()->json($customers);
    }

    /**
     * Get details of a specific customer.
     */
    public function show(Request $request, MerchantCustomer $customer): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($customer->merchant_id !== $merchant->id) abort(403);

        // Fetch recent orders for this customer
        $orders = \App\Models\Order::where('merchant_id', $merchant->id)
            ->where('customer_phone', $customer->phone)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return response()->json([
            'customer' => $customer,
            'recent_orders' => $orders
        ]);
    }
}
