<?php

namespace App\Services;

use App\Models\Merchant;
use Illuminate\Http\UploadedFile;
use Exception;

class StorageQuotaService
{
    /**
     * Check if the merchant has enough storage for the given file size.
     */
    public function canUpload(Merchant $merchant, int $fileSizeInBytes): bool
    {
        $limitInBytes = $merchant->storage_limit_mb * 1024 * 1024;
        $potentialNewUsage = $merchant->storage_used_bytes + $fileSizeInBytes;

        return $potentialNewUsage <= $limitInBytes;
    }

    /**
     * Update the merchant's storage usage.
     */
    public function recordUpload(Merchant $merchant, int $fileSizeInBytes): void
    {
        $merchant->increment('storage_used_bytes', $fileSizeInBytes);
    }

    /**
     * Record a deletion and decrease usage.
     */
    public function recordDeletion(Merchant $merchant, int $fileSizeInBytes): void
    {
        $merchant->decrement('storage_used_bytes', max(0, $fileSizeInBytes));
    }

    /**
     * Recalculate total storage usage for a merchant (slow, use for sync only).
     */
    public function syncUsage(Merchant $merchant): int
    {
        // This would involve summing up all PostMedia, ProductImages, etc.
        // For now, we trust the incremental counter.
        return $merchant->storage_used_bytes;
    }
}
