<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('social_commerce_request_invitations')
            ->whereNull('short_code')
            ->orderBy('id')
            ->eachById(function (object $invitation): void {
                do {
                    $shortCode = Str::random(16);
                } while (DB::table('social_commerce_request_invitations')->where('short_code', $shortCode)->exists());

                DB::table('social_commerce_request_invitations')
                    ->where('id', $invitation->id)
                    ->update([
                        'short_code' => $shortCode,
                        'short_token_hash' => hash('sha256', $shortCode),
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        // Short codes are nullable compatibility data; keep them if this migration is rolled back.
    }
};
