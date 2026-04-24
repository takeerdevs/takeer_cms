<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Payments\Drivers\Flutterwave\FlutterwaveGateway;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class TestFlutterwaveTanzania extends Command
{
    protected $signature = 'test:flutterwave {phone} {amount=1500}';
    protected $description = 'Trigger a Flutterwave MNO sandbox payment for Tanzania';

    public function handle()
    {
        $phone = $this->argument('phone');
        $amount = $this->argument('amount');

        $this->info("🚀 Testing Flutterwave TZ MNO for Phone: {$phone}, Amount: {$amount}");

        // 1. Setup a dummy buyer
        $buyer = User::firstOrCreate(
            ['phone_number' => $phone],
            ['name' => 'Flw Tester', 'email' => 'flw_tester@example.com']
        );

        // 2. Setup a dummy product & order
        $product = Product::first() ?? Product::factory()->create();
        
        $order = Order::create([
            'buyer_id'         => $buyer->id,
            'merchant_id'      => $product->merchant_id,
            'purchasable_type' => 'product',
            'purchasable_id'   => $product->id,
            'order_kind'       => 'one_time',
            'quantity'         => 1,
            'unit_price'       => $amount,
            'total_paid'       => $amount,
            'payment_status'   => 'pending',
            'transaction_ref'  => 'TEST-FLW-' . Str::upper(Str::random(10)),
            'payment_gateway'  => 'flutterwave',
            'country_code'     => 'TZ',
            'idempotency_key'  => Str::uuid(),
        ]);

        $this->info("🛒 Created Order #{$order->id} with Ref: {$order->transaction_ref}");

        // 3. Initiate payment
        $gateway = app(FlutterwaveGateway::class);
        $result = $gateway->initiate($order, [
            'payment_number' => $phone,
            'buyer_name'     => $buyer->name,
        ]);

        if ($result->success) {
            $this->warn("✅ SUCCESS: {$result->message}");
            $this->info("Gateway Ref: {$result->gatewayRef}");
        } else {
            $this->error("❌ FAILED: {$result->message}");
            $this->error("Code: {$result->errorCode}");
            $this->line(json_encode($result->raw, JSON_PRETTY_PRINT));
        }

        return 0;
    }
}
