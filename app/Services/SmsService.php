<?php

namespace App\Services;

use App\Models\NotificationLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    private string $apiKey;
    private string $secretKey;
    private string $senderId;
    private string $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.beem_africa.api_key', '');
        $this->secretKey = config('services.beem_africa.secret_key', '');
        $this->senderId = config('services.beem_africa.sender_id', 'TAKEER');
        $this->baseUrl = 'https://apisms.beem.africa/v1/send';
    }

    /**
     * Send an SMS to a phone number.
     *
     * @param string $phone   Recipient phone (e.g. +255712345678)
     * @param string $message SMS body
     * @param int|null $userId  FK to users table for logging
     * @return bool           Whether the send was successful
     */
    public function send(string $phone, string $message, ?int $userId = null, ?string $dedupeKey = null): bool
    {
        try {
            $response = Http::withBasicAuth($this->apiKey, $this->secretKey)
                ->timeout(10)
                ->post($this->baseUrl, [
                    'source_addr' => $this->senderId,
                    'schedule_time' => '',
                    'encoding' => '0',
                    'message' => $message,
                    'recipients' => [
                        ['recipient_id' => '1', 'dest_addr' => $phone],
                    ],
                ]);

            $success = $response->successful() && ($response->json('successful') ?? false);

            $this->log($phone, $message, $userId, $success ? 'sent' : 'failed', $response->body(), $dedupeKey);

            return $success;
        } catch (\Throwable $e) {
            Log::error('SmsService::send failed', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);
            $this->log($phone, $message, $userId, 'failed', $e->getMessage(), $dedupeKey);
            return false;
        }
    }

    /**
     * Send OTP SMS. Template: "Takeer: Your verification code is 1234. Valid for 5 minutes."
     */
    public function sendOtp(string $phone, string $otp, ?int $userId = null): bool
    {
        $message = "Takeer: Msimbo wako wa uthibitisho ni {$otp}. Unaisha baada ya dakika 5.";
        return $this->send($phone, $message, $userId);
    }

    /**
     * Send order notification to merchant.
     */
    public function sendOrderNotification(string $phone, string $orderId, ?int $userId = null): bool
    {
        $message = "Takeer: Agizo jipya #{$orderId}! Tafadhali tuma na pakia video ya uthibitisho.";
        return $this->send($phone, $message, $userId);
    }

    public function sendPhysicalQuoteReady(string $phone, string $orderPublicId, float $total, ?int $userId = null): bool
    {
        $amount = number_format($total);
        $message = "Takeer: Muuzaji ameweka offer ya order #{$orderPublicId}. Jumla ni TZS {$amount}. Fungua chat kukubali na kulipia.";
        return $this->sendOnce("physical-quote-ready:{$orderPublicId}", $phone, $message, $userId);
    }

    public function sendPhysicalPaymentHeldToBuyer(string $phone, string $orderPublicId, float $total, ?int $userId = null): bool
    {
        $amount = number_format($total);
        $message = "Takeer: Malipo ya order #{$orderPublicId} TZS {$amount} yameshikiliwa SafePay. Muuzaji sasa atatuma mzigo au kuthibitisha pickup.";
        return $this->sendOnce("physical-payment-held-buyer:{$orderPublicId}", $phone, $message, $userId);
    }

    public function sendPhysicalPaymentHeldToMerchant(string $phone, string $orderPublicId, float $total, ?int $userId = null): bool
    {
        $amount = number_format($total);
        $message = "Takeer: Mteja amelipia order #{$orderPublicId}. TZS {$amount} iko SafePay. Pakia ushahidi wa dispatch au thibitisha Pickup PIN.";
        return $this->sendOnce("physical-payment-held-merchant:{$orderPublicId}", $phone, $message, $userId);
    }

    /**
     * Send digital/service link to buyer.
     */
    public function sendDigitalDeliveryNotification(string $phone, string $productTitle, string $url, ?int $userId = null): bool
    {
        $deliveryTarget = $url;

        // Private storage refs are not directly usable in SMS. Point buyers to their in-app Library.
        if ($this->isPrivateStorageReference($url)) {
            $deliveryTarget = rtrim((string) config('app.url', ''), '/') . '/orders';
        }

        $message = "Takeer: Asante! Umefanikiwa kulipia {$productTitle}. Hii hapa link yako: {$deliveryTarget}";
        return $this->send($phone, $message, $userId);
    }

    /**
     * Send dispatch notification to buyer.
     */
    public function sendDispatchNotification(string $phone, string $busName, string $tracking, string $pin, ?int $userId = null): bool
    {
        $message = "Takeer: Bidhaa yako iko kwenye {$busName}. Nambari ya kufuatilia: {$tracking}. Tumia PIN {$pin} kupokea bidhaa kwenye counter.";
        return $this->send($phone, $message, $userId);
    }

    public function sendIntercityDispatchNotification(string $phone, string $orderPublicId, string $busName, string $tracking, string $pin, ?int $userId = null): bool
    {
        $message = "Takeer: Order #{$orderPublicId} iko kwenye {$busName}. Tracking: {$tracking}. Tumia PIN {$pin} kupokea mzigo kwenye counter baada ya kukagua.";
        return $this->sendOnce("physical-intercity-dispatch:{$orderPublicId}", $phone, $message, $userId);
    }

    public function sendLocalDispatchNotification(string $phone, string $orderPublicId, string $pin, ?string $bodaPhone = null, ?int $userId = null): bool
    {
        $boda = $bodaPhone ? " Rider: {$bodaPhone}." : '';
        $message = "Takeer: Order #{$orderPublicId} imetumwa kwa local delivery.{$boda} Mpe dereva PIN {$pin} baada ya kukagua mzigo.";
        return $this->sendOnce("physical-local-dispatch:{$orderPublicId}", $phone, $message, $userId);
    }

    public function sendPickupPinToBuyer(string $phone, string $orderPublicId, string $pin, ?int $userId = null): bool
    {
        $message = "Takeer: Pickup PIN ya order #{$orderPublicId} ni {$pin}. Mpe muuzaji PIN hii tu baada ya kupokea mzigo.";
        return $this->sendOnce("physical-pickup-pin:{$orderPublicId}", $phone, $message, $userId);
    }

    public function sendOrderCompletedToBuyer(string $phone, string $orderPublicId, ?int $userId = null): bool
    {
        $message = "Takeer: Asante! Order #{$orderPublicId} imekamilika. Unaweza kutoa review kwenye app.";
        return $this->sendOnce("physical-completed-buyer:{$orderPublicId}", $phone, $message, $userId);
    }

    public function sendMerchantPayoutReleased(string $phone, string $orderPublicId, float $netAmount, ?int $userId = null): bool
    {
        $amount = number_format($netAmount);
        $message = "Takeer: Malipo ya order #{$orderPublicId} yametolewa. TZS {$amount} imeingia kwenye wallet yako.";
        return $this->sendOnce("physical-payout-released:{$orderPublicId}", $phone, $message, $userId);
    }

    /**
     * Resend buyer release PIN.
     */
    public function resendPin(string $phone, string $pin, ?int $userId = null): bool
    {
        $message = "Takeer: PIN yako ya kupokea bidhaa ni {$pin}. Usishirikishe mtu yeyote.";
        return $this->send($phone, $message, $userId);
    }

    private function sendOnce(string $dedupeKey, string $phone, string $message, ?int $userId = null): bool
    {
        $alreadySent = NotificationLog::query()
            ->where('channel', 'sms')
            ->where('dedupe_key', $dedupeKey)
            ->where('status', 'sent')
            ->exists();

        if ($alreadySent) {
            return true;
        }

        return $this->send($phone, $message, $userId, $dedupeKey);
    }

    private function log(string $phone, string $message, ?int $userId, string $status, ?string $errorMessage = null, ?string $dedupeKey = null): void
    {
        try {
            $payload = [
                'user_id' => $userId,
                'channel' => 'sms',
                'recipient' => $phone,
                'phone' => $phone,
                'message' => $message,
                'status' => $status,
                'error_message' => $status === 'failed' ? substr($errorMessage ?? '', 0, 500) : null,
                'gateway' => 'beem_africa',
                'dedupe_key' => $dedupeKey,
            ];

            if ($dedupeKey) {
                NotificationLog::updateOrCreate(
                    ['channel' => 'sms', 'dedupe_key' => $dedupeKey],
                    $payload
                );
                return;
            }

            NotificationLog::create($payload);
        } catch (\Throwable $e) {
            Log::warning('SmsService: Failed to write notification log', ['error' => $e->getMessage()]);
        }
    }

    private function isPrivateStorageReference(?string $value): bool
    {
        $target = trim((string) $value);

        if ($target === '') {
            return false;
        }

        if (str_starts_with($target, 'private://')) {
            return true;
        }

        // Legacy private uploads were stored as plain relative paths.
        if (!preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $target) && str_contains($target, '/')) {
            return true;
        }

        return false;
    }
}
