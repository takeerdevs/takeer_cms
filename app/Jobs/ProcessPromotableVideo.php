<?php

namespace App\Jobs;

use App\Models\PostMedia;
use App\Models\ProductImage;
use App\Services\VideoProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessPromotableVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 1200;

    public function __construct(
        public int $productImageId,
        public ?int $postMediaId = null,
    ) {
        $this->onQueue('media');
    }

    public function handle(VideoProcessingService $processor): void
    {
        $media = ProductImage::find($this->productImageId);
        if (!$media || $media->media_type !== 'video') {
            return;
        }

        $media->update([
            'processing_status' => 'processing',
            'processing_error' => null,
        ]);

        $result = $processor->processPromotableVideo($media);

        $payload = [
            ...$result,
            'processing_status' => 'ready',
            'processing_error' => null,
        ];

        $media->update($payload);

        if ($this->postMediaId) {
            PostMedia::whereKey($this->postMediaId)->update($payload);
        }
    }

    public function failed(?Throwable $exception): void
    {
        $message = $exception?->getMessage() ?: 'Video processing failed.';
        $payload = [
            'processing_status' => 'failed',
            'processing_error' => $message,
        ];

        ProductImage::whereKey($this->productImageId)->update($payload);

        if ($this->postMediaId) {
            PostMedia::whereKey($this->postMediaId)->update($payload);
        }
    }
}
