<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $pgsql = DB::connection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');
        }

        Schema::create('search_index', function (Blueprint $table): void {
            $table->id();
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id');
            $table->string('source_type', 40);
            $table->unsignedBigInteger('source_id');
            $table->string('parent_type', 40)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->cascadeOnDelete();
            $table->string('canonical_group_key', 120);
            $table->string('content_type', 60);
            $table->string('card_type', 60);
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('summary')->nullable();
            $table->string('normalized_title')->default('');
            $table->text('keywords')->nullable();
            $table->json('facets')->nullable();
            $table->json('display_data')->nullable();
            $table->string('url')->nullable();
            $table->string('image_url')->nullable();
            $table->string('currency_code', 12)->nullable();
            $table->decimal('price_min', 16, 3)->nullable();
            $table->decimal('price_max', 16, 3)->nullable();
            $table->decimal('price_min_base', 16, 3)->nullable();
            $table->decimal('price_max_base', 16, 3)->nullable();
            $table->boolean('in_stock')->nullable();
            $table->boolean('is_available')->default(true);
            $table->foreignId('country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->string('city')->nullable();
            $table->string('region')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('language', 12)->default('und');
            $table->string('visibility', 30)->default('public');
            $table->boolean('is_searchable')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->decimal('popularity_score', 14, 4)->default(0);
            $table->decimal('quality_score', 10, 4)->default(0);
            $table->timestamp('source_updated_at')->nullable();
            $table->timestamp('indexed_at')->nullable();
            $table->string('content_hash', 64)->nullable();
            $table->string('embedding_hash', 64)->nullable();
            $table->string('embedding_status', 20)->default('pending');
            $table->string('embedding_model')->nullable();
            $table->timestamp('embedding_updated_at')->nullable();
            $table->unsignedBigInteger('last_outbox_id')->nullable();
            $table->unsignedInteger('index_version')->default(1);
            $table->unsignedInteger('generation')->default(1);
            $table->timestamps();

            $table->unique(['generation', 'source_type', 'source_id'], 'search_index_source_unique');
            $table->index(['generation', 'is_searchable', 'entity_type'], 'search_index_public_type_idx');
            $table->index(['generation', 'is_searchable', 'content_type'], 'search_index_public_content_idx');
            $table->index(['merchant_id', 'is_searchable']);
            $table->index(['country_id', 'is_searchable']);
            $table->index(['price_min_base', 'price_max_base']);
            $table->index(['published_at', 'id']);
            $table->index('canonical_group_key');
        });

        if ($pgsql) {
            DB::statement('ALTER TABLE search_index ADD COLUMN search_vector tsvector');
            DB::statement('CREATE INDEX search_index_search_vector_gin ON search_index USING gin (search_vector) WHERE is_searchable = true');
            DB::statement('CREATE INDEX search_index_title_trgm ON search_index USING gin (normalized_title gin_trgm_ops) WHERE is_searchable = true');
        } else {
            Schema::table('search_index', fn (Blueprint $table) => $table->text('search_vector')->nullable());
        }

        Schema::create('search_index_chunks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('search_index_id')->constrained('search_index')->cascadeOnDelete();
            $table->string('chunk_key', 120);
            $table->string('chunk_type', 40)->default('summary');
            $table->unsignedInteger('position')->default(0);
            $table->text('content');
            $table->json('facets')->nullable();
            $table->decimal('price_min', 16, 3)->nullable();
            $table->decimal('price_max', 16, 3)->nullable();
            $table->boolean('in_stock')->nullable();
            $table->string('content_hash', 64);
            $table->string('embedding_hash', 64)->nullable();
            $table->string('embedding_model')->nullable();
            $table->string('embedding_status', 20)->default('pending');
            $table->timestamp('embedding_updated_at')->nullable();
            $table->timestamps();

            $table->unique(['search_index_id', 'chunk_key'], 'search_index_chunk_unique');
            $table->index(['chunk_type', 'in_stock']);
            $table->index('embedding_status');
        });

        if ($pgsql) {
            DB::statement('ALTER TABLE search_index_chunks ADD COLUMN search_vector tsvector');
            DB::statement('ALTER TABLE search_index_chunks ADD COLUMN embedding vector(512)');
            DB::statement('CREATE INDEX search_index_chunks_search_vector_gin ON search_index_chunks USING gin (search_vector)');
            DB::statement('CREATE INDEX search_index_chunks_embedding_hnsw ON search_index_chunks USING hnsw (embedding vector_cosine_ops)');
        } else {
            Schema::table('search_index_chunks', function (Blueprint $table): void {
                $table->text('search_vector')->nullable();
                $table->text('embedding')->nullable();
            });
        }

        Schema::create('search_index_outbox', function (Blueprint $table): void {
            $table->id();
            $table->string('aggregate_type', 40);
            $table->unsignedBigInteger('aggregate_id');
            $table->string('action', 20)->default('upsert');
            $table->string('reason')->nullable();
            $table->string('source_event')->nullable();
            $table->timestamp('available_at')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('processed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['processed_at', 'available_at', 'id'], 'search_outbox_pending_idx');
            $table->index(['aggregate_type', 'aggregate_id', 'id'], 'search_outbox_aggregate_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('search_index_outbox');
        Schema::dropIfExists('search_index_chunks');
        Schema::dropIfExists('search_index');
    }
};
