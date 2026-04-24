<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Enable pgvector extension for product embeddings
        if (config('database.default') === 'pgsql') {
            \DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('phone_number')->unique()->nullable()->after('email');
            $table->enum('role', ['buyer', 'merchant'])->default('buyer')->after('phone_number');
            $table->string('password')->nullable()->change();
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone_number', 'role']);
        });
    }
};
