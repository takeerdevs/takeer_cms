<?php

namespace App\Services;

use App\Models\ContentReport;
use App\Models\Dispute;
use App\Models\Forwarder;
use App\Models\Merchant;
use App\Models\MerchantServiceCredential;
use App\Models\MerchantTrustSafetyReview;
use App\Models\NotificationLog;
use App\Models\Product;
use App\Models\ServiceCategory;
use App\Models\ServiceRequest;
use App\Models\TrackedLink;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AdminAttentionService
{
    public function items(?string $category = null): Collection
    {
        $items = collect()
            ->merge($this->openDisputes())
            ->merge($this->pendingWithdrawals())
            ->merge($this->pendingMerchantKyc())
            ->merge($this->pendingForwarders())
            ->merge($this->pendingTrustSafetyReviews())
            ->merge($this->contentReports())
            ->merge($this->reportedTrackedLinks())
            ->merge($this->serviceRisk())
            ->merge($this->notificationOutbox());

        if ($category && $category !== 'all') {
            $items = $items->where('category', $category)->values();
        }

        return $items
            ->sort(function (array $a, array $b) {
                $severity = $this->severityRank($b['severity']) <=> $this->severityRank($a['severity']);

                return $severity !== 0
                    ? $severity
                    : strcmp((string) ($b['occurred_at'] ?? ''), (string) ($a['occurred_at'] ?? ''));
            })
            ->values();
    }

    public function summary(): array
    {
        $items = $this->items();

        return [
            'total' => $items->count(),
            'critical' => $items->where('severity', 'critical')->count(),
            'high' => $items->where('severity', 'high')->count(),
            'medium' => $items->where('severity', 'medium')->count(),
            'low' => $items->where('severity', 'low')->count(),
            'categories' => $items->groupBy('category')->map->count()->all(),
        ];
    }

    private function openDisputes(): Collection
    {
        return Dispute::query()
            ->with(['order.merchant:id,display_name,username', 'order.buyer:id,name,phone_number'])
            ->where('status', 'open')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (Dispute $dispute) => $this->item(
                id: "dispute:{$dispute->id}",
                category: 'payments',
                source: 'Disputes',
                severity: 'critical',
                title: "Open dispute #{$dispute->id}",
                body: trim(($dispute->dispute_reason ?: 'Dispute needs admin resolution') . $this->merchantSuffix($dispute->order?->merchant)),
                href: '/admin/disputes',
                action: 'Resolve dispute',
                occurredAt: $dispute->created_at?->toISOString(),
            ));
    }

    private function pendingWithdrawals(): Collection
    {
        return WithdrawalRequest::query()
            ->with('user:id,name,phone_number')
            ->where('status', 'pending')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (WithdrawalRequest $withdrawal) => $this->item(
                id: "withdrawal:{$withdrawal->id}",
                category: 'payments',
                source: 'Withdrawals',
                severity: 'high',
                title: 'Merchant withdrawal waiting approval',
                body: trim(($withdrawal->user?->name ?: 'Merchant') . ' requested ' . number_format((float) $withdrawal->amount)),
                href: '/admin/withdrawals',
                action: 'Review payout',
                occurredAt: $withdrawal->created_at?->toISOString(),
            ));
    }

    private function pendingMerchantKyc(): Collection
    {
        return Merchant::query()
            ->with('user:id,name,phone_number,email')
            ->where('kyc_status', 'pending')
            ->latest('updated_at')
            ->limit(20)
            ->get()
            ->map(fn (Merchant $merchant) => $this->item(
                id: "merchant-kyc:{$merchant->id}",
                category: 'trust',
                source: 'Verifications',
                severity: 'high',
                title: 'Merchant KYC waiting review',
                body: ($merchant->display_name ?: $merchant->username ?: "Merchant #{$merchant->id}") . ' submitted verification documents.',
                href: "/admin/merchants/{$merchant->id}",
                action: 'Review KYC',
                occurredAt: $merchant->updated_at?->toISOString(),
                meta: ['merchant_id' => $merchant->id],
            ));
    }

    private function pendingForwarders(): Collection
    {
        return Forwarder::query()
            ->with(['merchant:id,display_name,username', 'submitter:id,name,email,phone_number'])
            ->where('verification_status', 'pending')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (Forwarder $forwarder) => $this->item(
                id: "forwarder:{$forwarder->id}",
                category: 'logistics',
                source: 'Forwarders',
                severity: 'medium',
                title: 'Forwarder waiting verification',
                body: ($forwarder->name ?: "Forwarder #{$forwarder->id}") . $this->merchantSuffix($forwarder->merchant),
                href: '/admin/forwarders',
                action: 'Review forwarder',
                occurredAt: $forwarder->created_at?->toISOString(),
            ));
    }

    private function pendingTrustSafetyReviews(): Collection
    {
        return MerchantTrustSafetyReview::query()
            ->with('merchant:id,display_name,username')
            ->where('status', 'pending')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (MerchantTrustSafetyReview $review) => $this->item(
                id: "trust-safety-review:{$review->id}",
                category: 'trust',
                source: 'Safety Reviews',
                severity: 'high',
                title: 'Trust & Safety review requested',
                body: ($review->merchant?->display_name ?: 'Merchant') . ' is asking for a POS payment-link restriction review.',
                href: '/admin/trust-safety-reviews',
                action: 'Review request',
                occurredAt: $review->created_at?->toISOString(),
            ));
    }

    private function contentReports(): Collection
    {
        return ContentReport::query()
            ->with('merchant:id,display_name,username')
            ->whereIn('status', ['open', 'under_review'])
            ->orWhere('appeal_status', 'pending')
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn (ContentReport $report) => $this->item(
                id: "content-report:{$report->id}",
                category: 'content',
                source: 'Content Reports',
                severity: $report->appeal_status === 'pending' ? 'high' : 'medium',
                title: $report->appeal_status === 'pending' ? 'Content appeal waiting review' : 'Content report waiting review',
                body: trim(($report->reason_code ?: $report->reason ?: 'Policy report') . " for {$report->item_type} #{$report->item_id}" . $this->merchantSuffix($report->merchant)),
                href: '/admin/content-reports',
                action: 'Moderate content',
                occurredAt: ($report->appealed_at ?: $report->created_at)?->toISOString(),
            ));
    }

    private function reportedTrackedLinks(): Collection
    {
        return TrackedLink::query()
            ->with('merchant:id,display_name,username')
            ->withCount(['reports as open_reports_count' => fn ($query) => $query->whereIn('status', ['open', 'under_review'])])
            ->whereHas('reports', fn ($query) => $query->whereIn('status', ['open', 'under_review']))
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (TrackedLink $link) => $this->item(
                id: "tracked-link:{$link->id}",
                category: 'content',
                source: 'Tracked Links',
                severity: 'medium',
                title: 'Tracked link has open reports',
                body: ($link->destination_host ?: $link->code) . ' has ' . (int) $link->open_reports_count . ' open report(s).',
                href: '/admin/tracked-links',
                action: 'Review link',
                occurredAt: $link->updated_at?->toISOString(),
            ));
    }

    private function serviceRisk(): Collection
    {
        $pendingCredentials = MerchantServiceCredential::query()
            ->with('merchant:id,display_name,username,is_suspended')
            ->where('status', 'pending')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (MerchantServiceCredential $credential) => $this->item(
                id: "service-credential:{$credential->id}",
                category: 'services',
                source: 'Service Risk',
                severity: 'high',
                title: 'Service credential waiting review',
                body: ($credential->document_name ?: $credential->document_type ?: 'Credential') . $this->merchantSuffix($credential->merchant),
                href: $credential->merchant_id ? "/admin/merchants/{$credential->merchant_id}" : '/admin/service-risk',
                action: 'Review credential',
                occurredAt: $credential->created_at?->toISOString(),
            ));

        $expiringCredentials = MerchantServiceCredential::query()
            ->with('merchant:id,display_name,username,is_suspended')
            ->where('status', 'verified')
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '>=', now()->toDateString())
            ->whereDate('expires_at', '<=', now()->addDays(30)->toDateString())
            ->orderBy('expires_at')
            ->limit(20)
            ->get()
            ->map(fn (MerchantServiceCredential $credential) => $this->item(
                id: "service-credential-expiring:{$credential->id}",
                category: 'services',
                source: 'Service Risk',
                severity: 'medium',
                title: 'Service credential expires soon',
                body: ($credential->document_name ?: 'Credential') . ' expires ' . $credential->expires_at?->toDateString() . $this->merchantSuffix($credential->merchant),
                href: '/admin/service-risk',
                action: 'Check credential',
                occurredAt: $credential->expires_at?->toDateString(),
            ));

        $disputedRequests = ServiceRequest::query()
            ->with(['merchant:id,display_name,username', 'product:id,title'])
            ->where(fn ($query) => $query->where('payment_status', 'disputed')->orWhere('delivery_status', 'disputed'))
            ->latest('disputed_at')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (ServiceRequest $request) => $this->item(
                id: "service-dispute:{$request->id}",
                category: 'services',
                source: 'Service Risk',
                severity: 'critical',
                title: 'Open service dispute',
                body: ($request->product?->title ?: "Service request {$request->public_id}") . $this->merchantSuffix($request->merchant),
                href: '/admin/service-risk',
                action: 'Review service risk',
                occurredAt: ($request->disputed_at ?: $request->updated_at)?->toISOString(),
            ));

        return collect()
            ->merge($pendingCredentials)
            ->merge($expiringCredentials)
            ->merge($disputedRequests)
            ->merge($this->regulatedServicesMissingCredentials());
    }

    private function regulatedServicesMissingCredentials(): Collection
    {
        $categoryPolicies = ServiceCategory::query()
            ->get()
            ->groupBy(fn (ServiceCategory $category) => Str::lower(trim((string) $category->name)));

        return Product::query()
            ->where('type', 'service')
            ->with('merchant:id,display_name,username,is_verified,kyc_status,is_suspended')
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
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhereDate('expires_at', '>=', now()->toDateString()))
                    ->exists();

                if ($hasCredential) {
                    return null;
                }

                return $this->item(
                    id: "regulated-service-missing-credential:{$product->id}",
                    category: 'services',
                    source: 'Service Risk',
                    severity: 'critical',
                    title: 'Regulated service missing credentials',
                    body: ($product->title ?: "Service #{$product->id}") . $this->merchantSuffix($product->merchant),
                    href: '/admin/service-risk',
                    action: 'Review service',
                    occurredAt: $product->created_at?->toISOString(),
                );
            })
            ->filter()
            ->take(20)
            ->values();
    }

    private function notificationOutbox(): Collection
    {
        return NotificationLog::query()
            ->with('user:id,name,email,phone_number')
            ->whereIn('status', ['pending', 'failed'])
            ->latest()
            ->limit(20)
            ->get()
            ->map(function (NotificationLog $log) {
                $label = $log->subject ?: (data_get($log->metadata, 'kind') ?: 'Notification');

                return $this->item(
                    id: "notification-log:{$log->id}",
                    category: 'system',
                    source: 'Notification Outbox',
                    severity: $log->status === 'failed' ? 'high' : 'low',
                    title: $log->status === 'failed' ? 'Notification delivery failed' : 'Notification waiting dispatch',
                    body: trim($label . ' · ' . ($log->recipient ?: $log->phone ?: $log->email ?: 'No recipient')),
                    href: '/admin/notifications',
                    action: 'Open outbox',
                    occurredAt: $log->created_at?->toISOString(),
                );
            });
    }

    private function serviceCategoryPolicyForProduct(Product $product, Collection $categoryPolicies): ?ServiceCategory
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

    private function item(
        string $id,
        string $category,
        string $source,
        string $severity,
        string $title,
        string $body,
        string $href,
        string $action,
        ?string $occurredAt,
        array $meta = [],
    ): array {
        return [
            'id' => $id,
            'category' => $category,
            'source' => $source,
            'severity' => $severity,
            'title' => $title,
            'body' => $body,
            'href' => $href,
            'action' => $action,
            'occurred_at' => $occurredAt,
            'meta' => $meta,
        ];
    }

    private function merchantSuffix(?Merchant $merchant): string
    {
        if (! $merchant) {
            return '';
        }

        return ' · ' . ($merchant->display_name ?: $merchant->username ?: "Merchant #{$merchant->id}");
    }

    private function severityRank(string $severity): int
    {
        return match ($severity) {
            'critical' => 4,
            'high' => 3,
            'medium' => 2,
            default => 1,
        };
    }
}
