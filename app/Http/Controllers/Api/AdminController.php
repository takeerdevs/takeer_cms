<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Dispute;
use App\Models\DisputeResolution;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class AdminController extends Controller
{
    /**
     * Admin list of disputes with real order/evidence context.
     */
    public function indexDisputes(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', 'all');
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $query = Dispute::with([
            'order.buyer:id,name,phone_number',
            'order.merchant:id,display_name,username',
            'order.product:id,title,type',
            'order.delivery:id,order_id,bus_company,waybill_tracking_number,waybill_photo_url,delivery_status',
            'resolution:id,order_id,admin_id,verdict,reason_notes,created_at',
            'resolution.admin:id,name',
        ])->latest();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $disputes = $query->paginate($perPage);
        $disputes->getCollection()->transform(function (Dispute $dispute) {
            $order = $dispute->order;

            return [
                'id' => $dispute->id,
                'status' => $dispute->status,
                'dispute_reason' => $dispute->dispute_reason,
                'buyer_unboxing_video_url' => $dispute->buyer_unboxing_video_url,
                'admin_resolution_notes' => $dispute->admin_resolution_notes,
                'created_at' => $dispute->created_at?->toISOString(),
                'order' => $order ? [
                    'id' => $order->id,
                    'payment_status' => $order->payment_status,
                    'total_paid' => (float) $order->total_paid,
                    'merchant_dispatch_video_url' => $order->merchant_dispatch_video_url,
                    'buyer' => $order->buyer ? [
                        'id' => $order->buyer->id,
                        'name' => $order->buyer->name,
                        'phone_number' => $order->buyer->phone_number,
                    ] : null,
                    'merchant' => $order->merchant ? [
                        'id' => $order->merchant->id,
                        'display_name' => $order->merchant->display_name,
                        'username' => $order->merchant->username,
                    ] : null,
                    'product' => $order->product ? [
                        'id' => $order->product->id,
                        'title' => $order->product->title,
                        'type' => $order->product->type,
                    ] : null,
                    'delivery' => $order->delivery ? [
                        'delivery_status' => $order->delivery->delivery_status,
                        'bus_company' => $order->delivery->bus_company,
                        'waybill_tracking_number' => $order->delivery->waybill_tracking_number,
                        'waybill_photo_url' => $order->delivery->waybill_photo_url,
                    ] : null,
                ] : null,
                'resolution' => $dispute->resolution ? [
                    'verdict' => $dispute->resolution->verdict,
                    'reason_notes' => $dispute->resolution->reason_notes,
                    'created_at' => $dispute->resolution->created_at?->toISOString(),
                    'admin' => $dispute->resolution->admin ? [
                        'id' => $dispute->resolution->admin->id,
                        'name' => $dispute->resolution->admin->name,
                    ] : null,
                ] : null,
            ];
        });

        return response()->json($disputes);
    }

    /**
     * Admin resolves a dispute (Refunds Buyer or Pays Merchant).
     */
    public function resolveDispute(Request $request, Dispute $dispute): JsonResponse
    {
        $validated = $request->validate([
            'verdict' => 'required|in:refund_buyer,pay_merchant',
            'reason_notes' => 'required|string',
        ]);

        if ($dispute->status === 'resolved') {
            return response()->json(['message' => 'This dispute has already been resolved.'], 400);
        }

        DB::transaction(function () use ($request, $dispute, $validated) {
            $order = $dispute->order;

            $dispute->update(['status' => 'resolved']);

            DisputeResolution::create([
                'admin_id' => $request->user()->id,
                'order_id' => $order->id,
                'verdict' => $validated['verdict'],
                'reason_notes' => $validated['reason_notes'],
            ]);

            if ($validated['verdict'] === 'refund_buyer') {
                $order->update(['payment_status' => 'resolved_buyer_refunded']);
                // Refund logic (M-Pesa B2C or Wallet) goes here
                $wallet = $order->product->merchant->user->wallet()->firstOrCreate(
                    ['user_id' => $order->product->merchant->user_id],
                    ['balance' => 0, 'frozen_balance' => 0]
                );
                $wallet->decrement('frozen_balance', $order->total_paid);
            } else {
                $order->update(['payment_status' => 'resolved_merchant_paid']);
                $merchantWallet = $order->product->merchant->user->wallet()->firstOrCreate(
                    ['user_id' => $order->product->merchant->user_id],
                    ['balance' => 0, 'frozen_balance' => 0]
                );
                $merchantWallet->decrement('frozen_balance', $order->total_paid);
                $merchantWallet->increment('balance', $order->total_paid * 0.95);
            }
        });

        return response()->json(['message' => 'Dispute resolved successfully.']);
    }

    /**
     * Admin approves a standard M-Pesa withdrawal.
     */
    public function approveWithdrawal(Request $request, WithdrawalRequest $withdrawal): JsonResponse
    {
        if ($withdrawal->status !== 'pending') {
            return response()->json(['message' => 'This withdrawal request has already been handled.'], 400);
        }

        DB::transaction(function () use ($withdrawal) {
            $withdrawal->update(['status' => 'approved']);
            // M-Pesa B2C API trigger would go here to send funds to user's phone
        });

        return response()->json(['message' => 'Withdrawal approved successfully.']);
    }

    /**
     * Admin lists all merchants.
     */
    public function indexMerchants(Request $request): JsonResponse
    {
        $search = (string) $request->input('search', '');
        $status = (string) $request->input('status', 'all');

        $merchants = \App\Models\Merchant::with(['country', 'currency', 'user:id,name,phone_number,email'])
            ->withCount(['products', 'orders', 'posts', 'contentItems'])
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('display_name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%");
                });
            })
            ->when($status !== 'all', function ($q) use ($status) {
                if ($status === 'active') {
                    $q->where('is_suspended', false)->where('is_active', true);
                    return;
                }
                if ($status === 'suspended') {
                    $q->where('is_suspended', true);
                    return;
                }
                if ($status === 'inactive') {
                    $q->where('is_active', false);
                    return;
                }
                if ($status === 'verified') {
                    $q->where('is_verified', true);
                }
            })
            ->latest()
            ->paginate(20);

        return response()->json([
            'merchants' => $merchants,
        ]);
    }

    /**
     * Admin toggles a merchant's suspension.
     */
    public function toggleSuspension(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $merchant->update([
            'is_suspended' => !$merchant->is_suspended,
        ]);

        $status = $merchant->is_suspended ? 'suspended' : 're-activated';

        return response()->json([
            'message' => "Merchant account {$status} successfully.",
            'merchant' => $merchant,
        ]);
    }

    /**
     * Admin updates merchant control flags.
     */
    public function updateMerchant(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $validated = $request->validate([
            'is_suspended' => 'sometimes|boolean',
            'is_verified' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'kyc_status' => 'sometimes|nullable|string|max:40',
        ]);

        $merchant->update($validated);

        return response()->json([
            'message' => 'Merchant updated successfully.',
            'merchant' => $merchant->fresh(['user:id,name,phone_number,email']),
        ]);
    }

    /**
     * Admin view: merchant profile + control summary.
     */
    public function showMerchant(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $merchant->load(['user:id,name,email,phone_number,created_at', 'country:id,name,iso_alpha2', 'currency:id,name,code,symbol']);
        $merchant->loadCount(['products', 'posts', 'contentItems', 'bundles', 'subscriptionPlans', 'orders']);

        $summary = [
            'gross_revenue' => (float) Order::where('merchant_id', $merchant->id)->sum('total_paid'),
            'paid_orders' => Order::where('merchant_id', $merchant->id)->where('payment_status', 'resolved_merchant_paid')->count(),
            'open_disputes' => \App\Models\Dispute::whereHas('order', fn ($q) => $q->where('merchant_id', $merchant->id))
                ->where('status', 'open')
                ->count(),
            'latest_order_at' => optional(Order::where('merchant_id', $merchant->id)->latest()->first())->created_at?->toISOString(),
            'content_types' => [
                'physical_products' => Product::where('merchant_id', $merchant->id)->where('type', 'physical')->count(),
                'digital_downloads' => Product::where('merchant_id', $merchant->id)->where('type', 'digital')->count(),
                'service_bookings' => Product::where('merchant_id', $merchant->id)->where('type', 'service')->count(),
                'posts' => Post::where('merchant_id', $merchant->id)->count(),
                'bundles' => Bundle::where('merchant_id', $merchant->id)->count(),
                'subscriptions' => SubscriptionPlan::where('merchant_id', $merchant->id)->count(),
            ],
        ];

        return response()->json([
            'merchant' => $merchant,
            'summary' => $summary,
        ]);
    }

    public function merchantProducts(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $products = Product::query()
            ->where('merchant_id', $merchant->id)
            ->with(['attributes:id,product_id,suggested_description', 'images:id,product_id,image_url,order'])
            ->withCount(['orders'])
            ->latest()
            ->paginate(20);

        return response()->json($products);
    }

    public function merchantPosts(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $posts = Post::query()
            ->where('merchant_id', $merchant->id)
            ->with(['media:id,post_id,media_url,media_type', 'linkedContentItem:id,title,visibility,price'])
            ->latest()
            ->paginate(20);

        return response()->json($posts);
    }

    public function merchantOrders(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $orders = Order::query()
            ->where('merchant_id', $merchant->id)
            ->with([
                'buyer:id,name,phone_number',
                'product:id,title,type',
                'delivery:id,order_id,delivery_status,bus_company,waybill_tracking_number,created_at',
                'dispute:id,order_id,status,created_at',
            ])
            ->latest()
            ->paginate(20);

        $orders->getCollection()->transform(function (Order $order) {
            return [
                'id' => $order->id,
                'purchasable_type' => $order->purchasable_type,
                'purchasable_id' => $order->purchasable_id,
                'quantity' => $order->quantity,
                'total_paid' => (float) $order->total_paid,
                'payment_status' => $order->payment_status,
                'created_at' => $order->created_at?->toISOString(),
                'item_title' => $order->resolved_purchasable?->title
                    ?? $order->resolved_purchasable?->name
                    ?? $order->product?->title
                    ?? 'Order item',
                'buyer' => $order->buyer ? [
                    'id' => $order->buyer->id,
                    'name' => $order->buyer->name,
                    'phone_number' => $order->buyer->phone_number,
                ] : null,
                'product' => $order->product ? [
                    'id' => $order->product->id,
                    'title' => $order->product->title,
                    'type' => $order->product->type,
                ] : null,
                'delivery' => $order->delivery ? [
                    'delivery_status' => $order->delivery->delivery_status,
                    'bus_company' => $order->delivery->bus_company,
                    'waybill_tracking_number' => $order->delivery->waybill_tracking_number,
                ] : null,
                'dispute' => $order->dispute ? [
                    'status' => $order->dispute->status,
                    'created_at' => $order->dispute->created_at?->toISOString(),
                ] : null,
            ];
        });

        return response()->json($orders);
    }

    public function merchantCatalogByType(Request $request, \App\Models\Merchant $merchant, string $type): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $q = (string) $request->input('search', '');

        $allowed = ['physical', 'digital', 'service', 'posts', 'bundles', 'subscriptions'];
        if (!in_array($type, $allowed, true)) {
            return response()->json(['message' => 'Invalid catalog type.'], 422);
        }

        if (in_array($type, ['physical', 'digital', 'service'], true)) {
            $rows = Product::query()
                ->where('merchant_id', $merchant->id)
                ->where('type', $type)
                ->when($q !== '', fn($query) => $query->where('title', 'like', "%{$q}%"))
                ->with(['images:id,product_id,image_url,order'])
                ->withCount(['orders'])
                ->latest()
                ->paginate($perPage);

            return response()->json($rows);
        }

        if ($type === 'posts') {
            $rows = Post::query()
                ->where('merchant_id', $merchant->id)
                ->when($q !== '', fn($query) => $query->where('title', 'like', "%{$q}%")->orWhere('caption', 'like', "%{$q}%"))
                ->with(['media:id,post_id,media_url,media_type'])
                ->latest()
                ->paginate($perPage);

            return response()->json($rows);
        }

        if ($type === 'bundles') {
            $rows = Bundle::query()
                ->where('merchant_id', $merchant->id)
                ->when($q !== '', fn($query) => $query->where('title', 'like', "%{$q}%"))
                ->withCount(['items'])
                ->latest()
                ->paginate($perPage);

            return response()->json($rows);
        }

        $rows = SubscriptionPlan::query()
            ->where('merchant_id', $merchant->id)
            ->when($q !== '', fn($query) => $query->where('name', 'like', "%{$q}%"))
            ->withCount(['items', 'subscriptions'])
            ->latest()
            ->paginate($perPage);

        return response()->json($rows);
    }

    public function adminFeed(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $q = (string) $request->input('search', '');
        $merchantId = (int) $request->input('merchant', 0);

        $posts = Post::withTrashed()
            ->with([
                'merchant.storefrontSetting',
                'linkedContentItem',
                'media.productImage',
                'linkedProduct.attributes',
                'linkedProduct.images',
                'linkedProduct.variants',
                'product.attributes',
                'product.images',
                'product.variants',
                'productTags.product.attributes',
                'productTags.product.images',
                'productTags.product.variants',
                'reactions',
                'promotableBundles',
                'promotableSubscriptions',
            ])
            ->when($merchantId > 0, fn($query) => $query->where('merchant_id', $merchantId))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('title', 'like', "%{$q}%")
                        ->orWhere('caption', 'like', "%{$q}%")
                        ->orWhere('body', 'like', "%{$q}%");
                });
            })
            ->latest()
            ->paginate($perPage);

        return PostResource::collection($posts)->response();
    }

    public function adminPostDetail(Request $request, string $postRef): JsonResponse
    {
        $query = Post::withTrashed()->with([
            'merchant:id,display_name,username',
            'media:id,post_id,media_url,media_type,likes_count',
            'linkedProduct:id,title,type,price,url,download_link,has_variants,discounted_price',
            'linkedProduct.images',
            'linkedProduct.attributes',
            'linkedProduct.variants',
            'linkedContentItem:id,title,excerpt,body,price,visibility,format',
            'product:id,title,type,price,url,download_link,has_variants,discounted_price',
            'product.images',
            'product.attributes',
            'product.variants',
            'productTags.product:id,title,type,price,url,download_link,has_variants,discounted_price',
            'productTags.product.images',
            'productTags.product.attributes',
            'productTags.product.variants',
        ])->where('public_id', $postRef);

        if (ctype_digit($postRef)) {
            $query->orWhere('id', (int) $postRef);
        }

        $post = $query->firstOrFail();

        return response()->json([
            'post' => PostResource::make($post)->resolve($request),
        ]);
    }

    public function adminShowPostDetailPage(Request $request, string $postRef): InertiaResponse
    {
        $query = Post::withTrashed()->with([
            'merchant.storefrontSetting',
            'linkedContentItem',
            'media.productImage',
            'linkedProduct.attributes',
            'linkedProduct.images',
            'linkedProduct.variants',
            'product.attributes',
            'product.images',
            'product.variants',
            'productTags.product.attributes',
            'productTags.product.images',
            'productTags.product.variants',
            'reactions',
        ])->where('public_id', $postRef);

        if (ctype_digit($postRef)) {
            $query->orWhere('id', (int) $postRef);
        }

        $post = $query->firstOrFail();

        return Inertia::render('PostDetail', [
            'post' => PostResource::make($post)->resolve($request),
            'postId' => $post->id,
            'initialComments' => Inertia::defer(
                fn() => \App\Http\Resources\CommentResource::collection(
                    $post->comments()
                        ->whereNull('parent_id')
                        ->with(['user', 'replies.user', 'replies.replies.user'])
                        ->latest()
                        ->paginate(15)
                )->resolve()
            ),
            'readOnly' => true,
            'backHref' => '/admin/feed',
        ]);
    }

    public function globalSearch(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([
                'users' => [],
                'merchants' => [],
                'products' => [],
                'posts' => [],
                'orders' => [],
            ]);
        }

        $users = \App\Models\User::query()
            ->select('id', 'name', 'phone_number', 'role', 'is_admin')
            ->where(fn($x) => $x->where('name', 'like', "%{$q}%")->orWhere('phone_number', 'like', "%{$q}%"))
            ->limit(8)
            ->get();

        $merchants = \App\Models\Merchant::query()
            ->select('id', 'display_name', 'username', 'kyc_status', 'is_suspended')
            ->where(fn($x) => $x->where('display_name', 'like', "%{$q}%")->orWhere('username', 'like', "%{$q}%"))
            ->limit(8)
            ->get();

        $products = Product::query()
            ->select('id', 'merchant_id', 'title', 'type', 'price')
            ->where('title', 'like', "%{$q}%")
            ->limit(8)
            ->get();

        $posts = Post::withTrashed()
            ->select('id', 'merchant_id', 'public_id', 'title', 'caption', 'created_at')
            ->where(fn($x) => $x->where('title', 'like', "%{$q}%")->orWhere('caption', 'like', "%{$q}%"))
            ->latest()
            ->limit(8)
            ->get();

        $orders = Order::query()
            ->select('id', 'merchant_id', 'buyer_id', 'payment_status', 'total_paid', 'created_at')
            ->where('id', 'like', "%{$q}%")
            ->orWhere('transaction_ref', 'like', "%{$q}%")
            ->latest()
            ->limit(8)
            ->get();

        return response()->json(compact('users', 'merchants', 'products', 'posts', 'orders'));
    }
}
