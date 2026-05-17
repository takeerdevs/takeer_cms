<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retail_business_obligations', function (Blueprint $table) {
            if (! Schema::hasColumn('retail_business_obligations', 'recurrence_frequency')) {
                $table->string('recurrence_frequency')->default('none')->after('due_date')->index();
            }

            if (! Schema::hasColumn('retail_business_obligations', 'recurrence_interval')) {
                $table->unsignedSmallInteger('recurrence_interval')->default(1)->after('recurrence_frequency');
            }

            if (! Schema::hasColumn('retail_business_obligations', 'recurrence_ends_at')) {
                $table->date('recurrence_ends_at')->nullable()->after('recurrence_interval')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('retail_business_obligations', function (Blueprint $table) {
            if (Schema::hasColumn('retail_business_obligations', 'recurrence_ends_at')) {
                $table->dropColumn('recurrence_ends_at');
            }

            if (Schema::hasColumn('retail_business_obligations', 'recurrence_interval')) {
                $table->dropColumn('recurrence_interval');
            }

            if (Schema::hasColumn('retail_business_obligations', 'recurrence_frequency')) {
                $table->dropColumn('recurrence_frequency');
            }
        });
    }
};
