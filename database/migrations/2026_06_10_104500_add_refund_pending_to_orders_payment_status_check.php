<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private const STATUSES = [
        'pending',
        'paid_pending_confirmation',
        'awaiting_merchant_confirmation',
        'escrow_locked',
        'shipped',
        'disputed',
        'refund_pending',
        'resolved_merchant_paid',
        'resolved_buyer_refunded',
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
            'paid_pending_confirmation',
            'awaiting_merchant_confirmation',
            'escrow_locked',
            'disputed',
            'resolved_merchant_paid',
            'resolved_buyer_refunded',
            'failed',
        ]);
    }

    private function replaceConstraint(array $statuses): void
    {
        $quoted = collect($statuses)
            ->map(fn (string $status) => DB::getPdo()->quote($status))
            ->implode(', ');

        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ({$quoted}))");
    }
};
