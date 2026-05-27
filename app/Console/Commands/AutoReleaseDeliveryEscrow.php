<?php

namespace App\Console\Commands;

use App\Models\DeliveryEvent;
use App\Models\Message;
use App\Models\Order;
use App\Models\ReturnRequest;
use App\Services\EntitlementService;
use App\Services\WalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class AutoReleaseDeliveryEscrow extends Command
{
    protected $signature = 'orders:auto-release-delivery-escrow
        {--dry-run : Show eligible orders without releasing funds}
        {--limit=100 : Maximum orders to process per run}
        {--forwarder-hours=24 : Review window after forwarder receives the package}
        {--local-hours=24 : Review window after local delivery is marked delivered}
        {--intercity-hours=72 : Review window after intercity delivery is marked delivered}';

    protected $description = 'Release delivery escrow after buyer confirmation windows expire without a buyer issue.';

    public function handle(WalletService $walletService, EntitlementService $entitlementService): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $limit = max(1, (int) $this->option('limit'));
        $windows = [
            'forwarder' => max(1, (int) $this->option('forwarder-hours')),
            'local_boda' => max(1, (int) $this->option('local-hours')),
            'intercity_bus' => max(1, (int) $this->option('intercity-hours')),
        ];

        $orders = Order::query()
            ->with(['buyer:id,name,phone_number', 'merchant.user:id,name,phone_number', 'product', 'delivery.events', 'dispute', 'returnRequest'])
            ->whereIn('payment_status', ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped'])
            ->whereNull('paid_out_at')
            ->whereHas('delivery', fn ($query) => $query->whereIn('delivery_type', ['forwarder', 'local_boda', 'intercity_bus']))
            ->whereDoesntHave('dispute', fn ($query) => $query
                ->whereNull('status')
                ->orWhereNotIn('status', ['resolved', 'closed']))
            ->whereDoesntHave('returnRequest', fn ($query) => $query
                ->whereIn('status', [
                    ReturnRequest::STATUS_PENDING,
                    ReturnRequest::STATUS_APPROVED,
                    ReturnRequest::STATUS_ITEM_RECEIVED,
                    ReturnRequest::STATUS_ESCALATED,
                ]))
            ->oldest('id')
            ->limit($limit)
            ->get();

        $eligible = 0;
        $released = 0;
        $failed = 0;

        foreach ($orders as $order) {
            $decision = $this->releaseDecision($order, $windows);
            if (! $decision) {
                continue;
            }

            $eligible++;
            $this->line(sprintf(
                'Order #%s eligible: %s after %dh window from %s.',
                $order->public_id ?: $order->id,
                $decision['reason'],
                $decision['hours'],
                $decision['event_at']?->toDateTimeString() ?: 'delivery timestamp'
            ));

            if ($dryRun) {
                continue;
            }

            try {
                DB::transaction(function () use ($order, $decision, $walletService, $entitlementService): void {
                    $order = Order::query()
                        ->with(['delivery', 'merchant.user', 'product'])
                        ->whereKey($order->id)
                        ->lockForUpdate()
                        ->firstOrFail();

                    if (! in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped'], true) || $order->paid_out_at) {
                        return;
                    }

                    if ($this->hasOpenBuyerIssue($order)) {
                        return;
                    }

                    $order->delivery?->update([
                        'delivery_status' => 'customer_confirmed',
                        'confirmed_at' => now(),
                    ]);

                    $order->delivery?->events()->create([
                        'order_id' => $order->id,
                        'status' => 'customer_confirmed',
                        'actor_type' => 'system',
                        'actor_user_id' => null,
                        'note' => $decision['note'],
                        'metadata' => [
                            'auto_release' => true,
                            'release_reason' => $decision['reason'],
                            'review_window_hours' => $decision['hours'],
                        ],
                    ]);

                    $this->appendAutoReleaseMessage($order, $decision['message']);
                    $walletService->releaseEscrowToMerchant($order);
                    $entitlementService->grantForOrder($order->fresh(['product']));
                });

                $released++;
            } catch (Throwable $exception) {
                $failed++;
                report($exception);
                $this->error(sprintf('Order #%s failed: %s', $order->public_id ?: $order->id, $exception->getMessage()));
            }
        }

        $this->info(sprintf(
            'Delivery escrow auto-release complete. Eligible: %d. Released: %d. Failed: %d.%s',
            $eligible,
            $released,
            $failed,
            $dryRun ? ' Dry run only.' : ''
        ));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function releaseDecision(Order $order, array $windows): ?array
    {
        $delivery = $order->delivery;
        if (! $delivery) {
            return null;
        }

        $type = (string) $delivery->delivery_type;
        $status = (string) $delivery->delivery_status;

        if ($type === 'forwarder' && $status === 'ready_at_terminal') {
            $event = $this->latestEvent($order, 'ready_at_terminal');
            if (! $this->windowExpired($event?->created_at ?? $delivery->updated_at, $windows['forwarder'])) {
                return null;
            }

            return [
                'reason' => 'forwarder handoff received',
                'hours' => $windows['forwarder'],
                'event_at' => $event?->created_at ?? $delivery->updated_at,
                'note' => 'Auto-released after the forwarder handoff review window expired with no buyer issue.',
                'message' => 'Takeer SafePay released this order because the forwarder handoff review window ended without a buyer issue.',
            ];
        }

        if ($type === 'local_boda' && $status === 'delivered') {
            $event = $this->latestEvent($order, 'delivered');
            if (! $this->windowExpired($event?->created_at ?? $delivery->delivered_at ?? $delivery->updated_at, $windows['local_boda'])) {
                return null;
            }

            return [
                'reason' => 'local delivery marked delivered',
                'hours' => $windows['local_boda'],
                'event_at' => $event?->created_at ?? $delivery->delivered_at ?? $delivery->updated_at,
                'note' => 'Auto-released after the local delivery review window expired with no buyer issue.',
                'message' => 'Takeer SafePay released this order because local delivery was marked complete and the buyer review window ended without an issue.',
            ];
        }

        if ($type === 'intercity_bus' && $status === 'delivered') {
            $event = $this->latestEvent($order, 'delivered');
            if (! $this->windowExpired($event?->created_at ?? $delivery->delivered_at ?? $delivery->updated_at, $windows['intercity_bus'])) {
                return null;
            }

            return [
                'reason' => 'intercity pickup marked delivered',
                'hours' => $windows['intercity_bus'],
                'event_at' => $event?->created_at ?? $delivery->delivered_at ?? $delivery->updated_at,
                'note' => 'Auto-released after the intercity delivery review window expired with no buyer issue.',
                'message' => 'Takeer SafePay released this order because intercity pickup was marked complete and the buyer review window ended without an issue.',
            ];
        }

        return null;
    }

    private function latestEvent(Order $order, string $status): ?DeliveryEvent
    {
        return $order->delivery?->events
            ->first(fn (DeliveryEvent $event) => $event->status === $status);
    }

    private function windowExpired($timestamp, int $hours): bool
    {
        return $timestamp && $timestamp->lte(now()->subHours($hours));
    }

    private function hasOpenBuyerIssue(Order $order): bool
    {
        $order->loadMissing(['dispute', 'returnRequest']);

        if ($order->payment_status === 'disputed') {
            return true;
        }

        if ($order->dispute && ! in_array($order->dispute->status, ['resolved', 'closed'], true)) {
            return true;
        }

        return $order->returnRequest
            && in_array($order->returnRequest->status, [
                ReturnRequest::STATUS_PENDING,
                ReturnRequest::STATUS_APPROVED,
                ReturnRequest::STATUS_ITEM_RECEIVED,
                ReturnRequest::STATUS_ESCALATED,
            ], true);
    }

    private function appendAutoReleaseMessage(Order $order, string $body): void
    {
        $senderId = $order->merchant?->user_id;
        $receiverId = $order->buyer_id;

        if (! $senderId || ! $receiverId) {
            return;
        }

        Message::create([
            'order_id' => $order->id,
            'sender_id' => $senderId,
            'receiver_id' => $receiverId,
            'type' => 'system',
            'body' => $body,
            'payload' => [
                'action_type' => 'escrow_auto_released',
                'released_at' => now()->toISOString(),
            ],
        ]);
    }
}
