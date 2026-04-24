<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockWaitlist;
use App\Notifications\StockBackInStoreNotification;
use Illuminate\Support\Facades\Notification;

class InventoryObserver
{
    /**
     * Handle the Product "updated" event.
     */
    public function updated($model): void
    {
        // We handle both Product and ProductVariant here
        if (!$model->isDirty('inventory_count')) {
            return;
        }

        $oldStock = $model->getOriginal('inventory_count');
        $newStock = $model->inventory_count;

        // If stock was 0 (or less) and is now > 0
        if ($oldStock <= 0 && $newStock > 0) {
            $this->notifyWaitlistedUsers($model);
        }
    }

    protected function notifyWaitlistedUsers($model): void
    {
        $productId = $model instanceof Product ? $model->id : $model->product_id;
        $variantId = $model instanceof ProductVariant ? $model->id : null;

        $waitlistEntries = StockWaitlist::where('product_id', $productId)
            ->where('variant_id', $variantId)
            ->where('is_notified', false)
            ->with('user')
            ->get();

        if ($waitlistEntries->isEmpty()) {
            return;
        }

        $product = $model instanceof Product ? $model : $model->product;
        $variant = $model instanceof ProductVariant ? $model : null;

        foreach ($waitlistEntries as $entry) {
            if ($entry->user) {
                $entry->user->notify(new StockBackInStoreNotification($product, $variant));
            }
            $entry->update(['is_notified' => true]);
            // Optional: delete the entry after notification? 
            // Usually we keep it and mark as notified.
        }
    }
}
