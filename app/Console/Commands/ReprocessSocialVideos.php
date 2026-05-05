<?php

namespace App\Console\Commands;

use App\Jobs\ProcessPostMediaVideo;
use App\Jobs\ProcessPromotableVideo;
use App\Models\PostMedia;
use App\Models\ProductImage;
use Illuminate\Console\Command;

class ReprocessSocialVideos extends Command
{
    protected $signature = 'media:reprocess-social-videos {--force : Reprocess videos even when a processed MP4 already exists}';

    protected $description = 'Queue social/feed videos for the compressed 720p MP4 playback profile.';

    public function handle(): int
    {
        $force = (bool) $this->option('force');
        $queued = 0;

        ProductImage::query()
            ->where('media_type', 'video')
            ->when(!$force, fn ($query) => $query->whereNull('processed_url'))
            ->select(['id'])
            ->chunkById(100, function ($items) use (&$queued) {
                foreach ($items as $item) {
                    ProcessPromotableVideo::dispatch($item->id);
                    $queued++;
                }
            });

        PostMedia::query()
            ->where('media_type', 'video')
            ->whereNull('product_image_id')
            ->when(!$force, fn ($query) => $query->whereNull('processed_url'))
            ->select(['id'])
            ->chunkById(100, function ($items) use (&$queued) {
                foreach ($items as $item) {
                    ProcessPostMediaVideo::dispatch($item->id);
                    $queued++;
                }
            });

        $this->info("Queued {$queued} social video processing job(s).");

        return self::SUCCESS;
    }
}
