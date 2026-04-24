<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('account_phone')->nullable()->after('idempotency_key')
                ->comment('Owning account phone used for login/recovery');
            $table->string('payment_phone')->nullable()->after('account_phone')
                ->comment('Phone number used for this payment transaction');

            $table->index('account_phone');
            $table->index('payment_phone');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['account_phone']);
            $table->dropIndex(['payment_phone']);
            $table->dropColumn(['account_phone', 'payment_phone']);
        });
    }
};
