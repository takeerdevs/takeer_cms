<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            $table->string('media_type')->default('image')->after('image_url');
            $table->string('thumbnail_url')->nullable()->after('media_type');
            $table->string('processed_url')->nullable()->after('thumbnail_url');
            $table->string('hls_url')->nullable()->after('processed_url');
            $table->string('mime')->nullable()->after('hls_url');
            $table->unsignedBigInteger('size')->nullable()->after('mime');
            $table->unsignedInteger('duration_seconds')->nullable()->after('size');
            $table->unsignedInteger('width')->nullable()->after('duration_seconds');
            $table->unsignedInteger('height')->nullable()->after('width');
            $table->string('processing_status')->default('ready')->after('height');
            $table->text('processing_error')->nullable()->after('processing_status');
        });

        Schema::table('post_media', function (Blueprint $table) {
            $table->string('thumbnail_url')->nullable()->after('media_type');
            $table->string('processed_url')->nullable()->after('thumbnail_url');
            $table->string('hls_url')->nullable()->after('processed_url');
            $table->string('mime')->nullable()->after('hls_url');
            $table->unsignedBigInteger('size')->nullable()->after('mime');
            $table->unsignedInteger('duration_seconds')->nullable()->after('size');
            $table->unsignedInteger('width')->nullable()->after('duration_seconds');
            $table->unsignedInteger('height')->nullable()->after('width');
            $table->string('processing_status')->default('ready')->after('height');
            $table->text('processing_error')->nullable()->after('processing_status');
        });
    }

    public function down(): void
    {
        Schema::table('post_media', function (Blueprint $table) {
            $table->dropColumn([
                'thumbnail_url',
                'processed_url',
                'hls_url',
                'mime',
                'size',
                'duration_seconds',
                'width',
                'height',
                'processing_status',
                'processing_error',
            ]);
        });

        Schema::table('product_images', function (Blueprint $table) {
            $table->dropColumn([
                'media_type',
                'thumbnail_url',
                'processed_url',
                'hls_url',
                'mime',
                'size',
                'duration_seconds',
                'width',
                'height',
                'processing_status',
                'processing_error',
            ]);
        });
    }
};
