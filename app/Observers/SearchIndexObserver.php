<?php

namespace App\Observers;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\ForwarderRoute;
use App\Models\Merchant;
use App\Models\OfferingGroup;
use App\Models\Post;
use App\Models\Product;
use App\Models\SearchIndexEntry;
use App\Models\SubscriptionPlan;
use App\Search\SearchIndexMutationRecorder;
use Illuminate\Database\Eloquent\Model;

class SearchIndexObserver
{
    public function saving(Model $model): void
    {
        if (! config('search.write_enabled')) {
            return;
        }

        $hide = match (true) {
            $model instanceof Merchant => ($model->isDirty('is_suspended') && (bool) $model->is_suspended)
                || ($model->isDirty('is_active') && ! (bool) $model->is_active),
            $model instanceof ContentItem => ($model->isDirty('visibility') && $model->visibility !== 'published')
                || ($model->isDirty('moderation_status') && $model->moderation_status !== 'approved'),
            $model instanceof Bundle, $model instanceof OfferingGroup => $model->isDirty('status') && $model->status !== 'published',
            $model instanceof SubscriptionPlan => $model->isDirty('status') && $model->status !== 'active',
            $model instanceof ForwarderRoute => $model->isDirty('is_active') && ! (bool) $model->is_active,
            default => false,
        };

        if (! $hide || ! $model->exists) {
            return;
        }

        $query = SearchIndexEntry::query()->where('generation', (int) config('search.generation', 1));
        if ($model instanceof Merchant) {
            $query->where('merchant_id', $model->getKey());
        } elseif ($aggregate = $this->aggregate($model)) {
            $query->where('source_type', $aggregate[0])->where('source_id', $aggregate[1]);
        }
        $query->update(['is_searchable' => false, 'updated_at' => now()]);
    }

    public function saved(Model $model): void
    {
        $this->record($model, 'upsert', 'model_saved');
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'upsert', 'model_deleted');
    }

    public function restored(Model $model): void
    {
        $this->record($model, 'upsert', 'model_restored');
    }

    public function deleting(Model $model): void
    {
        if (! config('search.write_enabled')) {
            return;
        }
        if ($aggregate = $this->aggregate($model)) {
            SearchIndexEntry::query()
                ->where('generation', (int) config('search.generation', 1))
                ->where('source_type', $aggregate[0])
                ->where('source_id', $aggregate[1])
                ->update(['is_searchable' => false, 'updated_at' => now()]);
        }
    }

    private function record(Model $model, string $action, string $event): void
    {
        if (! config('search.write_enabled')) {
            return;
        }
        $aggregate = $this->aggregate($model);
        if (! $aggregate) {
            return;
        }

        $recorder = app(SearchIndexMutationRecorder::class);
        $recorder->record($aggregate[0], $aggregate[1], $model instanceof Merchant ? 'fanout' : $action, null, $event);

        if ($model instanceof Post && $model->content_item_id) {
            $recorder->record('content_item', (int) $model->content_item_id, 'upsert', 'linked_post_changed', $event);
        }
        if ($model instanceof Post && $model->source === 'catalog_publish') {
            $model->productTags()->pluck('product_id')->each(
                fn ($productId) => $recorder->record('product', (int) $productId, 'upsert', 'catalog_post_changed', $event)
            );
        }
        if (class_basename($model) === 'PostProductTag' && $model->getAttribute('product_id')) {
            $recorder->record('product', (int) $model->getAttribute('product_id'), 'upsert', 'catalog_post_tag_changed', $event);
        }
    }

    private function aggregate(Model $model): ?array
    {
        if (class_basename($model) === 'BundleCourseLesson') {
            $bundleId = $model->module?->bundle_id;
            return $bundleId ? ['bundle', (int) $bundleId] : null;
        }

        return match (true) {
            $model instanceof Merchant => ['merchant', (int) $model->getKey()],
            $model instanceof Product => ['product', (int) $model->getKey()],
            $model instanceof Post => ['post', (int) $model->getKey()],
            $model instanceof ContentItem => ['content_item', (int) $model->getKey()],
            $model instanceof Bundle => ['bundle', (int) $model->getKey()],
            $model instanceof SubscriptionPlan => ['subscription_plan', (int) $model->getKey()],
            $model instanceof OfferingGroup => ['offering_group', (int) $model->getKey()],
            $model instanceof ForwarderRoute => ['forwarder_route', (int) $model->getKey()],
            in_array(class_basename($model), [
                'ProductVariant', 'ProductAttribute', 'ProductCategoryAttributeValue', 'ProductImage', 'ProductFaq',
                'ProductSpecification', 'ProductDetailSection', 'ProductPricingTier', 'ProductLeadTimeTier',
                'ProductPackagingDetail', 'ProductCustomizationOption', 'ProductLocationInventory',
            ], true) && $model->getAttribute('product_id') => ['product', (int) $model->getAttribute('product_id')],
            in_array(class_basename($model), ['PostMedia', 'PostProductTag'], true) && $model->getAttribute('post_id') => ['post', (int) $model->getAttribute('post_id')],
            in_array(class_basename($model), ['BundleItem', 'BundleCourseModule'], true) && $model->getAttribute('bundle_id') => ['bundle', (int) $model->getAttribute('bundle_id')],
            class_basename($model) === 'SubscriptionPlanItem' && $model->getAttribute('subscription_plan_id') => ['subscription_plan', (int) $model->getAttribute('subscription_plan_id')],
            class_basename($model) === 'OfferingGroupItem' && $model->getAttribute('offering_group_id') => ['offering_group', (int) $model->getAttribute('offering_group_id')],
            in_array(class_basename($model), ['ForwarderRouteLocation', 'ForwarderRouteTransportMode'], true) && $model->getAttribute('forwarder_route_id') => ['forwarder_route', (int) $model->getAttribute('forwarder_route_id')],
            class_basename($model) === 'MerchantLocation' && $model->getAttribute('merchant_id') => ['merchant', (int) $model->getAttribute('merchant_id')],
            default => null,
        };
    }
}
