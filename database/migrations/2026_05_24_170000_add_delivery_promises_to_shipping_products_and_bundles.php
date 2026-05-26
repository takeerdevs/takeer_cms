<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->unsignedSmallInteger('handling_min_days')->nullable()->after('is_active');
            $table->unsignedSmallInteger('handling_max_days')->nullable()->after('handling_min_days');
            $table->unsignedSmallInteger('transit_min_days')->nullable()->after('handling_max_days');
            $table->unsignedSmallInteger('transit_max_days')->nullable()->after('transit_min_days');
            $table->time('cutoff_time')->nullable()->after('transit_max_days');
            $table->boolean('business_days_only')->default(true)->after('cutoff_time');
            $table->string('delivery_promise_label')->nullable()->after('business_days_only');
            $table->text('delivery_promise_note')->nullable()->after('delivery_promise_label');
            $table->boolean('requires_delivery_confirmation')->default(false)->after('delivery_promise_note');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->boolean('delivery_promise_override_enabled')->default(false)->after('shipping_profile_id');
            $table->unsignedSmallInteger('delivery_handling_min_days')->nullable()->after('delivery_promise_override_enabled');
            $table->unsignedSmallInteger('delivery_handling_max_days')->nullable()->after('delivery_handling_min_days');
            $table->unsignedSmallInteger('delivery_transit_min_days')->nullable()->after('delivery_handling_max_days');
            $table->unsignedSmallInteger('delivery_transit_max_days')->nullable()->after('delivery_transit_min_days');
            $table->time('delivery_cutoff_time')->nullable()->after('delivery_transit_max_days');
            $table->boolean('delivery_business_days_only')->default(true)->after('delivery_cutoff_time');
            $table->string('delivery_promise_label')->nullable()->after('delivery_business_days_only');
            $table->text('delivery_promise_note')->nullable()->after('delivery_promise_label');
            $table->boolean('delivery_requires_confirmation')->default(false)->after('delivery_promise_note');
        });

        Schema::table('bundles', function (Blueprint $table) {
            $table->foreignId('shipping_profile_id')->nullable()->after('merchant_id')->constrained('shipping_profiles')->nullOnDelete();
            $table->boolean('delivery_promise_override_enabled')->default(false)->after('shipping_profile_id');
            $table->unsignedSmallInteger('delivery_handling_min_days')->nullable()->after('delivery_promise_override_enabled');
            $table->unsignedSmallInteger('delivery_handling_max_days')->nullable()->after('delivery_handling_min_days');
            $table->unsignedSmallInteger('delivery_transit_min_days')->nullable()->after('delivery_handling_max_days');
            $table->unsignedSmallInteger('delivery_transit_max_days')->nullable()->after('delivery_transit_min_days');
            $table->time('delivery_cutoff_time')->nullable()->after('delivery_transit_max_days');
            $table->boolean('delivery_business_days_only')->default(true)->after('delivery_cutoff_time');
            $table->string('delivery_promise_label')->nullable()->after('delivery_business_days_only');
            $table->text('delivery_promise_note')->nullable()->after('delivery_promise_label');
            $table->boolean('delivery_requires_confirmation')->default(false)->after('delivery_promise_note');
        });
    }

    public function down(): void
    {
        Schema::table('bundles', function (Blueprint $table) {
            $table->dropForeign(['shipping_profile_id']);
            $table->dropColumn([
                'shipping_profile_id',
                'delivery_promise_override_enabled',
                'delivery_handling_min_days',
                'delivery_handling_max_days',
                'delivery_transit_min_days',
                'delivery_transit_max_days',
                'delivery_cutoff_time',
                'delivery_business_days_only',
                'delivery_promise_label',
                'delivery_promise_note',
                'delivery_requires_confirmation',
            ]);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_promise_override_enabled',
                'delivery_handling_min_days',
                'delivery_handling_max_days',
                'delivery_transit_min_days',
                'delivery_transit_max_days',
                'delivery_cutoff_time',
                'delivery_business_days_only',
                'delivery_promise_label',
                'delivery_promise_note',
                'delivery_requires_confirmation',
            ]);
        });

        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->dropColumn([
                'handling_min_days',
                'handling_max_days',
                'transit_min_days',
                'transit_max_days',
                'cutoff_time',
                'business_days_only',
                'delivery_promise_label',
                'delivery_promise_note',
                'requires_delivery_confirmation',
            ]);
        });
    }
};
