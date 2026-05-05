<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\Product;
use App\Services\PlatformNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LiveEventController extends Controller
{
    public function __construct(private readonly PlatformNotificationService $notifications)
    {
    }

    public function dashboard(Request $request, Merchant $merchant, Product $product): JsonResponse
    {
        $this->authorizeEvent($request, $merchant, $product);

        $orders = $this->attendeeOrders($product)->get();
        $startsAt = $this->localizedStartsAt($product);

        return response()->json([
            'event' => $this->serializeEvent($product, $startsAt),
            'stats' => [
                'registered_seats' => (int) $orders->sum(fn (Order $order) => (int) $order->quantity),
                'checked_in' => (int) $orders
                    ->filter(fn (Order $order) => in_array($order->live_event_attendance_status, ['present', 'late'], true))
                    ->sum(fn (Order $order) => (int) $order->quantity),
                'capacity' => $product->live_event_capacity !== null ? (int) $product->live_event_capacity : null,
                'seats_remaining' => $product->liveEventSeatsRemaining(),
                'revenue' => (float) $orders->sum(fn (Order $order) => (float) $order->total_paid),
            ],
            'attendees' => $orders->map(fn (Order $order) => $this->serializeAttendee($order))->values(),
        ]);
    }

    public function update(Request $request, Merchant $merchant, Product $product): JsonResponse
    {
        $this->authorizeEvent($request, $merchant, $product);

        $validated = $request->validate([
            'live_event_starts_at' => 'required|date',
            'live_event_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'live_event_timezone' => ['nullable', 'timezone'],
            'live_event_access_url' => 'nullable|string|max:2048',
            'live_event_venue' => 'nullable|string|max:255',
            'live_event_capacity' => 'nullable|integer|min:1|max:100000',
            'live_event_replay_url' => 'nullable|string|max:2048',
            'live_event_instructions' => 'nullable|string|max:5000',
        ]);

        if (blank($validated['live_event_access_url'] ?? null) && blank($validated['live_event_venue'] ?? null)) {
            return response()->json(['message' => 'Add a join link or venue for this live event.'], 422);
        }

        $product->update([
            'live_event_starts_at' => $validated['live_event_starts_at'],
            'live_event_duration_minutes' => $validated['live_event_duration_minutes'] ?? null,
            'live_event_timezone' => $validated['live_event_timezone'] ?: config('app.timezone'),
            'live_event_access_url' => $validated['live_event_access_url'] ?? null,
            'live_event_venue' => $validated['live_event_venue'] ?? null,
            'live_event_capacity' => $validated['live_event_capacity'] ?? null,
            'live_event_replay_url' => $validated['live_event_replay_url'] ?? null,
            'live_event_instructions' => $validated['live_event_instructions'] ?? null,
        ]);

        return $this->dashboard($request, $merchant, $product->fresh());
    }

    public function markAttendance(Request $request, Merchant $merchant, Product $product, Order $order): JsonResponse
    {
        $this->authorizeEvent($request, $merchant, $product);
        abort_unless($order->merchant_id === $merchant->id && $order->product_id === $product->id, 404);

        $validated = $request->validate([
            'status' => 'required|string|in:registered,present,late,absent',
        ]);

        $status = $validated['status'];
        $order->update([
            'live_event_attendance_status' => $status === 'registered' ? null : $status,
            'live_event_checked_in_at' => in_array($status, ['present', 'late'], true) ? now() : null,
        ]);

        return response()->json([
            'message' => 'Attendance updated.',
            'attendee' => $this->serializeAttendee($order->fresh('buyer')),
        ]);
    }

    public function resendAccess(Request $request, Merchant $merchant, Product $product, Order $order): JsonResponse
    {
        $this->authorizeEvent($request, $merchant, $product);
        abort_unless($order->merchant_id === $merchant->id && $order->product_id === $product->id, 404);
        abort_unless($order->buyer, 422, 'This order has no buyer account to notify.');

        $startsAt = $this->localizedStartsAt($product);
        $message = sprintf(
            "Takeer: Access details for \"%s\".\nTime: %s\nOpen: %s",
            $product->title,
            $startsAt ? $startsAt->format('d/m/Y H:i T') : 'TBA',
            $this->eventUrl($product)
        );

        if ($product->live_event_access_url) {
            $message .= "\nJoin link is available inside your purchased event page.";
        }

        if ($product->live_event_replay_url) {
            $message .= "\nReplay is now available inside the event page.";
        }

        if ($product->live_event_instructions) {
            $message .= "\nInstructions: " . $product->live_event_instructions;
        }

        $logs = $this->notifications->dispatchToUser($order->buyer, [
            'channels' => ['sms', 'whatsapp', 'email'],
            'subject' => 'Takeer: Live event access details',
            'message' => $message,
            'dedupe_key' => "live_event.access_resend:{$product->id}:{$order->id}:" . now()->format('YmdHi'),
            'metadata' => [
                'kind' => 'live_event.access_resend',
                'product_id' => $product->id,
                'order_id' => $order->id,
                'event_url' => $this->eventUrl($product),
            ],
        ]);

        $order->update(['live_event_access_last_sent_at' => now()]);

        return response()->json([
            'message' => 'Access details prepared for sending.',
            'notification_count' => $logs->count(),
            'attendee' => $this->serializeAttendee($order->fresh('buyer')),
        ]);
    }

    private function authorizeEvent(Request $request, Merchant $merchant, Product $product): void
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($product->merchant_id === $merchant->id, 404);
        abort_unless($product->type === 'digital' && $product->digital_delivery_type === 'live_event', 404);
    }

    private function attendeeOrders(Product $product)
    {
        return Order::query()
            ->with('buyer')
            ->where('product_id', $product->id)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->latest();
    }

    private function localizedStartsAt(Product $product): ?Carbon
    {
        return $product->live_event_starts_at
            ? $product->live_event_starts_at->timezone($product->live_event_timezone ?: config('app.timezone'))
            : null;
    }

    private function serializeEvent(Product $product, ?Carbon $startsAt): array
    {
        return [
            'starts_at' => $product->live_event_starts_at?->toISOString(),
            'starts_at_local' => $startsAt?->format('d/m/Y H:i'),
            'duration_minutes' => $product->live_event_duration_minutes !== null ? (int) $product->live_event_duration_minutes : null,
            'timezone' => $product->live_event_timezone,
            'access_url' => $product->live_event_access_url,
            'venue' => $product->live_event_venue,
            'capacity' => $product->live_event_capacity !== null ? (int) $product->live_event_capacity : null,
            'replay_url' => $product->live_event_replay_url,
            'instructions' => $product->live_event_instructions,
            'public_url' => $this->eventUrl($product),
        ];
    }

    private function serializeAttendee(Order $order): array
    {
        return [
            'order_id' => $order->id,
            'public_id' => $order->public_id,
            'buyer_id' => $order->buyer_id,
            'buyer_name' => $order->buyer?->name ?: $order->customer_name,
            'buyer_phone' => $order->buyer?->phone_number ?: $order->customer_phone ?: $order->payment_phone,
            'quantity' => (int) $order->quantity,
            'total_paid' => (float) $order->total_paid,
            'status' => $order->live_event_attendance_status ?: 'registered',
            'checked_in_at' => $order->live_event_checked_in_at?->toISOString(),
            'access_last_sent_at' => $order->live_event_access_last_sent_at?->toISOString(),
            'created_at' => $order->created_at?->toISOString(),
        ];
    }

    private function eventUrl(Product $product): string
    {
        return rtrim((string) config('app.url'), '/') . '/product/' . ($product->slug ?: $product->id);
    }
}
