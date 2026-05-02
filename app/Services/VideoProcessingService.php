<?php

namespace App\Services;

use App\Models\ProductImage;
use Exception;
use FFMpeg\Coordinate\Dimension;
use FFMpeg\Format\Video\X264;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ProtoneMedia\LaravelFFMpeg\Support\FFMpeg;

class VideoProcessingService
{
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
        $processedPath = $baseDir.'/playback.mp4';
        $hlsPath = $baseDir.'/hls/master.m3u8';

        $opened->getFrameFromSeconds($duration > 2 ? 1.5 : 0.2)
            ->export()
            ->toDisk('public')
            ->save($thumbnailPath);

        FFMpeg::fromDisk('public')
            ->open($source)
            ->export()
            ->toDisk('public')
            ->inFormat((new X264('aac'))->setKiloBitrate(1200))
            ->save($processedPath);

        FFMpeg::fromDisk('public')
            ->open($source)
            ->exportForHLS()
            ->setSegmentLength(6)
            ->addFormat((new X264('aac'))->setKiloBitrate(450), function ($media) {
                $media->scale(640, 360);
            })
            ->addFormat((new X264('aac'))->setKiloBitrate(1200), function ($media) {
                $media->scale(1280, 720);
            })
            ->toDisk('public')
            ->save($hlsPath);

        return [
            'thumbnail_url' => Storage::disk('public')->url($thumbnailPath),
            'processed_url' => Storage::disk('public')->url($processedPath),
            'hls_url' => Storage::disk('public')->url($hlsPath),
            'duration_seconds' => $duration ?: null,
            'width' => $dimensions['width'],
            'height' => $dimensions['height'],
        ];
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
