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
    }

    public function handle(): void
    {
        // Skip if not a video or if already has HLS
        if ($this->post->media_type !== 'video' || $this->post->hls_url) {
            return;
        }

        // We assume media_url stores raw s3 path like 'feed/raw/vid.mp4'
        $rawPath = $this->post->media_url;

        // Output directory on S3
        $outputDir = 'feed/hls/post_' . $this->post->id;
        $m3u8Name = 'playlist.m3u8';
        $fullPath = $outputDir . '/' . $m3u8Name;

        // Define adaptive bitrates for East African networks
        // 360p (Data Saver) and 720p (WiFi)
        $lowBitrate = (new X264)->setKiloBitrate(250);
        $midBitrate = (new X264)->setKiloBitrate(1000);

        FFMpeg::fromDisk('s3')
            ->open($rawPath)
            ->exportForHLS()
            ->withRotatingEncryptionKey(function ($filename, $contents) {
                Storage::disk('s3')->put("feed/keys/$filename", $contents);
            }) // Optional encryption for payload protection
            ->addFormat($lowBitrate, function ($media) {
                $media->scale(640, 360);
            })
            ->addFormat($midBitrate, function ($media) {
                $media->scale(1280, 720);
            })
            ->toDisk('s3')
            ->save($fullPath);

        // Update the database record with the final chunked m3u8 playlist URL
        $this->post->update([
            'hls_url' => Storage::disk('s3')->url($fullPath)
        ]);

        // Cleanup the raw mp4 file to save S3 storage costs
        Storage::disk('s3')->delete($rawPath);
    }
}
