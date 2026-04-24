<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Payments\PaymentCallbackProcessor;
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
    ) {}

    public function handle(Request $request): JsonResponse
    {
        // 1. Verify Secret Hash for security
        $secretHash = config('services.flutterwave.secret_hash');
        $signature  = $request->header('verif-hash');

        if (!$signature || $signature !== $secretHash) {
            Log::warning('Flutterwave Callback: Invalid or missing secret hash.', [
                'header' => $signature,
                'ip'     => $request->ip(),
            ]);
            // Return 401 to fail early, but some providers prefer 200 to stop retries if hash is wrong
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $payload = $request->input('data');
        $event   = $request->input('event');

        Log::info('Flutterwave Callback: Received', [
            'event'   => $event,
            'tx_ref'  => $payload['tx_ref'] ?? 'N/A',
            'status'  => $payload['status'] ?? 'N/A',
        ]);

        // We only care about charge completion
        if ($event !== 'charge.completed') {
            return response()->json(['status' => 'ignored'], 200);
        }

        // 2. Locate our order
        $transactionRef = $payload['tx_ref'] ?? null;
        if (!$transactionRef) {
            Log::error('Flutterwave Callback: Missing tx_ref in payload.', $payload);
            return response()->json(['message' => 'Missing tx_ref'], 200);
        }

        $order = Order::where('transaction_ref', $transactionRef)->first();
        if (!$order) {
            Log::error("Flutterwave Callback: Order not found for ref [{$transactionRef}].");
            return response()->json(['message' => 'Order not found'], 200);
        }

        // 3. Process result
        $status     = strtolower($payload['status'] ?? '');
        $gatewayRef = (string) ($payload['flw_ref'] ?? ($payload['id'] ?? 'N/A'));

        if ($status === 'successful') {
            $this->processor->handleSuccess(
                order:      $order,
                gatewayRef: $gatewayRef,
                gateway:    'flutterwave',
            );
        } else {
            // "failed", "cancelled", etc.
            $this->processor->handleFailure(
                order:  $order,
                reason: "Flutterwave status: {$status}",
            );
        }

        return response()->json(['status' => 'success'], 200);
    }
}
