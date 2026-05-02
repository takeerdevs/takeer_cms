<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $now = now();

        DB::table('fee_policies')->updateOrInsert(
            ['category' => 'sale', 'scope' => 'global', 'name' => 'Standard Takeer sale fee'],
            [
                'fee_type' => 'percentage',
                'percentage_rate' => 5,
                'fixed_amount' => 0,
                'is_active' => true,
                'notes' => 'Default platform fee for paid sales.',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('fee_policies')->updateOrInsert(
            ['category' => 'withdrawal', 'scope' => 'global', 'name' => 'Standard withdrawal fee'],
            [
                'fee_type' => 'fixed',
                'percentage_rate' => 0,
                'fixed_amount' => 0,
                'is_active' => true,
                'notes' => 'Default withdrawal fee. Update when payout rails have confirmed charges.',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    public function down(): void
    {
        DB::table('fee_policies')
            ->whereIn('name', ['Standard Takeer sale fee', 'Standard withdrawal fee'])
            ->delete();
    }
};
