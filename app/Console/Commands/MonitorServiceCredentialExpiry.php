<?php

namespace App\Console\Commands;

use App\Models\MerchantServiceCredential;
use App\Services\PlatformNotificationService;
use Illuminate\Console\Command;

class MonitorServiceCredentialExpiry extends Command
{
    protected $signature = 'service-credentials:monitor-expiry';

    protected $description = 'Expire service credentials and prepare reminder notifications before expiry.';

    public function __construct(private readonly PlatformNotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $expired = MerchantServiceCredential::query()
            ->where('status', 'verified')
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<', now()->toDateString())
            ->get();

        foreach ($expired as $credential) {
            $credential->update([
                'status' => 'expired',
                'expired_at' => now(),
                'rejection_reason' => 'Credential expired automatically.',
            ]);
        }

        $expiring = MerchantServiceCredential::query()
            ->with(['merchant.user'])
            ->where('status', 'verified')
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '>=', now()->toDateString())
            ->whereDate('expires_at', '<=', now()->addDays(30)->toDateString())
            ->where(function ($query) {
                $query->whereNull('last_expiry_reminder_at')
                    ->orWhere('last_expiry_reminder_at', '<=', now()->subDays(7));
            })
            ->orderBy('expires_at')
            ->limit(100)
            ->get();

        foreach ($expiring as $credential) {
            $merchant = $credential->merchant;
            $user = $merchant?->user;

            if ($user) {
                $this->notifications->dispatchToUser($user, [
                    'channels' => ['sms', 'whatsapp', 'email'],
                    'subject' => 'Takeer: Service credential expiring soon',
                    'message' => sprintf(
                        'Takeer: Leseni/cheti "%s" kwa %s kinaisha %s. Tafadhali upload cheti kipya ili huduma zako ziendelee kupokea booking.',
                        $credential->document_name,
                        $merchant->display_name ?: $merchant->username,
                        $credential->expires_at?->toDateString()
                    ),
                    'metadata' => [
                        'kind' => 'service_credential_expiry',
                        'credential_id' => $credential->id,
                    ],
                ]);
            }

            $credential->update(['last_expiry_reminder_at' => now()]);
        }

        $this->info("Expired {$expired->count()} credential(s); prepared {$expiring->count()} reminder(s).");

        return self::SUCCESS;
    }
}
