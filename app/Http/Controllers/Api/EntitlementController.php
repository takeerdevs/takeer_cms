<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BundleResource;
use App\Http\Resources\ContentItemResource;
use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\SubscriptionPlanResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\ContentReport;
use App\Models\Entitlement;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\Product;
use App\Models\ProductLicenseKey;
use App\Models\PulseNotification;
use App\Models\ServiceRequest;
use App\Models\SubscriptionPlan;
use App\Models\Order;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntitlementController extends Controller
{
    public function myPulse(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 12), 1), 50);

        $events = PulseNotification::query()
            ->where('user_id', $request->user()->id)
            ->latest('occurred_at')
            ->paginate($perPage);

        return response()->json([
            'events' => $events->getCollection()->map(fn (PulseNotification $event) => [
                'id' => $event->id,
                'date' => $event->occurred_at?->toISOString(),
                'icon' => $event->icon,
                'tone' => $event->tone,
                'eyebrow' => $event->eyebrow,
                'title' => $event->title,
                'body' => $event->body,
                'meta' => $event->meta,
                'href' => $event->href,
                'status' => $event->status,
                'event_type' => $event->event_type,
                'read_at' => $event->read_at?->toISOString(),
            ])->values(),
            'meta' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'per_page' => $events->perPage(),
                'total' => $events->total(),
            ],
        ]);
    }

    public function merchantPulse(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);

        $perPage = min(max((int) $request->query('per_page', 12), 1), 50);
        $merchantEventTypes = [
            'merchant_order_started',
            'merchant_order_quote_updated',
            'merchant_payment_completed',
            'merchant_payment_held',
            'merchant_merchant_confirmation_needed',
            'merchant_issue_reported',
            'merchant_order_cancelled',
            'merchant_review_created',
        ];

        $events = PulseNotification::query()
            ->where('user_id', $request->user()->id)
            ->where('merchant_id', $merchant->id)
            ->whereIn('event_type', $merchantEventTypes)
            ->latest('occurred_at')
            ->paginate($perPage);

        return response()->json([
            'events' => $events->getCollection()->map(fn (PulseNotification $event) => [
                'id' => $event->id,
                'date' => $event->occurred_at?->toISOString(),
                'icon' => $event->icon,
                'tone' => $event->tone,
                'eyebrow' => $event->eyebrow,
                'title' => $event->title,
                'body' => $event->body,
                'meta' => $event->meta,
                'href' => $event->href,
                'status' => $event->status,
                'event_type' => $event->event_type,
                'payload' => $event->payload,
                'read_at' => $event->read_at?->toISOString(),
            ])->values(),
            'meta' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'per_page' => $events->perPage(),
                'total' => $events->total(),
            ],
        ]);
    }

    public function myLibrary(Request $request): JsonResponse
    {
        $filterType = (string) $request->query('type', 'all');
        $search = trim((string) $request->query('q', ''));
        $days = (int) $request->query('days', 0);
        $page = max((int) $request->query('page', 1), 1);
        $perPage = min(max((int) $request->query('per_page', 12), 1), 50);

        $itemsQuery = Entitlement::where('user_id', $request->user()->id)
            ->with('merchant')
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            });

        if (in_array($filterType, ['physical_product', 'digital_file', 'service_booking'], true)) {
            $itemsQuery->where('item_type', 'product');
        } elseif ($filterType === 'post_content') {
            $itemsQuery->whereIn('item_type', ['post', 'content_item', 'bundle', 'subscription_plan']);
        }

        if ($days > 0) {
            $itemsQuery->where('created_at', '>=', now()->subDays($days));
        }

        $items = $itemsQuery->latest()->get();
        $unfilteredTotal = (int) $items->count();

        $entitlements = $items->map(function (Entitlement $entitlement) use ($request) {
            $resolved = $this->resolveEntitledItem($entitlement->item_type, $entitlement->item_id);
            $libraryType = $this->classifyLibraryType($entitlement, $resolved);
            $searchBlob = $this->buildSearchBlob($entitlement, $resolved);

            return [
                'id' => $entitlement->id,
                'item_type' => $entitlement->item_type,
                'item_id' => $entitlement->item_id,
                'library_type' => $libraryType,
                'source_type' => $entitlement->source_type,
                'source_id' => $entitlement->source_id,
                'status' => $entitlement->status,
                'starts_at' => $entitlement->starts_at?->toISOString(),
                'expires_at' => $entitlement->expires_at?->toISOString(),
                'granted_at' => $entitlement->created_at?->toISOString(),
                'sort_date' => $entitlement->created_at,
                'search_blob' => $searchBlob,
                'merchant' => $entitlement->merchant ? [
                    'id' => $entitlement->merchant->id,
                    'name' => $entitlement->merchant->display_name,
                    'slug' => $entitlement->merchant->username,
                ] : null,
                'item' => match ($entitlement->item_type) {
                    'product' => $resolved ? ProductResource::make($resolved->loadMissing(['attributes', 'images', 'merchant']))->resolve($request) : null,
                    'content_item' => $resolved ? ContentItemResource::make($resolved->loadMissing('merchant'))->resolve($request) : null,
                    'bundle' => $resolved ? BundleResource::make($resolved->loadMissing(['merchant', 'items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts']))->resolve($request) : null,
                    'subscription_plan' => $resolved ? SubscriptionPlanResource::make($resolved->loadMissing(['merchant', 'items']))->resolve($request) : null,
                    'post' => $resolved ? PostResource::make($resolved->loadMissing([
                        'merchant.user',
                        'merchant.storefrontSetting',
                        'merchant.products.images',
                        'linkedProduct.attributes',
                        'linkedProduct.images',
                        'linkedProduct.variants',
                        'product.attributes',
                        'product.images',
                        'product.variants',
                        'productTags.product.attributes',
                        'productTags.product.images',
                        'productTags.product.variants',
                        'media',
                        'reactions',
                    ]))->resolve($request) : null,
                    default => null,
                },
                'order_details' => ($entitlement->source_type === 'order' && $entitlement->item_type === 'product' && $resolved instanceof Product)
                    ? $this->buildProductOrderDetails((int) $entitlement->source_id, $resolved)
                    : null,
            ];
        });

        $inquiries = collect();
        if (in_array($filterType, ['all', 'physical_product'], true)) {
            $inquiriesQuery = Order::with(['merchant', 'product'])
                ->where('buyer_id', $request->user()->id)
                ->where('is_inquiry', true)
                ->whereNotIn('payment_status', ['resolved_buyer_refunded']);
            
            if ($days > 0) {
                $inquiriesQuery->where('created_at', '>=', now()->subDays($days));
            }
            // Only add inquiries that do not already have an Entitlement mapped (i.e. those waiting for payout or pending quoting)
            $existingSources = $entitlements->where('source_type', 'order')->pluck('source_id')->toArray();
            if (count($existingSources)) {
                $inquiriesQuery->whereNotIn('id', $existingSources);
            }
            $inquiries = $inquiriesQuery->get();
        }

        $mappedInquiries = $inquiries->map(function (Order $order) use ($request) {
            $resolved = $order->product;
            if (!$resolved) return null;
            
            $searchBlob = trim(strtolower(($resolved->title ?? $resolved->name ?? '') . ' ' . ($resolved->excerpt ?? $resolved->description ?? '') . ' ' . ($order->merchant?->display_name ?? '')));
            
            return [
                'id' => 'inquiry_' . $order->id,
                'item_type' => 'product',
                'item_id' => $resolved->id,
                'library_type' => 'physical_product',
                'source_type' => 'order',
                'source_id' => $order->id,
                'status' => 'active',
                'starts_at' => $order->created_at?->toISOString(),
                'expires_at' => null,
                'granted_at' => $order->created_at?->toISOString(),
                'sort_date' => $order->created_at,
                'search_blob' => $searchBlob,
                'merchant' => $order->merchant ? [
                    'id' => $order->merchant->id,
                    'name' => $order->merchant->display_name,
                    'slug' => $order->merchant->username,
                ] : null,
                'item' => ProductResource::make($resolved->loadMissing(['attributes', 'images', 'merchant']))->resolve($request),
                'order_details' => [
                    'id' => $order->id,
                    'public_id' => $order->public_id,
                    'is_inquiry' => true,
                    'inquiry_status' => $order->inquiry_status,
                    'shipping_fee' => $order->shipping_fee,
                    'total_paid' => $order->total_paid,
                    'payment_status' => $order->payment_status,
                    'delivery' => $order->delivery ? [
                        'status' => $order->delivery->delivery_status,
                        'type' => $order->delivery->delivery_type ?? $order->delivery->shippingZone?->delivery_type,
                        'delivery_type' => $order->delivery->delivery_type ?? $order->delivery->shippingZone?->delivery_type,
                        'pickup_pin' => $order->delivery->pickup_pin,
                        'buyer_release_pin' => $order->delivery->buyer_release_pin,
                    ] : null,
                ],
            ];
        })->filter();

        $unfilteredTotal = $items->count() + $inquiries->count();

        $combined = $entitlements->concat($mappedInquiries)->sortByDesc('sort_date')->values();

        $filtered = $combined->filter(function (array $entry) use ($filterType, $search) {
            $matchesType = $filterType === 'all' || $entry['library_type'] === $filterType;
            $matchesSearch = $search === '' || str_contains(strtolower((string) $entry['search_blob']), strtolower($search));
            return $matchesType && $matchesSearch;
        })->values();

        $filteredTotal = (int) $filtered->count();
        $lastPage = max((int) ceil($filteredTotal / $perPage), 1);
        $safePage = min($page, $lastPage);
        $slice = $filtered->forPage($safePage, $perPage)->values()->map(function (array $entry) {
            unset($entry['search_blob']);
            unset($entry['sort_date']);
            return $entry;
        });

        $queryParams = [
            'type' => $filterType,
            'q' => $search,
            'days' => $days > 0 ? $days : null,
            'per_page' => $perPage,
        ];

        return response()->json([
            'entitlements' => $slice,
            'meta' => [
                'current_page' => $safePage,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $filteredTotal,
                'unfiltered_total' => $unfilteredTotal,
            ],
            'links' => [
                'next' => $safePage < $lastPage
                    ? url()->current() . '?' . http_build_query(array_filter([...$queryParams, 'page' => $safePage + 1], fn($v) => $v !== null && $v !== ''))
                    : null,
                'prev' => $safePage > 1
                    ? url()->current() . '?' . http_build_query(array_filter([...$queryParams, 'page' => $safePage - 1], fn($v) => $v !== null && $v !== ''))
                    : null,
            ],
        ]);
    }

    public function canAccess(Request $request, EntitlementService $entitlementService): JsonResponse
    {
        $validated = $request->validate([
            'item_type' => 'required|string|in:product,content_item,bundle,subscription_plan,post',
            'item_id' => 'required|integer|min:1',
        ]);

        $allowed = $entitlementService->hasAccess(
            (int) $request->user()->id,
            $validated['item_type'],
            (int) $validated['item_id']
        );

        return response()->json(['allowed' => $allowed]);
    }

    public function reportContent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'merchant_id' => 'nullable|integer|exists:merchants,id',
            'item_type' => 'required|string|in:post,product,content_item,bundle,subscription_plan,order,license_key',
            'item_id' => 'required|integer|min:1',
            'reason' => 'required|string|in:adult_content,political_content,misleading,copyright,scam,license_abuse,download_abuse,harassment,spam,custom_work_issue,other',
            'report_context' => 'nullable|string|max:80',
            'notes' => 'nullable|string|max:2000',
            'evidence_url' => 'nullable|url|max:2048',
            'metadata' => 'nullable|array',
        ]);

        $target = $this->resolveReportTarget($validated['item_type'], (int) $validated['item_id']);
        $merchantId = $validated['merchant_id'] ?? $target['merchant_id'] ?? null;

        abort_unless($merchantId, 422, 'Unable to resolve merchant for this report.');

        if ($validated['item_type'] === 'order') {
            abort_unless(
                (int) ($target['buyer_id'] ?? 0) === (int) $request->user()->id
                    || (int) ($target['merchant_user_id'] ?? 0) === (int) $request->user()->id,
                403,
                'You can only report orders you are involved in.'
            );
        }

        $legacyReason = in_array($validated['reason'], ['adult_content', 'political_content', 'misleading', 'other'], true)
            ? $validated['reason']
            : 'other';

        $report = ContentReport::create([
            'reporter_id' => $request->user()->id,
            'merchant_id' => $merchantId,
            'item_type' => $validated['item_type'],
            'item_id' => $validated['item_id'],
            'reason' => $legacyReason,
            'reason_code' => $validated['reason'],
            'report_context' => $validated['report_context'] ?? $target['context'] ?? 'marketplace',
            'notes' => $validated['notes'] ?? null,
            'evidence_url' => $validated['evidence_url'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
            'status' => 'open',
            'safety_state' => 'reported',
        ]);

        return response()->json([
            'message' => 'Report submitted.',
            'report' => $report,
        ], 201);
    }

    private function resolveReportTarget(string $itemType, int $itemId): array
    {
        return match ($itemType) {
            'product' => [
                'merchant_id' => Product::withTrashed()->find($itemId)?->merchant_id,
                'context' => 'product',
            ],
            'content_item' => [
                'merchant_id' => ContentItem::withTrashed()->find($itemId)?->merchant_id,
                'context' => 'premium_content',
            ],
            'bundle' => [
                'merchant_id' => Bundle::withTrashed()->find($itemId)?->merchant_id,
                'context' => 'bundle',
            ],
            'subscription_plan' => [
                'merchant_id' => SubscriptionPlan::withTrashed()->find($itemId)?->merchant_id,
                'context' => 'membership',
            ],
            'post' => [
                'merchant_id' => Post::withTrashed()->find($itemId)?->merchant_id,
                'context' => 'feed_post',
            ],
            'order' => $this->resolveReportOrderTarget($itemId),
            'license_key' => [
                'merchant_id' => ProductLicenseKey::find($itemId)?->merchant_id,
                'context' => 'license_abuse',
            ],
            default => [],
        };
    }

    private function resolveReportOrderTarget(int $orderId): array
    {
        $order = Order::with('merchant')->find($orderId);

        return [
            'merchant_id' => $order?->merchant_id,
            'buyer_id' => $order?->buyer_id,
            'merchant_user_id' => $order?->merchant?->user_id,
            'context' => $order?->custom_delivery_required ? 'custom_work' : 'order',
        ];
    }

    private function resolveEntitledItem(string $itemType, int $itemId): Product|ContentItem|Bundle|SubscriptionPlan|Post|null
    {
        return match ($itemType) {
            'product' => Product::find($itemId),
            'content_item' => ContentItem::withTrashed()->find($itemId),
            'bundle' => Bundle::find($itemId),
            'subscription_plan' => SubscriptionPlan::find($itemId),
            'post' => Post::withTrashed()->find($itemId),
            default => null,
        };
    }

    private function classifyLibraryType(Entitlement $entitlement, Product|ContentItem|Bundle|SubscriptionPlan|Post|null $resolved): string
    {
        if ($entitlement->item_type === 'product') {
            $productType = $resolved instanceof Product ? $resolved->type : null;

            return match ($productType) {
                'physical' => 'physical_product',
                'service' => 'service_booking',
                'digital' => ($resolved->digital_delivery_type ?? null) === 'custom_delivery' ? 'custom_work' : 'digital_file',
                default => 'digital_file',
            };
        }

        return 'post_content';
    }

    private function buildProductOrderDetails(int $orderId, Product $product): ?array
    {
        $order = Order::with('delivery.shippingZone')->find($orderId);
        if (!$order) {
            return null;
        }

        $details = [
            'id' => $order->id,
            'public_id' => $order->public_id,
            'payment_status' => $order->payment_status,
            'shipping_fee' => $order->shipping_fee,
            'total_paid' => $order->total_paid,
            'is_inquiry' => (bool) $order->is_inquiry,
            'inquiry_status' => $order->inquiry_status,
            'download_count' => (int) $order->download_count,
            'first_downloaded_at' => $order->first_downloaded_at?->toISOString(),
            'refund_policy' => $order->refundPolicyContext(),
            'custom_delivery' => [
                'file_name' => $order->custom_delivery_file_name,
                'file_mime' => $order->custom_delivery_file_mime,
                'file_size' => $order->custom_delivery_file_size !== null ? (int) $order->custom_delivery_file_size : null,
                'message' => $order->custom_delivery_message,
                'due_at' => $order->custom_delivery_due_at?->toISOString(),
                'delivered_at' => $order->custom_delivery_delivered_at?->toISOString(),
                'status' => $order->custom_delivery_status,
                'revision_message' => $order->custom_delivery_revision_message,
                'revision_requested_at' => $order->custom_delivery_revision_requested_at?->toISOString(),
                'revision_count' => (int) $order->custom_delivery_revision_count,
                'revision_limit' => Order::CUSTOM_DELIVERY_REVISION_LIMIT,
                'accepted_at' => $order->custom_delivery_accepted_at?->toISOString(),
            ],
            'delivery' => $order->delivery ? [
                'status' => $order->delivery->delivery_status,
                'type' => $order->delivery->delivery_type ?? $order->delivery->shippingZone?->delivery_type,
                'delivery_type' => $order->delivery->delivery_type ?? $order->delivery->shippingZone?->delivery_type,
                'pickup_pin' => $order->delivery->pickup_pin,
                'buyer_release_pin' => $order->delivery->buyer_release_pin,
                'bus_company' => $order->delivery->bus_company,
                'waybill_tracking_number' => $order->delivery->waybill_tracking_number,
                'waybill_photo_url' => $order->delivery->waybill_photo_url,
            ] : null,
        ];

        if ($product->type === 'service') {
            $serviceRequest = ServiceRequest::query()
                ->where('payment_order_id', $order->id)
                ->first();

            $details['service_request'] = $serviceRequest ? [
                'id' => $serviceRequest->id,
                'public_id' => $serviceRequest->public_id,
                'request_type' => $serviceRequest->request_type,
                'status' => $serviceRequest->status,
                'payment_status' => $serviceRequest->payment_status,
                'delivery_status' => $serviceRequest->delivery_status,
                'delivered_at' => $serviceRequest->delivered_at?->toISOString(),
                'customer_confirmed_at' => $serviceRequest->customer_confirmed_at?->toISOString(),
                'disputed_at' => $serviceRequest->disputed_at?->toISOString(),
                'auto_confirm_after' => $serviceRequest->auto_confirm_after?->toISOString(),
                'preferred_date' => $serviceRequest->preferred_date?->toDateString(),
                'preferred_time' => $serviceRequest->preferred_time,
                'scheduled_at' => $serviceRequest->scheduled_at?->toISOString(),
                'scheduled_ends_at' => $serviceRequest->scheduled_ends_at?->toISOString(),
                'timezone' => $serviceRequest->timezone,
                'duration_minutes' => $serviceRequest->duration_minutes,
                'location_text' => $serviceRequest->location_text,
                'quoted_amount' => $serviceRequest->quoted_amount !== null ? (float) $serviceRequest->quoted_amount : null,
                'service_option' => $serviceRequest->metadata['service_option'] ?? null,
                'service_session' => [
                    'id' => $serviceRequest->metadata['service_session_id'] ?? null,
                    'title' => $serviceRequest->metadata['service_session_title'] ?? null,
                ],
            ] : null;
        }

        return $details;
    }

    private function buildSearchBlob(Entitlement $entitlement, Product|ContentItem|Bundle|SubscriptionPlan|Post|null $resolved): string
    {
        $merchantName = (string) ($entitlement->merchant?->display_name ?? '');
        $title = '';
        $description = '';

        if ($resolved) {
            $title = (string) ($resolved->title ?? $resolved->name ?? '');
            $description = (string) ($resolved->excerpt ?? $resolved->description ?? $resolved->body ?? '');
        }

        return trim(strtolower("{$title} {$description} {$merchantName}"));
    }
}
