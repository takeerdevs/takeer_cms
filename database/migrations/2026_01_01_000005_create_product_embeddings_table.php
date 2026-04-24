<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (config('database.default') !== 'pgsql') {
            \Illuminate\Support\Facades\Schema::create('product_embeddings', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->text('vector');
                $table->timestamps();
            });
            return;
        }

        // pgvector must be enabled — done in the users migration.
        // Create the product_embeddings table using raw SQL for vector column support.
        DB::statement('
            CREATE TABLE product_embeddings (
                id BIGSERIAL PRIMARY KEY,
                product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                vector vector(512) NOT NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                UNIQUE(product_id)
            )
        ');
        DB::statement('CREATE INDEX ON product_embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 100)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS product_embeddings');
    }
};
