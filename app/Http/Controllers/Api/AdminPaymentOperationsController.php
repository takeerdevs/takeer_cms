<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentChannelIncident;
use App\Models\PaymentProvider;
use App\Models\PaymentProviderChannel;
use App\Models\PaymentProviderCountry;
use App\Services\PaymentChannelIncidentService;
use App\Services\PaymentProviderCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPaymentOperationsController extends Controller
{
    public function index(): JsonResponse
    {
        app(PaymentProviderCatalogService::class)->ensureDefaults();

        return response()->json([
            'providers' => PaymentProvider::query()
                ->with(['countries', 'channels' => fn ($query) => $query->orderBy('country_code')->orderBy('direction')->orderBy('priority')])
                ->orderBy('name')
                ->get(),
            'incidents' => PaymentChannelIncident::query()
                ->with('channel.provider')
                ->latest()
                ->limit(50)
                ->get(),
        ]);
    }

    public function updateChannel(Request $request, PaymentProviderChannel $channel): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|in:enabled,degraded,disabled',
            'priority' => 'nullable|integer|min:1|max:1000',
            'fee_type' => 'nullable|in:none,fixed,percent,fixed_plus_percent',
            'fee_fixed' => 'nullable|numeric|min:0',
            'fee_percent_bps' => 'nullable|integer|min:0|max:10000',
            'fee_min' => 'nullable|numeric|min:0',
            'fee_max' => 'nullable|numeric|min:0',
            'fx_margin_bps' => 'nullable|integer|min:0|max:5000',
            'limits' => 'nullable|array',
            'limits.min_withdrawal_amount' => 'nullable|numeric|min:0',
            'limits.max_withdrawal_amount' => 'nullable|numeric|min:0',
            'settlement_note' => 'nullable|string|max:255',
        ]);

        if (($channel->direction ?? null) !== 'payout') {
            unset($validated['limits']);
        } elseif (array_key_exists('limits', $validated)) {
            $limits = is_array($validated['limits']) ? $validated['limits'] : [];
            $validated['limits'] = [
                'min_withdrawal_amount' => array_key_exists('min_withdrawal_amount', $limits) && $limits['min_withdrawal_amount'] !== null && $limits['min_withdrawal_amount'] !== ''
                    ? max(0, (float) $limits['min_withdrawal_amount'])
                    : null,
                'max_withdrawal_amount' => array_key_exists('max_withdrawal_amount', $limits) && $limits['max_withdrawal_amount'] !== null && $limits['max_withdrawal_amount'] !== ''
                    ? max(0, (float) $limits['max_withdrawal_amount'])
                    : null,
            ];
        }

        $channel->fill($validated)->save();

        return response()->json(['message' => 'Channel updated.', 'channel' => $channel->fresh('provider')]);
    }

    public function updateProvider(Request $request, PaymentProvider $provider): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|in:enabled,degraded,disabled',
            'name' => 'nullable|string|max:120',
            'driver' => 'nullable|string|max:80',
            'logo_url' => 'nullable|string|max:500',
            'metadata' => 'nullable|array',
        ]);

        $provider->fill($validated)->save();

        return response()->json(['message' => 'Provider updated.', 'provider' => $provider->fresh(['countries', 'channels'])]);
    }

    public function updateCountry(Request $request, PaymentProviderCountry $country): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => 'nullable|boolean',
            'supported_directions' => 'nullable|array',
            'supported_currencies' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

        $country->fill($validated)->save();

        return response()->json(['message' => 'Provider country updated.', 'country' => $country->fresh('provider')]);
    }

    public function storeIncident(Request $request, PaymentProviderChannel $channel): JsonResponse
    {
        $validated = $request->validate([
            'severity' => 'nullable|in:minor,major,critical',
            'status' => 'nullable|in:investigating,identified,monitoring,resolved',
            'title' => 'required|string|max:160',
            'message' => 'nullable|string|max:2000',
            'notify_affected_merchants' => 'nullable|boolean',
        ]);

        $incident = app(PaymentChannelIncidentService::class)->openIncident($channel, $validated);

        return response()->json(['message' => 'Incident opened.', 'incident' => $incident]);
    }

    public function resolveIncident(PaymentChannelIncident $incident): JsonResponse
    {
        $incident = app(PaymentChannelIncidentService::class)->resolveIncident($incident);

        return response()->json(['message' => 'Incident resolved.', 'incident' => $incident]);
    }
}
