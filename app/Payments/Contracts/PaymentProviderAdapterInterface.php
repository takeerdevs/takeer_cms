<?php

namespace App\Payments\Contracts;

use App\Payments\PaymentEvent;
use App\Payments\PaymentResult;
use Illuminate\Http\Request;

interface PaymentProviderAdapterInterface
{
    public function key(): string;

    public function createPayin(array $payload): PaymentResult;

    public function createPayout(array $payload): PaymentResult;

    public function createRefund(array $payload): PaymentResult;

    public function queryRefundStatus(string $providerReference): PaymentEvent;

    public function verifyCallback(Request $request): bool;

    /** Verify the raw callback before any provider payload is trusted. */
    public function verifyRawCallback(Request $request): bool;

    public function parseCallback(Request $request): PaymentEvent;

    /** Parse only after verifyRawCallback() has succeeded. */
    public function parseVerifiedCallback(Request $request): PaymentEvent;

    public function queryStatus(string $providerReference): PaymentEvent;
}
