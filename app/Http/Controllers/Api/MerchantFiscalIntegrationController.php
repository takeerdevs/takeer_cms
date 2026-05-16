<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FiscalReceipt;
use App\Models\FiscalProvider;
use App\Models\FiscalRegime;
use App\Models\MerchantFiscalIntegration;
use App\Services\FiscalReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MerchantFiscalIntegrationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $merchant->loadMissing('country');

        $regimes = FiscalRegime::query()
            ->where('country_id', $merchant->country_id)
            ->where('is_active', true)
            ->with(['providers' => fn($query) => $query->where('status', 'active')->orderBy('name')])
            ->get();

        $integrations = MerchantFiscalIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->with(['country:id,name,iso_alpha2', 'regime:id,code,name,authority_name', 'provider:id,code,name'])
            ->latest()
            ->get();

        return response()->json([
            'country' => $merchant->country ? [
                'id' => $merchant->country->id,
                'name' => $merchant->country->name,
                'iso_alpha2' => $merchant->country->iso_alpha2,
            ] : null,
            'regimes' => $regimes,
            'integrations' => $integrations,
            'receipts' => $this->recentReceipts($merchant->id),
            'receipt_summary' => $this->receiptSummary($merchant->id),
            'manual_fallback' => [
                'enabled' => $integrations->every(fn($integration) => !$integration->hasUsableCredentials()),
                'message' => 'No active fiscal provider credentials found. Keep using manual EFD/VFD receipt numbers on bookkeeping records.',
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'fiscal_regime_id' => 'required|exists:fiscal_regimes,id',
            'fiscal_provider_id' => 'required|exists:fiscal_providers,id',
            'status' => ['required', Rule::in(['draft', 'active', 'paused'])],
            'mode' => ['required', Rule::in(['test', 'live'])],
            'tin' => 'nullable|string|max:80',
            'vrn' => 'nullable|string|max:80',
            'branch_code' => 'nullable|string|max:80',
            'device_serial' => 'nullable|string|max:160',
            'provider_access_expires_at' => 'nullable|date',
            'credentials' => 'nullable|array',
            'settings' => 'nullable|array',
        ]);

        $credentials = $validated['credentials'] ?? [];
        $hasApiKey = trim((string) ($credentials['api_key'] ?? '')) !== '';
        $hasUserPass = trim((string) ($credentials['username'] ?? '')) !== ''
            && trim((string) ($credentials['password'] ?? '')) !== '';

        if ($validated['status'] === 'active' && (blank($validated['tin'] ?? null) || (!$hasApiKey && !$hasUserPass))) {
            return response()->json([
                'message' => 'Set merchant TIN and valid provider credentials before activating automated fiscal receipts.',
            ], 422);
        }

        $regime = FiscalRegime::query()
            ->where('id', $validated['fiscal_regime_id'])
            ->where('country_id', $merchant->country_id)
            ->firstOrFail();

        $provider = FiscalProvider::query()
            ->where('id', $validated['fiscal_provider_id'])
            ->where('fiscal_regime_id', $regime->id)
            ->firstOrFail();

        $integration = MerchantFiscalIntegration::updateOrCreate(
            [
                'merchant_id' => $merchant->id,
                'fiscal_regime_id' => $regime->id,
            ],
            [
                'country_id' => $regime->country_id,
                'fiscal_provider_id' => $provider->id,
                'status' => $validated['status'],
                'mode' => $validated['mode'],
                'tin' => $validated['tin'] ?? null,
                'vrn' => $validated['vrn'] ?? null,
                'branch_code' => $validated['branch_code'] ?? null,
                'device_serial' => $validated['device_serial'] ?? null,
                'provider_access_expires_at' => $validated['provider_access_expires_at'] ?? null,
                'credentials' => $validated['credentials'] ?? [],
                'settings' => $validated['settings'] ?? [],
                'last_error' => null,
            ]
        );

        return response()->json([
            'message' => 'Fiscal receipt integration saved.',
            'data' => $integration->fresh(['country:id,name,iso_alpha2', 'regime:id,code,name,authority_name', 'provider:id,code,name']),
        ]);
    }

    public function receipts(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $query = FiscalReceipt::query()
            ->where('merchant_id', $merchant->id)
            ->with(['provider:id,code,name', 'order:id,public_id,payment_status,source', 'bookkeepingEntry:id,category,amount'])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'receipts' => $query->paginate(30),
            'summary' => $this->receiptSummary($merchant->id),
        ]);
    }

    public function retry(Request $request, FiscalReceipt $receipt, FiscalReceiptService $service): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        abort_unless((int) $receipt->merchant_id === (int) $merchant->id, 403);

        $updated = $service->retry($receipt);

        return response()->json([
            'message' => 'Fiscal receipt retry attempted.',
            'data' => $updated->load(['provider:id,code,name', 'order:id,public_id,payment_status,source', 'bookkeepingEntry:id,category,amount']),
        ]);
    }

    private function recentReceipts(int $merchantId)
    {
        return FiscalReceipt::query()
            ->where('merchant_id', $merchantId)
            ->with(['provider:id,code,name', 'order:id,public_id,payment_status,source'])
            ->latest()
            ->limit(10)
            ->get();
    }

    private function receiptSummary(int $merchantId): array
    {
        $rows = FiscalReceipt::query()
            ->where('merchant_id', $merchantId)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return [
            'pending' => (int) ($rows['pending'] ?? 0),
            'queued' => (int) ($rows['queued'] ?? 0),
            'issued' => (int) ($rows['issued'] ?? 0),
            'failed' => (int) ($rows['failed'] ?? 0),
            'provider_pending' => (int) ($rows['provider_pending'] ?? 0),
            'manual_fallback' => (int) ($rows['manual_fallback'] ?? 0),
            'voided' => (int) ($rows['voided'] ?? 0),
        ];
    }
}
