<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retail_business_obligations', function (Blueprint $table) {
            if (! Schema::hasColumn('retail_business_obligations', 'estimated_amount')) {
                $table->decimal('estimated_amount', 15, 2)->nullable()->after('recurrence_ends_at');
            }

            if (! Schema::hasColumn('retail_business_obligations', 'currency_code')) {
                $table->string('currency_code', 8)->default('TZS')->after('estimated_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('retail_business_obligations', function (Blueprint $table) {
            if (Schema::hasColumn('retail_business_obligations', 'currency_code')) {
                $table->dropColumn('currency_code');
            }

            if (Schema::hasColumn('retail_business_obligations', 'estimated_amount')) {
                $table->dropColumn('estimated_amount');
            }
        });
    }
};
