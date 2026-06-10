<?php

namespace App\Services;

use App\Models\WithdrawalRequest;
use App\Models\ProviderTreasuryAccount;
use App\Payments\Drivers\Selcom\SelcomGateway;
use App\Payments\PaymentResult;
use Illuminate\Support\Facades\DB;

class SelcomPayoutService
{
    public function __construct(private readonly SelcomGateway $selcom)
    {
    }

    public function shouldHandle(WithdrawalRequest $withdrawal): bool
    {
        $withdrawal->loadMissing(['paymentProvider', 'paymentProviderChannel.provider', 'payoutCredential.channel.provider']);

        return ($withdrawal->paymentProvider?->key === 'selcom')
            || ($withdrawal->paymentProviderChannel?->provider?->key === 'selcom')
            || ($withdrawal->payoutCredential?->channel?->provider?->key === 'selcom');
    }

    public function submit(WithdrawalRequest $withdrawal): PaymentResult
    {
        $withdrawal->loadMissing(['paymentProviderChannel.provider', 'payoutCredential.channel.provider', 'merchant.user']);
        $channel = $withdrawal->paymentProviderChannel ?: $withdrawal->payoutCredential?->channel;
        $credential = $withdrawal->payoutCredential;

        if (! $channel || ! $credential) {
            return PaymentResult::failure('This withdrawal needs a saved Selcom payout credential before it can be sent.', 'missing_payout_credential');
        }

        $takeerReference = 'WDR' . $withdrawal->id . now()->format('His');
        $result = $this->selcom->createPayout([
            'takeer_reference' => $takeerReference,
            'method' => $channel->method,
            'network' => $credential->network,
            'amount' => $withdrawal->payout_amount ?? $withdrawal->amount,
            'currency' => $withdrawal->payout_currency_code ?: $credential->currency_code,
            'details' => $credential->details_encrypted ?: [],
            'narration' => 'Takeer withdrawal #' . $withdrawal->id,
        ]);

        $snapshot = $withdrawal->payout_snapshot ?: [];
        $snapshot['provider'] = 'selcom';
        $snapshot['provider_takeer_reference'] = $takeerReference;
        $snapshot['provider_reference'] = $result->gatewayRef;
        $snapshot['provider_response'] = $result->raw;
        $snapshot['provider_submitted_at'] = now()->toISOString();

        DB::transaction(function () use ($withdrawal, $result, $snapshot) {
            $withdrawal->update([
                'status' => ($result->raw['simulated'] ?? false)
                    ? 'approved'
                    : ($result->success ? 'processing' : 'pending'),
                'payout_snapshot' => $snapshot,
            ]);

            if ($result->success) {
                app(WithdrawalAccountingService::class)->recordSubmitted($withdrawal->fresh());
                if (($result->raw['simulated'] ?? false) || (string) ($result->raw['resultcode'] ?? '') === '000') {
                    app(ProviderTreasuryService::class)->captureWithdrawal($withdrawal->fresh());
                }
            }
        });

        return $result;
    }

    public function syncTreasuryAccount(ProviderTreasuryAccount $account): PaymentResult
    {
        $result = $this->selcom->queryVendorBalance();

        if (! $result->success) {
            return $result;
        }

        $balance = data_get($result->raw, 'balance');

        if ($balance === null || $balance === '') {
            return PaymentResult::failure('Selcom did not return a usable vendor balance.', 'selcom_balance_missing', $result->raw);
        }

        app(ProviderTreasuryService::class)->syncAccountBalance($account, (float) $balance, 'selcom_vendor_balance', [
            'provider_response' => $result->raw,
        ]);

        return $result;
    }
}
