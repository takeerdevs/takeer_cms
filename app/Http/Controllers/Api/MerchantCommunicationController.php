<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BundleCohortEnrollment;
use App\Models\Merchant;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\ServiceRequest;
use App\Models\UserSubscription;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class MerchantCommunicationController extends Controller
{
    public function index(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);

        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'segment' => ['nullable', 'string', 'max:40'],
        ]);

        $contacts = $this->contacts($merchant);
        $query = strtolower(trim((string) ($validated['q'] ?? '')));
        $segment = (string) ($validated['segment'] ?? 'all');

        $filteredContacts = $contacts
            ->filter(function (array $contact) use ($query, $segment) {
                if ($query !== '') {
                    $haystack = strtolower(implode(' ', array_filter([
                        $contact['name'],
                        $contact['phone'],
                        $contact['email'],
                    ])));

                    if (! str_contains($haystack, $query)) {
                        return false;
                    }
                }

                return match ($segment) {
                    'needs_reply' => collect($contact['followups'])->contains(fn (array $item) => $item['priority'] === 'high'),
                    'bookings' => in_array('service_requests', $contact['sources'], true),
                    'orders' => in_array('orders', $contact['sources'], true),
                    'learning' => in_array('enrollments', $contact['sources'], true),
                    'members' => in_array('subscriptions', $contact['sources'], true),
                    default => true,
                };
            })
            ->sortByDesc(fn (array $contact) => $contact['last_activity_at'] ?? '')
            ->values();

        $logs = NotificationLog::query()
            ->where('metadata->merchant_id', $merchant->id)
            ->latest()
            ->limit(40)
            ->get()
            ->map(fn (NotificationLog $log) => [
                'id' => $log->id,
                'channel' => $log->channel,
                'recipient' => $log->recipient ?: $log->phone ?: $log->email ?: $log->whatsapp,
                'subject' => $log->subject,
                'message' => $log->message,
                'status' => $log->status,
                'created_at' => $log->created_at?->toISOString(),
                'metadata' => $log->metadata ?: [],
            ]);

        $followups = $filteredContacts
            ->flatMap(fn (array $contact) => collect($contact['followups'])->map(fn (array $item) => [
                ...$item,
                'contact' => [
                    'key' => $contact['key'],
                    'name' => $contact['name'],
                    'phone' => $contact['phone'],
                    'email' => $contact['email'],
                ],
            ]))
            ->sortByDesc(fn (array $item) => $item['priority'] === 'high' ? 2 : 1)
            ->values()
            ->take(30);

        return response()->json([
            'summary' => [
                'contacts' => $filteredContacts->count(),
                'needs_reply' => $contacts->filter(fn (array $contact) => collect($contact['followups'])->contains(fn (array $item) => $item['priority'] === 'high'))->count(),
                'pending_messages' => $logs->where('status', 'pending')->count(),
                'sent_messages' => $logs->where('status', 'sent')->count(),
            ],
            'templates' => $this->templates($merchant),
            'followups' => $followups,
            'contacts' => $filteredContacts->take(80)->values(),
            'logs' => $logs,
        ]);
    }

    public function store(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);

        $validated = $request->validate([
            'channel' => ['required', 'string', Rule::in(['sms', 'whatsapp', 'email', 'call', 'in_person'])],
            'recipient' => ['required', 'string', 'max:180'],
            'subject' => ['nullable', 'string', 'max:180'],
            'message' => ['required', 'string', 'max:2000'],
            'contact_key' => ['nullable', 'string', 'max:120'],
            'template_key' => ['nullable', 'string', 'max:80'],
            'context_type' => ['nullable', 'string', 'max:80'],
            'context_id' => ['nullable', 'integer'],
        ]);

        $log = NotificationLog::query()->create([
            'user_id' => $request->user()->id,
            'channel' => $validated['channel'],
            'recipient' => $validated['recipient'],
            'phone' => in_array($validated['channel'], ['sms', 'call'], true) ? $validated['recipient'] : null,
            'email' => $validated['channel'] === 'email' ? $validated['recipient'] : null,
            'whatsapp' => $validated['channel'] === 'whatsapp' ? $validated['recipient'] : null,
            'subject' => $validated['subject'] ?? null,
            'message' => $validated['message'],
            'status' => 'pending',
            'gateway' => 'manual',
            'metadata' => [
                'merchant_id' => $merchant->id,
                'merchant_username' => $merchant->username,
                'source' => 'merchant_communications',
                'contact_key' => $validated['contact_key'] ?? null,
                'template_key' => $validated['template_key'] ?? null,
                'context_type' => $validated['context_type'] ?? null,
                'context_id' => $validated['context_id'] ?? null,
            ],
        ]);

        return response()->json([
            'message' => 'Message prepared in the communication log.',
            'log' => [
                'id' => $log->id,
                'channel' => $log->channel,
                'recipient' => $log->recipient,
                'subject' => $log->subject,
                'message' => $log->message,
                'status' => $log->status,
                'created_at' => $log->created_at?->toISOString(),
            ],
        ], 201);
    }

    private function contacts(Merchant $merchant): Collection
    {
        $contacts = collect();

        Order::query()
            ->where('merchant_id', $merchant->id)
            ->with(['buyer:id,name,email,phone_number', 'product:id,title,type,module_key'])
            ->latest()
            ->take(500)
            ->get()
            ->each(function (Order $order) use (&$contacts) {
                $this->mergeContact($contacts, [
                    'user_id' => $order->buyer_id,
                    'name' => $order->buyer?->name ?: $order->customer_name,
                    'email' => $order->buyer?->email,
                    'phone' => $order->buyer?->phone_number ?: $order->customer_phone ?: $order->account_phone ?: $order->payment_phone,
                    'source' => 'orders',
                    'activity_at' => $order->created_at,
                    'label' => $order->product?->title ?: 'Order',
                    'status' => $order->payment_status,
                    'followup' => in_array($order->payment_status, ['awaiting_payment', 'awaiting_merchant_confirmation', 'pending'], true)
                        ? $this->followup('order_'.$order->id, 'Order follow-up', 'Check payment, confirmation, or fulfilment status.', 'high', 'order', $order->id)
                        : null,
                ]);
            });

        ServiceRequest::query()
            ->where('merchant_id', $merchant->id)
            ->with(['buyer:id,name,email,phone_number', 'product:id,title,type,module_key'])
            ->latest()
            ->take(500)
            ->get()
            ->each(function (ServiceRequest $serviceRequest) use (&$contacts) {
                $this->mergeContact($contacts, [
                    'user_id' => $serviceRequest->buyer_id,
                    'name' => $serviceRequest->buyer?->name ?: $serviceRequest->customer_name,
                    'email' => $serviceRequest->buyer?->email ?: $serviceRequest->customer_email,
                    'phone' => $serviceRequest->buyer?->phone_number ?: $serviceRequest->customer_phone,
                    'source' => 'service_requests',
                    'activity_at' => $serviceRequest->scheduled_at ?: $serviceRequest->created_at,
                    'label' => $serviceRequest->product?->title ?: 'Service request',
                    'status' => $serviceRequest->status,
                    'followup' => in_array($serviceRequest->status, ['pending', 'contacted', 'quoted'], true)
                        ? $this->followup('service_'.$serviceRequest->id, 'Service follow-up', 'Respond to the request, confirm schedule, or share next steps.', 'high', 'service_request', $serviceRequest->id)
                        : null,
                ]);
            });

        UserSubscription::query()
            ->where('merchant_id', $merchant->id)
            ->with(['user:id,name,email,phone_number', 'plan:id,name'])
            ->latest()
            ->take(500)
            ->get()
            ->each(function (UserSubscription $subscription) use (&$contacts) {
                $endsSoon = $subscription->current_period_end
                    && $subscription->current_period_end->between(now(), now()->addDays(14));

                $this->mergeContact($contacts, [
                    'user_id' => $subscription->user_id,
                    'name' => $subscription->user?->name,
                    'email' => $subscription->user?->email,
                    'phone' => $subscription->user?->phone_number,
                    'source' => 'subscriptions',
                    'activity_at' => $subscription->current_period_end ?: $subscription->started_at ?: $subscription->created_at,
                    'label' => $subscription->plan?->name ?: 'Subscription',
                    'status' => $subscription->status,
                    'followup' => $endsSoon
                        ? $this->followup('subscription_'.$subscription->id, 'Membership renewal', 'Current period ends soon; remind the member about renewal or next steps.', 'normal', 'subscription', $subscription->id)
                        : null,
                ]);
            });

        BundleCohortEnrollment::query()
            ->whereHas('cohort.bundle', fn ($query) => $query->where('merchant_id', $merchant->id))
            ->with(['user:id,name,email,phone_number', 'cohort.bundle:id,title,merchant_id'])
            ->latest()
            ->take(500)
            ->get()
            ->each(function (BundleCohortEnrollment $enrollment) use (&$contacts) {
                $cohortStart = $enrollment->cohort?->starts_at;
                $startsSoon = $cohortStart && CarbonImmutable::parse($cohortStart)->between(now(), now()->addDays(7));

                $this->mergeContact($contacts, [
                    'user_id' => $enrollment->user_id,
                    'name' => $enrollment->user?->name,
                    'email' => $enrollment->user?->email,
                    'phone' => $enrollment->user?->phone_number,
                    'source' => 'enrollments',
                    'activity_at' => $cohortStart ?: $enrollment->enrolled_at ?: $enrollment->created_at,
                    'label' => $enrollment->cohort?->bundle?->title ?: 'Enrollment',
                    'status' => $enrollment->status,
                    'followup' => $startsSoon
                        ? $this->followup('enrollment_'.$enrollment->id, 'Class reminder', 'Cohort starts soon; share joining details or materials.', 'normal', 'enrollment', $enrollment->id)
                        : null,
                ]);
            });

        return $contacts
            ->map(fn (array $contact) => [
                ...$contact,
                'sources' => collect($contact['sources'])->unique()->values()->all(),
                'followups' => collect($contact['followups'])->unique('key')->values()->all(),
                'recent_activity' => collect($contact['recent_activity'])->sortByDesc('activity_at')->take(4)->values()->all(),
            ]);
    }

    private function mergeContact(Collection &$contacts, array $entry): void
    {
        $name = trim((string) ($entry['name'] ?? ''));
        $email = trim((string) ($entry['email'] ?? ''));
        $phone = preg_replace('/\s+/', '', trim((string) ($entry['phone'] ?? '')));

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
            'phone' => null,
            'email' => null,
            'sources' => [],
            'activity_count' => 0,
            'last_activity_at' => null,
            'recent_activity' => [],
            'followups' => [],
        ]);

        $activityAt = $entry['activity_at']
            ? CarbonImmutable::parse($entry['activity_at'])
            : CarbonImmutable::now();

        $contact['name'] = $contact['name'] ?: ($name ?: null);
        $contact['phone'] = $contact['phone'] ?: ($phone ?: null);
        $contact['email'] = $contact['email'] ?: ($email ?: null);
        $contact['sources'][] = $entry['source'];
        $contact['activity_count']++;
        $contact['last_activity_at'] = $contact['last_activity_at']
            ? max($contact['last_activity_at'], $activityAt->toISOString())
            : $activityAt->toISOString();
        $contact['recent_activity'][] = [
            'source' => $entry['source'],
            'label' => $entry['label'] ?? null,
            'status' => $entry['status'] ?? null,
            'activity_at' => $activityAt->toISOString(),
        ];

        if (! empty($entry['followup'])) {
            $contact['followups'][] = $entry['followup'];
        }

        $contacts->put($key, $contact);
    }

    private function followup(string $key, string $title, string $description, string $priority, string $contextType, int $contextId): array
    {
        return compact('key', 'title', 'description', 'priority') + [
            'context_type' => $contextType,
            'context_id' => $contextId,
        ];
    }

    private function templates(Merchant $merchant): array
    {
        $name = $merchant->display_name ?: 'our team';

        return [
            [
                'key' => 'order_update',
                'label' => 'Order update',
                'channel' => 'sms',
                'subject' => 'Order update',
                'message' => "Hi {{customer_name}}, {$name} here. Your order update: {{next_step}}. Reply here if you need help.",
            ],
            [
                'key' => 'booking_confirmation',
                'label' => 'Booking confirmation',
                'channel' => 'whatsapp',
                'subject' => 'Booking confirmation',
                'message' => "Hi {{customer_name}}, your booking with {$name} is confirmed for {{date_time}}. Please let us know if anything changes.",
            ],
            [
                'key' => 'class_reminder',
                'label' => 'Class reminder',
                'channel' => 'sms',
                'subject' => 'Class reminder',
                'message' => "Hi {{customer_name}}, reminder from {$name}: your session starts on {{date_time}}. Bring any required materials and arrive on time.",
            ],
            [
                'key' => 'renewal_reminder',
                'label' => 'Renewal reminder',
                'channel' => 'whatsapp',
                'subject' => 'Membership renewal',
                'message' => "Hi {{customer_name}}, your membership with {$name} is due soon. Reply here if you want help renewing.",
            ],
            [
                'key' => 'general_followup',
                'label' => 'General follow-up',
                'channel' => 'sms',
                'subject' => 'Follow-up',
                'message' => "Hi {{customer_name}}, {$name} checking in. {{next_step}}",
            ],
        ];
    }
}
