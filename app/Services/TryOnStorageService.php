<?php

namespace App\Services;

use App\Models\TryOnSession;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;

class TryOnStorageService
{
    public function diskName(): string
    {
        return (string) config('services.try_on.storage_disk', 'local');
    }

    public function storeUpload(UploadedFile $file, string $directory, ?string $extension = null): array
    {
        $diskName = $this->diskName();
        $disk = Storage::disk($diskName);
        $extension ??= strtolower((string) ($file->extension() ?: 'jpg'));
        $path = $disk->putFileAs($directory, $file, Str::uuid().'.'.$extension, 'private');

        if (! $path) {
            throw new \RuntimeException('Try-on image could not be stored.');
        }

        return [
            'disk' => $diskName,
            'path' => $path,
        ];
    }

    public function storeResult(TryOnSession $session, TryOnProviderResult $result): array
    {
        $diskName = $this->diskName();
        $disk = Storage::disk($diskName);
        $extension = $this->extensionForMime($result->mimeType);
        $path = 'try-on/results/'.$session->public_id.'.'.$extension;

        if (! $disk->put($path, $result->contents, 'private')) {
            throw new \RuntimeException('Try-on result could not be stored.');
        }

        return [
            'disk' => $diskName,
            'path' => $path,
            'mime' => $result->mimeType,
            'metadata' => $result->metadata,
        ];
    }

    public function read(string $diskName, string $path): string
    {
        $contents = Storage::disk($diskName)->get($path);
        if ($contents === null || $contents === false) {
            throw new \RuntimeException('Try-on source image could not be read.');
        }

        return $contents;
    }

    public function delete(?string $diskName, ?string $path): void
    {
        if ($diskName && $path) {
            Storage::disk($diskName)->delete($path);
        }
    }

    public function response(string $diskName, string $path, string $mimeType, string $downloadName): Response|RedirectResponse
    {
        $disk = Storage::disk($diskName);

        if ($this->isS3($diskName)) {
            return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(10), [
                'ResponseContentType' => $mimeType,
                'ResponseContentDisposition' => 'inline; filename="'.$downloadName.'"',
            ]));
        }

        abort_unless($disk->exists($path), 404);

        return response()->file($disk->path($path), [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'private, max-age=600',
            'Content-Disposition' => 'inline; filename="'.$downloadName.'"',
        ]);
    }

    public function isS3(string $diskName): bool
    {
        return (string) config('filesystems.disks.'.$diskName.'.driver') === 's3';
    }

    private function extensionForMime(string $mimeType): string
    {
        return match (strtolower($mimeType)) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };
    }
}
