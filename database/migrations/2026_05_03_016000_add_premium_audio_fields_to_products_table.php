<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('paid_audio_url', 2048)->nullable()->after('premium_video_processed_at');
            $table->string('paid_audio_mime')->nullable()->after('paid_audio_url');
            $table->unsignedBigInteger('paid_audio_size')->nullable()->after('paid_audio_mime');
            $table->unsignedInteger('paid_audio_duration_seconds')->nullable()->after('paid_audio_size');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'paid_audio_url',
                'paid_audio_mime',
                'paid_audio_size',
                'paid_audio_duration_seconds',
            ]);
        });
    }
};
