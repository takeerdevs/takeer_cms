<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Payments\PaymentCallbackProcessor;
use App\Payments\PaymentEvent;
use App\Services\ProviderEventRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * POST /api/payments/tz/flutterwave
 *
 * Flutterwave posts a webhook here after the customer completes the transaction.
 *
 * Security: We verify the 'verif-hash' header against our FLUTTERWAVE_SECRET_HASH.
 */
class FlutterwaveCallbackController extends Controller
{
    public function __construct(
        private readonly PaymentCallbackProcessor $processor,
        private readonly ProviderEventRecorder $events,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        // 1. Verify Secret Hash for security
        $secretHash = config('services.flutterwave.secret_hash');
        $signature  = $request->header('verif-hash');

        if (!$signature || !$secretHash || ! hash_equals((string) $secretHash, (string) $signature)) {
            Log::warning('Flutterwave Callback: Invalid or missing secret hash.', [
                'signature_present' => $signature !== null,
                'ip'     => $request->ip(),
            ]);
            $rejected = new PaymentEvent(provider: 'flutterwave', direction: 'payin', status: 'rejected', rawPayload: $request->all());
            $this->events->record($request, $rejected, $signature !== null, false);
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $payload = $request->input('data');
        $event   = $request->input('event');

        if (! is_array($payload)) {
            $malformed = new PaymentEvent(
                provider: 'flutterwave',
                direction: 'payin',
                status: 'rejected',
                rawPayload: $request->all(),
                failureReason: 'Provider callback data must be an object.',
            );
            $providerEvent = $this->events->record($request, $malformed, true, true);
            $providerEvent->update(['validation_state' => 'review', 'processing_result' => 'malformed_payload']);
            return response()->json(['status' => 'review'], 200);
        }

        Log::info('Flutterwave callback received.', [
            'event'   => $event,
            'tx_ref'  => $payload['tx_ref'] ?? 'N/A',
            'status'  => $payload['status'] ?? 'N/A',
        ]);

        // Record every authenticated provider event before filtering business types.
        if ($event !== 'charge.completed') {
            $ignored = new PaymentEvent(
                provider: 'flutterwave',
                direction: 'payin',
                status: (string) ($event ?: 'ignored'),
                providerReference: (string) ($payload['flw_ref'] ?? ($payload['id'] ?? '')),
                takeerReference: (string) ($payload['tx_ref'] ?? ''),
                amount: isset($payload['amount']) ? (float) $payload['amount'] : null,
                currency: $payload['currency'] ?? null,
                rawPayload: $request->all(),
            );
            $providerEvent = $this->events->record($request, $ignored, true, true);
            $providerEvent->update(['validation_state' => 'processed', 'processing_result' => 'ignored_event', 'processed_at' => now()]);
            return response()->json(['status' => 'ignored'], 200);
        }

        // 2. Locate our order
        $transactionRef = $payload['tx_ref'] ?? null;
        if (!$transactionRef) {
            Log::error('Flutterwave Callback: Missing tx_ref in payload.', $payload);
            $missingReference = new PaymentEvent(
                provider: 'flutterwave',
                direction: 'payin',
                status: 'rejected',
                providerReference: (string) ($payload['flw_ref'] ?? ($payload['id'] ?? '')),
                amount: isset($payload['amount']) ? (float) $payload['amount'] : null,
                currency: $payload['currency'] ?? null,
                rawPayload: $request->all(),
                failureReason: 'Missing Takeer transaction reference.',
            );
            $providerEvent = $this->events->record($request, $missingReference, true, true);
            $providerEvent->update(['validation_state' => 'review', 'processing_result' => 'missing_takeer_reference']);
            return response()->json(['message' => 'Missing tx_ref'], 200);
        }

        $order = Order::where('transaction_ref', $transactionRef)->first();
        if (!$order) {
            Log::error("Flutterwave Callback: Order not found for ref [{$transactionRef}].");
            $unknownOrder = new PaymentEvent(
                provider: 'flutterwave',
                direction: 'payin',
                status: 'rejected',
                providerReference: (string) ($payload['flw_ref'] ?? ($payload['id'] ?? '')),
                takeerReference: (string) $transactionRef,
                amount: isset($payload['amount']) ? (float) $payload['amount'] : null,
                currency: $payload['currency'] ?? null,
                rawPayload: $request->all(),
                failureReason: 'Takeer payment attempt not found.',
            );
            $providerEvent = $this->events->record($request, $unknownOrder, true, true);
            $providerEvent->update(['validation_state' => 'review', 'processing_result' => 'attempt_not_found']);
            return response()->json(['message' => 'Order not found'], 200);
        }

        // 3. Process result
        $status     = strtolower($payload['status'] ?? '');
        $gatewayRef = (string) ($payload['flw_ref'] ?? ($payload['id'] ?? 'N/A'));

        $paymentEvent = new PaymentEvent(
            provider: 'flutterwave',
            direction: 'payin',
            status: $status,
            providerReference: $gatewayRef,
            takeerReference: (string) $transactionRef,
            amount: isset($payload['amount']) ? (float) $payload['amount'] : null,
            currency: $payload['currency'] ?? null,
            rawPayload: $request->all(),
            failureReason: $payload['processor_response'] ?? null,
        );
        $providerEvent = $this->events->record($request, $paymentEvent, true, true);
        $this->processor->processVerifiedEvent($paymentEvent, $providerEvent);

        return response()->json(['status' => 'success'], 200);
    }
}
