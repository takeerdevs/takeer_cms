<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('shipping_zone_id')->nullable()->constrained('shipping_zones')->nullOnDelete();
            $table->text('physical_address')->nullable()->comment('Delivery address inputted by customer');
            $table->string('boda_phone')->nullable()->comment('Boda boda rider phone for local delivery');
            $table->string('bus_company')->nullable()->comment('Intercity bus company name');
            $table->string('waybill_tracking_number')->nullable()->comment('OCR-extracted from waybill photo');
            $table->string('waybill_photo_url')->nullable()->comment('S3 URL of uploaded waybill image');
            $table->enum('delivery_status', [
                'awaiting_boda',       // Local order assigned to rider
                'in_transit',          // Intercity: dispatched via bus
                'ready_at_terminal',   // Buyer SMS sent with PIN
                'delivered',           // Buyer PIN confirmed
            ])->default('awaiting_boda');
            $table->string('buyer_release_pin', 4)->nullable()->comment('4-digit PIN sent to buyer via SMS');
            $table->string('pickup_pin', 4)->nullable()->comment('4-digit PIN generated for Customer Boda pickup');
            $table->string('whatsapp_pin_url')->nullable()->comment('WhatsApp deeplink for PIN delivery fallback');
            $table->timestamps();

            $table->unique('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
