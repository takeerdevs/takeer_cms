<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'fulfillment_mode')) {
                $table->string('fulfillment_mode', 40)->default('own_stock')->after('type');
            }
            if (! Schema::hasColumn('products', 'source_details')) {
                $table->json('source_details')->nullable()->after('fulfillment_mode');
            }
            if (! Schema::hasColumn('products', 'availability_lead_time_days')) {
                $table->unsignedSmallInteger('availability_lead_time_days')->nullable()->after('source_details');
            }
            if (! Schema::hasColumn('products', 'available_from')) {
                $table->date('available_from')->nullable()->after('availability_lead_time_days');
            }
            if (! Schema::hasColumn('products', 'group_sale_goal_quantity')) {
                $table->unsignedInteger('group_sale_goal_quantity')->nullable()->after('available_from');
            }
            if (! Schema::hasColumn('products', 'group_sale_deadline')) {
                $table->date('group_sale_deadline')->nullable()->after('group_sale_goal_quantity');
            }
        });

        Schema::table('product_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('product_categories', 'risk_level')) {
                $table->string('risk_level', 24)->default('standard')->after('image_url');
            }
            if (! Schema::hasColumn('product_categories', 'allowed_fulfillment_modes')) {
                $table->json('allowed_fulfillment_modes')->nullable()->after('risk_level');
            }
            if (! Schema::hasColumn('product_categories', 'requires_verified_business')) {
                $table->boolean('requires_verified_business')->default(false)->after('allowed_fulfillment_modes');
            }
            if (! Schema::hasColumn('product_categories', 'requires_manual_review')) {
                $table->boolean('requires_manual_review')->default(false)->after('requires_verified_business');
            }
            if (! Schema::hasColumn('product_categories', 'required_documents')) {
                $table->json('required_documents')->nullable()->after('requires_manual_review');
            }
            if (! Schema::hasColumn('product_categories', 'payout_hold_days')) {
                $table->unsignedSmallInteger('payout_hold_days')->default(3)->after('required_documents');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $columns = [
                'fulfillment_mode',
                'source_details',
                'availability_lead_time_days',
                'available_from',
                'group_sale_goal_quantity',
                'group_sale_deadline',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('product_categories', function (Blueprint $table) {
            $columns = [
                'risk_level',
                'allowed_fulfillment_modes',
                'requires_verified_business',
                'requires_manual_review',
                'required_documents',
                'payout_hold_days',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('product_categories', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
