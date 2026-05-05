<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('custom_delivery_file_url')->nullable()->after('live_event_access_last_sent_at');
            $table->string('custom_delivery_file_name')->nullable()->after('custom_delivery_file_url');
            $table->string('custom_delivery_file_mime')->nullable()->after('custom_delivery_file_name');
            $table->unsignedBigInteger('custom_delivery_file_size')->nullable()->after('custom_delivery_file_mime');
            $table->text('custom_delivery_message')->nullable()->after('custom_delivery_file_size');
            $table->timestamp('custom_delivery_delivered_at')->nullable()->after('custom_delivery_message');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'custom_delivery_file_url',
                'custom_delivery_file_name',
                'custom_delivery_file_mime',
                'custom_delivery_file_size',
                'custom_delivery_message',
                'custom_delivery_delivered_at',
            ]);
        });
    }
};
