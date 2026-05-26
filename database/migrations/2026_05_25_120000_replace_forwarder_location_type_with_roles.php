<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('forwarder_locations')) {
            return;
        }

        Schema::table('forwarder_locations', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarder_locations', 'roles')) {
                $table->json('roles')->nullable()->after('forwarder_id');
            }
        });

        if (Schema::hasColumn('forwarder_locations', 'type')) {
            DB::table('forwarder_locations')
                ->orderBy('id')
                ->each(function ($location): void {
                    $role = $location->type === 'destination_office' ? 'destination' : 'origin';

                    DB::table('forwarder_locations')
                        ->where('id', $location->id)
                        ->update(['roles' => json_encode([$role])]);
                });

            Schema::table('forwarder_locations', function (Blueprint $table) {
                try {
                    $table->dropIndex(['forwarder_id', 'type', 'is_verified', 'is_active']);
                } catch (Throwable) {
                    //
                }
                $table->dropColumn('type');
                $table->index(['forwarder_id', 'is_verified', 'is_active']);
            });
        }

        DB::table('forwarder_locations')
            ->whereNull('roles')
            ->update(['roles' => json_encode(['origin'])]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('forwarder_locations')) {
            return;
        }

        Schema::table('forwarder_locations', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarder_locations', 'type')) {
                $table->string('type')->default('origin_warehouse')->after('forwarder_id');
            }
        });

        DB::table('forwarder_locations')
            ->orderBy('id')
            ->each(function ($location): void {
                $roles = json_decode($location->roles ?: '[]', true);
                $type = in_array('destination', $roles, true) && !in_array('origin', $roles, true)
                    ? 'destination_office'
                    : 'origin_warehouse';

                DB::table('forwarder_locations')
                    ->where('id', $location->id)
                    ->update(['type' => $type]);
            });

        Schema::table('forwarder_locations', function (Blueprint $table) {
            if (Schema::hasColumn('forwarder_locations', 'roles')) {
                $table->dropColumn('roles');
            }
            $table->index(['forwarder_id', 'type', 'is_verified', 'is_active']);
        });
    }
};
