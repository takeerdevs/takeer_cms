<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bundles', function (Blueprint $table) {
            $table->enum('course_format', ['self_paced', 'cohort', 'live'])->nullable()->after('is_course');
            $table->json('course_outcomes')->nullable()->after('course_format');
            $table->json('course_requirements')->nullable()->after('course_outcomes');
            $table->string('course_cover_image_url')->nullable()->after('course_requirements');
        });

        Schema::table('bundle_items', function (Blueprint $table) {
            $table->string('section_title')->nullable()->after('item_id');
            $table->string('lesson_title')->nullable()->after('section_title');
            $table->text('lesson_summary')->nullable()->after('lesson_title');
            $table->unsignedInteger('lesson_duration_minutes')->nullable()->after('lesson_summary');
            $table->unsignedInteger('unlock_after_days')->default(0)->after('lesson_duration_minutes');
            $table->boolean('is_preview')->default(false)->after('unlock_after_days');
        });
    }

    public function down(): void
    {
        Schema::table('bundle_items', function (Blueprint $table) {
            $table->dropColumn([
                'section_title',
                'lesson_title',
                'lesson_summary',
                'lesson_duration_minutes',
                'unlock_after_days',
                'is_preview',
            ]);
        });

        Schema::table('bundles', function (Blueprint $table) {
            $table->dropColumn([
                'course_format',
                'course_outcomes',
                'course_requirements',
                'course_cover_image_url',
            ]);
        });
    }
};
