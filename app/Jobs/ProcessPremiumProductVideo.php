<?php

namespace App\Jobs;

use App\Models\Product;
use App\Services\VideoProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessPremiumProductVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 1800;

    public function __construct(public int $productId)
    {
        $this->onQueue('media');
    }

    public function handle(VideoProcessingService $processor): void
    {
        $product = Product::find($this->productId);
        if (!$product || !$product->isDigital() || ($product->digital_delivery_type ?? 'file') !== 'video_stream') {
            return;
        }

        if (!$product->paid_video_url || $product->premium_video_status === 'ready') {
            return;
        }

        $product->update([
            'premium_video_status' => 'processing',
            'premium_video_error' => null,
        ]);

        $product->update($processor->processPremiumProductVideo($product));
    }

    public function failed(?Throwable $exception): void
    {
        Product::whereKey($this->productId)->update([
            'premium_video_status' => 'failed',
            'premium_video_error' => $exception?->getMessage() ?: 'Premium video processing failed.',
        ]);
    }
}
