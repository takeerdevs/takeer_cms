<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // SQLite cannot alter named CHECK constraints. Its test schema does not
        // need the production PostgreSQL constraint rewrite.
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_format_check');
        DB::statement("ALTER TABLE content_items ADD CONSTRAINT content_items_format_check CHECK (format IN ('plain_text', 'markdown', 'html', 'lexical'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_format_check');
        DB::statement("ALTER TABLE content_items ADD CONSTRAINT content_items_format_check CHECK (format IN ('plain_text', 'markdown', 'html'))");
    }
};
