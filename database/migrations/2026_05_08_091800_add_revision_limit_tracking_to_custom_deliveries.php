<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('custom_delivery_due_at')->nullable()->after('custom_delivery_message');
            $table->unsignedSmallInteger('custom_delivery_revision_count')->default(0)->after('custom_delivery_revision_requested_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'custom_delivery_due_at',
                'custom_delivery_revision_count',
            ]);
        });
    }
};
