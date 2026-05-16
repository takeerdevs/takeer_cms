<?php

use App\Models\Country;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_regimes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('country_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->string('name');
            $table->string('authority_name')->nullable();
            $table->json('required_fields')->nullable();
            $table->json('settings')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['country_id', 'code']);
        });

        Schema::create('fiscal_providers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fiscal_regime_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->string('name');
            $table->string('status')->default('active');
            $table->json('credential_schema')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->unique(['fiscal_regime_id', 'code']);
            $table->index(['code', 'status']);
        });

        Schema::create('merchant_fiscal_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('country_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fiscal_regime_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fiscal_provider_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('draft');
            $table->string('mode')->default('test');
            $table->string('tin')->nullable();
            $table->string('vrn')->nullable();
            $table->string('branch_code')->nullable();
            $table->string('device_serial')->nullable();
            $table->text('credentials')->nullable();
            $table->json('settings')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique(['merchant_id', 'fiscal_regime_id']);
            $table->index(['merchant_id', 'status']);
        });

        Schema::create('fiscal_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('country_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('fiscal_regime_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('fiscal_provider_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('merchant_fiscal_integration_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('retail_bookkeeping_entry_id')->nullable()->constrained('retail_bookkeeping_entries')->nullOnDelete();
            $table->string('source_type')->default('order');
            $table->string('status')->default('pending');
            $table->string('receipt_number')->nullable();
            $table->string('verification_code')->nullable();
            $table->text('verification_url')->nullable();
            $table->text('qr_code_data')->nullable();
            $table->string('z_report_reference')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('provider_response')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('last_attempted_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'retail_bookkeeping_entry_id', 'source_type'], 'fiscal_receipt_source_unique');
            $table->index(['merchant_id', 'status']);
        });

        $this->seedTanzaniaProviders();
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_receipts');
        Schema::dropIfExists('merchant_fiscal_integrations');
        Schema::dropIfExists('fiscal_providers');
        Schema::dropIfExists('fiscal_regimes');
    }

    private function seedTanzaniaProviders(): void
    {
        $countryId = Country::query()->where('iso_alpha2', 'TZ')->value('id');
        if (!$countryId) {
            return;
        }

        $regimeId = DB::table('fiscal_regimes')->insertGetId([
            'country_id' => $countryId,
            'code' => 'TRA_VFD',
            'name' => 'TRA Virtual Fiscal Device',
            'authority_name' => 'Tanzania Revenue Authority',
            'required_fields' => json_encode(['tin', 'provider_credentials']),
            'settings' => json_encode(['receipt_timing' => 'on_sale']),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([
            ['simplify_vfd', 'Simplify VFD'],
            ['total_vfd', 'TotalVFD'],
            ['vfdplus', 'VFDPlus'],
        ] as [$code, $name]) {
            DB::table('fiscal_providers')->insert([
                'fiscal_regime_id' => $regimeId,
                'code' => $code,
                'name' => $name,
                'status' => 'active',
                'credential_schema' => json_encode([
                    ['key' => 'api_key', 'label' => 'API Key', 'secret' => true],
                    ['key' => 'username', 'label' => 'Username', 'secret' => false],
                    ['key' => 'password', 'label' => 'Password', 'secret' => true],
                ]),
                'settings' => json_encode(['adapter' => 'pending_provider_docs']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
