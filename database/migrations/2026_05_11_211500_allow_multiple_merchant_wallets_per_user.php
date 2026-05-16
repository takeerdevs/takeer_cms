<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['pgsql', 'sqlite'], true)) {
            DB::statement('CREATE UNIQUE INDEX wallets_user_generic_unique ON wallets (user_id) WHERE merchant_id IS NULL');
        } else {
            Schema::table('wallets', function (Blueprint $table) {
                $table->index('user_id');
            });
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['pgsql', 'sqlite'], true)) {
            DB::statement('DROP INDEX IF EXISTS wallets_user_generic_unique');
        } else {
            Schema::table('wallets', function (Blueprint $table) {
                $table->dropIndex(['user_id']);
            });
        }

        Schema::table('wallets', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }
};
