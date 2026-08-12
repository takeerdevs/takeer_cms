export const REQUIRED_MERCHANT_DOCUMENT_TYPES = [
    'merchant_marketplace_agreement',
    'payment_provider_processing_terms',
    'refund_return_cancellation_dispute_policy',
    'fee_payout_schedule',
    'privacy_notice',
    'restricted_products_services_policy',
    'complaints_redress_procedure',
];

export const LEGAL_DOCUMENT_LABELS = {
    buyer_terms: ['Buyer terms', 'Masharti ya mnunuzi'],
    merchant_marketplace_agreement: ['Merchant marketplace agreement', 'Makubaliano ya marketplace ya mfanyabiashara'],
    payment_provider_processing_terms: ['Payment provider processing terms', 'Masharti ya uchakataji wa malipo ya provider'],
    refund_return_cancellation_dispute_policy: ['Refund, return, cancellation and dispute policy', 'Sera ya marejesho, kurudisha, kughairi na migogoro'],
    fee_payout_schedule: ['Fee and provider payout schedule', 'Ratiba ya ada na malipo ya provider'],
    privacy_notice: ['Privacy notice', 'Taarifa ya faragha'],
    restricted_products_services_policy: ['Restricted products and services policy', 'Sera ya bidhaa na huduma zilizozuiwa'],
    complaints_redress_procedure: ['Complaints and redress procedure', 'Utaratibu wa malalamiko na redress'],
};

export const legalDocumentLabel = (documentType, copy) => {
    const [english, swahili] = LEGAL_DOCUMENT_LABELS[documentType] || [documentType.replaceAll('_', ' '), documentType.replaceAll('_', ' ')];
    return copy(english, swahili);
};

export const legalDocumentSlug = (documentType) => documentType === 'merchant_marketplace_agreement'
    ? 'merchant-marketplace-agreement'
    : documentType.replaceAll('_', '-');
