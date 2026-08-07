<?php

namespace App\Console\Commands;

use App\Models\LinkPreview;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneSocialCommercePreviewMedia extends Command
{
    protected $signature = 'social-commerce:prune-preview-media';
    protected $description = 'Remove temporary social-commerce preview media after the retention period.';
    public function handle(): int
    {
        $cutoff = now()->subDays((int) config('social_commerce.preview_media_retention_days', 30));
        LinkPreview::query()->where('created_at', '<', $cutoff)->whereNotNull('image_url')->each(function (LinkPreview $preview): void {
            $urlPath = parse_url((string) $preview->image_url, PHP_URL_PATH);
            if ($urlPath && str_contains($urlPath, '/storage/')) {
                Storage::disk('public')->delete(ltrim((string) str($urlPath)->after('/storage/'), '/'));
            }
            $preview->update(['image_url' => null]);
        });
        return self::SUCCESS;
    }
}
