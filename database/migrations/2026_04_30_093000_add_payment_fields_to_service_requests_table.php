<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->string('payment_token', 80)->nullable()->unique()->after('public_id');
            $table->string('payment_status')->nullable()->after('status');
            $table->timestamp('payment_link_expires_at')->nullable()->after('payment_status');
            $table->foreignId('payment_order_id')->nullable()->after('payment_link_expires_at')->constrained('orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_order_id');
            $table->dropColumn([
                'payment_token',
                'payment_status',
                'payment_link_expires_at',
            ]);
        });
    }
};
