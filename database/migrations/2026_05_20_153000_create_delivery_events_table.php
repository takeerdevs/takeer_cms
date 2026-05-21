<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('deliveries')) {
            $statuses = [
                'inquiry',
                'packing',
                'ready_for_pickup',
                'awaiting_boda',
                'awaiting_pickup',
                'dispatched',
                'with_boda',
                'in_transit',
                'arrived',
                'ready_at_terminal',
                'delivered',
                'issue_reported',
                'disputed',
                'customer_confirmed',
            ];

            $driver = DB::getDriverName();
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check');
                $quoted = collect($statuses)->map(fn ($status) => "'{$status}'::character varying")->implode(', ');
                DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_status_check CHECK (delivery_status::text = ANY (ARRAY[{$quoted}]::text[]))");
            } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
                $quoted = collect($statuses)->map(fn ($status) => "'{$status}'")->implode(', ');
                DB::statement("ALTER TABLE deliveries MODIFY COLUMN delivery_status ENUM({$quoted}) DEFAULT 'awaiting_boda'");
            }
        }

        Schema::create('delivery_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_id')->constrained('deliveries')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('status', 80);
            $table->string('actor_type', 40)->default('merchant');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('proof_url')->nullable();
            $table->string('proof_mime')->nullable();
            $table->string('proof_type', 40)->nullable();
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'created_at']);
            $table->index(['delivery_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_events');

        if (! Schema::hasTable('deliveries')) {
            return;
        }

        $statuses = [
            'inquiry',
            'awaiting_boda',
            'awaiting_pickup',
            'in_transit',
            'ready_at_terminal',
            'delivered',
            'disputed',
            'customer_confirmed',
        ];

        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check');
            $quoted = collect($statuses)->map(fn ($status) => "'{$status}'::character varying")->implode(', ');
            DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_status_check CHECK (delivery_status::text = ANY (ARRAY[{$quoted}]::text[]))");
        } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
            $quoted = collect($statuses)->map(fn ($status) => "'{$status}'")->implode(', ');
            DB::statement("ALTER TABLE deliveries MODIFY COLUMN delivery_status ENUM({$quoted}) DEFAULT 'awaiting_boda'");
        }
    }
};
