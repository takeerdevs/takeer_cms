# Takeer Unified Search Index Implementation

| Field | Value |
| --- | --- |
| Company | AVLY TECH GROUP LIMITED |
| Platform | Takeer |
| Prepared | 7 August 2026 |
| Status | Implemented; production migration and backfill required |
| Primary database | PostgreSQL with `pgvector` |
| Search consumers | Classic search, hybrid search, AI commerce copilot, discovery surfaces |

## Implementation status

The architecture in this document is implemented in the application as of 7 August 2026. The migration creates `search_index`, `search_index_chunks`, and `search_index_outbox`; model observers and queued jobs keep the projection current; `UnifiedSearchService` powers `/api/search`, the classic search page, the AI `search_takeer` tool, and the AI text/visual endpoints. Because Takeer is still in development, the superseded federated endpoint and product-only AI search executor were removed instead of retained as compatibility paths.

Before enabling production reads, deploy workers and the scheduler, run migrations, configure `SEARCH_EMBEDDING_MODEL` and `SEARCH_EMBEDDING_API_KEY` if semantic retrieval is wanted, and backfill with:

```bash
php artisan migrate --force
php artisan search:reindex
php artisan search:index-drain-outbox
php artisan search:index-reconcile --limit=2000
```

Lexical search works without embedding credentials. `search:reindex {type?} {id?}`, the minute outbox drainer, and the daily reconciler are the recovery and maintenance interfaces.

## 1. Decision summary

Takeer will keep its existing operational tables intact and add a PostgreSQL search read model named `search_index`. The index becomes the single retrieval entry point for both normal user search and AI-assisted search.

The operational models remain authoritative:

- `products` continues to own physical products, digital products, and services through `products.type`.
- `posts` continues to own feed activity and links to media, products, promotables, and optional long-form content.
- `content_items` continues to own authored long-form and paid content.
- `merchants`, `bundles`, `subscription_plans`, `offering_groups`, and public forwarder routes retain their own domain schemas.

The search index is not another source of truth and must never be used to authorize access, calculate a checkout total, reserve inventory, or decide whether an item is published. It is a denormalized, repairable projection optimized for retrieval, filtering, ranking, and typed result rendering.

The implementation has four essential properties:

1. One search service and result contract for classic and AI search.
2. Lexical, typo-tolerant, structured, geographic, and vector similarity retrieval from the same index.
3. Typed results so the client renders a merchant, post, physical product, service, download, course, or membership with the correct card.
4. Durable synchronization through Laravel model events, a transactional outbox, idempotent queued jobs, fail-closed visibility updates, and periodic reconciliation.

## 2. Why this is needed

Before this implementation, the classic `UnifiedSearchController` searched operational tables independently, collected IDs, hydrated several model types, merged scores in PHP, and paginated the in-memory collection. That approach recognized that search is cross-domain, but became expensive and difficult to rank consistently as data grew. The controller has now been removed.

Before this implementation, `AiSearchToolRegistry` exposed product-only search and the text/visual paths queried products directly. The registry now exposes `search_takeer`, and all AI search paths retrieve through the unified index. The older `product_embeddings` table is no longer the retrieval source for unified search.

The target design removes these differences:

```text
Classic search (no AI provider call) ----+
                                         |
Hybrid search (lexical + embedding) -----+--> UnifiedSearchService --> search_index
                                         |                             + search_index_chunks
AI copilot (intent + same search) -------+                                      |
                                                                                v
                                                                   typed result hydrators
                                                                                |
                                                                                v
                                                                  custom UI cards / AI blocks
```

## 3. Goals and non-goals

### 3.1 Goals

- Discover all public, user-visible content types from one search interface.
- Match terms found in titles, captions, public bodies, descriptions, categories, attributes, variants, FAQs, specifications, merchant profiles, service metadata, bundle contents, course previews, and route metadata.
- Support structured constraints such as minimum/maximum budget, currency, category, color, size, material, location, radius, availability, and item type.
- Support Swahili, English, mixed-language queries, names, brands, SKUs, and common spelling variations.
- Return one stable typed result contract to classic search and AI tools.
- Make updates, publication changes, moderation actions, inventory changes, and deletions reliably appear in search.
- Keep classic lexical search operational when an AI or embedding provider is unavailable.
- Make the index completely rebuildable from source tables.

### 3.2 Non-goals

- Do not merge operational data into one universal content table.
- Do not place orders, authorize access, or expose protected content from index snapshots.
- Do not make an LLM generate SQL or query arbitrary tables.
- Do not index private operational records such as orders, messages, payment data, service requests, shipment records, credentials, or customer details into public discovery.
- Do not rank sponsored content invisibly. Any paid placement must be separately labeled and audited.

“Everything” in this plan means every entity a user is allowed to discover, not every database table.

## 4. Discoverable entity registry

Searchable types must be registered centrally using stable string keys rather than PHP class names. This prevents a namespace refactor from invalidating index rows.

| Entity type | Content/card subtypes | Authoritative sources | Search result |
| --- | --- | --- | --- |
| `merchant` | `merchant_profile`, `forwarder_profile` | `merchants`, public locations, storefront settings | Merchant/profile card |
| `post` | `short_post`, `media_post`, `long_post`, `forwarder_update`, `community_post` | `posts`, `post_media`, linked content and promotables | Post card or long-content card |
| `content_item` | `article`, `paid_content`, `plain_text` | `content_items`, optional linked post | Long-content card |
| `product` | `physical_product`, `digital_download`, `premium_video`, `premium_audio`, `gallery_pack`, `software`, `live_event`, `custom_delivery` | `products` and catalog child tables | Product/digital card |
| `service` | `service`, `appointment`, `reservation`, `rental`, `room`, `tour`, `workshop`, `custom_order` | A `products` row with `type=service` plus service metadata | Service-specific card |
| `bundle` | `bundle`, `course` | `bundles`, bundle items, public modules/lessons | Bundle/course card |
| `subscription_plan` | `subscription`, `membership`, `creator_club` | `subscription_plans` and public plan items | Membership card |
| `offering_group` | `package`, template-specific group | `offering_groups` and group items | Package/group card |
| `forwarder_route` | `shipping_route` | Public active routes, locations, transport modes | Route card |

Services remain products in the domain model. The search index exposes `entity_type=service` as a presentation/search classification while retaining `source_type=product` and `source_id=<products.id>`. This makes service filters and cards simple without duplicating service records.

Categories, brands, product models, variants, FAQs, specifications, lessons, and route modes are generally retrieval evidence rather than top-level results. They are indexed as chunks or facets under their parent result.

## 5. Canonical results and duplicate control

A search result represents a user-visible destination, not necessarily one database row.

- A published `content_item` with a generated feed post must not appear twice. Its canonical entry uses the content item as the source, includes the linked post's public route and engagement metadata, and renders as `long_content` or `long_post`.
- A genuinely authored shoppable post and its tagged product may both appear because they are different experiences. Result diversification prevents them from occupying the entire first page.
- A minimal auto-generated catalog post may share `canonical_group_key=product:{id}` with the product and collapse to the higher-ranked representation.
- Product variant matches collapse to the parent product while returning `matched_variant` evidence.

Each row therefore carries `canonical_group_key`. Search keeps the best result per group before final diversification.

## 6. PostgreSQL data model

### 6.1 Required extensions

Production PostgreSQL must enable:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

The project already enables `vector` and has the `pgvector/pgvector` Laravel package. `pg_trgm` supplies typo/substring recall; `unaccent` normalizes text. The `simple` text-search configuration is the default because it behaves predictably across Swahili, English, names, SKUs, and mixed-language text.

### 6.2 `search_index`

One row represents one renderable result.

| Column | Purpose |
| --- | --- |
| `id` | Internal index ID |
| `entity_type`, `entity_id` | Stable public result identity |
| `source_type`, `source_id` | Authoritative model identity; services point to products |
| `parent_type`, `parent_id` | Optional grouping for nested entities |
| `merchant_id` | Ownership, filtering, suspension fan-out |
| `canonical_group_key` | Duplicate collapse key |
| `content_type`, `card_type` | Search classifier and frontend renderer key |
| `title`, `subtitle`, `summary` | Public display/search text |
| `normalized_title`, `keywords` | Accent/case-normalized exact and fuzzy terms |
| `search_vector` | Weighted PostgreSQL `tsvector` for the result summary |
| `facets` | JSONB structured values: category, brand, colors, service mode, delivery type, etc. |
| `display_data` | Bounded, public card snapshot; never private or authoritative for checkout |
| `url`, `image_url` | Public destination and preview |
| `currency_code` | Native listing currency |
| `price_min`, `price_max` | Effective searchable price range |
| `price_min_base`, `price_max_base` | Normalized platform-base values for cross-currency budgets |
| `in_stock`, `is_available` | Search-time availability signals |
| `country_id`, `city`, `region`, `latitude`, `longitude` | Geographic filtering/ranking |
| `language` | Detected or declared language, default `und` |
| `visibility` | Public visibility classifier |
| `is_searchable` | Fast fail-closed switch |
| `published_at`, `popularity_score`, `quality_score` | Ranking signals |
| `source_updated_at`, `indexed_at` | Freshness and reconciliation |
| `content_hash`, `embedding_hash` | Idempotency and embedding cost control |
| `embedding_status`, `embedding_model`, `embedding_updated_at` | Vector lifecycle |
| `last_outbox_id`, `index_version`, `generation` | Ordering and zero-downtime rebuilds |
| timestamps | Auditability |

Required constraints and indexes:

- Unique `(generation, entity_type, entity_id)`.
- B-tree indexes for active type, merchant, content type, country, price, availability, and publication time.
- GIN index on `search_vector`.
- GIN `jsonb_path_ops` index on bounded `facets` only where query evidence justifies it.
- Trigram indexes on `normalized_title` and `keywords`; do not trigram-index unrestricted body text.
- Partial indexes restricted to `is_searchable=true` for public query paths.

### 6.3 `search_index_chunks`

Deep content and nested catalog data require multiple retrieval units without producing duplicate cards. `search_index_chunks` belongs to a `search_index` row.

| Column | Purpose |
| --- | --- |
| `search_index_id` | Parent result |
| `chunk_key` | Stable idempotent key such as `summary`, `variant:91`, or `body:4` |
| `chunk_type` | `summary`, `body`, `variant`, `faq`, `specification`, `lesson`, `service`, `route_mode` |
| `position` | Original order |
| `content` | Public normalized retrieval text |
| `search_vector` | Chunk-level weighted lexical vector |
| `embedding` | `vector(512)` for semantic similarity |
| `facets` | Chunk-specific structured attributes |
| `price_min`, `price_max`, `in_stock` | Variant- or option-specific constraints |
| `content_hash`, `embedding_model`, `embedding_status` | Idempotent vector lifecycle |

Initial embeddings should use `vector(512)` to align with the existing `product_embeddings` schema. The embedding model and dimensions must be locked in configuration. A model dimension change requires a new column/table generation and backfill; it must not silently write incompatible vectors.

Use HNSW where the deployed pgvector version supports it. Otherwise create IVFFlat after a meaningful backfill and run `ANALYZE`. Vector indexes should be created in a non-transactional deployment migration, preferably concurrently where PostgreSQL permits.

### 6.4 `search_index_outbox`

The durable outbox stores only mutation instructions, not private source content:

- `id`
- `aggregate_type`, `aggregate_id`
- `action`: `upsert`, `hide`, `delete`, `fanout`
- `reason`
- `source_event`
- `available_at`, `attempts`, `processed_at`, `last_error`
- timestamps

Workers always rebuild from current authoritative tables instead of trusting an event payload. `last_outbox_id` prevents an older delayed job from overwriting a newer projection.

### 6.5 Optional operational tables

- `search_index_runs`: backfill/reconciliation run status, generation, counts, cursor, and errors.
- `search_query_logs`: privacy-safe query analytics with a retention policy; raw user prompts must not be retained indefinitely.

## 7. Document construction rules

All builders implement a common contract, for example:

```php
interface SearchDocumentBuilder
{
    public function supports(string $aggregateType): bool;
    public function build(int $aggregateId): ?SearchDocument;
}
```

`null` means the source no longer exists or is not publicly searchable and the worker must tombstone/delete the projection.

### 7.1 Product and service builder

The product builder aggregates:

- title, effective description, type, selling style, module/template metadata;
- category/subcategory names and IDs;
- brand, model, material, style, gender, colors, and category attribute values;
- active variants: name, SKU, attributes, effective price, stock, and location availability;
- public FAQs, specifications, detail sections, package contents, unit type, and customization options;
- digital content/delivery type and public access summary, never protected download URLs;
- service category, specialty, mode, pricing model, duration, public area/location, scheduling type, options, and public requirements;
- public trust signals and related merchant/location metadata.

Each active variant receives a `variant` chunk. Budget, color, size, and stock constraints are applied to the same variant chunk, preventing false matches where one variant satisfies the color but another satisfies the price. The final result collapses to the product and includes the highest-scoring eligible `matched_variant`.

`price_min` and `price_max` use current effective purchasable prices across active variants. Checkout must still recalculate from the product and selected variant.

### 7.2 Post and content builder

The post/content builders aggregate:

- title, caption, excerpt, public body, source, background style, and media types;
- linked public content item title/excerpt/body and format;
- tagged product names and public categories;
- promotable product, bundle, subscription, and offering-group names;
- merchant identity and public engagement counters.

Public long-form bodies are split into bounded paragraph-aware chunks. Restricted or paid content indexes only its public title, excerpt, tags, and preview. Locked body text must not be embedded or returned to an unauthorized search path.

### 7.3 Merchant builder

Index display name, username, public bio, business type/category, verified status, public location names, city/region/country, and public storefront labels. Never index private KYC documents, personal phone numbers, payment profiles, staff-only data, or credentials.

### 7.4 Bundles, courses, subscriptions, and offering groups

Index the public parent title/description/pricing plus public child titles and summaries as chunks. Paid lesson bodies or assets remain excluded unless explicitly marked as public previews. Child changes enqueue the parent aggregate.

### 7.5 Forwarders and routes

Index only verified/public forwarder profiles and active public routes: origin/destination names, transport modes, estimates, public rates, allowed-item summaries, and customer instructions. Shipment records are private and never enter public search.

## 8. Synchronization and consistency

### 8.1 Mutation flow

```text
Source model transaction
  -> source row/child row changes
  -> observer records aggregate mutation in search_index_outbox
  -> transaction commits
  -> afterCommit dispatches ProcessSearchIndexOutbox
  -> worker rebuilds latest aggregate and lexical chunks
  -> index is immediately eligible for lexical search
  -> GenerateSearchEmbeddings runs only for changed chunk hashes
  -> embedding_status becomes ready (or failed without breaking lexical search)
```

Every write path affecting searchable state must execute inside `DB::transaction(...)` so the source mutation and outbox row are atomic. Existing bulk `query()->update()` and `query()->delete()` paths do not fire model observers; they must either be converted to model-aware writes or explicitly call `SearchIndexMutationRecorder` with affected aggregate IDs.

The immediate `afterCommit` dispatch is an optimization. A scheduled `search:index-drain-outbox` command catches committed outbox rows that were not dispatched because of a process or Redis failure.

### 8.2 Dependency observers

Observers enqueue the owning result, not necessarily the changed row:

| Changed model | Aggregate(s) to enqueue |
| --- | --- |
| Product | Product/service |
| Product variant, attributes, attribute value, image, FAQ, specification, pricing/inventory child | Parent product |
| Product/service category, brand, model, unit type | All affected products in bounded batches |
| Post, media, product tag, promotable pivot | Parent post/canonical content |
| Content item | Content item and linked post canonical group |
| Bundle item, course module/lesson/preview asset | Parent bundle/course |
| Subscription plan item | Parent subscription plan |
| Offering group item | Parent offering group |
| Merchant public profile/location | Merchant plus dependent public entities through fan-out jobs |
| Forwarder route location/mode | Parent route |

Inventory-only changes update structured availability and variant chunks but skip embeddings when the textual `embedding_hash` is unchanged.

### 8.3 Fail-closed visibility

Safety-sensitive changes cannot wait for an embedding or general reindex queue:

- delete or soft delete;
- unpublish/archive;
- moderation rejection/removal;
- merchant suspension/deactivation;
- service/product/category prohibition;
- loss of required public eligibility.

The mutation transaction synchronously sets matching index rows to `is_searchable=false`. Merchant suspension performs one indexed update by `merchant_id` to hide all dependent results. A queued rebuild later deletes or repairs the rows. If a source write fails after the fail-closed update, reconciliation may restore the result; temporary hiding is safer than temporary exposure.

### 8.4 Idempotency, ordering, and retries

- Jobs implement `ShouldQueue` and `ShouldBeUnique` per aggregate for a short coalescing window.
- Workers lock the index row while applying a rebuild.
- Workers read the latest source state and ignore an outbox event when `last_outbox_id >= event.id`.
- `content_hash` avoids unnecessary row/chunk writes.
- `embedding_hash` includes normalized text, embedding model, dimensions, and embedding recipe version.
- Embedding retries use backoff and a dead-letter/failed status. Lexical search remains available.
- Builders must be deterministic: identical source state produces identical hashes and projection data.

### 8.5 Reconciliation

`search:index-reconcile` runs incrementally and performs:

1. Find public source rows with missing index entries.
2. Find entries whose `source_updated_at` or content hash is stale.
3. Hide/delete entries whose source is missing or ineligible.
4. Find failed/stuck outbox and embedding records.
5. Compare per-type source/index counts and emit metrics.

A nightly bounded reconciliation is the safety net, not the primary synchronization mechanism. Admins also need `search:index {type} {id}` for one entity and `search:reindex --type=... --generation=...` for controlled rebuilds.

## 9. Query modes

All modes use `UnifiedSearchService` and the same filters/result contract.

### 9.1 Lexical mode (AI opt-out)

No LLM or embedding-provider request is made. Candidate retrieval combines:

- `websearch_to_tsquery('simple', ...)` against weighted `tsvector` columns;
- exact normalized title, username, SKU, and category matches;
- trigram similarity for misspellings and partial terms;
- structured SQL filters and geographic/availability constraints.

This is the guaranteed fallback and must meet normal search latency targets independently.

### 9.2 Hybrid mode

Hybrid mode adds a cached query embedding and nearest-neighbor chunk retrieval. It can be used without conversational AI when product policy allows semantic search as a platform feature. Query embeddings are cached in Redis by model, recipe version, locale, and normalized-query hash.

If the provider fails, dimensions mismatch, or the vector feature is disabled, the request automatically falls back to lexical mode without returning an error page.

### 9.3 Conversational AI mode

The LLM interprets user intent but does not search operational tables. It calls a server-owned `search_takeer` tool whose arguments are validated and passed to `UnifiedSearchService`.

The LLM may extract:

- query concepts and synonyms;
- entity/content types;
- minimum/maximum budget and currency;
- category, attributes, service type, or delivery type;
- location/radius;
- availability and date intent;
- requested result count.

The model cannot provide SQL, ranking weights, arbitrary URLs, or visibility overrides. AI answers must be grounded in returned typed results and must not claim current price, stock, booking availability, or access beyond the hydrated public payload.

## 10. Retrieval and ranking

### 10.1 Candidate generation

Apply security and hard structured filters as early as possible, then retrieve bounded candidate sets:

1. Top lexical result rows.
2. Top lexical deep chunks.
3. Top semantic chunks when hybrid mode is active.
4. Exact/facet matches such as SKU, username, category, and variant attributes.

Aggregate chunk hits to the parent result and retain the best matching chunk/variant evidence.

### 10.2 Score fusion

Use Reciprocal Rank Fusion (RRF) to combine lexical and semantic lists because raw text-rank and cosine values are not directly comparable. A default `k=60` is suitable as a starting configuration and must be tuned with evaluation data.

Apply bounded post-fusion signals:

- exact title/username/SKU match;
- all requested constraints satisfied by one variant;
- availability/in-stock status;
- merchant trust/active status;
- location and radius relevance;
- freshness decay appropriate to content type;
- logarithmically bounded engagement/sales quality;
- content completeness and moderation quality.

Do not use raw views, sales, or follower counts directly; they would permanently bury new merchants. Apply result diversification after scoring, including limits per merchant, canonical group, and content type on the first page.

### 10.3 Budget and currency

- Store native `price_min`/`price_max` and normalized platform-base values.
- Convert the user's budget through the existing currency service using a recorded rate version.
- Variant-aware filtering must use the matching variant's effective price.
- Services with quote-first pricing remain searchable but are marked `price_kind=quote` and are not falsely presented as under budget unless a valid displayed minimum/range exists.
- Hydration re-reads current prices before display, and checkout recalculates authoritatively.

## 11. Unified API and typed views

### 11.1 Endpoint

Introduce:

```text
GET /api/search
```

Core request fields:

```json
{
  "q": "black running shoes size 42 under 120000",
  "mode": "lexical|hybrid",
  "entity_types": ["product", "service", "post", "merchant"],
  "content_types": ["physical_product"],
  "min_price": 0,
  "max_price": 120000,
  "currency": "TZS",
  "attributes": {"color": ["black"], "size": ["42"]},
  "country_id": 1,
  "lat": -6.8,
  "lng": 39.2,
  "radius_km": 25,
  "cursor": null,
  "per_page": 20
}
```

Use cursor pagination over a stable tuple such as `(final_score, published_at, search_index.id)` rather than loading and paginating a merged PHP collection.

### 11.2 Result contract

```json
{
  "id": "product:418",
  "entity_type": "product",
  "entity_id": 418,
  "content_type": "physical_product",
  "card_type": "product",
  "canonical_group_key": "product:418",
  "matched_on": ["title", "variant.attributes.color", "variant.name"],
  "matched_variant": {
    "id": 912,
    "name": "Black / EU 42",
    "price": 110000,
    "currency": "TZS",
    "in_stock": true
  },
  "payload": {},
  "tracking": {
    "query_id": "opaque-id",
    "position": 1,
    "index_version": 1
  }
}
```

`payload` is produced by a typed hydrator that re-checks the authoritative model, visibility, merchant status, and viewer access. Missing/ineligible items are dropped and a bounded refill query supplies replacements.

### 11.3 Frontend renderer registry

Replace the current three-way `if` chain with a component registry:

```js
const searchCardRegistry = {
  merchant: MerchantSearchCard,
  post: PostSearchCard,
  long_content: LongContentSearchCard,
  product: ProductSearchCard,
  digital_product: DigitalProductSearchCard,
  service: ServiceSearchCard,
  bundle: BundleSearchCard,
  course: CourseSearchCard,
  subscription: SubscriptionSearchCard,
  offering_group: OfferingGroupSearchCard,
  forwarder_route: ForwarderRouteSearchCard,
};
```

Classic search and AI UI blocks consume the same `card_type` and hydrated payload. AI may group results into carousels or sections, but it must not invent a card schema.

## 12. AI search changes

Replace product-only discovery with these read-only tools:

- `search_takeer`: unified retrieval and filters.
- `get_search_result_details`: dispatches to an allow-listed typed hydrator using a result token or entity identity returned by search.
- `get_product_options`: remains for variant/stock detail.
- Later domain-specific detail tools may be added for service slots, course previews, or route details, but all require a prior public result and current authorization check.

Add a distinct AI task route such as `search_embedding` with an `embeddings` capability. Do not use the conversational `ai_search` model implicitly for embeddings. Background document embeddings and query embeddings must record provider/model/version and cost in the existing AI control plane.

AI search must return mixed content when relevant. A query such as “how to photograph products” may return an article, a merchant post, a digital guide, a course, a photographer's service, and a merchant profile—not only products.

## 13. Privacy, moderation, and authorization

- Only public, published, approved, active, non-deleted sources are eligible.
- Restricted content indexes public preview fields only.
- Search snippets are generated from allowed public text; never expose a locked matching passage.
- Search index rows contain no payment numbers, personal phone numbers, private addresses, credentials, messages, order history, KYC files, entitlement-only URLs, or private media paths.
- Search hydrators repeat source authorization checks to protect against brief projection staleness.
- The AI tool receives bounded public payloads, not raw embeddings, internal moderation notes, SQL scores, or private `display_data` fields.
- Deletion and moderation workflows must include index hiding in their transaction and be covered by tests.

## 14. Laravel implementation components

### 14.1 New files/classes

Suggested implementation shape:

```text
app/Models/SearchIndexEntry.php
app/Models/SearchIndexChunk.php
app/Models/SearchIndexOutbox.php
app/Search/SearchDocument.php
app/Search/SearchDocumentBuilder.php
app/Search/SearchDocumentRegistry.php
app/Search/Builders/*SearchDocumentBuilder.php
app/Search/SearchIndexMutationRecorder.php
app/Search/UnifiedSearchService.php
app/Search/SearchQuery.php
app/Search/SearchResult.php
app/Search/SearchResultHydratorRegistry.php
app/Search/Hydrators/*SearchResultHydrator.php
app/Jobs/ProcessSearchIndexOutbox.php
app/Jobs/RebuildSearchIndexEntry.php
app/Jobs/GenerateSearchIndexEmbeddings.php
app/Console/Commands/DrainSearchIndexOutbox.php
app/Console/Commands/ReconcileSearchIndex.php
app/Console/Commands/RebuildSearchIndex.php
app/Http/Controllers/Api/SearchController.php
config/search.php
```

Add migrations for extensions, `search_index`, `search_index_chunks`, `search_index_outbox`, and optional run tracking. Register observers centrally in `AppServiceProvider`, following the project's existing observer pattern.

### 14.2 Existing files to migrate

- `routes/api.php`: add `/api/search`; keep the old route temporarily as a compatibility adapter.
- `resources/js/Pages/Search.jsx`: use the new endpoint, cursor pagination, and card registry.
- `UnifiedSearchController`: removed; `/api/search` is the sole public discovery endpoint.
- `AiSearchToolRegistry`: replace product-only search execution with `UnifiedSearchService`.
- `AiSearchController`: route legacy text/visual searches through the unified service or deprecate them.
- `AI_CONTROL_PLANE.md`: update tool and embedding-task documentation after implementation.
- `product_embeddings`: backfill into unified chunks and deprecate only after semantic parity is verified.

### 14.3 Configuration

`config/search.php` should own:

- feature flags and active generation;
- lexical/hybrid default mode;
- embedding task/model/dimensions/recipe version;
- candidate limits and RRF/ranking weights;
- chunk size/overlap and maximum public chunks per entity;
- outbox queues, retries, and reconciliation limits;
- result diversification limits;
- privacy-safe query log retention.

Ranking weights belong in versioned server configuration, not request parameters or LLM output.

## 15. Rollout plan

### Phase 0: Baseline and contracts

- Capture current search latency, zero-result rate, result-type distribution, and representative queries.
- Define the entity/card registry and public visibility policies.
- Add feature flags: `SEARCH_INDEX_WRITE`, `SEARCH_INDEX_READ`, `SEARCH_HYBRID`, and `SEARCH_INDEX_GENERATION`.

### Phase 1: Schema and lexical projection

- Create index/outbox tables and extensions.
- Implement product/service, post/content, and merchant builders first.
- Add observers, explicit bulk-write mutation recording, queue jobs, and commands.
- Backfill lexical rows/chunks while live mutations continue through the outbox.

### Phase 2: Remaining public entities and typed UI

- Add bundles/courses, subscriptions, offering groups, and public forwarder routes.
- Add typed hydrators and frontend card registry.
- Switch classic search to shadow-read the index while serving existing results.

### Phase 3: Vector retrieval

- Configure the dedicated embedding task/model.
- Backfill changed public chunks in controlled batches.
- Enable hybrid search for internal/admin evaluation, then a small traffic percentage.

### Phase 4: AI integration

- Add `search_takeer` and generalized detail tools.
- Ensure AI and classic search produce the same entities for equivalent constraints.
- Keep AI generation optional; lexical search remains the universal fallback.

### Phase 5: Cutover and cleanup

- Enable index reads for classic search.
- Keep the old endpoint as an adapter for one release window.
- Remove PHP-side multi-table merging after parity and latency targets pass.
- Deprecate `product_embeddings` after successful unified vector backfill and rollback window.

### Zero-downtime rebuilds

Write new rows with a new `generation` while queries continue using the active generation. Backfill, replay/verify outbox mutations, validate counts and samples, then atomically switch the configured active generation. Retain the prior generation for a bounded rollback period before pruning it in batches.

## 16. Testing strategy

### 16.1 Unit tests

- Deterministic document and chunk construction per entity type.
- Public/private field allow-listing.
- Content and embedding hash stability.
- Price range and variant-specific constraint calculation.
- Canonical grouping and card-type classification.
- Search intent validation and ranking fusion.

### 16.2 PostgreSQL integration tests

- Weighted full-text matching, accents, Swahili/English text, trigrams, and exact identifiers.
- Vector nearest-neighbor retrieval and dimension enforcement.
- Hybrid RRF ordering.
- Budget, currency, category, variant, availability, and geographic filters.
- Cursor stability while new entries are inserted.
- Public content body match versus restricted-content preview-only behavior.

SQLite tests may use a fake or lexical fallback backend, but PostgreSQL integration tests are mandatory for production search behavior.

### 16.3 Synchronization tests

- Create/update/delete/restore each aggregate and relevant child model.
- Bulk update paths explicitly enqueue affected parents.
- Out-of-order and duplicate jobs cannot regress an entry.
- Redis dispatch failure is recovered by the outbox drainer.
- Embedding failure leaves lexical search available.
- Merchant suspension and moderation rejection hide results immediately.
- Reconciliation repairs missing, stale, orphaned, and failed entries.

### 16.4 End-to-end tests

- One mixed query returns appropriate post, merchant, product, service, digital, and content cards.
- A variant query such as “black size 42 under TZS 120,000” matches one eligible variant and returns it as evidence.
- Classic and AI paths honor identical visibility and budget filters.
- AI answers are grounded in tool results and fall back to classic search on provider failure.

### 16.5 Search evaluation set

Maintain a versioned evaluation dataset with Swahili, English, mixed-language, misspelled, category, budget, location, service, content, and long-tail queries. Record expected relevant entities rather than only one exact ordering. Compare Recall@K, NDCG@K, zero-result rate, and per-content-type exposure before every ranking change.

## 17. Operations, observability, and cost controls

Track at minimum:

- search latency p50/p95/p99 by mode;
- lexical/vector candidate latency;
- hydration drop/refill rate;
- zero-result and reformulation rate;
- click-through, save, contact, checkout, and purchase conversion by result type/position;
- index lag (`now - indexed_at`) by entity type;
- outbox pending age, attempts, and failures;
- missing/stale/orphan reconciliation counts;
- embedding pending/failed counts, provider cost, and cache-hit rate;
- index/chunk row counts and PostgreSQL index size;
- result diversity by merchant and content type.

Initial service objectives:

- Safety-critical hides visible to search immediately within the source transaction.
- 95% of normal updates lexically searchable within 10 seconds.
- 99.9% within 5 minutes through outbox recovery.
- Classic search p95 under 500 ms at the API before network/render time.
- AI/provider failure never prevents lexical search.

Cost controls:

- Re-embed only when `embedding_hash` changes.
- Do not re-embed price, inventory, counters, or visibility-only changes.
- Batch document embeddings where the provider supports it.
- Bound chunk count and size; prioritize public title/summary and meaningful sections.
- Cache query embeddings and normalized intent for short periods.
- Attribute background embedding costs to a dedicated platform/merchant search task in the AI usage ledger.
- Measure search-to-revenue conversion by content type so indexing and model costs remain commercially justified.

## 18. Acceptance criteria

The implementation is complete only when:

1. Normal search reads from `search_index` and no longer merges independent operational queries in PHP.
2. AI search uses `search_takeer` backed by the same `UnifiedSearchService`.
3. Products, deep variants, services, digital products, posts, public content, merchants, bundles/courses, subscriptions, offering groups, and approved public forwarder routes are discoverable with typed views.
4. Price, category, attribute, availability, and location constraints are enforced structurally rather than inferred only from text similarity.
5. Restricted content, private records, inactive merchants, deleted items, and rejected content cannot appear.
6. All relevant direct and child mutations enter the durable outbox, and known bulk-update paths explicitly record mutations.
7. Immediate fail-closed hiding, queued rebuilds, retries, and reconciliation are covered by automated tests.
8. Classic search works without any AI provider call; hybrid and conversational modes degrade to lexical search.
9. A full generation can be rebuilt and switched without downtime.
10. Search quality, freshness, costs, and business conversion are observable before the old implementation is removed.

## 19. Recommended implementation order

Implement the lexical projection and synchronization guarantees before adding embeddings. A perfectly current lexical index is more valuable than a semantically powerful but stale or unsafe vector index. Once the write path, visibility controls, typed contract, and reconciliation are proven, vector retrieval and AI intent extraction can be added without changing the public search architecture.
