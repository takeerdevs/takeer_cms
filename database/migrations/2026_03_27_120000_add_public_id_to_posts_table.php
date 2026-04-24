<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        if (! Schema::hasColumn('posts', 'public_id')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->string('public_id', 32)->nullable()->after('id');
            });
        }

        DB::table('posts')
            ->select('id')
            ->whereNull('public_id')
            ->orderBy('id')
            ->chunkById(200, function ($posts): void {
                foreach ($posts as $post) {
                    do {
                        $candidate = Str::random(11);
                    } while (DB::table('posts')->where('public_id', $candidate)->exists());

                    DB::table('posts')
                        ->where('id', $post->id)
                        ->update(['public_id' => $candidate]);
                }
            });

        Schema::table('posts', function (Blueprint $table) {
            $table->unique('public_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts') || ! Schema::hasColumn('posts', 'public_id')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }
};
