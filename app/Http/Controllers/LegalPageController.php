<?php

namespace App\Http\Controllers;

use App\Support\SeoMeta;
use Illuminate\Support\Str;
use Inertia\Inertia;

class LegalPageController extends Controller
{
    private const PLATFORM_POLICIES = [
        [
            'title' => 'Terms of Service',
            'description' => 'The rules for using Takeer as a customer, creator, seller, merchant, or service provider.',
            'href' => '/terms',
        ],
        [
            'title' => 'Privacy Policy',
            'description' => 'How Takeer collects, uses, shares, and protects information across the platform.',
            'href' => '/privacy',
        ],
    ];

    private const DOCUMENTS = [
        'buyer-terms' => [
            'type' => 'buyer_terms',
            'title' => 'Buyer Terms',
            'audience' => 'Buyers',
            'description' => 'The rules for buying products and services through Takeer.',
            'path' => 'docs/legal/buyer-terms.md',
            'sw_path' => 'docs/legal/sw/buyer-terms.md',
        ],
        'merchant-marketplace-agreement' => [
            'type' => 'merchant_marketplace_agreement',
            'title' => 'Merchant Marketplace Agreement',
            'audience' => 'Merchants and sellers',
            'description' => 'The agreement governing merchant listings, fulfillment, PSP settlement, refunds, and seller responsibilities.',
            'path' => 'MERCHANT_AGREEMENT.md',
            'sw_path' => 'docs/legal/sw/merchant-marketplace-agreement.md',
        ],
        'payment-provider-processing-terms' => [
            'type' => 'payment_provider_processing_terms',
            'title' => 'Payment and PSP Processing Terms',
            'audience' => 'Buyers and merchants',
            'description' => 'How the named licensed PSP processes payment, refund, settlement, and payout activity.',
            'path' => 'docs/legal/payment-provider-processing-terms.md',
            'sw_path' => 'docs/legal/sw/payment-provider-processing-terms.md',
        ],
        'refund-return-cancellation-dispute-policy' => [
            'type' => 'refund_return_cancellation_dispute_policy',
            'title' => 'Refund, Return, Cancellation, and Dispute Policy',
            'audience' => 'Buyers and merchants',
            'description' => 'The marketplace process for returns, cancellations, refunds, reversals, and disputes.',
            'path' => 'docs/legal/refund-return-cancellation-dispute-policy.md',
            'sw_path' => 'docs/legal/sw/refund-return-cancellation-dispute-policy.md',
        ],
        'fee-payout-schedule' => [
            'type' => 'fee_payout_schedule',
            'title' => 'Fee and Provider Payout Schedule',
            'audience' => 'Merchants and sellers',
            'description' => 'How Takeer fees and order-specific PSP payout timing are disclosed.',
            'path' => 'docs/legal/fee-payout-schedule.md',
            'sw_path' => 'docs/legal/sw/fee-payout-schedule.md',
        ],
        'privacy-notice' => [
            'type' => 'privacy_notice',
            'title' => 'Privacy Notice',
            'audience' => 'All users',
            'description' => 'How Takeer handles account, order, support, fraud, and payment-reference data.',
            'path' => 'docs/legal/privacy-notice.md',
            'sw_path' => 'docs/legal/sw/privacy-notice.md',
        ],
        'restricted-products-services-policy' => [
            'type' => 'restricted_products_services_policy',
            'title' => 'Restricted Products and Services Policy',
            'audience' => 'Merchants and sellers',
            'description' => 'The categories, products, services, and conduct that require restriction or review.',
            'path' => 'docs/legal/restricted-products-services-policy.md',
            'sw_path' => 'docs/legal/sw/restricted-products-services-policy.md',
        ],
        'complaints-redress-procedure' => [
            'type' => 'complaints_redress_procedure',
            'title' => 'Complaints and Redress Procedure',
            'audience' => 'Buyers and merchants',
            'description' => 'How to raise order, provider-payment, refund, privacy, safety, and account complaints.',
            'path' => 'docs/legal/complaints-redress-procedure.md',
            'sw_path' => 'docs/legal/sw/complaints-redress-procedure.md',
        ],
    ];

    public function index()
    {
        $documents = collect(self::DOCUMENTS)
            ->map(fn (array $document, string $slug) => $this->documentPayload($document, $slug))
            ->values();

        $seo = SeoMeta::staticPage(
            'Legal Center',
            'Read Takeer buyer, merchant, payment, refund, privacy, safety, and complaints documents.',
            '/legal',
        );

        return Inertia::render('Legal/Index', [
            'platformPolicies' => self::PLATFORM_POLICIES,
            'documents' => $documents,
            'seo' => $seo,
        ])->withViewData('seo', $seo);
    }

    public function show(string $document)
    {
        abort_unless(isset(self::DOCUMENTS[$document]), 404);

        $definition = self::DOCUMENTS[$document];
        $path = base_path($definition['path']);
        abort_unless(is_file($path), 404);

        $htmlByLocale = [
            'en' => $this->renderMarkdownFile($path),
        ];
        $swahiliPath = isset($definition['sw_path']) ? base_path($definition['sw_path']) : null;
        if ($swahiliPath && is_file($swahiliPath)) {
            $htmlByLocale['sw'] = $this->renderMarkdownFile($swahiliPath);
        }
        $preferredLocale = in_array(session('user_session_language'), ['en', 'sw'], true)
            ? session('user_session_language')
            : 'en';

        $seo = SeoMeta::staticPage(
            $definition['title'].' | Takeer',
            $definition['description'],
            '/legal/'.$document,
        );

        return Inertia::render('Legal/Show', [
            'document' => array_merge(
                $this->documentPayload($definition, $document),
                [
                    'html' => $htmlByLocale[$preferredLocale] ?? $htmlByLocale['en'],
                    'html_by_locale' => $htmlByLocale,
                ],
            ),
            'seo' => $seo,
        ])->withViewData('seo', $seo);
    }

    private function documentPayload(array $definition, string $slug): array
    {
        return [
            'slug' => $slug,
            'document_type' => $definition['type'],
            'title' => $definition['title'],
            'audience' => $definition['audience'],
            'description' => $definition['description'],
        ];
    }

    private function renderMarkdownFile(string $path): string
    {
        return Str::markdown((string) file_get_contents($path), [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
        ]);
    }
}
