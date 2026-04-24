<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserAddress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserAddressController extends Controller
{
    public function index()
    {
        return response()->json([
            'addresses' => Auth::user()->addresses()->with('forwarder')->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'type' => 'required|in:local,forwarder',
            'address_line' => 'required|string',
            'extra_details' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'is_default' => 'boolean',
            'forwarder_id' => 'nullable|exists:forwarders,id',
            'forwarder_customer_id' => 'nullable|string|max:255',
        ]);

        if ($validated['is_default'] ?? false) {
            Auth::user()->addresses()->update(['is_default' => false]);
        }

        $address = Auth::user()->addresses()->create($validated);

        return response()->json([
            'message' => 'Anuani imehifadhiwa!',
            'address' => $address->load('forwarder')
        ]);
    }

    public function update(Request $request, UserAddress $address)
    {
        if ($address->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'type' => 'required|in:local,forwarder',
            'address_line' => 'required|string',
            'extra_details' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'is_default' => 'boolean',
            'forwarder_id' => 'nullable|exists:forwarders,id',
            'forwarder_customer_id' => 'nullable|string|max:255',
        ]);

        if ($validated['is_default'] ?? false) {
            Auth::user()->addresses()->where('id', '!=', $address->id)->update(['is_default' => false]);
        }

        $address->update($validated);

        return response()->json([
            'message' => 'Anuani imesasishwa!',
            'address' => $address->load('forwarder')
        ]);
    }

    public function destroy(UserAddress $address)
    {
        if ($address->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $address->delete();

        return response()->json(['message' => 'Anuani imefutwa!']);
    }

    public function setDefault(UserAddress $address)
    {
        if ($address->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Auth::user()->addresses()->update(['is_default' => false]);
        $address->update(['is_default' => true]);

        return response()->json(['message' => 'Anuani imewekwa kama chaguo msingi!']);
    }
}
