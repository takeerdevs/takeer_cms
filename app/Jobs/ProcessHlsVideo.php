<?php

namespace App\Jobs;

use App\Models\Post;
use FFMpeg\Format\Video\X264;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use ProtoneMedia\LaravelFFMpeg\Support\FFMpeg;
use Illuminate\Support\Facades\Storage;

class ProcessHlsVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The maximum number of unhandled exceptions to allow before failing.
     */
    public $maxExceptions = 1;

    public function __construct(public Post $post)
    {
        $this->onQueue('media');
    }

    public function handle(): void
    {
        // Skip if not a video or if already has HLS
        if ($this->post->media_type !== 'video' || $this->post->hls_url) {
            return;
        }

        // We assume media_url stores raw public disk path like 'feed/raw/vid.mp4'
        $rawPath = $this->post->media_url;

        // Output directory on the public disk
        $outputDir = 'feed/hls/post_' . $this->post->id;
        $m3u8Name = 'playlist.m3u8';
        $fullPath = $outputDir . '/' . $m3u8Name;

        // Define adaptive bitrates for East African networks
        // 360p (Data Saver) and 720p (WiFi)
        $lowBitrate = (new X264)->setKiloBitrate(250);
        $midBitrate = (new X264)->setKiloBitrate(1000);

        FFMpeg::fromDisk('public')
            ->open($rawPath)
            ->exportForHLS()
            ->withRotatingEncryptionKey(function ($filename, $contents) {
                Storage::disk('public')->put("feed/keys/$filename", $contents);
            }) // Optional encryption for payload protection
            ->addFormat($lowBitrate, function ($media) {
                $media->scale(640, 360);
            })
            ->addFormat($midBitrate, function ($media) {
                $media->scale(1280, 720);
            })
            ->toDisk('public')
            ->save($fullPath);

        // Update the database record with the final chunked m3u8 playlist URL
        $this->post->update([
            'hls_url' => Storage::disk('public')->url($fullPath)
        ]);

        // Cleanup the raw mp4 file to save S3 storage costs
        Storage::disk('public')->delete($rawPath);
    }
}
