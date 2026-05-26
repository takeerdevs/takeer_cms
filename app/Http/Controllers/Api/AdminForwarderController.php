<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Forwarder;
use App\Models\ForwarderLocation;
use App\Support\GeographyResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminForwarderController extends Controller
{
    public function __construct(private GeographyResolver $geography)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Forwarder::query()
            ->with(['country', 'merchant:id,display_name,username,type,kyc_status,is_verified', 'locations.country', 'locations.state', 'locations.cityRecord', 'submitter:id,name,email,phone_number'])
            ->withCount('userAddresses')
            ->latest();

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('verification_status', $status);
            }
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('legal_name', 'like', "%{$search}%")
                    ->orWhere('contact_phone', 'like', "%{$search}%")
                    ->orWhere('contact_email', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'forwarders' => $query->paginate(15),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateForwarder($request);
        $forwarder = Forwarder::create($this->forwarderPayload($validated));

        return response()->json([
            'message' => 'Forwarder created.',
            'forwarder' => $forwarder->load(['country', 'locations.country', 'locations.state', 'locations.cityRecord']),
        ], 201);
    }

    public function update(Request $request, Forwarder $forwarder): JsonResponse
    {
        $validated = $this->validateForwarder($request, partial: true);
        $forwarder->update($this->forwarderPayload($validated, $forwarder));

        return response()->json([
            'message' => 'Forwarder updated.',
            'forwarder' => $forwarder->fresh(['country', 'locations.country', 'locations.state', 'locations.cityRecord']),
        ]);
    }

    public function updateStatus(Request $request, Forwarder $forwarder): JsonResponse
    {
        $validated = $request->validate([
            'verification_status' => 'required|in:pending,verified,rejected,suspended',
            'admin_notes' => 'nullable|string|max:5000',
        ]);

        $isVerified = $validated['verification_status'] === 'verified';
        $forwarder->update([
            'verification_status' => $validated['verification_status'],
            'is_verified' => $isVerified,
            'verified_at' => $isVerified ? now() : null,
            'admin_notes' => array_key_exists('admin_notes', $validated) ? $validated['admin_notes'] : $forwarder->admin_notes,
        ]);

        return response()->json([
            'message' => 'Forwarder status updated.',
            'forwarder' => $forwarder->fresh(['country', 'locations.country', 'locations.state', 'locations.cityRecord']),
        ]);
    }

    public function destroy(Forwarder $forwarder): JsonResponse
    {
        $forwarder->delete();

        return response()->json(['message' => 'Forwarder deleted.']);
    }

    public function storeLocation(Request $request, Forwarder $forwarder): JsonResponse
    {
        $validated = $this->validateLocation($request);
        $location = $forwarder->locations()->create($this->locationPayload($validated));

        return response()->json([
            'message' => 'Forwarder location added.',
            'location' => $location->load(['country', 'state', 'cityRecord']),
        ], 201);
    }

    public function updateLocation(Request $request, ForwarderLocation $location): JsonResponse
    {
        $validated = $this->validateLocation($request, partial: true);
        $location->update($this->locationPayload($validated, $location));

        return response()->json([
            'message' => 'Forwarder location updated.',
            'location' => $location->fresh(['country', 'state', 'cityRecord']),
        ]);
    }

    public function destroyLocation(ForwarderLocation $location): JsonResponse
    {
        $location->delete();

        return response()->json(['message' => 'Forwarder location deleted.']);
    }

    private function validateForwarder(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => "{$required}|string|max:255",
            'legal_name' => 'nullable|string|max:255',
            'business_registration_number' => 'nullable|string|max:120',
            'description' => 'nullable|string|max:5000',
            'application_summary' => 'nullable|string|max:5000',
            'rates_info' => 'nullable|string|max:5000',
            'address_line' => "{$required}|string|max:1000",
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'country_id' => 'nullable|exists:countries,id',
            'country_iso2' => 'nullable|string|size:2',
            'country_name' => 'nullable|string|max:120',
            'contact_person' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:80',
            'contact_email' => 'nullable|email|max:255',
            'whatsapp_phone' => 'nullable|string|max:80',
            'website' => 'nullable|url|max:255',
            'logo_url' => 'nullable|string|max:1000',
            'verification_status' => 'nullable|in:pending,verified,rejected,suspended',
            'required_fields' => 'nullable|array',
            'required_fields.*' => 'string|max:80',
            'service_types' => 'nullable|array',
            'service_types.*' => 'string|max:80',
            'origin_country_ids' => 'nullable|array',
            'origin_country_ids.*' => 'integer|exists:countries,id',
            'destination_country_ids' => 'nullable|array',
            'destination_country_ids.*' => 'integer|exists:countries,id',
            'operating_country_ids' => 'nullable|array',
            'operating_country_ids.*' => 'integer|exists:countries,id',
            'documents' => 'nullable|array',
            'admin_notes' => 'nullable|string|max:5000',
        ]);
    }

    private function forwarderPayload(array $validated, ?Forwarder $forwarder = null): array
    {
        $geo = $this->geography->resolve(
            countryId: $validated['country_id'] ?? $forwarder?->country_id,
            countryIso2: $validated['country_iso2'] ?? null,
            countryName: $validated['country_name'] ?? null,
        );
        $status = $validated['verification_status'] ?? $forwarder?->verification_status ?? 'pending';

        return [
            ...collect($validated)->except(['country_iso2', 'country_name'])->all(),
            'country_id' => $geo['country_id'],
            'is_verified' => $status === 'verified',
            'verification_status' => $status,
            'verified_at' => $status === 'verified' ? ($forwarder?->verified_at ?? now()) : null,
        ];
    }

    private function validateLocation(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $coordinate = $partial ? 'sometimes|numeric' : 'required|numeric';

        $validated = $request->validate([
            'roles' => "{$required}|array|min:1",
            'roles.*' => 'in:origin,destination',
            'name' => "{$required}|string|max:255",
            'address_line' => "{$required}|string|max:1000",
            'address_template' => 'nullable|string|max:5000',
            'country_id' => 'nullable|exists:countries,id',
            'country_iso2' => 'nullable|string|size:2',
            'country_name' => 'nullable|string|max:120',
            'state_id' => 'nullable|exists:country_states,id',
            'state_name' => 'nullable|string|max:120',
            'city_id' => 'nullable|exists:country_cities,id',
            'city_name' => 'nullable|string|max:120',
            'latitude' => $coordinate,
            'longitude' => $coordinate,
            'contact_phone' => 'nullable|string|max:80',
            'contact_person' => 'nullable|string|max:255',
            'business_hours' => 'nullable|string|max:1000',
            'merchant_instructions' => 'nullable|string|max:5000',
            'customer_instructions' => 'nullable|string|max:5000',
            'required_fields' => 'nullable|array',
            'required_fields.*' => 'string|max:80',
            'is_verified' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        if (isset($validated['roles'])) {
            $validated['roles'] = array_values(array_unique($validated['roles']));
        }

        if (!$partial && empty($validated['country_id']) && empty($validated['country_iso2']) && empty($validated['country_name'])) {
            throw ValidationException::withMessages([
                'country_id' => 'Pick the exact location on the map so the country can be linked.',
            ]);
        }

        return $validated;
    }

    private function locationPayload(array $validated, ?ForwarderLocation $location = null): array
    {
        $geo = $this->geography->resolve(
            countryId: $validated['country_id'] ?? $location?->country_id,
            countryIso2: $validated['country_iso2'] ?? null,
            countryName: $validated['country_name'] ?? null,
            stateId: $validated['state_id'] ?? $location?->state_id,
            stateName: $validated['state_name'] ?? null,
            cityId: $validated['city_id'] ?? $location?->city_id,
            cityName: $validated['city_name'] ?? null,
        );

        $isVerified = (bool) ($validated['is_verified'] ?? $location?->is_verified ?? false);

        return [
            ...collect($validated)->except(['country_iso2', 'country_name', 'state_name', 'city_name'])->all(),
            'country_id' => $geo['country_id'],
            'state_id' => $geo['state_id'],
            'city_id' => $geo['city_id'],
            'is_verified' => $isVerified,
            'verified_at' => $isVerified ? ($location?->verified_at ?? now()) : null,
        ];
    }
}
