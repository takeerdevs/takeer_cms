<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('premium_video_status', 40)->nullable()->after('paid_video_duration_seconds');
            $table->string('premium_video_hls_path', 2048)->nullable()->after('premium_video_status');
            $table->string('premium_video_hls_disk', 40)->nullable()->after('premium_video_hls_path');
            $table->string('premium_video_thumbnail_path', 2048)->nullable()->after('premium_video_hls_disk');
            $table->text('premium_video_error')->nullable()->after('premium_video_thumbnail_path');
            $table->timestamp('premium_video_processed_at')->nullable()->after('premium_video_error');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'premium_video_status',
                'premium_video_hls_path',
                'premium_video_hls_disk',
                'premium_video_thumbnail_path',
                'premium_video_error',
                'premium_video_processed_at',
            ]);
        });
    }
};
