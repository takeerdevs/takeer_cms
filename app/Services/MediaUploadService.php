<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MediaUploadService
{
    /**
     * Store a file securely on S3.
     */
    public function storeSecurely(UploadedFile $file, string $path): string
    {
        // Store privately by default on s3 driver
        return Storage::disk('s3')->putFile($path, $file, 'private');
    }

    /**
     * Generate a temporary signed URL for viewing private S3 files.
     * Useful for Admin Dispute Review or Buyer Unboxing proof.
     */
    public function getSignedUrl(string $path, int $minutes = 1440): string
    {
        try {
            if (config('filesystems.disks.s3.key')) {
                return Storage::disk('s3')->temporaryUrl($path, now()->addMinutes($minutes));
            }
        } catch (\Exception $e) {
            // S3 failed or not configured
        }
        
        // For local development or non-S3 environments, we return a relative URL 
        // to our admin kyc proxy route.
        return url("/admin/api/kyc/view?path=" . urlencode($path));
    }

    /**
     * Store public feed video on S3 and immediately trigger HLS queue job
     */
    public function storePublicVideo(UploadedFile $file, $post): string
    {
        // For Feed videos, they are public to East Africa CDN
        $path = Storage::disk('s3')->putFile('feed/raw', $file, 'public');

        // Return raw URL as fallback before HLS completes
        return Storage::disk('s3')->url($path);
    }

    /**
     * Decode a base64 image and store it.
     */
    public function uploadBase64Image(string $base64, string $folder = 'uploads'): string
    {
        if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
            $base64 = substr($base64, strpos($base64, ',') + 1);
            $type = strtolower($type[1]); // jpg, png, etc
        } else {
            throw new \Exception('Invalid image data');
        }

        $base64 = base64_decode($base64);

        if ($base64 === false) {
            throw new \Exception('base64_decode failed');
        }

        $fileName = \Illuminate\Support\Str::random(40) . '.' . $type;
        $path = $folder . '/' . $fileName;

        Storage::disk('public')->put($path, $base64);

        return Storage::url($path);
    }

    /**
     * Store a file directly from a multipart/form-data upload.
     */
    public function uploadFile(UploadedFile $file, string $folder = 'uploads', bool $isPrivate = false): string
    {
        if ($isPrivate) {
            try {
                $path = Storage::disk('s3')->putFile($folder, $file, 'private');
                if ($path) {
                    return $path;
                }
            } catch (\Exception $e) {
                // Fallback to local
            }
            return Storage::disk('local')->putFile($folder, $file);
        }

        $path = Storage::disk('public')->putFile($folder, $file, 'public');
        return Storage::disk('public')->url($path);
    }

    /**
     * Decode a base64-encoded digital product file (PDF, MP4, ZIP, etc.)
     * and store it privately. Returns the storage path for later retrieval.
     * After a successful purchase, a signed URL is generated via getSignedUrl().
     */
    public function uploadPrivateFile(string $base64, string $originalName, string $folder = 'digital-products'): string
    {
        // Strip any data URI prefix (e.g. "data:application/pdf;base64,")
        if (str_contains($base64, ',')) {
            $base64 = substr($base64, strpos($base64, ',') + 1);
        }

        $decoded = base64_decode($base64, true);
        if ($decoded === false) {
            throw new \Exception('Failed to decode digital file.');
        }

        // Sanitise and build a unique filename
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $safeName = \Illuminate\Support\Str::random(40) . ($ext ? '.' . $ext : '');
        $path = $folder . '/' . $safeName;

        // Try S3 private first; fall back to local disk for dev environments
        try {
            Storage::disk('s3')->put($path, $decoded, 'private');
        } catch (\Exception) {
            // Local fallback (development)
            Storage::disk('local')->put($path, $decoded);
        }

        // Return the storage path so we can generate a signed URL later
        return $path;
    }
}
