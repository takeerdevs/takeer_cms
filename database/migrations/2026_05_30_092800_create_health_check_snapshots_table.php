<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_check_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('status', 24)->index();
            $table->unsignedInteger('duration_ms')->default(0);
            $table->json('checks');
            $table->timestamp('checked_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_check_snapshots');
    }
};
