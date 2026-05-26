<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarder_locations', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarder_locations', 'address_template')) {
                $table->text('address_template')->nullable()->after('address_line');
            }
        });

        DB::table('forwarder_locations')
            ->whereNull('address_template')
            ->update(['address_template' => DB::raw('address_line')]);
    }

    public function down(): void
    {
        Schema::table('forwarder_locations', function (Blueprint $table) {
            if (Schema::hasColumn('forwarder_locations', 'address_template')) {
                $table->dropColumn('address_template');
            }
        });
    }
};
