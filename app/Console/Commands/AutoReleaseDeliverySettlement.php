<?php

namespace App\Console\Commands;

use App\Models\DeliveryEvent;
use App\Models\Message;
use App\Models\Order;
use App\Models\ReturnRequest;
use App\Services\EntitlementService;
use App\Services\MarketplaceSettlementService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class AutoReleaseDeliverySettlement extends Command
{
    protected $signature = 'orders:auto-release-delivery-settlement
        {--dry-run : Show eligible orders without requesting provider payout}
        {--limit=100 : Maximum orders to process per run}
        {--forwarder-hours=24 : Review window after forwarder receives the package}
        {--local-hours=24 : Review window after local delivery is marked delivered}
        {--intercity-hours=72 : Review window after intercity delivery is marked delivered}';

    protected $description = 'Mark delivered marketplace orders payout-eligible after the buyer review window.';

    public function handle(MarketplaceSettlementService $settlements, EntitlementService $entitlements): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $limit = max(1, (int) $this->option('limit'));
        $windows = [
            'forwarder' => max(1, (int) $this->option('forwarder-hours')),
            'local_boda' => max(1, (int) $this->option('local-hours')),
            'intercity_bus' => max(1, (int) $this->option('intercity-hours')),
        ];

        $orders = Order::query()
            ->with(['buyer:id,name', 'merchant.user:id,name', 'product', 'delivery.events', 'dispute', 'returnRequest', 'settlement'])
            ->whereIn('payment_status', ['pending_fulfillment', 'payment_confirmed'])
            ->whereHas('settlement', fn ($query) => $query->whereIn('settlement_state', ['pending_fulfillment', 'payment_confirmed']))
            ->whereHas('delivery', fn ($query) => $query->whereIn('delivery_type', ['forwarder', 'local_boda', 'intercity_bus']))
            ->oldest('id')
            ->limit($limit)
            ->get();

        $eligible = $released = $failed = 0;
        foreach ($orders as $order) {
            $decision = $this->releaseDecision($order, $windows);
            if (! $decision || $this->hasOpenBuyerIssue($order)) {
                continue;
            }
            $eligible++;
            $this->line(sprintf('Order #%s eligible: %s.', $order->public_id ?: $order->id, $decision['reason']));
            if ($dryRun) {
                continue;
            }

            try {
                DB::transaction(function () use ($order, $decision, $settlements, $entitlements): void {
                    $locked = Order::query()->with(['delivery', 'settlement', 'product', 'merchant.user'])->lockForUpdate()->findOrFail($order->id);
                    if (! $locked->settlement || ! in_array($locked->settlement->settlement_state, ['pending_fulfillment', 'payment_confirmed'], true) || $this->hasOpenBuyerIssue($locked)) {
                        return;
                    }

                    $locked->delivery?->update(['delivery_status' => 'customer_confirmed', 'confirmed_at' => now()]);
                    $locked->delivery?->events()->create([
                        'order_id' => $locked->id,
                        'status' => 'customer_confirmed',
                        'actor_type' => 'system',
                        'note' => $decision['note'],
                        'metadata' => ['automatic_review_window' => true, 'release_reason' => $decision['reason'], 'review_window_hours' => $decision['hours']],
                    ]);
                    $this->appendSettlementMessage($locked, $decision['message']);
                    $settlements->releaseAfterFulfillment($locked, 'delivery_review_window_expired', ['decision' => $decision]);
                    $entitlements->grantForOrder($locked->fresh(['product']));
                });
                $released++;
            } catch (Throwable $exception) {
                $failed++;
                report($exception);
                $this->error(sprintf('Order #%s failed: %s', $order->public_id ?: $order->id, $exception->getMessage()));
            }
        }

        $this->info(sprintf('Delivery settlement review complete. Eligible: %d. Payout requests created: %d. Failed: %d.%s', $eligible, $released, $failed, $dryRun ? ' Dry run only.' : ''));
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function releaseDecision(Order $order, array $windows): ?array
    {
        $delivery = $order->delivery;
        if (! $delivery) return null;
        $type = (string) $delivery->delivery_type;
        $status = (string) $delivery->delivery_status;
        $eventStatus = $type === 'forwarder' ? 'ready_at_terminal' : 'delivered';
        $window = $windows[$type] ?? null;
        if ($window === null || ($type === 'forwarder' ? $status !== 'ready_at_terminal' : $status !== 'delivered')) return null;
        $event = $delivery->events?->first(fn (DeliveryEvent $event) => $event->status === $eventStatus);
        $eventAt = $event?->created_at ?? ($type === 'forwarder' ? $delivery->updated_at : ($delivery->delivered_at ?? $delivery->updated_at));
        if (! $eventAt || ! $eventAt->lte(now()->subHours($window))) return null;
        return [
            'reason' => $type . ' delivery review window expired',
            'hours' => $window,
            'note' => 'The buyer review window expired without an open issue.',
            'message' => 'Takeer marked this order ready for provider payout after the buyer review window ended without an issue.',
        ];
    }

    private function hasOpenBuyerIssue(Order $order): bool
    {
        $order->loadMissing(['dispute', 'returnRequest']);
        return $order->payment_status === 'disputed'
            || ($order->dispute && ! in_array($order->dispute->status, ['resolved', 'closed'], true))
            || ($order->returnRequest && in_array($order->returnRequest->status, [ReturnRequest::STATUS_PENDING, ReturnRequest::STATUS_APPROVED, ReturnRequest::STATUS_ITEM_RECEIVED, ReturnRequest::STATUS_ESCALATED], true));
    }

    private function appendSettlementMessage(Order $order, string $body): void
    {
        if (! $order->merchant?->user_id || ! $order->buyer_id) return;
        Message::create([
            'order_id' => $order->id,
            'sender_id' => $order->merchant->user_id,
            'receiver_id' => $order->buyer_id,
            'type' => 'system',
            'body' => $body,
            'payload' => ['action_type' => 'settlement_review_window_completed', 'occurred_at' => now()->toISOString()],
        ]);
    }
}
