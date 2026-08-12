<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Http\Request;
use RuntimeException;

class MerchantSellingReadinessService
{
    public function __construct(
        private readonly LegalAcceptanceService $legalAcceptance,
    ) {
    }

    /**
     * Check the prerequisites for opening the seller upload flow or publishing.
     * KYC is intentionally evaluated before merchant legal acceptance.
     *
     * @param bool $requireKyc Whether the action also creates a sellable/paid offer.
     * @return array{ready: bool, step: ?string, message: ?string, verification_url: string}
     */
    public function check(User $user, Merchant $merchant, bool $requireKyc = true): array
    {
        $kycUrl = "/merchant/{$merchant->username}/kyc";
        $legalUrl = '/legal';

        if ($requireKyc && ! $merchant->canSellProducts()) {
            return [
                'ready' => false,
                'step' => 'kyc',
                'message' => 'Complete KYC before uploading or publishing products.',
                'verification_url' => $kycUrl,
            ];
        }

        try {
            $this->legalAcceptance->assertMerchantReady($user, (int) $merchant->id);
        } catch (RuntimeException $exception) {
            return [
                'ready' => false,
                'step' => 'legal',
                'message' => $exception->getMessage(),
                'verification_url' => $legalUrl,
            ];
        }

        return [
            'ready' => true,
            'step' => null,
            'message' => null,
            'verification_url' => $legalUrl,
        ];
    }

    public function acceptIfRequested(User $user, Request $request, Merchant $merchant): void
    {
        if ($request->boolean('accept_merchant_terms')) {
            $this->legalAcceptance->acceptMerchant($user, $request, (int) $merchant->id);
        }
    }
}
