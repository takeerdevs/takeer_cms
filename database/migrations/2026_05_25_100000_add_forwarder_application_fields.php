<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarders', 'business_registration_number')) {
                $table->string('business_registration_number')->nullable()->after('legal_name');
            }

            if (!Schema::hasColumn('forwarders', 'application_summary')) {
                $table->text('application_summary')->nullable()->after('description');
            }

            if (!Schema::hasColumn('forwarders', 'operating_country_ids')) {
                $table->json('operating_country_ids')->nullable()->after('destination_country_ids');
            }

            if (!Schema::hasColumn('forwarders', 'application_submitted_at')) {
                $table->timestamp('application_submitted_at')->nullable()->after('submitted_by_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            foreach ([
                'application_submitted_at',
                'operating_country_ids',
                'application_summary',
                'business_registration_number',
            ] as $column) {
                if (Schema::hasColumn('forwarders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
