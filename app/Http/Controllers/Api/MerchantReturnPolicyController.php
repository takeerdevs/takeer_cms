<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantReturnPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantReturnPolicyController extends Controller
{
    private function merchantFromRequest(Request $request): Merchant
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            abort(403, 'Merchant profile not found.');
        }

        return $merchant;
    }

    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureDefaultPolicy($merchant);

        return response()->json([
            'data' => MerchantReturnPolicy::query()
                ->where('merchant_id', $merchant->id)
                ->latest('is_default')
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $validated = $this->validatePayload($request);

        if (($validated['is_default'] ?? false) || ! $merchant->returnPolicies()->exists()) {
            MerchantReturnPolicy::where('merchant_id', $merchant->id)->update(['is_default' => false]);
            $validated['is_default'] = true;
        }

        $policy = MerchantReturnPolicy::create([
            ...$validated,
            'merchant_id' => $merchant->id,
        ]);

        return response()->json([
            'message' => 'Return policy created.',
            'data' => $policy,
        ]);
    }

    public function update(Request $request, MerchantReturnPolicy $returnPolicy): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        abort_unless((int) $returnPolicy->merchant_id === (int) $merchant->id, 403);

        $validated = $this->validatePayload($request);

        if ($validated['is_default'] ?? false) {
            MerchantReturnPolicy::where('merchant_id', $merchant->id)
                ->where('id', '!=', $returnPolicy->id)
                ->update(['is_default' => false]);
        }

        $returnPolicy->update($validated);

        return response()->json([
            'message' => 'Return policy updated.',
            'data' => $returnPolicy->fresh(),
        ]);
    }

    public function destroy(Request $request, MerchantReturnPolicy $returnPolicy): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        abort_unless((int) $returnPolicy->merchant_id === (int) $merchant->id, 403);

        if ($returnPolicy->products()->exists()) {
            return response()->json([
                'message' => 'Policy hii inatumika kwenye bidhaa. Chagua policy nyingine kwanza.',
            ], 422);
        }

        $wasDefault = $returnPolicy->is_default;
        $returnPolicy->delete();

        if ($wasDefault) {
            MerchantReturnPolicy::where('merchant_id', $merchant->id)->latest()->first()?->update(['is_default' => true]);
        }

        return response()->json(['message' => 'Return policy deleted.']);
    }

    public function setDefault(Request $request, MerchantReturnPolicy $returnPolicy): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        abort_unless((int) $returnPolicy->merchant_id === (int) $merchant->id, 403);

        MerchantReturnPolicy::where('merchant_id', $merchant->id)->update(['is_default' => false]);
        $returnPolicy->update(['is_default' => true, 'is_active' => true]);

        return response()->json(['message' => 'Default return policy updated.']);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:120',
            'policy' => 'required|string|in:standard,strict,final_sale',
            'window_days' => 'nullable|integer|min:0|max:30',
            'note' => 'nullable|string|max:1000',
            'is_default' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);
    }

    private function ensureDefaultPolicy(Merchant $merchant): void
    {
        if ($merchant->returnPolicies()->exists()) {
            return;
        }

        MerchantReturnPolicy::create([
            'merchant_id' => $merchant->id,
            'name' => 'Standard physical return',
            'policy' => 'standard',
            'window_days' => 3,
            'note' => 'Return or replacement is available within 3 days when the item is damaged, wrong, or not as described. Item should be unused and in original condition when possible.',
            'is_default' => true,
            'is_active' => true,
        ]);
    }
}
