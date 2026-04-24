<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('is_inquiry')->default(false)->after('payment_status');
            $table->string('inquiry_status')->nullable()->after('is_inquiry'); // 'pending', 'quoted'
            $table->decimal('shipping_fee', 12, 2)->nullable()->after('total_paid');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['is_inquiry', 'inquiry_status', 'shipping_fee']);
        });
    }
};
