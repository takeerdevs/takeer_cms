<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('referral_commission_amount', 12, 2)->default(0)->after('referral_code');
            $table->enum('referral_commission_status', ['pending', 'approved', 'paid', 'void'])->nullable()->after('referral_commission_amount');
            $table->timestamp('referral_commission_paid_at')->nullable()->after('referral_commission_status');
            $table->json('referral_reward_snapshot')->nullable()->after('referral_commission_paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'referral_commission_amount',
                'referral_commission_status',
                'referral_commission_paid_at',
                'referral_reward_snapshot',
            ]);
        });
    }
};
