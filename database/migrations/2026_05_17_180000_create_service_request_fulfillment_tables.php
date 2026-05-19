<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_request_fulfillments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')->unique()->constrained('service_requests')->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('module_key', 80)->nullable();
            $table->string('action', 40)->default('update');
            $table->string('status', 80)->default('updated');
            $table->text('notes')->nullable();
            $table->string('room_number', 80)->nullable();
            $table->string('unit_label', 120)->nullable();
            $table->string('pickup_point', 160)->nullable();
            $table->string('guide_name', 120)->nullable();
            $table->string('practitioner', 120)->nullable();
            $table->string('appointment_room', 120)->nullable();
            $table->string('table_label', 120)->nullable();
            $table->string('session_title', 160)->nullable();
            $table->string('reference_code', 120)->nullable();
            $table->string('certificate_status', 80)->nullable();
            $table->string('deposit_status', 80)->nullable();
            $table->unsignedInteger('guests')->nullable();
            $table->unsignedInteger('party_size')->nullable();
            $table->unsignedInteger('attendee_count')->nullable();
            $table->timestamp('check_in_at')->nullable();
            $table->timestamp('check_out_at')->nullable();
            $table->timestamp('departure_at')->nullable();
            $table->timestamp('pickup_at')->nullable();
            $table->timestamp('return_due_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'module_key', 'status'], 'srf_merchant_module_status_index');
            $table->index(['merchant_id', 'status', 'recorded_at'], 'srf_merchant_status_recorded_index');
            $table->index(['product_id', 'status']);
            $table->index('reference_code');
        });

        Schema::create('service_request_fulfillment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_fulfillment_id')->constrained('service_request_fulfillments')->cascadeOnDelete();
            $table->foreignId('service_request_id')->constrained('service_requests')->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('module_key', 80)->nullable();
            $table->string('action', 40);
            $table->string('status', 80);
            $table->text('notes')->nullable();
            $table->string('room_number', 80)->nullable();
            $table->string('unit_label', 120)->nullable();
            $table->string('pickup_point', 160)->nullable();
            $table->string('guide_name', 120)->nullable();
            $table->string('practitioner', 120)->nullable();
            $table->string('appointment_room', 120)->nullable();
            $table->string('table_label', 120)->nullable();
            $table->string('session_title', 160)->nullable();
            $table->string('reference_code', 120)->nullable();
            $table->string('certificate_status', 80)->nullable();
            $table->string('deposit_status', 80)->nullable();
            $table->unsignedInteger('guests')->nullable();
            $table->unsignedInteger('party_size')->nullable();
            $table->unsignedInteger('attendee_count')->nullable();
            $table->timestamp('check_in_at')->nullable();
            $table->timestamp('check_out_at')->nullable();
            $table->timestamp('departure_at')->nullable();
            $table->timestamp('pickup_at')->nullable();
            $table->timestamp('return_due_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'module_key', 'status'], 'srfe_merchant_module_status_index');
            $table->index(['service_request_id', 'recorded_at'], 'srfe_request_recorded_index');
            $table->index(['recorded_by', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_request_fulfillment_events');
        Schema::dropIfExists('service_request_fulfillments');
    }
};
