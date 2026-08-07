<?php

namespace App\Jobs;

use App\Services\SocialCommercePreviewService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class FetchSocialCommercePreview implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 2;
    public array $backoff = [10, 60];
    public function __construct(public string $url) {}
    public function handle(SocialCommercePreviewService $previews): void { $previews->preview($this->url); }
}
