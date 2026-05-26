<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (!Schema::hasColumn('posts', 'forwarder_id')) {
                $table->foreignId('forwarder_id')->nullable()->after('merchant_id')->constrained('forwarders')->nullOnDelete();
            }
            if (!Schema::hasColumn('posts', 'forwarder_route_id')) {
                $table->string('forwarder_route_id')->nullable()->after('forwarder_id');
            }
            if (!Schema::hasColumn('posts', 'forwarder_route_label')) {
                $table->string('forwarder_route_label')->nullable()->after('forwarder_route_id');
            }
            if (!Schema::hasColumn('posts', 'forwarder_route_snapshot')) {
                $table->json('forwarder_route_snapshot')->nullable()->after('forwarder_route_label');
            }

            $table->index(['forwarder_id', 'forwarder_route_id']);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'forwarder_id') && Schema::hasColumn('posts', 'forwarder_route_id')) {
                $table->dropIndex(['forwarder_id', 'forwarder_route_id']);
            }

            foreach (['forwarder_route_snapshot', 'forwarder_route_label', 'forwarder_route_id'] as $column) {
                if (Schema::hasColumn('posts', $column)) {
                    $table->dropColumn($column);
                }
            }

            if (Schema::hasColumn('posts', 'forwarder_id')) {
                $table->dropConstrainedForeignId('forwarder_id');
            }
        });
    }
};
