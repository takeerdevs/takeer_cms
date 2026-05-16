<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_fiscal_integrations', function (Blueprint $table) {
            $table->timestamp('provider_access_expires_at')->nullable()->after('last_verified_at');
            $table->index(['status', 'provider_access_expires_at']);
        });
    }

    public function down(): void
    {
        Schema::table('merchant_fiscal_integrations', function (Blueprint $table) {
            $table->dropIndex(['status', 'provider_access_expires_at']);
            $table->dropColumn('provider_access_expires_at');
        });
    }
};
