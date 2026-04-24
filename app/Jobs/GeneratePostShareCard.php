<?php

namespace App\Jobs;

use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Spatie\Browsershot\Browsershot;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Illuminate\Support\Facades\Log;

class GeneratePostShareCard implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $post;

    /**
     * Create a new job instance.
     */
    public function __construct(Post $post)
    {
        $this->post = $post->load(['merchant', 'productTags.product']);
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("Starting Share Card generation for Post #{$this->post->id}");
        
        try {
            $merchant = $this->post->merchant;
            $product = $this->post->productTags->first()?->product;
            $postRouteKey = $this->post->public_id ?: $this->post->id;
            $postUrl = url("/p/{$postRouteKey}");

            Log::info("Data loaded: Merchant (@" . ($merchant->name ?? 'None') . "), Product (" . ($product->title ?? 'None') . ")");

            // 1. Generate QR Code as SVG string
            $qrCode = QrCode::format('svg')->size(200)->errorCorrection('H')->generate($postUrl);
            Log::info("QR Code generated successfully.");

            // 2. Prepare Data for Template
            $data = [
                'post_id'         => $this->post->id,
                'merchant_name'   => $merchant->name ?? 'Takeer',
                'merchant_avatar' => $merchant->avatar_url,
                'media_url'       => $this->post->media_url ?? ($this->post->images[0] ?? null),
                'title'           => $product->title ?? $this->post->caption ?? 'Product',
                'price'           => $product->price ?? 0,
                'qr_code'         => (string) $qrCode,
            ];

            // 3. Render HTML to Image using Browsershot
            Log::info("Rendering Blade template emails.share-card...");
            $html = view('emails.share-card', $data)->render();
            
            $imageName = "share-cards/post-{$this->post->id}-" . time() . ".png";
            
            Log::info("Executing Browsershot (Puppeteer) for 1080x1920...");
            
            // Note: Browsershot requires Node.js and Puppeteer installed on the server
            $imageData = Browsershot::html($html)
                ->windowSize(1080, 1920)
                ->deviceScaleFactor(2)
                ->fullPage()
                ->setScreenshotType('png')
                ->screenshot();

            Log::info("Browsershot capture successful. Image size: " . strlen($imageData) . " bytes.");

            // 4. Store the generated image
            Storage::disk('public')->put($imageName, $imageData);
            
            Log::info("Share Card stored successfully at: " . Storage::disk('public')->url($imageName));
            
            // 5. Update Post with share card URL (optional, if we add a column)
            // $this->post->update(['share_card_url' => Storage::url($imageName)]);

            Log::info("Share card generation completed for Post #{$this->post->id}");

            // TODO: Here we would trigger the Instagram Content Publishing API
            // $this->post->autoPostToInstagram($imageName);

        } catch (\Exception $e) {
            Log::error("CRITICAL FAILURE in Share Card Generation (Post #{$this->post->id})");
            Log::error("Error: " . $e->getMessage());
            Log::error("Trace: " . $e->getTraceAsString());
            throw $e;
        }
    }
}
