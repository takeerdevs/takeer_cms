<?php

namespace App\Search;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\ForwarderRoute;
use App\Models\OfferingGroup;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;

class SearchIndexFanoutService
{
    public function __construct(private SearchIndexWriter $writer)
    {
    }

    public function rebuildMerchant(int $merchantId, ?int $outboxId = null): void
    {
        $this->writer->rebuild('merchant', $merchantId, $outboxId);
        $this->rebuild(Product::query()->where('merchant_id', $merchantId), 'product');
        $this->rebuild(Post::withTrashed()->where('merchant_id', $merchantId), 'post');
        $this->rebuild(ContentItem::withTrashed()->where('merchant_id', $merchantId), 'content_item');
        $this->rebuild(Bundle::withTrashed()->where('merchant_id', $merchantId), 'bundle');
        $this->rebuild(SubscriptionPlan::withTrashed()->where('merchant_id', $merchantId), 'subscription_plan');
        $this->rebuild(OfferingGroup::withTrashed()->where('merchant_id', $merchantId), 'offering_group');

        ForwarderRoute::query()->whereHas('forwarder', fn ($query) => $query->where('merchant_id', $merchantId))
            ->pluck('id')->each(fn ($id) => $this->writer->rebuild('forwarder_route', (int) $id));
    }

    private function rebuild($query, string $type): void
    {
        $query->pluck('id')->each(fn ($id) => $this->writer->rebuild($type, (int) $id));
    }
}
