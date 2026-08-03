<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private const STATUSES = [
        'pending',
        'payment_confirmed',
        'pending_fulfillment',
        'release_eligible',
        'release_requested',
        'payout_processing',
        'paid_out',
        'disputed',
        'refund_pending',
        'refunded',
        'compliance_hold',
        'failed',
    ];

    public function up(): void
    {
        $this->replaceConstraint(self::STATUSES);
    }

    public function down(): void
    {
        $this->replaceConstraint([
            'pending',
            'payment_confirmed',
            'pending_fulfillment',
            'release_eligible',
            'release_requested',
            'payout_processing',
            'paid_out',
            'disputed',
            'refunded',
            'compliance_hold',
            'failed',
        ]);
    }

    private function replaceConstraint(array $statuses): void
    {
        // SQLite materializes the enum/check constraint from the original
        // orders migration and does not support ALTER TABLE ... DROP
        // CONSTRAINT. The original constraint already contains this exact
        // status set, so there is nothing to rewrite for test databases.
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        $quoted = collect($statuses)
            ->map(fn (string $status) => DB::getPdo()->quote($status))
            ->implode(', ');

        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ({$quoted}))");
    }
};
