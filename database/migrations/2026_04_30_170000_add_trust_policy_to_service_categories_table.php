<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_categories', function (Blueprint $table) {
            $table->string('risk_level', 24)->default('standard')->after('option_template');
            $table->json('required_documents')->nullable()->after('risk_level');
            $table->boolean('requires_manual_review')->default(false)->after('required_documents');
            $table->unsignedSmallInteger('payout_hold_days')->default(3)->after('requires_manual_review');
            $table->decimal('max_first_quote_amount', 12, 2)->nullable()->after('payout_hold_days');
        });
    }

    public function down(): void
    {
        Schema::table('service_categories', function (Blueprint $table) {
            $table->dropColumn([
                'risk_level',
                'required_documents',
                'requires_manual_review',
                'payout_hold_days',
                'max_first_quote_amount',
            ]);
        });
    }
};
