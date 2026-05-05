<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE subscription_plan_items DROP CONSTRAINT IF EXISTS subscription_plan_items_content_only_check");
        DB::statement("ALTER TABLE subscription_plan_items ADD CONSTRAINT subscription_plan_items_content_only_check CHECK (item_type IN ('content_item', 'bundle', 'product'))");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE subscription_plan_items DROP CONSTRAINT IF EXISTS subscription_plan_items_content_only_check");
        DB::statement("ALTER TABLE subscription_plan_items ADD CONSTRAINT subscription_plan_items_content_only_check CHECK (item_type IN ('content_item', 'bundle'))");
    }
};
