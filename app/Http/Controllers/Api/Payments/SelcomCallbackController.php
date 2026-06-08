<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\WithdrawalRequest;
use App\Payments\Drivers\Selcom\SelcomGateway;
use App\Payments\PaymentCallbackProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SelcomCallbackController extends Controller
{
    public function payin(Request $request, SelcomGateway $selcom, PaymentCallbackProcessor $processor): JsonResponse
    {
        $event = $selcom->parseCallback($request);
        Log::info('Selcom pay-in callback received.', ['event' => $event->rawPayload]);

        $takeerReference = (string) $event->takeerReference;
        $order = Order::query()
            ->where('transaction_ref', $takeerReference)
            ->orWhereRaw("replace(transaction_ref, '-', '') = ?", [$takeerReference])
            ->orWhere('gateway_ref', $event->providerReference)
            ->first();

        if (! $order) {
            Log::warning('Selcom pay-in callback order not found.', ['reference' => $event->takeerReference, 'provider_reference' => $event->providerReference]);
            return response()->json(['message' => 'Accepted']);
        }

        if ($event->isSuccessful()) {
            $processor->handleSuccess($order, (string) ($event->providerReference ?: $event->takeerReference), 'selcom');
        } elseif ($event->isFailed()) {
            $processor->handleFailure($order, $event->failureReason ?: 'Selcom payment failed.');
        }

        return response()->json(['message' => 'Accepted']);
    }

    public function payout(Request $request, SelcomGateway $selcom): JsonResponse
    {
        $event = $selcom->parseCallback($request);
        Log::info('Selcom payout callback received.', ['event' => $event->rawPayload]);

        $withdrawal = WithdrawalRequest::query()
            ->where('id', data_get($event->rawPayload, 'withdrawal_id'))
            ->orWhere('payout_snapshot->provider_takeer_reference', $event->takeerReference)
            ->orWhere('payout_snapshot->provider_reference', $event->providerReference)
            ->first();

        if (! $withdrawal) {
            Log::warning('Selcom payout callback withdrawal not found.', ['reference' => $event->takeerReference, 'provider_reference' => $event->providerReference]);
            return response()->json(['message' => 'Accepted']);
        }

        $snapshot = $withdrawal->payout_snapshot ?: [];
        $snapshot['provider_callback'] = $event->rawPayload;
        $snapshot['provider_status'] = $event->status;
        $snapshot['provider_reference'] = $event->providerReference ?: ($snapshot['provider_reference'] ?? null);

        if ($event->isSuccessful()) {
            $withdrawal->update(['status' => 'approved', 'payout_snapshot' => $snapshot]);
        } elseif ($event->isFailed()) {
            $withdrawal->update(['status' => 'failed', 'payout_snapshot' => $snapshot]);
        } else {
            $withdrawal->update(['payout_snapshot' => $snapshot]);
        }

        return response()->json(['message' => 'Accepted']);
    }
}
