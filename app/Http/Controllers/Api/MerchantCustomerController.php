<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BundleCohortEnrollment;
use App\Models\MerchantCustomer;
use App\Models\Order;
use App\Models\ServiceRequest;
use App\Models\UserSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class MerchantCustomerController extends Controller
{
    public function crm(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);

        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'segment' => ['nullable', 'string', 'max:40'],
        ]);

        $contacts = collect();

        Order::query()
            ->where('merchant_id', $merchant->id)
            ->with(['buyer:id,name,email,phone_number', 'product:id,title,type,module_key'])
            ->latest()
            ->take(1000)
            ->get()
            ->each(function (Order $order) use (&$contacts) {
                $this->mergeCustomerContact($contacts, [
                    'user_id' => $order->buyer_id,
                    'name' => $order->buyer?->name ?: $order->customer_name,
                    'email' => $order->buyer?->email,
                    'phone' => $order->buyer?->phone_number ?: $order->customer_phone ?: $order->account_phone ?: $order->payment_phone,
                    'source' => 'orders',
                    'activity_at' => $order->created_at,
                    'amount' => (float) ($order->total_paid ?? $order->grand_total ?? 0),
                    'label' => $order->product?->title ?: 'Order',
                    'meta' => [
                        'status' => $order->payment_status,
                        'kind' => $order->order_kind ?: $order->product?->type,
                    ],
                ]);
            });

        ServiceRequest::query()
            ->where('merchant_id', $merchant->id)
            ->with(['buyer:id,name,email,phone_number', 'product:id,title,type,module_key'])
            ->latest()
            ->take(1000)
            ->get()
            ->each(function (ServiceRequest $serviceRequest) use (&$contacts) {
                $this->mergeCustomerContact($contacts, [
                    'user_id' => $serviceRequest->buyer_id,
                    'name' => $serviceRequest->buyer?->name ?: $serviceRequest->customer_name,
                    'email' => $serviceRequest->buyer?->email ?: $serviceRequest->customer_email,
                    'phone' => $serviceRequest->buyer?->phone_number ?: $serviceRequest->customer_phone,
                    'source' => 'service_requests',
                    'activity_at' => $serviceRequest->scheduled_at ?: $serviceRequest->created_at,
                    'amount' => (float) ($serviceRequest->quoted_amount ?? 0),
                    'label' => $serviceRequest->product?->title ?: 'Service request',
                    'meta' => [
                        'status' => $serviceRequest->status,
                        'module' => $serviceRequest->product?->module_key,
                    ],
                ]);
            });

        UserSubscription::query()
            ->where('merchant_id', $merchant->id)
            ->with(['user:id,name,email,phone_number', 'plan:id,name,price'])
            ->latest()
            ->take(1000)
            ->get()
            ->each(function (UserSubscription $subscription) use (&$contacts) {
                $this->mergeCustomerContact($contacts, [
                    'user_id' => $subscription->user_id,
                    'name' => $subscription->user?->name,
                    'email' => $subscription->user?->email,
                    'phone' => $subscription->user?->phone_number,
                    'source' => 'subscriptions',
                    'activity_at' => $subscription->started_at ?: $subscription->created_at,
                    'amount' => (float) ($subscription->plan?->price ?? 0),
                    'label' => $subscription->plan?->name ?: 'Subscription',
                    'meta' => [
                        'status' => $subscription->status,
                    ],
                ]);
            });

        BundleCohortEnrollment::query()
            ->whereHas('cohort.bundle', fn ($query) => $query->where('merchant_id', $merchant->id))
            ->with(['user:id,name,email,phone_number', 'cohort.bundle:id,title,merchant_id', 'order:id,total_paid,payment_status'])
            ->latest()
            ->take(1000)
            ->get()
            ->each(function (BundleCohortEnrollment $enrollment) use (&$contacts) {
                $this->mergeCustomerContact($contacts, [
                    'user_id' => $enrollment->user_id,
                    'name' => $enrollment->user?->name,
                    'email' => $enrollment->user?->email,
                    'phone' => $enrollment->user?->phone_number,
                    'source' => 'enrollments',
                    'activity_at' => $enrollment->enrolled_at ?: $enrollment->created_at,
                    'amount' => (float) ($enrollment->order?->total_paid ?? 0),
                    'label' => $enrollment->cohort?->bundle?->title ?: 'Enrollment',
                    'meta' => [
                        'status' => $enrollment->status,
                        'cohort' => $enrollment->cohort?->name,
                    ],
                ]);
            });

        $query = strtolower(trim((string) ($validated['q'] ?? '')));
        $segment = (string) ($validated['segment'] ?? 'all');

        $customers = $contacts
            ->values()
            ->map(fn (array $contact) => $this->finalizeCustomerContact($contact))
            ->filter(function (array $contact) use ($query, $segment) {
                if ($query !== '') {
                    $haystack = strtolower(implode(' ', array_filter([
                        $contact['name'],
                        $contact['email'],
                        $contact['phone'],
                    ])));

                    if (! str_contains($haystack, $query)) {
                        return false;
                    }
                }

                return match ($segment) {
                    'vip' => $contact['total_spent'] >= 100000 || $contact['activity_count'] >= 5,
                    'repeat' => $contact['activity_count'] >= 2,
                    'services' => in_array('service_requests', $contact['sources'], true),
                    'students' => in_array('enrollments', $contact['sources'], true),
                    'members' => in_array('subscriptions', $contact['sources'], true),
                    default => true,
                };
            })
            ->sortByDesc(fn (array $contact) => $contact['last_activity_at'] ?? '')
            ->values();

        return response()->json([
            'summary' => [
                'total' => $customers->count(),
                'vip' => $customers->filter(fn (array $contact) => $contact['total_spent'] >= 100000 || $contact['activity_count'] >= 5)->count(),
                'repeat' => $customers->filter(fn (array $contact) => $contact['activity_count'] >= 2)->count(),
                'service_customers' => $customers->filter(fn (array $contact) => in_array('service_requests', $contact['sources'], true))->count(),
                'students' => $customers->filter(fn (array $contact) => in_array('enrollments', $contact['sources'], true))->count(),
                'members' => $customers->filter(fn (array $contact) => in_array('subscriptions', $contact['sources'], true))->count(),
            ],
            'customers' => $customers->take(200)->values(),
        ]);
    }

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

    private function mergeCustomerContact(Collection &$contacts, array $entry): void
    {
        $name = trim((string) ($entry['name'] ?? ''));
        $email = trim((string) ($entry['email'] ?? ''));
        $phone = $this->normalizePhone($entry['phone'] ?? null);

        if ($name === '' && $email === '' && $phone === '' && empty($entry['user_id'])) {
            return;
        }

        $key = $entry['user_id']
            ? 'user:'.$entry['user_id']
            : ($phone !== '' ? 'phone:'.$phone : 'email:'.strtolower($email));

        $contact = $contacts->get($key, [
            'key' => $key,
            'user_id' => $entry['user_id'] ?? null,
            'name' => null,
            'email' => null,
            'phone' => null,
            'sources' => [],
            'activity_count' => 0,
            'total_spent' => 0,
            'last_activity_at' => null,
            'recent_activity' => [],
        ]);

        $contact['name'] = $contact['name'] ?: ($name ?: null);
        $contact['email'] = $contact['email'] ?: ($email ?: null);
        $contact['phone'] = $contact['phone'] ?: ($phone ?: null);
        $contact['sources'][] = $entry['source'];
        $contact['activity_count'] += 1;
        $contact['total_spent'] += (float) ($entry['amount'] ?? 0);

        $activityAt = $entry['activity_at'] instanceof Carbon
            ? $entry['activity_at']
            : ($entry['activity_at'] ? Carbon::parse($entry['activity_at']) : now());
        $lastActivity = $contact['last_activity_at'] ? Carbon::parse($contact['last_activity_at']) : null;
        if (! $lastActivity || $activityAt->greaterThan($lastActivity)) {
            $contact['last_activity_at'] = $activityAt->toISOString();
        }

        $contact['recent_activity'][] = [
            'source' => $entry['source'],
            'label' => $entry['label'] ?? null,
            'amount' => (float) ($entry['amount'] ?? 0),
            'activity_at' => $activityAt->toISOString(),
            'meta' => $entry['meta'] ?? [],
        ];

        $contacts->put($key, $contact);
    }

    private function finalizeCustomerContact(array $contact): array
    {
        $contact['sources'] = collect($contact['sources'])->unique()->values()->all();
        $contact['total_spent'] = round((float) $contact['total_spent'], 2);
        $contact['recent_activity'] = collect($contact['recent_activity'])
            ->sortByDesc('activity_at')
            ->take(5)
            ->values()
            ->all();
        $contact['segments'] = collect([
            ($contact['total_spent'] >= 100000 || $contact['activity_count'] >= 5) ? 'VIP' : null,
            $contact['activity_count'] >= 2 ? 'Repeat' : null,
            in_array('service_requests', $contact['sources'], true) ? 'Services' : null,
            in_array('enrollments', $contact['sources'], true) ? 'Student' : null,
            in_array('subscriptions', $contact['sources'], true) ? 'Member' : null,
        ])->filter()->values()->all();

        return $contact;
    }

    private function normalizePhone(mixed $phone): string
    {
        return preg_replace('/\s+/', '', trim((string) $phone));
    }
}
