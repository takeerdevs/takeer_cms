<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bundle_cohort_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_cohort_id')->constrained('bundle_cohorts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('status')->default('active')->comment('active|cancelled|completed');
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamps();

            $table->unique(['bundle_cohort_id', 'user_id'], 'bundle_cohort_user_unique');
            $table->index(['user_id', 'status']);
        });

        Schema::create('bundle_course_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_course_lesson_id')->constrained('bundle_course_lessons')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['bundle_course_lesson_id', 'user_id'], 'bundle_lesson_user_unique');
            $table->index(['user_id', 'completed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bundle_course_progress');
        Schema::dropIfExists('bundle_cohort_enrollments');
    }
};
