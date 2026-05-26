<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Forwarder;
use App\Models\ForwarderRoute;
use App\Models\Merchant;
use App\Support\GeographyResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ForwarderController extends Controller
{
    public function __construct(private GeographyResolver $geography)
    {
    }

    public function index()
    {
        return response()->json([
            'forwarders' => Forwarder::query()
                ->with([
                    'country',
                    'locations' => fn ($query) => $query
                        ->where('is_verified', true)
                        ->where('is_active', true)
                        ->with(['country', 'state', 'cityRecord'])
                        ->orderBy('name'),
                    'routes' => fn ($query) => $query
                        ->where('is_active', true)
                        ->with([
                            'originLocations.country',
                            'originLocations.state',
                            'originLocations.cityRecord',
                            'destinationLocations.country',
                            'destinationLocations.state',
                            'destinationLocations.cityRecord',
                            'transportModes',
                        ])
                        ->orderBy('id'),
                ])
                ->where('is_verified', true)
                ->where('verification_status', 'verified')
                ->orderBy('name')
                ->get()
        ]);
    }

    public function showRoute(string $routeRef)
    {
        $route = ForwarderRoute::query()
            ->where(fn ($query) => $query
                ->where('route_uid', $routeRef)
                ->orWhere('id', ctype_digit($routeRef) ? (int) $routeRef : 0))
            ->where('is_active', true)
            ->with([
                'forwarder.merchant',
                'originLocations.country',
                'originLocations.state',
                'originLocations.cityRecord',
                'destinationLocations.country',
                'destinationLocations.state',
                'destinationLocations.cityRecord',
                'transportModes',
            ])
            ->firstOrFail();

        abort_unless(
            $route->forwarder?->is_verified && $route->forwarder?->verification_status === 'verified',
            404
        );

        $forwarder = $route->forwarder;
        $routeUid = (string) $route->route_uid;
        $scheduleRows = collect($forwarder->shipping_schedules ?: [])
            ->filter(fn ($item) => (string) ($item['route_id'] ?? '') === $routeUid || (string) ($item['route_id'] ?? '') === (string) $route->id)
            ->values()
            ->all();
        $updateRows = collect($forwarder->logistics_updates ?: [])
            ->filter(fn ($item) => empty($item['route_id']) || (string) ($item['route_id'] ?? '') === $routeUid || (string) ($item['route_id'] ?? '') === (string) $route->id)
            ->values()
            ->all();

        return Inertia::render('Forwarders/RouteDetail', [
            'routeData' => [
                'id' => $routeUid,
                'forwarder_route_id' => $route->id,
                'label' => $this->routeLabel($route),
                'forwarder' => [
                    'id' => $forwarder->id,
                    'name' => $forwarder->name,
                    'description' => $forwarder->description,
                    'logo_url' => $forwarder->logo_url,
                    'contact_phone' => $forwarder->contact_phone,
                    'whatsapp_phone' => $forwarder->whatsapp_phone,
                    'website' => $forwarder->website,
                    'merchant' => $forwarder->merchant ? [
                        'id' => $forwarder->merchant->id,
                        'username' => $forwarder->merchant->username,
                        'display_name' => $forwarder->merchant->display_name,
                    ] : null,
                ],
                'origin_locations' => $route->originLocations->map(fn ($location) => $this->routeLocationPayload($location))->values()->all(),
                'destination_locations' => $route->destinationLocations->map(fn ($location) => $this->routeLocationPayload($location))->values()->all(),
                'transport_modes' => $route->transportModes->pluck('mode')->values()->all(),
                'transport_details' => $route->transportModes->mapWithKeys(fn ($mode) => [$mode->mode => [
                    'estimate' => $mode->estimate,
                    'pricing_model' => $mode->pricing_model,
                    'price_amount' => $mode->price_amount,
                    'currency' => $mode->currency,
                    'minimum_charge' => $mode->minimum_charge,
                    'payment_term' => $mode->payment_term,
                    'deposit_type' => $mode->deposit_type,
                    'deposit_value' => $mode->deposit_value,
                    'balance_due' => $mode->balance_due,
                    'payment_notes' => $mode->payment_notes,
                    'notes' => $mode->notes,
                    'allowed_items' => $mode->allowed_items,
                    'disallowed_items' => $mode->disallowed_items,
                    'details' => $mode->details ?: [],
                ]])->all(),
                'customer_instructions' => $route->customer_instructions,
                'schedules' => $scheduleRows,
                'updates' => $updateRows,
            ],
        ]);
    }

    public function enroll(Request $request)
    {
        abort_unless(
            $request->user()?->hasVerifiedPersonalProfile(),
            403,
            'Verify your personal profile first before applying as a freight or forwarding company.'
        );

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'business_registration_number' => 'nullable|string|max:120',
            'description' => 'nullable|string|max:2000',
            'application_summary' => 'nullable|string|max:5000',
            'contact_person' => 'required|string|max:255',
            'contact_phone' => 'required|string|max:80',
            'contact_email' => 'nullable|email|max:255',
            'whatsapp_phone' => 'nullable|string|max:80',
            'website' => 'nullable|url|max:255',
            'logo_url' => 'nullable|string|max:1000',
            'merchant_username' => 'nullable|string|exists:merchants,username',
            'service_types' => 'nullable|array',
            'service_types.*' => 'string|in:sea_cargo,air_cargo',
            'operating_country_ids' => 'nullable|array',
            'operating_country_ids.*' => 'integer|exists:countries,id',
            'document_files' => 'nullable|array|max:8',
            'document_files.*' => 'file|mimes:pdf,jpg,jpeg,png,webp,doc,docx|max:10240',
            'document_links' => 'nullable|array|max:12',
            'document_links.*' => 'nullable|url|max:2048',
            'required_fields' => 'nullable|array',
            'required_fields.*' => 'string|max:80',
            'locations' => 'nullable|array',
            'locations.*.roles' => 'required|array|min:1',
            'locations.*.roles.*' => 'in:origin,destination',
            'locations.*.name' => 'required|string|max:255',
            'locations.*.address_line' => 'required|string|max:1000',
            'locations.*.address_template' => 'nullable|string|max:5000',
            'locations.*.country_id' => 'nullable|exists:countries,id',
            'locations.*.country_iso2' => 'nullable|string|size:2',
            'locations.*.country_name' => 'nullable|string|max:120',
            'locations.*.state_name' => 'nullable|string|max:120',
            'locations.*.city_name' => 'nullable|string|max:120',
            'locations.*.latitude' => 'nullable|numeric',
            'locations.*.longitude' => 'nullable|numeric',
            'locations.*.contact_phone' => 'nullable|string|max:80',
            'locations.*.contact_person' => 'nullable|string|max:255',
            'locations.*.business_hours' => 'nullable|string|max:1000',
            'locations.*.merchant_instructions' => 'nullable|string|max:2000',
            'locations.*.customer_instructions' => 'nullable|string|max:2000',
        ]);

        $merchant = null;

        if (!empty($validated['merchant_username'])) {
            $merchant = Merchant::query()->where('username', $validated['merchant_username'])->first();
            abort_unless($merchant && $request->user()?->merchantProfiles()->whereKey($merchant->id)->exists(), 403);
        }

        $existing = $merchant
            ? Forwarder::query()->where('merchant_id', $merchant->id)->latest()->first()
            : null;

        $previousDocuments = $existing?->documents ?: ['files' => [], 'links' => []];
        $documents = [
            'files' => $previousDocuments['files'] ?? [],
            'links' => array_values(array_unique(array_merge(
                $previousDocuments['links'] ?? [],
                array_values(array_filter($validated['document_links'] ?? [])),
            ))),
        ];

        foreach ($request->file('document_files', []) as $file) {
            $path = $file->store('forwarder-documents/' . ($merchant?->id ?: 'public'), 'public');
            $documents['files'][] = [
                'name' => $file->getClientOriginalName(),
                'url' => Storage::disk('public')->url($path),
                'path' => $path,
                'mime' => $file->getClientMimeType(),
                'size' => $file->getSize(),
            ];
        }

        if (count($documents['files']) === 0 && count($documents['links']) === 0) {
            throw ValidationException::withMessages([
                'document_files' => 'Please upload at least one license, certificate, registration proof, or document link.',
            ]);
        }

        $payload = [
            'merchant_id' => $merchant?->id,
            'name' => $validated['name'],
            'legal_name' => $validated['legal_name'] ?? null,
            'business_registration_number' => $validated['business_registration_number'] ?? null,
            'address_line' => $merchant?->display_name ?: ($validated['legal_name'] ?? $validated['name']),
            'contact_phone' => $validated['contact_phone'],
            'contact_person' => $validated['contact_person'],
            'contact_email' => $validated['contact_email'] ?? null,
            'whatsapp_phone' => $validated['whatsapp_phone'] ?? null,
            'website' => $validated['website'] ?? null,
            'logo_url' => $validated['logo_url'] ?? null,
            'is_verified' => false,
            'verification_status' => 'pending',
            'required_fields' => $validated['required_fields'] ?? ['customer_id'],
            'service_types' => $this->enabledServiceTypes($validated['service_types'] ?? []),
            'operating_country_ids' => array_values(array_unique(array_map('intval', $validated['operating_country_ids'] ?? []))),
            'description' => $validated['description'] ?? null,
            'application_summary' => $validated['application_summary'] ?? null,
            'documents' => $documents,
            'submitted_by_user_id' => $request->user()?->id,
            'application_submitted_at' => now(),
        ];

        $forwarder = $existing
            ? tap($existing)->update($payload)
            : Forwarder::create($payload);

        foreach (($validated['locations'] ?? []) as $location) {
            $geo = $this->resolveGeo($location);
            $forwarder->locations()->create([
                'roles' => array_values(array_unique($location['roles'])),
                'name' => $location['name'],
                'address_line' => $location['address_line'],
                'country_id' => $geo['country_id'],
                'state_id' => $geo['state_id'],
                'city_id' => $geo['city_id'],
                'address_template' => $location['address_template'] ?? $location['address_line'],
                'latitude' => $location['latitude'] ?? null,
                'longitude' => $location['longitude'] ?? null,
                'contact_phone' => $location['contact_phone'] ?? null,
                'contact_person' => $location['contact_person'] ?? null,
                'business_hours' => $location['business_hours'] ?? null,
                'merchant_instructions' => $location['merchant_instructions'] ?? null,
                'customer_instructions' => $location['customer_instructions'] ?? null,
                'required_fields' => $validated['required_fields'] ?? ['customer_id'],
                'is_verified' => false,
                'is_active' => true,
            ]);
        }

        return response()->json([
            'message' => 'Forwarder application received. Our team will verify it before customers can use it.',
            'forwarder' => $forwarder->load(['locations.country', 'locations.state', 'locations.cityRecord']),
        ], 201);
    }

    private function enabledServiceTypes(array $serviceTypes): array
    {
        return collect($serviceTypes)
            ->filter(fn ($type) => in_array($type, ['sea_cargo', 'air_cargo'], true))
            ->values()
            ->all();
    }

    private function resolveGeo(array $payload): array
    {
        return $this->geography->resolve(
            countryId: isset($payload['country_id']) ? (int) $payload['country_id'] : null,
            countryIso2: $payload['country_iso2'] ?? null,
            countryName: $payload['country_name'] ?? null,
            stateName: $payload['state_name'] ?? null,
            cityName: $payload['city_name'] ?? null,
        );
    }

    private function routeLabel(ForwarderRoute $route): string
    {
        return ($this->routePlaceName($route->originLocations) ?: 'Origin') . ' to ' . ($this->routePlaceName($route->destinationLocations) ?: 'Destination');
    }

    private function routePlaceName($locations): string
    {
        $countryNames = $locations->map(fn ($location) => $location->country?->name)->filter()->unique()->values();
        if ($countryNames->count() === 1) {
            return $countryNames->first();
        }
        if ($countryNames->count() > 1) {
            return $countryNames->join(', ');
        }

        $stateNames = $locations->map(fn ($location) => $location->state?->name)->filter()->unique()->values();
        if ($stateNames->count() > 0) {
            return $stateNames->join(', ');
        }

        return $locations->map(fn ($location) => $location->name)->filter()->unique()->join(', ');
    }

    private function routeLocationPayload($location): array
    {
        return [
            'id' => $location?->id,
            'name' => $location?->name,
            'address_line' => $location?->address_line,
            'address_template' => $location?->address_template,
            'latitude' => $location?->latitude,
            'longitude' => $location?->longitude,
            'country_id' => $location?->country_id,
            'state_id' => $location?->state_id,
            'city_id' => $location?->city_id,
            'city' => $location?->cityRecord?->name,
            'state' => $location?->state?->name,
            'country' => $location?->country?->name,
            'contact_phone' => $location?->contact_phone,
            'business_hours' => $location?->business_hours,
            'customer_instructions' => $location?->customer_instructions,
            'required_fields' => $location?->required_fields ?: [],
        ];
    }
}
