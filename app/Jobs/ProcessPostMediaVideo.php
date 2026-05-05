<?php

namespace App\Jobs;

use App\Models\PostMedia;
use App\Services\VideoProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessPostMediaVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 1200;

    public function __construct(public int $postMediaId)
    {
        $this->onQueue('media');
    }

    public function handle(VideoProcessingService $processor): void
    {
        $media = PostMedia::find($this->postMediaId);
        if (!$media || $media->media_type !== 'video') {
            return;
        }

        $media->update([
            'processing_status' => 'processing',
            'processing_error' => null,
        ]);

        $media->update([
            ...$processor->processPostMediaVideo($media),
            'processing_status' => 'ready',
            'processing_error' => null,
        ]);
    }

    public function failed(?Throwable $exception): void
    {
        PostMedia::whereKey($this->postMediaId)->update([
            'processing_status' => 'failed',
            'processing_error' => $exception?->getMessage() ?: 'Video processing failed.',
        ]);
    }
}
