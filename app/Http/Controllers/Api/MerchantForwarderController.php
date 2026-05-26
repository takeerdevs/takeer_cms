<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\Currency;
use App\Models\Forwarder;
use App\Models\ForwarderLocation;
use App\Models\ForwarderRoute;
use App\Models\ForwarderShipment;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\UserAddress;
use App\Support\GeographyResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MerchantForwarderController extends Controller
{
    public function __construct(private GeographyResolver $geography)
    {
    }

    public function page(Request $request, Merchant $merchant, string $section): Response
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);

        abort_unless(in_array($section, ['locations', 'routes', 'schedules', 'shipments'], true), 404);

        return Inertia::render('Merchant/Forwarders/FreightManager', [
            'merchantUsername' => $merchant->username,
            'section' => $section,
            'countries' => Country::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'iso_alpha2']),
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderByRaw("CASE WHEN code = 'USD' THEN 0 ELSE 1 END")
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'symbol']),
            'forwarder' => $this->payload($forwarder),
        ]);
    }

    public function updateProfile(Request $request, Merchant $merchant): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'business_registration_number' => 'nullable|string|max:120',
            'contact_person' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:80',
            'contact_email' => 'nullable|email|max:255',
            'whatsapp_phone' => 'nullable|string|max:80',
            'website' => 'nullable|url|max:255',
            'description' => 'nullable|string|max:5000',
            'required_fields' => 'nullable|array',
            'required_fields.*' => 'string|max:80',
        ]);

        $forwarder->update($validated);

        return response()->json([
            'message' => 'Forwarder profile updated.',
            'forwarder' => $this->payload($forwarder->fresh()),
        ]);
    }

    public function storeLocation(Request $request, Merchant $merchant): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        $payload = $this->locationPayload($this->validateLocation($request));
        $this->assertApprovedCountry($forwarder, (int) ($payload['country_id'] ?? 0), 'location');
        $location = $forwarder->locations()->create($payload);

        return response()->json([
            'message' => 'Location saved.',
            'location' => $location->load(['country', 'state', 'cityRecord']),
        ], 201);
    }

    public function updateLocation(Request $request, Merchant $merchant, ForwarderLocation $location): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        abort_unless((int) $location->forwarder_id === (int) $forwarder->id, 404);

        $payload = $this->locationPayload($this->validateLocation($request, true), $location);
        $this->assertApprovedCountry($forwarder, (int) ($payload['country_id'] ?? 0), 'location');
        $location->update($payload);

        return response()->json([
            'message' => 'Location updated.',
            'location' => $location->fresh(['country', 'state', 'cityRecord']),
        ]);
    }

    public function destroyLocation(Request $request, Merchant $merchant, ForwarderLocation $location): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        abort_unless((int) $location->forwarder_id === (int) $forwarder->id, 404);

        $location->delete();

        return response()->json(['message' => 'Location deleted.']);
    }

    public function updateDestinations(Request $request, Merchant $merchant): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        $validated = $request->validate([
            'destinations_config' => 'nullable|array',
        ]);

        $routes = $this->sanitizeRoutes($forwarder, array_values($validated['destinations_config'] ?? []));
        $routes = $this->publishRoutePosts(
            $forwarder,
            $routes,
            $request->user()?->id,
        );

        $this->syncRoutes($forwarder, $routes);
        $forwarder->update(['destinations_config' => $routes]);

        return response()->json([
            'message' => 'Routes updated.',
            'forwarder' => $this->payload($forwarder->fresh()),
        ]);
    }

    public function updateSchedules(Request $request, Merchant $merchant): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        $validated = $request->validate([
            'shipping_schedules' => 'nullable|array',
        ]);

        $forwarder->update([
            'shipping_schedules' => array_values($validated['shipping_schedules'] ?? []),
        ]);

        return response()->json([
            'message' => 'Schedules updated.',
            'forwarder' => $this->payload($forwarder->fresh()),
        ]);
    }

    public function routesContext(Request $request, Merchant $merchant): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        $forwarder->loadMissing([
            'routes.originLocations.country',
            'routes.originLocations.state',
            'routes.originLocations.cityRecord',
            'routes.destinationLocations.country',
            'routes.destinationLocations.state',
            'routes.destinationLocations.cityRecord',
            'routes.transportModes',
        ]);

        return response()->json([
            'forwarder_id' => $forwarder->id,
            'routes' => $this->routesToConfig($forwarder),
        ]);
    }

    public function updateUpdates(Request $request, Merchant $merchant): JsonResponse
    {
        $forwarder = $this->verifiedForwarder($request, $merchant);
        $validated = $request->validate([
            'logistics_updates' => 'nullable|array',
        ]);

        $forwarder->update([
            'logistics_updates' => array_values($validated['logistics_updates'] ?? []),
        ]);

        return response()->json([
            'message' => 'Updates saved.',
            'forwarder' => $this->payload($forwarder->fresh()),
        ]);
    }

    private function verifiedForwarder(Request $request, Merchant $merchant): Forwarder
    {
        abort_unless($request->user()?->merchantProfiles()->whereKey($merchant->id)->exists(), 403);

        $forwarder = Forwarder::query()
            ->where('merchant_id', $merchant->id)
            ->where('verification_status', 'verified')
            ->where('is_verified', true)
            ->with([
                'locations.country',
                'locations.state',
                'locations.cityRecord',
                'routes.originCountry',
                'routes.destinationCountry',
                'routes.originLocations.country',
                'routes.originLocations.state',
                'routes.originLocations.cityRecord',
                'routes.destinationLocations.country',
                'routes.destinationLocations.state',
                'routes.destinationLocations.cityRecord',
                'routes.transportModes',
            ])
            ->latest()
            ->first();

        abort_unless($forwarder, 403, 'Forwarder tools are available after admin approval.');

        return $forwarder;
    }

    private function payload(Forwarder $forwarder): array
    {
        $forwarder->loadMissing([
            'locations.country',
            'locations.state',
            'locations.cityRecord',
            'routes.originCountry',
            'routes.destinationCountry',
            'routes.originLocations.country',
            'routes.originLocations.state',
            'routes.originLocations.cityRecord',
            'routes.destinationLocations.country',
            'routes.destinationLocations.state',
            'routes.destinationLocations.cityRecord',
            'routes.transportModes',
        ]);

        return [
            ...$forwarder->toArray(),
            'locations' => $forwarder->locations->values()->all(),
            'destinations_config' => $this->routesToConfig($forwarder),
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

        return [
            ...collect($validated)->except(['country_iso2', 'country_name', 'state_name', 'city_name'])->all(),
            'country_id' => $geo['country_id'],
            'state_id' => $geo['state_id'],
            'city_id' => $geo['city_id'],
            'is_verified' => false,
        ];
    }

    private function syncRoutes(Forwarder $forwarder, array $routes): void
    {
        DB::transaction(function () use ($forwarder, $routes): void {
            $routeUids = collect($routes)->pluck('id')->map(fn ($id) => (string) $id)->all();

            $forwarder->routes()
                ->whereNotIn('route_uid', $routeUids)
                ->get()
                ->each(function (ForwarderRoute $route): void {
                    if ($this->routeHasCustomerUsage($route)) {
                        $route->update(['is_active' => false]);
                    } else {
                        $route->delete();
                    }
                });

            foreach ($routes as $route) {
                /** @var ForwarderRoute $model */
                $model = $forwarder->routes()->updateOrCreate(
                    ['route_uid' => (string) $route['id']],
                    [
                        'origin_country_id' => $route['origin_country_id'] ?? null,
                        'destination_country_id' => $route['destination_country_id'] ?? null,
                        'estimate' => $route['estimate'] ?? null,
                        'rates_info' => $route['rates_info'] ?? null,
                        'customer_instructions' => $route['customer_instructions'] ?? null,
                        'post_to_feed' => (bool) ($route['post_to_feed'] ?? false),
                        'feed_post_id' => $route['feed_post_id'] ?? null,
                        'posted_at' => $route['posted_at'] ?? null,
                        'is_active' => (bool) ($route['is_active'] ?? true),
                        'metadata' => ['source' => 'merchant_forwarder_routes'],
                    ],
                );

                $model->routeLocations()->delete();
                foreach (($route['origin_location_ids'] ?? []) as $locationId) {
                    $model->routeLocations()->create([
                        'forwarder_location_id' => (int) $locationId,
                        'role' => 'origin',
                    ]);
                }
                foreach (($route['destination_location_ids'] ?? []) as $locationId) {
                    $model->routeLocations()->create([
                        'forwarder_location_id' => (int) $locationId,
                        'role' => 'destination',
                    ]);
                }

                $model->transportModes()->delete();
                foreach (($route['transport_modes'] ?? []) as $mode) {
                    $detail = $route['transport_details'][$mode] ?? [];
                    $model->transportModes()->create([
                        'mode' => (string) $mode,
                        'estimate' => $detail['estimate'] ?? null,
                        'pricing_model' => $detail['pricing_model'] ?? 'per_kg',
                        'price_amount' => $detail['price_amount'] ?? null,
                        'currency' => $detail['currency'] ?? 'USD',
                        'minimum_charge' => $detail['minimum_charge'] ?? null,
                        'payment_term' => $detail['payment_term'] ?? 'pay_on_pickup',
                        'deposit_type' => $detail['deposit_type'] ?? null,
                        'deposit_value' => $detail['deposit_value'] ?? null,
                        'balance_due' => $detail['balance_due'] ?? null,
                        'payment_notes' => $detail['payment_notes'] ?? null,
                        'notes' => $detail['notes'] ?? null,
                        'allowed_items' => $detail['allowed_items'] ?? null,
                        'disallowed_items' => $detail['disallowed_items'] ?? null,
                        'details' => $detail['details'] ?? null,
                    ]);
                }
            }
        });
    }

    private function routesToConfig(Forwarder $forwarder): array
    {
        $forwarder->loadMissing([
            'routes.originLocations.country',
            'routes.originLocations.state',
            'routes.originLocations.cityRecord',
            'routes.destinationLocations.country',
            'routes.destinationLocations.state',
            'routes.destinationLocations.cityRecord',
            'routes.transportModes',
            'locations.country',
            'locations.state',
            'locations.cityRecord',
        ]);

        $locations = $forwarder->locations->keyBy('id');

        return $forwarder->routes
            ->sortBy('id')
            ->values()
            ->map(function (ForwarderRoute $route, int $index) use ($locations): array {
                $originLocationIds = $route->originLocations->pluck('id')->values()->all();
                $destinationLocationIds = $route->destinationLocations->pluck('id')->values()->all();
                $transportModes = $route->transportModes->pluck('mode')->values()->all();
                $transportDetails = $route->transportModes
                    ->mapWithKeys(fn ($mode) => [$mode->mode => [
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
                    ]])
                    ->all();

                return [
                    'id' => $route->route_uid,
                    'forwarder_route_id' => $route->id,
                    'label' => $this->routeLabel([
                        'origin_location_ids' => $originLocationIds,
                        'destination_location_ids' => $destinationLocationIds,
                    ], $locations, $index),
                    'origin_country_id' => $route->origin_country_id,
                    'destination_country_id' => $route->destination_country_id,
                    'origin_location_ids' => $originLocationIds,
                    'destination_location_ids' => $destinationLocationIds,
                    'transport_modes' => $transportModes,
                    'transport_details' => $transportDetails,
                    'estimate' => $route->estimate,
                    'rates_info' => $route->rates_info,
                    'customer_instructions' => $route->customer_instructions,
                    'post_to_feed' => $route->post_to_feed,
                    'feed_post_id' => $route->feed_post_id,
                    'posted_at' => $route->posted_at?->toISOString(),
                    'is_active' => $route->is_active,
                    'has_customer_usage' => $this->routeHasCustomerUsage($route),
                ];
            })
            ->all();
    }

    private function routeHasCustomerUsage(ForwarderRoute $route): bool
    {
        return UserAddress::query()->where('forwarder_route_id', $route->id)->exists()
            || ForwarderShipment::query()->where('forwarder_route_id', $route->id)->exists();
    }

    private function sanitizeRoutes(Forwarder $forwarder, array $routes): array
    {
        $forwarder->loadMissing(['locations']);
        $locations = $forwarder->locations->keyBy('id');
        $approvedCountryIds = $this->approvedCountryIds($forwarder);
        $approvedModes = collect($forwarder->service_types ?: [])
            ->map(fn ($mode) => (string) $mode)
            ->intersect($this->routeServiceTypes())
            ->values();

        if ($approvedCountryIds->isEmpty()) {
            throw ValidationException::withMessages([
                'destinations_config' => 'Add operating countries in Forwarder Profile and wait for admin approval before creating routes.',
            ]);
        }

        return collect($routes)->map(function (array $route, int $index) use ($locations, $approvedCountryIds, $approvedModes): array {
            $originCountryId = (int) ($route['origin_country_id'] ?? 0);
            $destinationCountryId = (int) ($route['destination_country_id'] ?? 0);

            if (!$approvedCountryIds->contains($originCountryId)) {
                throw ValidationException::withMessages([
                    "destinations_config.{$index}.origin_country_id" => 'This origin country is not approved for this forwarder profile.',
                ]);
            }

            if (!$approvedCountryIds->contains($destinationCountryId)) {
                throw ValidationException::withMessages([
                    "destinations_config.{$index}.destination_country_id" => 'This destination country is not approved for this forwarder profile.',
                ]);
            }

            $originLocationIds = $this->validatedRouteLocationIds(
                $route['origin_location_ids'] ?? [],
                $locations,
                'origin',
                $originCountryId,
                "destinations_config.{$index}.origin_location_ids",
            );

            $destinationLocationIds = $this->validatedRouteLocationIds(
                $route['destination_location_ids'] ?? [],
                $locations,
                'destination',
                $destinationCountryId,
                "destinations_config.{$index}.destination_location_ids",
            );

            $transportModes = collect($route['transport_modes'] ?? [])
                ->map(fn ($mode) => (string) $mode)
                ->unique()
                ->values();

            $unapprovedModes = $transportModes->diff($approvedModes);
            if ($unapprovedModes->isNotEmpty()) {
                throw ValidationException::withMessages([
                    "destinations_config.{$index}.transport_modes" => 'This route includes shipping services that have not been approved yet.',
                ]);
            }

            return [
                ...$route,
                'id' => (string) ($route['id'] ?? ('route-' . ($index + 1) . '-' . now()->timestamp)),
                'origin_country_id' => $originCountryId,
                'destination_country_id' => $destinationCountryId,
                'origin_location_ids' => $originLocationIds,
                'destination_location_ids' => $destinationLocationIds,
                'transport_modes' => $transportModes->values()->all(),
                'transport_details' => $this->sanitizeTransportDetails($route['transport_details'] ?? [], $transportModes),
            ];
        })->values()->all();
    }

    private function sanitizeTransportDetails(array $details, \Illuminate\Support\Collection $transportModes): array
    {
        return $transportModes
            ->mapWithKeys(function (string $mode) use ($details): array {
                $detail = is_array($details[$mode] ?? null) ? $details[$mode] : [];

                return [$mode => [
                    'estimate' => str($detail['estimate'] ?? '')->limit(120, '')->toString(),
                    'pricing_model' => in_array(($detail['pricing_model'] ?? 'per_kg'), $this->pricingModelsForMode($mode), true)
                        ? $detail['pricing_model']
                        : $this->defaultPricingModelForMode($mode),
                    'price_amount' => str($detail['price_amount'] ?? '')->limit(80, '')->toString(),
                    'currency' => $this->sanitizeCurrencyCode($detail['currency'] ?? 'USD'),
                    'minimum_charge' => str($detail['minimum_charge'] ?? '')->limit(120, '')->toString(),
                    'payment_term' => $this->sanitizePaymentTerm($detail['payment_term'] ?? 'pay_on_pickup'),
                    'deposit_type' => in_array(($detail['deposit_type'] ?? ''), ['fixed', 'percent'], true) ? $detail['deposit_type'] : null,
                    'deposit_value' => str($detail['deposit_value'] ?? '')->limit(80, '')->toString(),
                    'balance_due' => str($detail['balance_due'] ?? '')->limit(120, '')->toString(),
                    'payment_notes' => str($detail['payment_notes'] ?? '')->limit(1000, '')->toString(),
                    'notes' => str($detail['notes'] ?? '')->limit(1000, '')->toString(),
                    'allowed_items' => str($detail['allowed_items'] ?? '')->limit(2000, '')->toString(),
                    'disallowed_items' => str($detail['disallowed_items'] ?? '')->limit(2000, '')->toString(),
                    'details' => $this->sanitizeServiceSpecificDetails($mode, is_array($detail['details'] ?? null) ? $detail['details'] : []),
                ]];
            })
            ->all();
    }

    private function sanitizePaymentTerm(string $term): string
    {
        return in_array($term, [
            'pay_on_pickup',
            'pay_before_shipping',
            'deposit_balance',
            'quote_after_receiving',
            'included_or_seller_paid',
        ], true) ? $term : 'pay_on_pickup';
    }

    private function routeServiceTypes(): array
    {
        return [
            'sea_cargo',
            'air_cargo',
            // Re-enable later when supported in the production freight flow.
            // 'road_cargo',
            // 'bus_parcel',
            // 'customs_clearing',
            // 'warehousing',
            // 'last_mile_delivery',
            // 'import_forwarding',
        ];
    }

    private function pricingModelsForMode(string $mode): array
    {
        return match ($mode) {
            'customs_clearing' => ['quote', 'fixed', 'percent_declared_value', 'percent_duty_tax', 'fee_plus_government'],
            'warehousing' => ['quote', 'fixed', 'per_day', 'per_week', 'per_cbm_day', 'per_pallet'],
            'last_mile_delivery' => ['quote', 'fixed', 'per_km', 'per_zone', 'per_kg'],
            'import_forwarding' => ['quote', 'fixed', 'percent_declared_value', 'retainer'],
            default => ['per_kg', 'per_cbm', 'fixed', 'quote'],
        };
    }

    private function defaultPricingModelForMode(string $mode): string
    {
        return match ($mode) {
            'customs_clearing', 'import_forwarding' => 'quote',
            'warehousing' => 'per_day',
            'last_mile_delivery' => 'per_zone',
            default => 'per_kg',
        };
    }

    private function sanitizeServiceSpecificDetails(string $mode, array $details): array
    {
        $allowedKeys = match ($mode) {
            'customs_clearing' => [
                'government_charges_note',
                'documents_required',
                'hs_code_support',
                'permit_support',
                'tax_handling',
                'restricted_items_note',
            ],
            'warehousing' => [
                'free_storage_days',
                'storage_pricing_unit',
                'receiving_fee',
                'handling_fee',
                'storage_rules',
                'max_dimensions',
                'insurance_note',
            ],
            'last_mile_delivery' => [
                'coverage_area',
                'delivery_window',
                'max_weight',
                'proof_of_delivery',
                'cod_support',
                'return_handling',
            ],
            'import_forwarding' => [
                'service_scope',
                'origin_handling',
                'destination_handling',
                'customer_steps',
                'required_documents',
                'partner_notes',
            ],
            default => [
                'billing_weight_note',
                'consolidation_schedule',
                'cutoff_note',
                'cargo_handling_note',
                'insurance_note',
            ],
        };

        return collect($allowedKeys)
            ->mapWithKeys(fn (string $key) => [$key => str($details[$key] ?? '')->limit(2000, '')->toString()])
            ->all();
    }

    private function sanitizeCurrencyCode(mixed $currency): string
    {
        $code = str($currency ?: 'USD')->upper()->limit(12, '')->toString();

        if (Currency::query()->where('is_active', true)->where('code', $code)->exists()) {
            return $code;
        }

        return Currency::query()
            ->where('is_active', true)
            ->orderByRaw("CASE WHEN code = 'USD' THEN 0 ELSE 1 END")
            ->orderBy('code')
            ->value('code') ?: 'USD';
    }

    private function validatedRouteLocationIds(array $ids, \Illuminate\Support\Collection $locations, string $role, int $countryId, string $field): array
    {
        return collect($ids)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->map(function (int $id) use ($locations, $role, $countryId, $field): int {
                $location = $locations->get($id);
                $roles = $location?->roles ?: [];

                if (!$location || !in_array($role, $roles, true) || (int) $location->country_id !== $countryId) {
                    throw ValidationException::withMessages([
                        $field => 'One or more selected locations do not match the selected country or location role.',
                    ]);
                }

                return $id;
            })
            ->all();
    }

    private function assertApprovedCountry(Forwarder $forwarder, int $countryId, string $context): void
    {
        if ($countryId && $this->approvedCountryIds($forwarder)->contains($countryId)) {
            return;
        }

        throw ValidationException::withMessages([
            'country_id' => "This {$context} country is not approved yet. Add it in Forwarder Profile and wait for admin review first.",
        ]);
    }

    private function approvedCountryIds(Forwarder $forwarder): \Illuminate\Support\Collection
    {
        return collect($forwarder->operating_country_ids ?: [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();
    }

    private function publishRoutePosts(Forwarder $forwarder, array $routes, ?int $userId): array
    {
        $forwarder->loadMissing(['locations.country', 'locations.state', 'locations.cityRecord']);
        $locations = $forwarder->locations->keyBy('id');

        return collect($routes)->map(function (array $route) use ($forwarder, $userId, $locations): array {
            if (empty($route['post_to_feed']) && empty($route['feed_post_id'])) {
                return $route;
            }

            $originLocations = collect($route['origin_location_ids'] ?? [])
                ->map(fn ($id) => $locations->get((int) $id))
                ->filter()
                ->values()
                ->all();
            $destinationLocations = collect($route['destination_location_ids'] ?? [])
                ->map(fn ($id) => $locations->get((int) $id))
                ->filter()
                ->values()
                ->all();
            $originName = $this->routePlaceName(collect($originLocations)) ?: 'Origin';
            $destinationName = $this->routePlaceName(collect($destinationLocations)) ?: 'Destination';
            $title = "{$originName} to {$destinationName}";
            $snapshot = $this->routePostSnapshot($route, $title, $originLocations, $destinationLocations);
            $excerpt = $this->transportDetailsSummary($route['transport_details'] ?? []) ?: $title;

            $lines = array_filter([
                "Freight route: {$title}.",
                !empty($route['transport_modes']) ? 'Available shipping: ' . collect($route['transport_modes'])->map(fn ($mode) => str_replace('_', ' ', (string) $mode))->join(', ') . '.' : null,
                !empty($route['transport_details']) ? 'Pricing: ' . $this->transportDetailsSummary($route['transport_details']) . '.' : null,
                !empty($originLocations) ? 'Origin points: ' . collect($originLocations)->pluck('name')->join(', ') . '.' : null,
                !empty($destinationLocations) ? 'Collection offices: ' . collect($destinationLocations)->pluck('name')->join(', ') . '.' : null,
                !empty($route['customer_instructions']) ? $route['customer_instructions'] : null,
            ]);

            $postPayload = [
                'merchant_id' => $forwarder->merchant_id,
                'forwarder_id' => $forwarder->id,
                'forwarder_route_id' => (string) ($route['id'] ?? ''),
                'forwarder_route_label' => $title,
                'forwarder_route_snapshot' => $snapshot,
                'created_by_user_id' => $userId,
                'source' => 'forwarder_route',
                'title' => $title,
                'caption' => implode("\n", $lines),
                'excerpt' => $excerpt,
            ];

            if (!empty($route['feed_post_id'])) {
                Post::query()
                    ->where('id', $route['feed_post_id'])
                    ->where('merchant_id', $forwarder->merchant_id)
                    ->update(collect($postPayload)->except(['merchant_id', 'created_by_user_id'])->all());

                return [
                    ...$route,
                    'posted_at' => $route['posted_at'] ?? now()->toISOString(),
                ];
            }

            $post = Post::create($postPayload);

            return [
                ...$route,
                'feed_post_id' => $post->id,
                'posted_at' => now()->toISOString(),
            ];
        })->values()->all();
    }

    private function routePostSnapshot(array $route, string $label, array $originLocations, array $destinationLocations): array
    {
        return [
            'id' => (string) ($route['id'] ?? ''),
            'label' => $label,
            'origin_location_ids' => array_values($route['origin_location_ids'] ?? []),
            'destination_location_ids' => array_values($route['destination_location_ids'] ?? []),
            'origin_locations' => collect($originLocations)->map(fn ($location) => $this->routePostLocationPayload($location))->values()->all(),
            'destination_locations' => collect($destinationLocations)->map(fn ($location) => $this->routePostLocationPayload($location))->values()->all(),
            'transport_modes' => array_values($route['transport_modes'] ?? []),
            'transport_details' => $route['transport_details'] ?? [],
            'customer_instructions' => $route['customer_instructions'] ?? null,
        ];
    }

    private function routePostLocationPayload($location): array
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
            'city' => $location?->cityRecord?->name ?: $location?->city_name,
            'state' => $location?->state?->name ?: $location?->state_name,
            'country' => $location?->country?->name ?: $location?->country_name,
            'contact_phone' => $location?->contact_phone,
            'required_fields' => $location?->required_fields ?: [],
        ];
    }

    private function transportDetailsSummary(array $details): string
    {
        return collect($details)
            ->map(function (array $detail, string $mode): ?string {
                $parts = array_filter([
                    str_replace('_', ' ', $mode),
                    !empty($detail['price_amount']) ? trim(($detail['currency'] ?? '') . ' ' . $detail['price_amount'] . $this->pricingModelSuffix($detail['pricing_model'] ?? null)) : null,
                    $detail['estimate'] ?? null,
                ]);

                return !empty($parts) ? implode(' - ', $parts) : null;
            })
            ->filter()
            ->join('; ');
    }

    private function pricingModelSuffix(?string $model): string
    {
        return match ($model) {
            'per_kg' => '/kg',
            'per_cbm' => '/CBM',
            'per_day' => '/day',
            'per_week' => '/week',
            'per_cbm_day' => '/CBM/day',
            'per_pallet' => '/pallet',
            'per_km' => '/km',
            'per_zone' => '/zone',
            'percent_declared_value' => '% value',
            'percent_duty_tax' => '% duty/tax',
            'fee_plus_government' => ' + govt charges',
            'retainer' => ' retainer',
            'fixed' => ' fixed',
            default => '',
        };
    }

    private function routeLabel(array $route, \Illuminate\Support\Collection $locations, int $index = 0): string
    {
        $originLocations = collect($route['origin_location_ids'] ?? [])
            ->map(fn ($id) => $locations->get((int) $id))
            ->filter()
            ->values();
        $destinationLocations = collect($route['destination_location_ids'] ?? [])
            ->map(fn ($id) => $locations->get((int) $id))
            ->filter()
            ->values();
        $originName = $this->routePlaceName($originLocations) ?: 'Origin';
        $destinationName = $this->routePlaceName($destinationLocations) ?: 'Destination';
        $label = "{$originName} to {$destinationName}";

        return $label === 'Origin to Destination' ? 'Route ' . ($index + 1) : $label;
    }

    private function routePlaceName(\Illuminate\Support\Collection $locations): string
    {
        if ($locations->isEmpty()) {
            return '';
        }

        $countryNames = $locations->map(fn ($location) => $location->country?->name)->filter()->unique()->values();
        if ($countryNames->count() > 1) {
            return $countryNames->join(', ');
        }

        $stateNames = $locations->map(fn ($location) => $location->state?->name)->filter()->unique()->values();
        if ($stateNames->count() > 1) {
            return $stateNames->join(', ');
        }

        $cityNames = $locations->map(fn ($location) => $location->cityRecord?->name)->filter()->unique()->values();
        if ($cityNames->count() > 1) {
            return $cityNames->join(', ');
        }

        return $countryNames->first()
            ?: $stateNames->first()
            ?: $cityNames->first()
            ?: $locations->pluck('name')->filter()->unique()->join(', ');
    }
}
