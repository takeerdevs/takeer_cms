<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('digital_delivery_type', 40)->default('file')->after('download_link');
            $table->string('paid_video_url', 2048)->nullable()->after('digital_delivery_type');
            $table->string('paid_video_mime', 255)->nullable()->after('paid_video_url');
            $table->unsignedBigInteger('paid_video_size')->nullable()->after('paid_video_mime');
            $table->unsignedInteger('paid_video_duration_seconds')->nullable()->after('paid_video_size');
            $table->boolean('allow_download')->default(true)->after('paid_video_duration_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'digital_delivery_type',
                'paid_video_url',
                'paid_video_mime',
                'paid_video_size',
                'paid_video_duration_seconds',
                'allow_download',
            ]);
        });
    }
};
