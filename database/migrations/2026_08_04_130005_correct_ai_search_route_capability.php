<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('ai_task_routes')
            ->where('task_key', 'ai_search')
            ->update([
                // Conversational AI Search is the canonical route. Legacy
                // text/visual endpoints pass their own capability override.
                'required_capability' => 'tools',
                'description' => 'Search Takeer catalog data through bounded read-only commerce tools.',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('ai_task_routes')
            ->where('task_key', 'ai_search')
            ->update([
                'required_capability' => 'vision_json',
                'description' => 'Convert natural language or visual searches into commerce intent.',
                'updated_at' => now(),
            ]);
    }
};
