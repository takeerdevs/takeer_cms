<?php

namespace App\Services;

use App\Models\ProductImage;
use App\Models\Product;
use App\Models\PostMedia;
use Exception;
use FFMpeg\Coordinate\Dimension;
use FFMpeg\Format\Video\X264;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ProtoneMedia\LaravelFFMpeg\Support\FFMpeg;

class VideoProcessingService
{
    private const SOCIAL_MAX_EDGE = 720;
    private const SOCIAL_VIDEO_KBPS = 850;
    private const SOCIAL_AUDIO_KBPS = 64;
    private const SOCIAL_FPS = 30;

    public function processPremiumProductVideo(Product $product): array
    {
        $source = $this->resolvePrivateVideoSource($product->paid_video_url);

        if (!$source) {
            throw new Exception('Premium video source file was not found.');
        }

        [$diskName, $sourcePath] = $source;
        $opened = FFMpeg::fromDisk($diskName)->open($sourcePath);
        $duration = $this->safeDuration($opened);
        $dimensions = $this->safeDimensions($opened);

        $baseDir = 'premium-videos/processed/product_'.$product->id;
        $thumbnailPath = $baseDir.'/thumb.jpg';
        $hlsPath = $baseDir.'/hls/master.m3u8';

        $opened->getFrameFromSeconds($duration > 2 ? 1.5 : 0.2)
            ->export()
            ->toDisk($diskName)
            ->save($thumbnailPath);

        FFMpeg::fromDisk($diskName)
            ->open($sourcePath)
            ->exportForHLS()
            ->setSegmentLength(6)
            ->addFormat($this->hlsFormat(280, 48), function ($media) {
                $media->addFilter($this->scaleFilter(426).',fps=24');
            })
            ->addFormat($this->hlsFormat(650, 64), function ($media) {
                $media->addFilter($this->scaleFilter(540).',fps=30');
            })
            ->addFormat($this->hlsFormat(1100, 96), function ($media) {
                $media->addFilter($this->scaleFilter(720).',fps=30');
            })
            ->toDisk($diskName)
            ->save($hlsPath);

        return [
            'premium_video_hls_disk' => $diskName,
            'premium_video_hls_path' => $hlsPath,
            'premium_video_thumbnail_path' => $thumbnailPath,
            'paid_video_duration_seconds' => $duration ?: null,
            'premium_video_processed_at' => now(),
            'premium_video_status' => 'ready',
            'premium_video_error' => null,
        ];
    }

    public function processPromotableVideo(ProductImage $media): array
    {
        $source = $this->resolvePublicDiskPath($media->image_url);

        if (!$source || !Storage::disk('public')->exists($source)) {
            throw new Exception('Video source file was not found on the public disk.');
        }

        $opened = FFMpeg::fromDisk('public')->open($source);
        $duration = $this->safeDuration($opened);
        $dimensions = $this->safeDimensions($opened);

        $baseDir = 'processed/promotables/'.$media->product_id.'/'.$media->id;
        $thumbnailPath = $baseDir.'/thumb.jpg';
        $processedPath = $baseDir.'/playback_720.mp4';
        $hlsPath = $baseDir.'/hls/master.m3u8';

        $opened->getFrameFromSeconds($duration > 2 ? 1.5 : 0.2)
            ->export()
            ->toDisk('public')
            ->save($thumbnailPath);

        FFMpeg::fromDisk('public')
            ->open($source)
            ->export()
            ->toDisk('public')
            ->inFormat($this->socialMp4Format())
            ->save($processedPath);

        FFMpeg::fromDisk('public')
            ->open($source)
            ->exportForHLS()
            ->setSegmentLength(6)
            ->addFormat($this->hlsFormat(280, 48), function ($media) {
                $media->addFilter($this->scaleFilter(426).',fps=24');
            })
            ->addFormat($this->hlsFormat(850, 64), function ($media) {
                $media->addFilter($this->scaleFilter(720).',fps=30');
            })
            ->toDisk('public')
            ->save($hlsPath);

        return [
            'thumbnail_url' => Storage::disk('public')->url($thumbnailPath),
            'processed_url' => Storage::disk('public')->url($processedPath),
            'hls_url' => Storage::disk('public')->url($hlsPath),
            'mime' => 'video/mp4',
            'size' => Storage::disk('public')->size($processedPath),
            'duration_seconds' => $duration ?: null,
            'width' => $dimensions['width'],
            'height' => $dimensions['height'],
        ];
    }

    public function processPostMediaVideo(PostMedia $media): array
    {
        $source = $this->resolvePublicDiskPath($media->media_url);

        if (!$source || !Storage::disk('public')->exists($source)) {
            throw new Exception('Video source file was not found on the public disk.');
        }

        $opened = FFMpeg::fromDisk('public')->open($source);
        $duration = $this->safeDuration($opened);
        $dimensions = $this->safeDimensions($opened);

        $baseDir = 'processed/posts/'.$media->post_id.'/'.$media->id;
        $thumbnailPath = $baseDir.'/thumb.jpg';
        $processedPath = $baseDir.'/playback_720.mp4';

        $opened->getFrameFromSeconds($duration > 2 ? 1.5 : 0.2)
            ->export()
            ->toDisk('public')
            ->save($thumbnailPath);

        FFMpeg::fromDisk('public')
            ->open($source)
            ->export()
            ->toDisk('public')
            ->inFormat($this->socialMp4Format())
            ->save($processedPath);

        return [
            'thumbnail_url' => Storage::disk('public')->url($thumbnailPath),
            'processed_url' => Storage::disk('public')->url($processedPath),
            'hls_url' => null,
            'mime' => 'video/mp4',
            'size' => Storage::disk('public')->size($processedPath),
            'duration_seconds' => $duration ?: null,
            'width' => $dimensions['width'],
            'height' => $dimensions['height'],
        ];
    }

    private function socialMp4Format(): X264
    {
        return (new X264('aac'))
            ->setKiloBitrate(self::SOCIAL_VIDEO_KBPS)
            ->setAudioKiloBitrate(self::SOCIAL_AUDIO_KBPS)
            ->setAudioChannels(2)
            ->setAdditionalParameters([
                '-vf', $this->scaleFilter(self::SOCIAL_MAX_EDGE).',fps='.self::SOCIAL_FPS,
                '-preset', 'veryfast',
                '-profile:v', 'main',
                '-level', '3.1',
                '-pix_fmt', 'yuv420p',
                '-maxrate', '1100k',
                '-bufsize', '2200k',
                '-movflags', '+faststart',
                '-map_metadata', '-1',
            ]);
    }

    private function hlsFormat(int $videoKbps, int $audioKbps): X264
    {
        return (new X264('aac'))
            ->setKiloBitrate($videoKbps)
            ->setAudioKiloBitrate($audioKbps)
            ->setAudioChannels(2)
            ->setAdditionalParameters([
                '-preset', 'veryfast',
                '-profile:v', 'main',
                '-pix_fmt', 'yuv420p',
                '-sc_threshold', '0',
                '-map_metadata', '-1',
            ]);
    }

    private function scaleFilter(int $maxEdge): string
    {
        return "scale='if(gte(iw,ih),min({$maxEdge},iw),-2)':'if(gte(iw,ih),-2,min({$maxEdge},ih))'";
    }

    private function resolvePublicDiskPath(?string $url): ?string
    {
        $value = trim((string) $url);
        if ($value === '') {
            return null;
        }

        $path = parse_url($value, PHP_URL_PATH) ?: $value;
        $path = urldecode($path);
        $storagePrefix = '/storage/';

        if (str_contains($path, $storagePrefix)) {
            return ltrim(Str::after($path, $storagePrefix), '/');
        }

        return ltrim($path, '/');
    }

    private function resolvePrivateVideoSource(?string $url): ?array
    {
        $value = trim((string) $url);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $value)) {
            return null;
        }

        $path = preg_replace('/^private:\/\//', '', $value);
        $path = ltrim((string) $path, '/');

        foreach (['s3', 'local'] as $diskName) {
            try {
                if (Storage::disk($diskName)->exists($path)) {
                    return [$diskName, $path];
                }
            } catch (Exception) {
                // Disk may not be configured in local development.
            }
        }

        return null;
    }

    private function safeDuration($media): ?int
    {
        try {
            return max(0, (int) $media->getDurationInSeconds());
        } catch (Exception) {
            return null;
        }
    }

    private function safeDimensions($media): array
    {
        try {
            $stream = $media->getVideoStream();
            if (!$stream) {
                return ['width' => null, 'height' => null];
            }

            /** @var Dimension $dimensions */
            $dimensions = $stream->getDimensions();

            return [
                'width' => (int) $dimensions->getWidth(),
                'height' => (int) $dimensions->getHeight(),
            ];
        } catch (Exception) {
            return ['width' => null, 'height' => null];
        }
    }
}
