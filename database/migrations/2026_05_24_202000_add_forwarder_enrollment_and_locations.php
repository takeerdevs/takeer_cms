<?php

use App\Support\GeographyResolver;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarders', 'legal_name')) {
                $table->string('legal_name')->nullable()->after('name');
            }
            if (!Schema::hasColumn('forwarders', 'contact_person')) {
                $table->string('contact_person')->nullable()->after('contact_phone');
            }
            if (!Schema::hasColumn('forwarders', 'contact_email')) {
                $table->string('contact_email')->nullable()->after('contact_person');
            }
            if (!Schema::hasColumn('forwarders', 'whatsapp_phone')) {
                $table->string('whatsapp_phone')->nullable()->after('contact_email');
            }
            if (!Schema::hasColumn('forwarders', 'verification_status')) {
                $table->string('verification_status')->default('pending')->after('is_verified');
            }
            if (!Schema::hasColumn('forwarders', 'service_types')) {
                $table->json('service_types')->nullable()->after('required_fields');
            }
            if (!Schema::hasColumn('forwarders', 'origin_country_ids')) {
                $table->json('origin_country_ids')->nullable()->after('service_types');
            }
            if (!Schema::hasColumn('forwarders', 'destination_country_ids')) {
                $table->json('destination_country_ids')->nullable()->after('origin_country_ids');
            }
            if (!Schema::hasColumn('forwarders', 'documents')) {
                $table->json('documents')->nullable()->after('destination_country_ids');
            }
            if (!Schema::hasColumn('forwarders', 'admin_notes')) {
                $table->text('admin_notes')->nullable()->after('documents');
            }
            if (!Schema::hasColumn('forwarders', 'submitted_by_user_id')) {
                $table->foreignId('submitted_by_user_id')->nullable()->after('admin_notes')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('forwarders', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('submitted_by_user_id');
            }
        });

        DB::table('forwarders')
            ->where('is_verified', true)
            ->where('verification_status', 'pending')
            ->update([
                'verification_status' => 'verified',
                'verified_at' => now(),
            ]);

        Schema::create('forwarder_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forwarder_id')->constrained('forwarders')->cascadeOnDelete();
            $table->json('roles')->nullable();
            $table->string('name');
            $table->string('address_line');
            $table->text('address_template')->nullable();
            $table->foreignId('country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignId('state_id')->nullable()->constrained('country_states')->nullOnDelete();
            $table->foreignId('city_id')->nullable()->constrained('country_cities')->nullOnDelete();
            $table->decimal('latitude', 11, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('contact_person')->nullable();
            $table->text('business_hours')->nullable();
            $table->text('merchant_instructions')->nullable();
            $table->text('customer_instructions')->nullable();
            $table->json('required_fields')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['forwarder_id', 'is_verified', 'is_active']);
            $table->index(['country_id', 'state_id', 'city_id']);
        });

        $this->seedLegacyForwarderLocations();
    }

    public function down(): void
    {
        Schema::dropIfExists('forwarder_locations');

        Schema::table('forwarders', function (Blueprint $table) {
            foreach ([
                'verified_at',
                'submitted_by_user_id',
                'admin_notes',
                'documents',
                'destination_country_ids',
                'origin_country_ids',
                'service_types',
                'verification_status',
                'whatsapp_phone',
                'contact_email',
                'contact_person',
                'legal_name',
            ] as $column) {
                if (Schema::hasColumn('forwarders', $column)) {
                    if ($column === 'submitted_by_user_id') {
                        $table->dropConstrainedForeignId($column);
                    } else {
                        $table->dropColumn($column);
                    }
                }
            }
        });
    }

    private function seedLegacyForwarderLocations(): void
    {
        $resolver = app(GeographyResolver::class);

        DB::table('forwarders')
            ->select(['id', 'name', 'address_line', 'country_id', 'latitude', 'longitude', 'contact_phone', 'required_fields', 'is_verified'])
            ->orderBy('id')
            ->each(function ($forwarder) use ($resolver): void {
                if (DB::table('forwarder_locations')->where('forwarder_id', $forwarder->id)->exists()) {
                    return;
                }

                $geo = $resolver->resolve(countryId: $forwarder->country_id ? (int) $forwarder->country_id : null);

                DB::table('forwarder_locations')->insert([
                    'forwarder_id' => $forwarder->id,
                    'roles' => json_encode(['origin']),
                    'name' => $forwarder->name . ' Warehouse',
                    'address_line' => $forwarder->address_line,
                    'address_template' => $forwarder->address_line,
                    'country_id' => $geo['country_id'],
                    'state_id' => $geo['state_id'],
                    'city_id' => $geo['city_id'],
                    'latitude' => $forwarder->latitude,
                    'longitude' => $forwarder->longitude,
                    'contact_phone' => $forwarder->contact_phone,
                    'required_fields' => $forwarder->required_fields,
                    'is_verified' => (bool) $forwarder->is_verified,
                    'is_active' => true,
                    'verified_at' => $forwarder->is_verified ? now() : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }
};
