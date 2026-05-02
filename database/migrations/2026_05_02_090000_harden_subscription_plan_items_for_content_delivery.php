<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        DB::table('subscription_plan_items')
            ->where('item_type', 'product')
            ->delete();

        DB::table('subscription_plan_items')
            ->where('item_type', 'bundle')
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('bundle_items')
                    ->join('products', 'products.id', '=', 'bundle_items.item_id')
                    ->whereColumn('bundle_items.bundle_id', 'subscription_plan_items.item_id')
                    ->where('bundle_items.item_type', 'product')
                    ->where('products.type', 'physical');
            })
            ->delete();

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE subscription_plan_items DROP CONSTRAINT IF EXISTS subscription_plan_items_content_only_check");
            DB::statement("ALTER TABLE subscription_plan_items ADD CONSTRAINT subscription_plan_items_content_only_check CHECK (item_type IN ('content_item', 'bundle'))");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE subscription_plan_items DROP CONSTRAINT IF EXISTS subscription_plan_items_content_only_check");
        }
    }
};
