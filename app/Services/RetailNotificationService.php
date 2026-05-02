<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\User;
use App\Models\NotificationLog;
use Illuminate\Support\Facades\Log;

class RetailNotificationService
{
    /**
     * Send a notification to a staff member or owner.
     * Stubbed for future Beem Africa integration.
     */
    public function notify(User $user, string $message, array $metadata = []): void
    {
        // 1. Log to Database for history
        NotificationLog::create([
            'user_id' => $user->id,
            'type' => 'RETAIL_ALERT',
            'title' => 'Retail Ops Alert',
            'body' => $message,
            'metadata' => $metadata,
            'sent_at' => now(),
        ]);

        // 2. Log to System Log for debugging
        Log::info("RETAIL_NOTIFICATION to User {$user->id}: {$message}", $metadata);

        // 3. TODO: Wire Beem Africa API here
        // $this->sendSmsViaBeem($user->phone_number, $message);
    }

    /**
     * Notify about low stock.
     */
    public function notifyLowStock(Merchant $merchant, string $productTitle, int $remaining): void
    {
        $message = "Low Stock Alert: {$productTitle} only has {$remaining} units remaining.";
        $this->notify($merchant->user, $message, ['product' => $productTitle]);
    }
}
