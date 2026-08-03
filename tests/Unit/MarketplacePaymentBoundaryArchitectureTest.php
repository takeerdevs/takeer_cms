<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class MarketplacePaymentBoundaryArchitectureTest extends TestCase
{
    public function test_prohibited_money_movement_components_are_deleted(): void
    {
        foreach ([
            'app/Models/Wallet.php',
            'app/Models/WithdrawalRequest.php',
            'app/Models/ProviderTreasuryAccount.php',
            'app/Models/ProviderTreasuryReservation.php',
            'app/Services/WalletService.php',
            'app/Services/AutomaticWithdrawalService.php',
            'app/Services/WithdrawalPolicyService.php',
            'app/Services/ProviderTreasuryService.php',
            'app/Http/Controllers/Api/MerchantWalletController.php',
            'app/Http/Controllers/Api/MerchantPayoutCredentialController.php',
            'app/Http/Controllers/Api/PaymentWebhookController.php',
        ] as $relativePath) {
            $this->assertFileDoesNotExist(dirname(__DIR__, 2) . '/' . $relativePath, $relativePath . ' must remain deleted.');
        }
    }

    public function test_payment_boundary_routes_and_processors_do_not_reference_deleted_features(): void
    {
        $root = dirname(__DIR__, 2);
        $sources = [
            file_get_contents($root . '/routes/api.php'),
            file_get_contents($root . '/routes/web.php'),
            file_get_contents($root . '/app/Payments/PaymentCallbackProcessor.php'),
            file_get_contents($root . '/app/Services/MarketplaceSettlementService.php'),
            file_get_contents($root . '/app/Jobs/SubmitProviderPayout.php'),
            file_get_contents($root . '/app/Jobs/SubmitProviderRefund.php'),
        ];
        $source = implode("\n", $sources);

        foreach ([
            'WalletService',
            'WithdrawalRequest',
            'ProviderTreasury',
            'frozen_balance',
            'takeer_wallet',
            'BuyerEscrowController',
        ] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $source, $forbidden . ' must not be part of the active payment boundary.');
        }

        $this->assertStringContainsString("Route::post('/legal/acceptances'", file_get_contents($root . '/routes/api.php'));
        $this->assertStringContainsString("'accept_terms' => ['required', 'accepted']", file_get_contents($root . '/app/Http/Requests/Checkout/CheckoutRequest.php'));
    }

    public function test_pickup_penalties_do_not_create_takeer_money_movements(): void
    {
        $root = dirname(__DIR__, 2);
        $pickupService = file_get_contents($root . '/app/Services/PickupAgreementService.php');
        $settlementService = file_get_contents($root . '/app/Services/MarketplaceSettlementService.php');
        $adminController = file_get_contents($root . '/app/Http/Controllers/Api/AdminController.php');

        $this->assertStringNotContainsString('Transaction', $pickupService);
        $this->assertStringNotContainsString('releaseAfterFulfillment', $pickupService);
        $this->assertStringContainsString('pickup_cancellation_refund', $adminController);
        $this->assertStringContainsString('$requestedAmountMinor', $settlementService);
        $this->assertStringContainsString('close_after_refund', $adminController);
    }

    public function test_clean_schema_migration_contains_order_specific_provider_records(): void
    {
        $migration = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/2026_08_03_000001_create_marketplace_payment_boundary_tables.php');

        foreach ([
            'marketplace_seller_payment_profiles',
            'payment_attempts',
            'provider_events',
            'order_settlements',
            'provider_payouts',
            'provider_payout_allocations',
            'provider_refunds',
            'provider_reconciliation_runs',
            'provider_reconciliation_breaks',
        ] as $table) {
            $this->assertStringContainsString("Schema::create('{$table}'", $migration);
        }

        foreach (['wallets', 'withdrawal_requests', 'provider_treasury_accounts', 'provider_treasury_reservations'] as $prohibitedTable) {
            $this->assertStringNotContainsString("Schema::create('{$prohibitedTable}'", $migration);
        }
    }
}
