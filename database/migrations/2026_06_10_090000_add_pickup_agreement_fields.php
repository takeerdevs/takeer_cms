<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->unsignedInteger('pickup_hold_hours')->default(2)->after('allow_self_pickup');
            $table->unsignedInteger('pickup_grace_hours')->default(12)->after('pickup_hold_hours');
            $table->json('pickup_available_windows')->nullable()->after('pickup_grace_hours');
            $table->text('pickup_instructions')->nullable()->after('pickup_available_windows');
            $table->boolean('pickup_holding_fee_enabled')->default(false)->after('pickup_instructions');
            $table->decimal('pickup_holding_fee_amount', 12, 2)->nullable()->after('pickup_holding_fee_enabled');
            $table->string('pickup_holding_fee_interval')->default('day')->after('pickup_holding_fee_amount');
            $table->unsignedInteger('pickup_max_holding_days')->default(2)->after('pickup_holding_fee_interval');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('pickup_hold_hours_override')->nullable()->after('availability_lead_time_days');
            $table->boolean('pickup_extension_allowed')->default(true)->after('pickup_hold_hours_override');
            $table->boolean('pickup_holding_fee_allowed')->default(true)->after('pickup_extension_allowed');
            $table->text('pickup_policy_note')->nullable()->after('pickup_holding_fee_allowed');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('pickup_location_id')->nullable()->after('user_address_id')->constrained('merchant_locations')->nullOnDelete();
            $table->timestamp('pickup_ready_at')->nullable()->after('paid_out_at');
            $table->timestamp('pickup_deadline_at')->nullable()->after('pickup_ready_at');
            $table->timestamp('pickup_grace_ends_at')->nullable()->after('pickup_deadline_at');
            $table->timestamp('pickup_completed_at')->nullable()->after('pickup_grace_ends_at');
            $table->string('pickup_status')->nullable()->after('pickup_completed_at');
            $table->json('pickup_policy_snapshot')->nullable()->after('pickup_status');
            $table->unsignedInteger('pickup_extension_count')->default(0)->after('pickup_policy_snapshot');
            $table->timestamp('pickup_no_show_marked_at')->nullable()->after('pickup_extension_count');
            $table->text('pickup_no_show_reason')->nullable()->after('pickup_no_show_marked_at');
            $table->string('holding_fee_status')->nullable()->after('pickup_no_show_reason');
            $table->decimal('holding_fee_amount', 12, 2)->nullable()->after('holding_fee_status');
            $table->timestamp('holding_fee_started_at')->nullable()->after('holding_fee_amount');
            $table->timestamp('holding_fee_accepted_at')->nullable()->after('holding_fee_started_at');

            $table->index(['pickup_status', 'pickup_deadline_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['pickup_location_id']);
            $table->dropIndex(['pickup_status', 'pickup_deadline_at']);
            $table->dropColumn([
                'pickup_location_id',
                'pickup_ready_at',
                'pickup_deadline_at',
                'pickup_grace_ends_at',
                'pickup_completed_at',
                'pickup_status',
                'pickup_policy_snapshot',
                'pickup_extension_count',
                'pickup_no_show_marked_at',
                'pickup_no_show_reason',
                'holding_fee_status',
                'holding_fee_amount',
                'holding_fee_started_at',
                'holding_fee_accepted_at',
            ]);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'pickup_hold_hours_override',
                'pickup_extension_allowed',
                'pickup_holding_fee_allowed',
                'pickup_policy_note',
            ]);
        });

        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->dropColumn([
                'pickup_hold_hours',
                'pickup_grace_hours',
                'pickup_available_windows',
                'pickup_instructions',
                'pickup_holding_fee_enabled',
                'pickup_holding_fee_amount',
                'pickup_holding_fee_interval',
                'pickup_max_holding_days',
            ]);
        });
    }
};
