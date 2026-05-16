<?php

namespace App\Jobs;

use App\Models\FiscalReceipt;
use App\Services\FiscalReceiptService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class IssueFiscalReceipt implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(public int $fiscalReceiptId)
    {
        $this->onQueue('fiscal');
    }

    public function handle(FiscalReceiptService $service): void
    {
        $receipt = FiscalReceipt::with('integration.provider')->find($this->fiscalReceiptId);

        if (!$receipt || $receipt->status === 'issued' || !$receipt->integration) {
            return;
        }

        $service->attemptIssue($receipt, $receipt->integration);
    }

    public function failed(?Throwable $exception): void
    {
        FiscalReceipt::whereKey($this->fiscalReceiptId)->update([
            'status' => 'failed',
            'failure_reason' => $exception?->getMessage() ?: 'Fiscal receipt job failed.',
            'last_attempted_at' => now(),
        ]);
    }
}
