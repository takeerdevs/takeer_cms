<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->string('rider_access_token_hash', 64)->nullable()->unique()->after('buyer_unboxing_video_url');
            $table->timestamp('rider_access_expires_at')->nullable()->after('rider_access_token_hash');
            $table->timestamp('rider_access_revoked_at')->nullable()->after('rider_access_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropColumn([
                'rider_access_token_hash',
                'rider_access_expires_at',
                'rider_access_revoked_at',
            ]);
        });
    }
};
