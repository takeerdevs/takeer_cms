<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Dispute;
use App\Models\DisputeResolution;
use App\Models\MerchantStrike;
use App\Models\MerchantServiceCredential;
use App\Models\MerchantTrustSafetyReview;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\RetailAuditLog;
use App\Models\ServiceCategory;
use App\Models\ServiceRequest;
use App\Models\SubscriptionPlan;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
                    'public_id' => $order->public_id,
                    'source' => $order->source,
                    'payment_mode' => $order->payment_mode,
                    'customer_name' => $order->customer_name,
                    'customer_phone' => $order->customer_phone,
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

        if ($dispute->status !== 'open') {
            return response()->json(['message' => 'This dispute has already been resolved.'], 400);
        }

        if ($dispute->buyer_unboxing_video_url === 'pos-credit-link-report') {
            return response()->json([
                'message' => 'POS payment-link reports must be handled with Trust & Safety actions.',
            ], 422);
        }

        $order = $dispute->order;
        if (!$order || !$this->hasPlatformHeldPayment($order)) {
            return response()->json([
                'message' => 'This order has no refundable platform-held payment.',
            ], 422);
        }

        DB::transaction(function () use ($request, $dispute, $validated) {
            $order = $dispute->order;
            $status = $validated['verdict'] === 'refund_buyer' ? 'ruled_for_buyer' : 'ruled_for_merchant';

            $dispute->update(['status' => $status]);

            DisputeResolution::create([
                'admin_id' => $request->user()->id,
                'order_id' => $order->id,
                'verdict' => $status,
                'reason_notes' => $validated['reason_notes'],
            ]);

            if ($validated['verdict'] === 'refund_buyer') {
                $order->update(['payment_status' => 'resolved_buyer_refunded']);
                \App\Models\ServiceRequest::query()
                    ->where('payment_order_id', $order->id)
                    ->update([
                        'payment_status' => 'refunded',
                        'delivery_status' => 'disputed',
                    ]);
                // Refund logic (M-Pesa B2C or Wallet) goes here
                $wallet = $order->merchant->user->wallet()->firstOrCreate(
                    ['user_id' => $order->merchant->user_id],
                    ['balance' => 0, 'frozen_balance' => 0]
                );
                $wallet->decrement('frozen_balance', $order->total_paid);
            } else {
                $order->update(['payment_status' => 'resolved_merchant_paid']);
                \App\Models\ServiceRequest::query()
                    ->where('payment_order_id', $order->id)
                    ->update([
                        'payment_status' => 'released',
                        'delivery_status' => 'customer_confirmed',
                        'customer_confirmed_at' => now(),
                        'status' => 'completed',
                    ]);
                $merchantWallet = $order->merchant->user->wallet()->firstOrCreate(
                    ['user_id' => $order->merchant->user_id],
                    ['balance' => 0, 'frozen_balance' => 0]
                );
                $netAmount = \App\Models\Transaction::query()
                    ->where('order_id', $order->id)
                    ->where('type', 'order_revenue')
                    ->latest()
                    ->value('net_amount')
                    ?? app(\App\Services\FeePolicyService::class)->calculateForOrder($order, (float) $order->total_paid)['net_amount'];
                $merchantWallet->decrement('frozen_balance', $order->total_paid);
                $merchantWallet->increment('balance', $netAmount);
            }
        });

        return response()->json(['message' => 'Dispute resolved successfully.']);
    }

    public function handleTrustSafetyDispute(Request $request, Dispute $dispute): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:dismiss,warn_merchant,add_strike,disable_pos_links,suspend_merchant',
            'reason_notes' => 'required|string|max:2000',
        ]);

        if ($dispute->status !== 'open') {
            return response()->json(['message' => 'This report has already been handled.'], 400);
        }

        if ($dispute->buyer_unboxing_video_url !== 'pos-credit-link-report') {
            return response()->json([
                'message' => 'This action is only for POS payment-link abuse reports.',
            ], 422);
        }

        $order = $dispute->order()->with(['merchant.user'])->first();
        $merchant = $order?->merchant;

        if (!$order || !$merchant) {
            return response()->json(['message' => 'The reported POS order or merchant was not found.'], 422);
        }

        DB::transaction(function () use ($request, $dispute, $order, $merchant, $validated) {
            $action = $validated['action'];
            $status = $action === 'dismiss' ? 'ruled_for_merchant' : 'ruled_for_buyer';
            $severity = match ($action) {
                'warn_merchant' => 'warning',
                'add_strike', 'disable_pos_links' => 'serious',
                'suspend_merchant' => 'critical',
                default => null,
            };

            if ($action === 'disable_pos_links') {
                $settings = $merchant->retail_settings;
                $settings['disable_pos_payment_links'] = true;
                $merchant->update(['retail_settings' => $settings]);
            }

            if ($action === 'suspend_merchant') {
                $merchant->update(['is_suspended' => true]);
            }

            if ($severity) {
                MerchantStrike::create([
                    'merchant_id' => $merchant->id,
                    'dispute_id' => $dispute->id,
                    'admin_id' => $request->user()?->id,
                    'type' => 'pos_payment_link_abuse',
                    'severity' => $severity,
                    'notes' => $validated['reason_notes'],
                ]);
            }

            $dispute->update([
                'status' => $status,
                'admin_resolution_notes' => $validated['reason_notes'],
            ]);

            DisputeResolution::create([
                'admin_id' => $request->user()?->id,
                'order_id' => $order->id,
                'verdict' => $status,
                'reason_notes' => $this->trustSafetyActionLabel($action) . ': ' . $validated['reason_notes'],
            ]);

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'staff_id' => null,
                'user_id' => $request->user()?->id,
                'action' => 'POS_PAYMENT_LINK_TRUST_SAFETY_ACTION',
                'description' => "Admin handled POS link report for {$order->public_id}.",
                'metadata' => [
                    'order_id' => $order->id,
                    'public_id' => $order->public_id,
                    'dispute_id' => $dispute->id,
                    'action' => $action,
                    'severity' => $severity,
                ],
            ]);
        });

        $order->refresh()->loadMissing(['merchant.user']);
        $this->sendMerchantTrustSafetyEmail(
            dispute: $dispute->fresh(),
            order: $order,
            action: $validated['action'],
            notes: $validated['reason_notes']
        );

        return response()->json(['message' => 'Trust & Safety action recorded successfully.']);
    }

    private function hasPlatformHeldPayment(Order $order): bool
    {
        $isServiceSafePay = \App\Models\ServiceRequest::query()
            ->where('payment_order_id', $order->id)
            ->exists();

        return (float) $order->total_paid > 0
            && ($order->payment_mode === 'online_escrow' || $isServiceSafePay)
            && in_array($order->payment_status, [
                'escrow_locked',
                'awaiting_merchant_confirmation',
                'paid_pending_confirmation',
                'paid',
            ], true);
    }

    private function trustSafetyActionLabel(string $action): string
    {
        return match ($action) {
            'dismiss' => 'Report dismissed',
            'warn_merchant' => 'Merchant warned',
            'add_strike' => 'Merchant strike added',
            'disable_pos_links' => 'POS payment links disabled',
            'suspend_merchant' => 'Merchant suspended',
            default => 'Trust & Safety action',
        };
    }

    private function sendMerchantTrustSafetyEmail(Dispute $dispute, Order $order, string $action, string $notes): void
    {
        $merchant = $order->merchant;
        $email = $merchant?->user?->email;

        if (!$email || $action === 'dismiss') {
            return;
        }

        try {
            $actionLabel = $this->trustSafetyActionLabel($action);

            Mail::send('emails.merchant-pos-link-warning', [
                'merchantName' => $merchant->display_name ?: $merchant->username ?: 'Mfanyabiashara',
                'orderPublicId' => $order->public_id,
                'customerReport' => $dispute->dispute_reason,
                'actionLabel' => $actionLabel,
                'adminNotes' => $notes,
            ], function ($message) use ($email, $actionLabel) {
                $message->to($email)->subject('Takeer: ' . $actionLabel);
            });
        } catch (\Throwable $exception) {
            report($exception);
        }
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
                    return;
                }
                if ($status === 'pending') {
                    $q->where('kyc_status', 'pending');
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
     * Admin suspends a merchant directly from service risk operations.
     */
    public function suspendMerchantForServiceRisk(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        $notes = trim((string) ($validated['reason'] ?? ''));
        if ($notes === '') {
            $notes = 'Suspended from Service Risk dashboard due to unresolved service trust risk.';
        }

        DB::transaction(function () use ($request, $merchant, $notes) {
            $merchant->update(['is_suspended' => true]);

            MerchantStrike::create([
                'merchant_id' => $merchant->id,
                'admin_id' => $request->user()?->id,
                'type' => 'service_trust_risk',
                'severity' => 'critical',
                'notes' => $notes,
            ]);
        });

        return response()->json([
            'message' => 'Merchant suspended and service risk strike recorded.',
            'merchant' => $merchant->fresh(),
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

    public function updateMerchantSettings(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $validated = $request->validate([
            'disable_pos_payment_links' => 'sometimes|boolean',
            'reason_notes' => 'nullable|string|max:2000',
        ]);

        $settings = $merchant->retail_settings;

        if (array_key_exists('disable_pos_payment_links', $validated)) {
            $settings['disable_pos_payment_links'] = (bool) $validated['disable_pos_payment_links'];
        }

        $merchant->update(['retail_settings' => $settings]);

        RetailAuditLog::create([
            'merchant_id' => $merchant->id,
            'staff_id' => null,
            'user_id' => $request->user()?->id,
            'action' => 'ADMIN_MERCHANT_SETTINGS_UPDATED',
            'description' => 'Admin updated merchant settings.',
            'metadata' => [
                'disable_pos_payment_links' => $settings['disable_pos_payment_links'] ?? false,
                'reason_notes' => $validated['reason_notes'] ?? null,
            ],
        ]);

        return response()->json([
            'message' => 'Merchant settings updated successfully.',
            'merchant' => $merchant->fresh(['user:id,name,phone_number,email']),
        ]);
    }

    public function indexTrustSafetyReviews(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', 'pending');

        $reviews = MerchantTrustSafetyReview::query()
            ->with([
                'merchant:id,display_name,username,retail_settings,is_suspended,user_id',
                'merchant.user:id,name,email,phone_number',
                'requestedBy:id,name,email,phone_number',
                'reviewedBy:id,name',
            ])
            ->when($status !== 'all', fn($q) => $q->where('status', $status))
            ->latest()
            ->paginate(20);

        return response()->json($reviews);
    }

    public function resolveTrustSafetyReview(Request $request, MerchantTrustSafetyReview $review): JsonResponse
    {
        $validated = $request->validate([
            'decision' => 'required|in:keep_restriction,reenable_pos_links,dismiss',
            'admin_notes' => 'required|string|max:2000',
        ]);

        $merchant = $review->merchant;

        DB::transaction(function () use ($request, $review, $merchant, $validated) {
            if ($validated['decision'] === 'reenable_pos_links') {
                $settings = $merchant->retail_settings;
                $settings['disable_pos_payment_links'] = false;
                $merchant->update(['retail_settings' => $settings]);
            }

            $review->update([
                'status' => $validated['decision'] === 'dismiss' ? 'dismissed' : 'reviewed',
                'reviewed_by_admin_id' => $request->user()?->id,
                'admin_notes' => $validated['admin_notes'],
                'action_taken' => $validated['decision'],
                'reviewed_at' => now(),
            ]);

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'staff_id' => null,
                'user_id' => $request->user()?->id,
                'action' => 'ADMIN_TRUST_SAFETY_REVIEW_RESOLVED',
                'description' => 'Admin resolved merchant Trust & Safety review request.',
                'metadata' => [
                    'review_id' => $review->id,
                    'decision' => $validated['decision'],
                    'admin_notes' => $validated['admin_notes'],
                ],
            ]);
        });

        return response()->json([
            'message' => 'Review request resolved successfully.',
            'review' => $review->fresh(['merchant.user', 'requestedBy', 'reviewedBy']),
        ]);
    }

    public function showMerchant(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $merchant->load([
            'user:id,name,email,phone_number,created_at',
            'country:id,name,iso_alpha2',
            'currency:id,name,code,symbol',
            'kyc',
            'serviceCredentials.serviceCategory:id,name,parent_id',
            'strikes' => fn ($query) => $query->latest()->limit(5),
        ]);
        $merchant->loadCount(['products', 'posts', 'contentItems', 'bundles', 'subscriptionPlans', 'orders', 'strikes']);

        // Resolve signed URLs for KYC documents if they exist
        if ($merchant->kyc) {
            $mediaService = app(\App\Services\MediaUploadService::class);
            if ($merchant->kyc->id_front_url) {
                $path = str_replace('private://', '', $merchant->kyc->id_front_url);
                try {
                    $merchant->kyc->id_front_signed_url = $mediaService->getSignedUrl($path);
                } catch (\Exception $e) {
                    $merchant->kyc->id_front_signed_url = null;
                }
            }
            if ($merchant->kyc->id_back_url) {
                $path = str_replace('private://', '', $merchant->kyc->id_back_url);
                try {
                    $merchant->kyc->id_back_signed_url = $mediaService->getSignedUrl($path);
                } catch (\Exception $e) {
                    $merchant->kyc->id_back_signed_url = null;
                }
            }
            if ($merchant->kyc->business_license_url) {
                $path = str_replace('private://', '', $merchant->kyc->business_license_url);
                try {
                    $merchant->kyc->business_license_signed_url = $mediaService->getSignedUrl($path);
                } catch (\Exception $e) {
                    $merchant->kyc->business_license_signed_url = null;
                }
            }
            if ($merchant->kyc->registration_doc_url) {
                $path = str_replace('private://', '', $merchant->kyc->registration_doc_url);
                try {
                    $merchant->kyc->registration_doc_signed_url = $mediaService->getSignedUrl($path);
                } catch (\Exception $e) {
                    $merchant->kyc->registration_doc_signed_url = null;
                }
            }
        }

        if ($merchant->relationLoaded('serviceCredentials')) {
            $mediaService = $mediaService ?? app(\App\Services\MediaUploadService::class);
            $merchant->serviceCredentials->each(function (MerchantServiceCredential $credential) use ($mediaService) {
                $path = str_replace('private://', '', (string) $credential->document_url);
                $credential->document_signed_url = null;
                if ($path !== '') {
                    try {
                        $credential->document_signed_url = $mediaService->getSignedUrl($path);
                    } catch (\Exception $e) {
                        $credential->document_signed_url = null;
                    }
                }
            });
        }

        $disputesQuery = \App\Models\Dispute::whereHas('order', fn ($q) => $q->where('merchant_id', $merchant->id));
        $posLinkReportsQuery = (clone $disputesQuery)->where('buyer_unboxing_video_url', 'pos-credit-link-report');

        $summary = [
            'gross_revenue' => (float) Order::where('merchant_id', $merchant->id)->sum('total_paid'),
            'paid_orders' => Order::where('merchant_id', $merchant->id)->where('payment_status', 'resolved_merchant_paid')->count(),
            'total_disputes' => (clone $disputesQuery)->count(),
            'open_disputes' => (clone $disputesQuery)->where('status', 'open')->count(),
            'pos_link_reports' => (clone $posLinkReportsQuery)->count(),
            'open_pos_link_reports' => (clone $posLinkReportsQuery)->where('status', 'open')->count(),
            'merchant_strikes' => $merchant->strikes_count,
            'retail_settings' => [
                'disable_pos_payment_links' => filter_var($merchant->retail_settings['disable_pos_payment_links'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ],
            'recent_strikes' => $merchant->strikes->map(fn (MerchantStrike $strike) => [
                'id' => $strike->id,
                'type' => $strike->type,
                'severity' => $strike->severity,
                'notes' => $strike->notes,
                'created_at' => $strike->created_at?->toISOString(),
            ])->values(),
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

    /**
     * Admin approves merchant KYC.
     */
    public function approveKyc(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $merchant->update([
            'kyc_status' => 'verified',
            'is_verified' => true,
        ]);

        if ($merchant->kyc) {
            $merchant->kyc->update(['status' => 'verified']);
        }

        return response()->json([
            'message' => 'Merchant identity verified successfully.',
            'merchant' => $merchant->fresh(),
        ]);
    }

    /**
     * Admin rejects merchant KYC.
     */
    public function rejectKyc(Request $request, \App\Models\Merchant $merchant): JsonResponse
    {
        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $merchant->update([
            'kyc_status' => 'rejected',
            'is_verified' => false,
        ]);

        if ($merchant->kyc) {
            $merchant->kyc->update([
                'status' => 'rejected',
                'rejection_reason' => $request->input('reason'),
            ]);
        }

        return response()->json([
            'message' => 'Merchant identity rejected.',
            'merchant' => $merchant->fresh(),
        ]);
    }

    public function approveServiceCredential(Request $request, \App\Models\Merchant $merchant, MerchantServiceCredential $credential): JsonResponse
    {
        abort_if($credential->merchant_id !== $merchant->id, 404);

        $validated = $request->validate([
            'review_checklist' => 'required|array',
            'review_checklist.identity_matches' => 'accepted',
            'review_checklist.document_readable' => 'accepted',
            'review_checklist.category_matches' => 'accepted',
            'review_checklist.issuer_trusted' => 'accepted',
            'review_checklist.not_expired' => 'accepted',
            'review_notes' => 'nullable|string|max:1000',
        ]);

        $credential->update([
            'status' => 'verified',
            'rejection_reason' => null,
            'review_checklist' => $validated['review_checklist'],
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
            'expired_at' => null,
        ]);

        return response()->json([
            'message' => 'Service credential approved.',
            'merchant' => $this->merchantWithCredentialUrls($merchant),
        ]);
    }

    public function rejectServiceCredential(Request $request, \App\Models\Merchant $merchant, MerchantServiceCredential $credential): JsonResponse
    {
        abort_if($credential->merchant_id !== $merchant->id, 404);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
            'review_notes' => 'nullable|string|max:1000',
        ]);

        $credential->update([
            'status' => 'rejected',
            'rejection_reason' => $validated['reason'],
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Service credential rejected.',
            'merchant' => $this->merchantWithCredentialUrls($merchant),
        ]);
    }

    private function merchantWithCredentialUrls(\App\Models\Merchant $merchant): \App\Models\Merchant
    {
        $merchant = $merchant->fresh(['kyc', 'serviceCredentials.serviceCategory:id,name,parent_id']);
        $mediaService = app(\App\Services\MediaUploadService::class);

        $merchant->serviceCredentials->each(function (MerchantServiceCredential $credential) use ($mediaService) {
            $path = str_replace('private://', '', (string) $credential->document_url);
            $credential->document_signed_url = $path !== '' ? $mediaService->getSignedUrl($path) : null;
        });

        return $merchant;
    }

    /**
     * Proxy for viewing private KYC files in admin.
     */
    public function viewKycFile(Request $request): \Illuminate\Http\Response|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $path = $request->query('path');
        if (!$path) abort(404);

        \Illuminate\Support\Facades\Log::info("Admin viewing KYC: " . $path);

        try {
            if (config('filesystems.disks.s3.key') && Storage::disk('s3')->exists($path)) {
                return response(Storage::disk('s3')->get($path))->header('Content-Type', Storage::disk('s3')->mimeType($path));
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("S3 KYC Error: " . $e->getMessage());
        }

        if (Storage::disk('local')->exists($path)) {
            \Illuminate\Support\Facades\Log::info("Found locally: " . Storage::disk('local')->path($path));
            return response()->file(Storage::disk('local')->path($path));
        }

        \Illuminate\Support\Facades\Log::warning("KYC Not found: " . $path);
        abort(404);
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

    public function services(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $q = trim((string) $request->input('search', ''));
        $mode = (string) $request->input('mode', 'all');
        $category = trim((string) $request->input('category', ''));

        $query = Product::query()
            ->where('type', 'service')
            ->with(['merchant:id,display_name,username,is_suspended', 'images:id,product_id,image_url,order'])
            ->withCount([
                'serviceRequests',
                'serviceRequests as pending_requests_count' => fn ($requests) => $requests->whereIn('status', ['pending', 'contacted', 'quoted']),
                'serviceRequests as paid_requests_count' => fn ($requests) => $requests->where('payment_status', 'paid'),
            ])
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('title', 'like', "%{$q}%")
                        ->orWhere('service_category', 'like', "%{$q}%")
                        ->orWhere('service_subcategory', 'like', "%{$q}%")
                        ->orWhereHas('merchant', function ($merchantQuery) use ($q) {
                            $merchantQuery->where('display_name', 'like', "%{$q}%")
                                ->orWhere('username', 'like', "%{$q}%");
                        });
                });
            })
            ->when($mode !== 'all' && $mode !== '', fn ($query) => $query->where('service_mode', $mode))
            ->when($category !== '', fn ($query) => $query->where('service_category', $category))
            ->latest();

        $services = $query->paginate($perPage);
        $productIds = $services->getCollection()->pluck('id')->all();

        $latestRequests = ServiceRequest::query()
            ->whereIn('product_id', $productIds)
            ->latest()
            ->get()
            ->groupBy('product_id')
            ->map(fn ($requests) => $requests->take(3)->map(fn (ServiceRequest $serviceRequest) => [
                'id' => $serviceRequest->id,
                'public_id' => $serviceRequest->public_id,
                'request_type' => $serviceRequest->request_type,
                'status' => $serviceRequest->status,
                'payment_status' => $serviceRequest->payment_status,
                'customer_name' => $serviceRequest->customer_name,
                'preferred_date' => $serviceRequest->preferred_date?->toDateString(),
                'scheduled_at' => $serviceRequest->scheduled_at?->toISOString(),
                'created_at' => $serviceRequest->created_at?->toISOString(),
            ])->values());

        $services->getCollection()->transform(function (Product $product) use ($latestRequests) {
            return [
                'id' => $product->id,
                'title' => $product->title,
                'status' => $product->status,
                'price' => (float) $product->price,
                'image_url' => $product->images->sortBy('order')->first()?->image_url ?? $product->url,
                'service_mode' => $product->service_mode,
                'service_category' => $product->service_category,
                'service_subcategory' => $product->service_subcategory,
                'service_price_display' => $product->service_price_display,
                'service_charges' => $product->service_charges ?? [],
                'service_location_type' => $product->service_location_type,
                'service_area' => $product->service_area ?? [],
                'service_duration_minutes' => $product->service_duration_minutes,
                'service_booking_provider' => $product->service_booking_provider,
                'service_requests_count' => (int) ($product->service_requests_count ?? 0),
                'pending_requests_count' => (int) ($product->pending_requests_count ?? 0),
                'paid_requests_count' => (int) ($product->paid_requests_count ?? 0),
                'created_at' => $product->created_at?->toISOString(),
                'merchant' => $product->merchant ? [
                    'id' => $product->merchant->id,
                    'display_name' => $product->merchant->display_name,
                    'username' => $product->merchant->username,
                    'is_suspended' => (bool) $product->merchant->is_suspended,
                ] : null,
                'latest_requests' => $latestRequests->get($product->id, collect())->values(),
            ];
        });

        return response()->json($services);
    }

    public function serviceRiskDashboard(Request $request): JsonResponse
    {
        $pendingCredentials = MerchantServiceCredential::query()
            ->with(['merchant:id,display_name,username,is_suspended', 'serviceCategory:id,name,parent_id'])
            ->where('status', 'pending')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (MerchantServiceCredential $credential) => [
                'id' => $credential->id,
                'document_name' => $credential->document_name,
                'document_type' => $credential->document_type,
                'category_name' => $credential->category_name,
                'subcategory_name' => $credential->subcategory_name,
                'issuer' => $credential->issuer,
                'expires_at' => $credential->expires_at?->toDateString(),
                'created_at' => $credential->created_at?->toISOString(),
                'merchant' => $credential->merchant ? [
                    'id' => $credential->merchant->id,
                    'display_name' => $credential->merchant->display_name,
                    'username' => $credential->merchant->username,
                    'is_suspended' => (bool) $credential->merchant->is_suspended,
                ] : null,
            ]);

        $expiringCredentials = MerchantServiceCredential::query()
            ->with(['merchant:id,display_name,username,is_suspended', 'serviceCategory:id,name,parent_id'])
            ->where('status', 'verified')
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '>=', now()->toDateString())
            ->whereDate('expires_at', '<=', now()->addDays(30)->toDateString())
            ->orderBy('expires_at')
            ->limit(20)
            ->get()
            ->map(fn (MerchantServiceCredential $credential) => [
                'id' => $credential->id,
                'document_name' => $credential->document_name,
                'document_type' => $credential->document_type,
                'category_name' => $credential->category_name,
                'subcategory_name' => $credential->subcategory_name,
                'issuer' => $credential->issuer,
                'expires_at' => $credential->expires_at?->toDateString(),
                'merchant' => $credential->merchant ? [
                    'id' => $credential->merchant->id,
                    'display_name' => $credential->merchant->display_name,
                    'username' => $credential->merchant->username,
                    'is_suspended' => (bool) $credential->merchant->is_suspended,
                ] : null,
            ]);

        $categoryPolicies = ServiceCategory::query()
            ->get()
            ->groupBy(fn (ServiceCategory $category) => Str::lower(trim((string) $category->name)));

        $regulatedServices = Product::query()
            ->where('type', 'service')
            ->with(['merchant:id,display_name,username,is_verified,kyc_status,is_suspended'])
            ->latest()
            ->limit(250)
            ->get()
            ->map(function (Product $product) use ($categoryPolicies) {
                $policy = $this->serviceCategoryPolicyForProduct($product, $categoryPolicies);
                if (! $policy) {
                    return null;
                }

                $requiredDocuments = collect($policy->required_documents ?: []);
                if (! $requiredDocuments->contains('professional_license') && ! in_array($policy->risk_level, ['elevated', 'regulated', 'restricted'], true)) {
                    return null;
                }

                $categoryIds = array_filter([$policy->id, $policy->parent_id]);
                $hasCredential = MerchantServiceCredential::query()
                    ->where('merchant_id', $product->merchant_id)
                    ->where('status', 'verified')
                    ->whereIn('service_category_id', $categoryIds)
                    ->where(function ($query) {
                        $query->whereNull('expires_at')
                            ->orWhereDate('expires_at', '>=', now()->toDateString());
                    })
                    ->exists();

                if ($hasCredential) {
                    return null;
                }

                return [
                    'id' => $product->id,
                    'title' => $product->title,
                    'slug' => $product->slug,
                    'service_category' => $product->service_category,
                    'service_subcategory' => $product->service_subcategory,
                    'risk_level' => $policy->risk_level,
                    'required_documents' => $requiredDocuments->values()->all(),
                    'created_at' => $product->created_at?->toISOString(),
                    'merchant' => $product->merchant ? [
                        'id' => $product->merchant->id,
                        'display_name' => $product->merchant->display_name,
                        'username' => $product->merchant->username,
                        'is_verified' => (bool) $product->merchant->is_verified,
                        'kyc_status' => $product->merchant->kyc_status,
                        'is_suspended' => (bool) $product->merchant->is_suspended,
                    ] : null,
                ];
            })
            ->filter()
            ->take(20)
            ->values();

        $disputedRequests = ServiceRequest::query()
            ->with(['merchant:id,display_name,username,is_suspended', 'product:id,title,slug'])
            ->where(function ($query) {
                $query->where('payment_status', 'disputed')
                    ->orWhere('delivery_status', 'disputed');
            })
            ->latest('disputed_at')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (ServiceRequest $serviceRequest) => [
                'id' => $serviceRequest->id,
                'public_id' => $serviceRequest->public_id,
                'customer_name' => $serviceRequest->customer_name,
                'payment_status' => $serviceRequest->payment_status,
                'delivery_status' => $serviceRequest->delivery_status,
                'quoted_amount' => $serviceRequest->quoted_amount !== null ? (float) $serviceRequest->quoted_amount : null,
                'disputed_at' => $serviceRequest->disputed_at?->toISOString(),
                'created_at' => $serviceRequest->created_at?->toISOString(),
                'product' => $serviceRequest->product ? [
                    'id' => $serviceRequest->product->id,
                    'title' => $serviceRequest->product->title,
                    'slug' => $serviceRequest->product->slug,
                ] : null,
                'merchant' => $serviceRequest->merchant ? [
                    'id' => $serviceRequest->merchant->id,
                    'display_name' => $serviceRequest->merchant->display_name,
                    'username' => $serviceRequest->merchant->username,
                    'is_suspended' => (bool) $serviceRequest->merchant->is_suspended,
                ] : null,
            ]);

        $repeatDisputeMerchants = ServiceRequest::query()
            ->select('merchant_id', DB::raw('count(*) as disputes_count'))
            ->where(function ($query) {
                $query->where('payment_status', 'disputed')
                    ->orWhere('delivery_status', 'disputed');
            })
            ->groupBy('merchant_id')
            ->havingRaw('count(*) >= 2')
            ->orderByDesc('disputes_count')
            ->with('merchant:id,display_name,username,is_suspended')
            ->limit(20)
            ->get()
            ->map(fn (ServiceRequest $row) => [
                'merchant_id' => $row->merchant_id,
                'disputes_count' => (int) $row->disputes_count,
                'merchant' => $row->merchant ? [
                    'id' => $row->merchant->id,
                    'display_name' => $row->merchant->display_name,
                    'username' => $row->merchant->username,
                    'is_suspended' => (bool) $row->merchant->is_suspended,
                ] : null,
            ]);

        return response()->json([
            'summary' => [
                'pending_credentials' => MerchantServiceCredential::where('status', 'pending')->count(),
                'expiring_credentials' => MerchantServiceCredential::query()
                    ->where('status', 'verified')
                    ->whereNotNull('expires_at')
                    ->whereDate('expires_at', '>=', now()->toDateString())
                    ->whereDate('expires_at', '<=', now()->addDays(30)->toDateString())
                    ->count(),
                'regulated_services_missing_credentials' => $regulatedServices->count(),
                'open_service_disputes' => ServiceRequest::query()
                    ->where(fn ($query) => $query->where('payment_status', 'disputed')->orWhere('delivery_status', 'disputed'))
                    ->count(),
                'repeat_dispute_merchants' => $repeatDisputeMerchants->count(),
            ],
            'pending_credentials' => $pendingCredentials,
            'expiring_credentials' => $expiringCredentials,
            'regulated_services_missing_credentials' => $regulatedServices,
            'disputed_requests' => $disputedRequests,
            'repeat_dispute_merchants' => $repeatDisputeMerchants,
        ]);
    }

    public function notificationLogs(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', 'all');
        $channel = (string) $request->input('channel', 'all');
        $q = trim((string) $request->input('search', ''));
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $query = NotificationLog::query()
            ->with('user:id,name,email,phone_number')
            ->when($status !== 'all', fn ($builder) => $builder->where('status', $status))
            ->when($channel !== 'all', fn ($builder) => $builder->where('channel', $channel))
            ->when($q !== '', function ($builder) use ($q) {
                $builder->where(function ($inner) use ($q) {
                    $inner->where('recipient', 'ILIKE', "%{$q}%")
                        ->orWhere('phone', 'ILIKE', "%{$q}%")
                        ->orWhere('email', 'ILIKE', "%{$q}%")
                        ->orWhere('whatsapp', 'ILIKE', "%{$q}%")
                        ->orWhere('subject', 'ILIKE', "%{$q}%")
                        ->orWhere('message', 'ILIKE', "%{$q}%")
                        ->orWhereHas('user', function ($userQuery) use ($q) {
                            $userQuery->where('name', 'ILIKE', "%{$q}%")
                                ->orWhere('email', 'ILIKE', "%{$q}%")
                                ->orWhere('phone_number', 'ILIKE', "%{$q}%");
                        });
                });
            })
            ->latest();

        $logs = $query->paginate($perPage);

        return response()->json([
            'summary' => [
                'total' => NotificationLog::count(),
                'pending' => NotificationLog::where('status', 'pending')->count(),
                'failed' => NotificationLog::where('status', 'failed')->count(),
                'sent' => NotificationLog::where('status', 'sent')->count(),
                'sms' => NotificationLog::where('channel', 'sms')->count(),
                'whatsapp' => NotificationLog::where('channel', 'whatsapp')->count(),
                'email' => NotificationLog::where('channel', 'email')->count(),
            ],
            'logs' => $logs,
        ]);
    }

    private function serviceCategoryPolicyForProduct(Product $product, \Illuminate\Support\Collection $categoryPolicies): ?ServiceCategory
    {
        $subcategory = Str::lower(trim((string) $product->service_subcategory));
        if ($subcategory !== '') {
            $match = $categoryPolicies->get($subcategory)?->first();
            if ($match) {
                return $match;
            }
        }

        $category = Str::lower(trim((string) $product->service_category));

        return $category !== '' ? $categoryPolicies->get($category)?->first() : null;
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
