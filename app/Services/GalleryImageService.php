<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GalleryImageService
{
    private const PREVIEW_MAX_EDGE = 1600;
    private const PREVIEW_QUALITY = 82;

    public function prepareItem(array $item, string $watermarkText): array
    {
        $url = $this->normalizePrivateUrl((string) ($item['url'] ?? ''));
        $prepared = [
            'url' => $url,
            'preview_url' => $this->normalizePrivateUrl((string) ($item['preview_url'] ?? '')),
            'name' => $item['name'] ?? null,
            'mime' => $item['mime'] ?? null,
            'size' => $item['size'] ?? null,
            'preview_mime' => $item['preview_mime'] ?? null,
            'preview_size' => $item['preview_size'] ?? null,
        ];

        if ($prepared['url'] === '' || $prepared['preview_url'] !== '') {
            return $prepared;
        }

        [$diskName, $path] = $this->findPrivateFile($prepared['url']);
        if (!$diskName || !$path) {
            return $prepared;
        }

        try {
            $disk = Storage::disk($diskName);
            $contents = $disk->get($path);
            $preview = $this->makePreview($contents, $watermarkText);
            if (!$preview) {
                return $prepared;
            }

            $previewPath = 'premium-gallery/previews/'.md5($path.'|'.$watermarkText).'.webp';
            if ($diskName === 's3') {
                $disk->put($previewPath, $preview, 'private');
            } else {
                $disk->put($previewPath, $preview);
            }

            $prepared['preview_url'] = "private://{$previewPath}";
            $prepared['preview_mime'] = 'image/webp';
            $prepared['preview_size'] = strlen($preview);
        } catch (\Throwable $e) {
            Log::warning('Failed to generate gallery preview', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
        }

        return $prepared;
    }

    private function normalizePrivateUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '' || preg_match('/^https?:\/\//i', $url)) {
            return $url;
        }

        return str_starts_with($url, 'private://') ? $url : "private://{$url}";
    }

    /**
     * @return array{0: string|null, 1: string|null}
     */
    private function findPrivateFile(string $url): array
    {
        $path = ltrim(Str::after($url, 'private://'), '/');
        if ($path === '' || $path === $url) {
            return [null, null];
        }

        foreach (['s3', 'local'] as $diskName) {
            try {
                if (Storage::disk($diskName)->exists($path)) {
                    return [$diskName, $path];
                }
            } catch (\Throwable) {
                // Disk may not be configured locally.
            }
        }

        return [null, null];
    }

    private function makePreview(string $contents, string $watermarkText): ?string
    {
        if (!function_exists('imagecreatefromstring') || !function_exists('imagewebp')) {
            return null;
        }

        $source = @imagecreatefromstring($contents);
        if (!$source) {
            return null;
        }

        $width = imagesx($source);
        $height = imagesy($source);
        if ($width <= 0 || $height <= 0) {
            imagedestroy($source);
            return null;
        }

        $scale = min(1, self::PREVIEW_MAX_EDGE / max($width, $height));
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));

        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        imagealphablending($canvas, true);
        imagesavealpha($canvas, true);
        imagecopyresampled($canvas, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
        imagedestroy($source);

        $this->drawWatermark($canvas, trim($watermarkText) ?: 'Takeer');

        ob_start();
        imagewebp($canvas, null, self::PREVIEW_QUALITY);
        $preview = ob_get_clean();
        imagedestroy($canvas);

        return is_string($preview) && $preview !== '' ? $preview : null;
    }

    private function drawWatermark(\GdImage $image, string $text): void
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $font = 5;
        $text = Str::limit($text, 48, '');
        $textWidth = imagefontwidth($font) * strlen($text);
        $textHeight = imagefontheight($font);
        $padding = max(12, (int) round(min($width, $height) * 0.018));
        $x = max($padding, $width - $textWidth - ($padding * 2));
        $y = max($padding, $height - $textHeight - ($padding * 2));

        $shadow = imagecolorallocatealpha($image, 0, 0, 0, 45);
        $white = imagecolorallocatealpha($image, 255, 255, 255, 18);
        imagefilledrectangle(
            $image,
            $x - $padding,
            $y - (int) ($padding * 0.65),
            $width - $padding,
            $height - $padding,
            $shadow
        );
        imagestring($image, $font, $x, $y, $text, $white);
    }
}
