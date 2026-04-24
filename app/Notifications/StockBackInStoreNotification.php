<?php

namespace App\Notifications;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StockBackInStoreNotification extends Notification
{
    use Queueable;

    protected $product;
    protected $variant;

    /**
     * Create a new notification instance.
     */
    public function __construct(Product $product, ?ProductVariant $variant = null)
    {
        $this->product = $product;
        $this->variant = $variant;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['database']; // Add 'mail' or 'fcm' if needed
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        $itemName = $this->product->title;
        if ($this->variant) {
            $itemName .= " (" . $this->variant->name . ")";
        }

        return [
            'type' => 'stock_replenished',
            'product_id' => $this->product->id,
            'variant_id' => $this->variant?->id,
            'title' => 'Bidhaa Imerudi!',
            'message' => "Habari! Bidhaa uliyokuwa ukiisubiri: {$itemName} sasa inapatikana. Wahi sasa!",
            'image_url' => $this->product->image_url,
            'action_url' => "/pwa/product/" . $this->product->slug,
        ];
    }
}
