<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_sms_campaign_recipients', function (Blueprint $table): void {
            $table->string('tracking_code', 80)->nullable()->unique()->after('phone');
            $table->string('landing_url', 1000)->nullable()->after('tracking_code');
            $table->timestamp('clicked_at')->nullable()->after('sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_sms_campaign_recipients', function (Blueprint $table): void {
            $table->dropColumn(['tracking_code', 'landing_url', 'clicked_at']);
        });
    }
};
