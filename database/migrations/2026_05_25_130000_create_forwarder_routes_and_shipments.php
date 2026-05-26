<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('forwarder_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forwarder_id')->constrained('forwarders')->cascadeOnDelete();
            $table->string('route_uid', 120);
            $table->foreignId('origin_country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignId('destination_country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->text('estimate')->nullable();
            $table->text('rates_info')->nullable();
            $table->text('customer_instructions')->nullable();
            $table->boolean('post_to_feed')->default(false);
            $table->foreignId('feed_post_id')->nullable()->constrained('posts')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['forwarder_id', 'route_uid']);
            $table->index(['origin_country_id', 'destination_country_id']);
            $table->index(['forwarder_id', 'is_active']);
        });

        Schema::create('forwarder_route_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forwarder_route_id')->constrained('forwarder_routes')->cascadeOnDelete();
            $table->foreignId('forwarder_location_id')->constrained('forwarder_locations')->cascadeOnDelete();
            $table->string('role', 24);
            $table->timestamps();

            $table->unique(['forwarder_route_id', 'forwarder_location_id', 'role'], 'fr_route_location_role_unique');
            $table->index(['role', 'forwarder_location_id']);
        });

        Schema::create('forwarder_route_transport_modes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forwarder_route_id')->constrained('forwarder_routes')->cascadeOnDelete();
            $table->string('mode', 80);
            $table->text('estimate')->nullable();
            $table->string('pricing_model', 40)->default('per_kg');
            $table->string('price_amount', 80)->nullable();
            $table->string('currency', 12)->default('USD');
            $table->string('minimum_charge', 120)->nullable();
            $table->text('notes')->nullable();
            $table->text('allowed_items')->nullable();
            $table->text('disallowed_items')->nullable();
            $table->json('details')->nullable();
            $table->timestamps();

            $table->unique(['forwarder_route_id', 'mode']);
            $table->index('mode');
        });

        Schema::create('forwarder_shipments', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 32)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('forwarder_id')->constrained('forwarders')->cascadeOnDelete();
            $table->foreignId('forwarder_route_id')->nullable()->constrained('forwarder_routes')->nullOnDelete();
            $table->foreignId('origin_location_id')->nullable()->constrained('forwarder_locations')->nullOnDelete();
            $table->foreignId('destination_location_id')->nullable()->constrained('forwarder_locations')->nullOnDelete();
            $table->foreignId('user_address_id')->nullable()->constrained('user_addresses')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('source_type', 40)->default('external_purchase');
            $table->string('status', 60)->default('incoming');
            $table->string('seller_name')->nullable();
            $table->string('seller_platform')->nullable();
            $table->string('external_order_ref')->nullable();
            $table->string('tracking_number')->nullable();
            $table->text('package_description')->nullable();
            $table->unsignedInteger('package_count')->nullable();
            $table->string('weight_estimate', 80)->nullable();
            $table->json('required_field_values')->nullable();
            $table->json('attachments')->nullable();
            $table->json('address_snapshot')->nullable();
            $table->json('route_snapshot')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('last_status_at')->nullable();
            $table->timestamps();

            $table->index(['forwarder_id', 'status']);
            $table->index(['user_id', 'status']);
            $table->index(['forwarder_route_id', 'status']);
            $table->index(['source_type', 'status']);
        });

        Schema::create('forwarder_shipment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forwarder_shipment_id')->constrained('forwarder_shipments')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('forwarder_location_id')->nullable()->constrained('forwarder_locations')->nullOnDelete();
            $table->string('status', 60);
            $table->text('note')->nullable();
            $table->json('attachments')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['forwarder_shipment_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        $this->backfillRoutesFromJson();
    }

    public function down(): void
    {
        Schema::dropIfExists('forwarder_shipment_events');
        Schema::dropIfExists('forwarder_shipments');
        Schema::dropIfExists('forwarder_route_transport_modes');
        Schema::dropIfExists('forwarder_route_locations');
        Schema::dropIfExists('forwarder_routes');
    }

    private function backfillRoutesFromJson(): void
    {
        DB::table('forwarders')
            ->whereNotNull('destinations_config')
            ->orderBy('id')
            ->get(['id', 'destinations_config'])
            ->each(function ($forwarder): void {
                $routes = json_decode($forwarder->destinations_config, true);
                if (!is_array($routes)) {
                    return;
                }

                $seenRouteUids = [];

                foreach (array_values($routes) as $index => $route) {
                    if (!is_array($route)) {
                        continue;
                    }

                    $baseRouteUid = (string) ($route['id'] ?? ('legacy-' . ($index + 1)));
                    $routeUid = $baseRouteUid;
                    if (in_array($routeUid, $seenRouteUids, true)) {
                        $routeUid = $baseRouteUid . '-' . Str::lower(Str::random(6));
                    }
                    $seenRouteUids[] = $routeUid;
                    $routeId = DB::table('forwarder_routes')->insertGetId([
                        'forwarder_id' => $forwarder->id,
                        'route_uid' => $routeUid,
                        'origin_country_id' => $route['origin_country_id'] ?? null,
                        'destination_country_id' => $route['destination_country_id'] ?? null,
                        'estimate' => $route['estimate'] ?? null,
                        'rates_info' => $route['rates_info'] ?? null,
                        'customer_instructions' => $route['customer_instructions'] ?? null,
                        'post_to_feed' => (bool) ($route['post_to_feed'] ?? false),
                        'feed_post_id' => $route['feed_post_id'] ?? null,
                        'posted_at' => isset($route['posted_at']) ? \Illuminate\Support\Carbon::parse($route['posted_at']) : null,
                        'is_active' => (bool) ($route['is_active'] ?? true),
                        'metadata' => json_encode(['legacy_index' => $index]),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    foreach (($route['origin_location_ids'] ?? []) as $locationId) {
                        $this->insertRouteLocation($routeId, (int) $locationId, 'origin');
                    }

                    foreach (($route['destination_location_ids'] ?? []) as $locationId) {
                        $this->insertRouteLocation($routeId, (int) $locationId, 'destination');
                    }

                    $details = is_array($route['transport_details'] ?? null) ? $route['transport_details'] : [];
                    foreach (($route['transport_modes'] ?? []) as $mode) {
                        $detail = is_array($details[$mode] ?? null) ? $details[$mode] : [];
                        DB::table('forwarder_route_transport_modes')->insertOrIgnore([
                            'forwarder_route_id' => $routeId,
                            'mode' => (string) $mode,
                            'estimate' => $detail['estimate'] ?? null,
                            'pricing_model' => $detail['pricing_model'] ?? 'per_kg',
                            'price_amount' => $detail['price_amount'] ?? null,
                            'currency' => $detail['currency'] ?? 'USD',
                            'minimum_charge' => $detail['minimum_charge'] ?? null,
                            'notes' => $detail['notes'] ?? null,
                            'allowed_items' => $detail['allowed_items'] ?? null,
                            'disallowed_items' => $detail['disallowed_items'] ?? null,
                            'details' => isset($detail['details']) && is_array($detail['details']) ? json_encode($detail['details']) : null,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    private function insertRouteLocation(int $routeId, int $locationId, string $role): void
    {
        if ($locationId <= 0) {
            return;
        }

        DB::table('forwarder_route_locations')->insertOrIgnore([
            'forwarder_route_id' => $routeId,
            'forwarder_location_id' => $locationId,
            'role' => $role,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
