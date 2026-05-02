<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bundle_course_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_id')->constrained('bundles')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['bundle_id', 'sort_order']);
        });

        Schema::create('bundle_course_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_course_module_id')->constrained('bundle_course_modules')->cascadeOnDelete();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->unsignedInteger('unlock_after_days')->default(0);
            $table->boolean('is_preview')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['bundle_course_module_id', 'sort_order'], 'bundle_lessons_module_sort_index');
        });

        Schema::create('bundle_lesson_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_course_lesson_id')->constrained('bundle_course_lessons')->cascadeOnDelete();
            $table->string('role')->default('supporting')->comment('primary|supporting');
            $table->string('asset_type')->default('file')->comment('product|content_item|file');
            $table->unsignedBigInteger('asset_id')->nullable();
            $table->foreignId('selected_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->json('selected_variant_snapshot')->nullable();
            $table->string('name')->nullable();
            $table->string('url', 1000)->nullable();
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['bundle_course_lesson_id', 'role'], 'bundle_lesson_assets_lesson_role_index');
            $table->index(['asset_type', 'asset_id']);
        });

        Schema::create('bundle_cohorts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_id')->constrained('bundles')->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('enrollment_deadline')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->string('access_rule')->default('all_on_start')->comment('all_on_start|weekly|manual');
            $table->string('status')->default('upcoming')->comment('upcoming|active|closed');
            $table->timestamps();

            $table->index(['bundle_id', 'status']);
        });

        Schema::create('bundle_live_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_course_lesson_id')->constrained('bundle_course_lessons')->cascadeOnDelete();
            $table->dateTime('starts_at')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->string('timezone')->nullable();
            $table->string('meeting_url', 1000)->nullable();
            $table->string('venue')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('starts_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bundle_live_sessions');
        Schema::dropIfExists('bundle_cohorts');
        Schema::dropIfExists('bundle_lesson_assets');
        Schema::dropIfExists('bundle_course_lessons');
        Schema::dropIfExists('bundle_course_modules');
    }
};
