<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProviderEvent;
use App\Models\ProviderPayout;
use App\Models\ProviderReconciliationBreak;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProviderPaymentOperationsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = min(100, max(10, (int) $request->query('limit', 50)));

        return response()->json([
            'payouts' => ProviderPayout::query()
                ->with(['merchant:id,display_name,username', 'provider:id,key,name'])
                ->whereIn('state', ['created', 'submitted', 'processing', 'failed'])
                ->latest()
                ->limit($limit)
                ->get(),
            'reconciliation_breaks' => ProviderReconciliationBreak::query()
                ->with(['order:id,public_id,merchant_id', 'payout:id,public_id'])
                ->whereIn('status', ['open', 'investigating'])
                ->latest()
                ->limit($limit)
                ->get(),
            'recent_provider_events' => ProviderEvent::query()
                ->with('provider:id,key,name')
                ->latest('received_at')
                ->limit($limit)
                ->get(['id', 'public_id', 'payment_provider_id', 'direction', 'event_type', 'provider_transaction_reference', 'takeer_reference', 'received_at', 'signature_valid', 'validation_state', 'processing_result']),
        ]);
    }
}
