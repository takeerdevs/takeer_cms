<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_plans', function (Blueprint $table) {
            $table->string('claim_frequency')->default('monthly')->after('billing_interval');
            $table->index(['scope_type', 'claim_frequency', 'is_active']);
        });

        // Preserve the old one-time billing meaning for plans that existed
        // before claim frequency became an explicit entitlement setting.
        DB::table('ai_plans')
            ->where('billing_interval', 'one_time')
            ->update(['claim_frequency' => 'once']);
    }

    public function down(): void
    {
        Schema::table('ai_plans', function (Blueprint $table) {
            $table->dropIndex(['scope_type', 'claim_frequency', 'is_active']);
            $table->dropColumn('claim_frequency');
        });
    }
};
