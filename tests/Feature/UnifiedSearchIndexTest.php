<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Post;
use App\Models\PostProductTag;
use App\Models\SearchIndexEntry;
use App\Models\SearchIndexChunk;
use App\Models\User;
use App\Search\SearchIndexWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UnifiedSearchIndexTest extends TestCase
{
    use RefreshDatabase;

    public function test_normal_search_does_not_silently_apply_the_detected_country(): void
    {
        $this->withSession(['user_session_country.iso_alpha2' => 'TZ'])
            ->get('/search?q=ndoa')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Search')
                ->where('initialQuery', 'ndoa')
                ->where('initialFilters.country_id', null));
    }

    public function test_superseded_search_endpoint_has_been_removed(): void
    {
        $this->getJson('/api/search/unified/posts?q=ndoa')->assertNotFound();
    }

    public function test_generated_catalog_post_is_folded_into_its_product_result(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'video-store',
            'display_name' => 'Video Store',
            'is_active' => true,
        ]);
        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Ndoa EP:1',
            'slug' => 'ndoa-ep-1',
            'type' => 'digital',
            'price' => 12000,
        ]);
        $post = Post::query()->create([
            'merchant_id' => $merchant->id,
            'source' => 'catalog_publish',
            'title' => 'Ndoa EP:1',
            'caption' => 'Hadithi ya maisha halisi ya wanandoa.',
        ]);
        PostProductTag::query()->create([
            'post_id' => $post->id,
            'product_id' => $product->id,
            'x_coordinate' => 50,
            'y_coordinate' => 50,
        ]);

        app(SearchIndexWriter::class)->rebuild('post', $post->id);
        app(SearchIndexWriter::class)->rebuild('product', $product->id);

        $this->assertDatabaseMissing('search_index', ['source_type' => 'post', 'source_id' => $post->id]);
        $this->assertDatabaseHas('search_index_chunks', ['chunk_type' => 'summary']);
        $this->assertStringContainsString(
            'Hadithi ya maisha halisi ya wanandoa',
            (string) SearchIndexChunk::query()
                ->whereHas('entry', fn ($query) => $query->where('source_type', 'product')->where('source_id', $product->id))
                ->value('content')
        );
        $this->getJson('/api/search?q=ndoa')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.entity_type', 'product');
    }

    public function test_product_and_variant_are_indexed_and_found_with_a_natural_budget(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'safari-store',
            'display_name' => 'Safari Store',
            'bio' => 'Outdoor equipment and travel essentials',
            'is_active' => true,
        ]);
        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Trail Running Shoes',
            'slug' => 'trail-running-shoes',
            'type' => 'physical',
            'has_variants' => true,
            'price' => 150000,
            'inventory_count' => 0,
        ]);
        ProductVariant::query()->create([
            'product_id' => $product->id,
            'name' => 'Black Size 42',
            'sku' => 'TRAIL-BLK-42',
            'price' => 110000,
            'inventory_count' => 4,
            'attributes' => ['color' => 'black', 'size' => '42'],
            'is_active' => true,
        ]);

        app(SearchIndexWriter::class)->rebuild('merchant', $merchant->id);
        app(SearchIndexWriter::class)->rebuild('product', $product->id);

        $this->getJson('/api/search?q=running+shoes+under+120000&available_only=1')
            ->assertOk()
            ->assertJsonPath('meta.filters.max_price', 120000)
            ->assertJsonPath('data.0.entity_type', 'product')
            ->assertJsonPath('data.0.matched_variant.variant_name', 'Black Size 42')
            ->assertJsonPath('data.0.matched_variant.price', 110000);
    }

    public function test_typed_results_share_one_endpoint_and_respect_entity_filters(): void
    {
        SearchIndexEntry::query()->create($this->entry([
            'source_type' => 'content_item',
            'entity_type' => 'content_item',
            'content_type' => 'article',
            'card_type' => 'long_content',
            'title' => 'Exporting Tanzanian Coffee',
            'summary' => 'A practical coffee export guide',
            'display_data' => ['title' => 'Exporting Tanzanian Coffee', 'url' => '/content/coffee-export'],
        ]));
        SearchIndexEntry::query()->create($this->entry([
            'source_type' => 'forwarder_route',
            'entity_type' => 'forwarder_route',
            'content_type' => 'shipping_route',
            'card_type' => 'forwarder_route',
            'title' => 'Dar es Salaam coffee freight',
            'summary' => 'Freight route for coffee exporters',
            'display_data' => ['title' => 'Dar es Salaam freight', 'url' => '/freight/routes/TZ-1'],
        ], 2));

        $this->getJson('/api/search?q=coffee')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.card_type', 'long_content');

        $this->getJson('/api/search?q=coffee&entity_types[]=forwarder_route')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.entity_type', 'forwarder_route');
    }

    private function entry(array $overrides, int $id = 1): array
    {
        return array_merge([
            'source_type' => 'post',
            'source_id' => $id,
            'entity_type' => 'post',
            'entity_id' => $id,
            'canonical_group_key' => 'test:'.$id,
            'content_type' => 'short_post',
            'card_type' => 'post',
            'title' => 'Test result',
            'normalized_title' => 'test result',
            'visibility' => 'public',
            'is_searchable' => true,
            'is_available' => true,
            'generation' => 1,
            'index_version' => 1,
        ], $overrides);
    }
}
