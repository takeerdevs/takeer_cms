import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ChevronLeft, ChevronRight, Store, ShieldCheck, Zap, Info, BadgeCheck,
    AlertTriangle, DownloadCloud, CalendarClock, MapPin, Link as LinkIcon,
    ShoppingBag, Bell, Star, Images, BookOpen, ExternalLink, PlayCircle, Loader2
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import VideoPlayer from '@/Components/VideoPlayer';
import { usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AddressPickerModal from '@/Components/AddressPickerModal';
import { trackAttributionEvent } from '@/lib/attribution';
import { formatQuantity, productCardPriceLabel, productPriceLabel, productStockLabel, productUnitLabel } from '@/lib/productUnits';

export default function ProductDetail({ product }) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [activeHotspot, setActiveHotspot] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [variantFilters, setVariantFilters] = useState({});
    const [isOnWaitlist, setIsOnWaitlist] = useState(false);
    const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
    const [serviceRequestOpen, setServiceRequestOpen] = useState(false);
    const [serviceRequestSubmitting, setServiceRequestSubmitting] = useState(false);
    const [galleryImageLoaded, setGalleryImageLoaded] = useState({});
    const galleryTouchStartRef = useRef(null);
    const [serviceRequestForm, setServiceRequestForm] = useState({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        preferred_date: '',
        preferred_time: '',
        selected_slot_start: '',
        selected_slot_end: '',
        selected_session_id: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Dar_es_Salaam',
        location_text: '',
        message: '',
    });
    const [serviceSlots, setServiceSlots] = useState([]);
    const [serviceSlotsLoading, setServiceSlotsLoading] = useState(false);
    const [selectedServiceOptionId, setSelectedServiceOptionId] = useState('');
    const [serviceIntakeAnswers, setServiceIntakeAnswers] = useState({});
    const [intakeLocationPicker, setIntakeLocationPicker] = useState(null);
    const [intakeUploadingField, setIntakeUploadingField] = useState(null);
    const premiumVideoRef = useRef(null);
    const documentReaderRef = useRef(null);
    const trackedContentEventsRef = useRef(new Set());

    const { auth } = usePage().props;
    const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

    useEffect(() => {
        if (!product?.id) return;

        trackAttributionEvent('product_view', {
            entity_type: 'product',
            entity_id: product.id,
            merchant_id: product?.merchant?.id || null,
            value: product?.discounted_price || product?.price || null,
            metadata: {
                product_type: product?.type || null,
                slug: product?.slug || null,
            },
        });
    }, [product?.id]);

    const trackContentInteraction = (eventType, metadata = {}, onceKey = null) => {
        if (!product?.id) return;
        if (onceKey) {
            const key = `${eventType}:${onceKey}`;
            if (trackedContentEventsRef.current.has(key)) return;
            trackedContentEventsRef.current.add(key);
        }

        trackAttributionEvent(eventType, {
            entity_type: 'product',
            entity_id: product.id,
            merchant_id: product?.merchant?.id || merchant?.id || null,
            value: product?.discounted_price || product?.price || null,
            source: 'product_detail',
            metadata: {
                product_type: product?.type || null,
                delivery_type: product?.digital_delivery_type || null,
                digital_content_type: product?.digital_content_type || null,
                slug: product?.slug || null,
                ...metadata,
            },
        });
    };

    const images = product?.images || [];
    const currentMedia = images[currentImageIndex] || null;
    const currentMediaType = currentMedia?.media_type || currentMedia?.type || 'image';
    const isCurrentVideo = currentMediaType === 'video';
    const heroImage = currentMedia?.thumbnail_url
        || currentMedia?.image_url
        || currentMedia?.url
        || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1200';

    const merchantProfile = product?.merchant_profile || product?.merchantProfile || null;
    const merchant = merchantProfile || product?.merchant || {};
    const attributes = product?.attributes || {};
    const isServiceProduct = product?.type === 'service';
    const description = attributes?.suggested_description
        || (isServiceProduct ? 'Maelezo ya huduma hayajapatikana.' : 'Maelezo ya bidhaa hayajapatikana.');
    const merchantUsername = merchantProfile?.username || merchant?.username || '';
    const merchantDisplayName = merchantProfile?.display_name
        || merchantProfile?.name
        || merchant?.display_name
        || merchant?.name
        || (isServiceProduct ? 'Mtoa huduma' : 'Muuzaji');
    const merchantSlug = merchantProfile?.username || merchant?.username || merchantProfile?.id || merchant?.id;
    const merchantRatingAverage = Number(merchant?.rating_average || 0);
    const merchantRatingsCount = Number(merchant?.ratings_count || 0);
    const merchantPhone = product?.merchant?.phone_number
        || product?.merchant?.user?.phone_number
        || merchantProfile?.phone_number
        || merchantProfile?.user?.phone_number
        || merchant?.phone_number
        || merchant?.user?.phone_number
        || '';
    const storefrontSettings = merchant?.storefront_setting
        || merchant?.storefrontSetting
        || product?.merchant?.storefront_setting
        || product?.merchant?.storefrontSetting
        || null;
    const serviceAreaType = storefrontSettings?.service_area_type || null;
    const serviceTimezone = storefrontSettings?.service_timezone || null;
    const serviceLocations = Array.isArray(storefrontSettings?.service_locations) ? storefrontSettings.service_locations : [];
    const weekDays = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
    const serviceHours = Array.isArray(storefrontSettings?.service_hours)
        ? storefrontSettings.service_hours
            .filter((row) => row?.day && row?.is_open)
            .map((row) => ({
                dayLabel: weekDays[row.day] || row.day,
                open: row.open || '--:--',
                close: row.close || '--:--',
            }))
        : [];
    const whatsappPhone = merchantPhone
        ? merchantPhone.replace(/[^\d]/g, '').replace(/^0/, '255')
        : '';
    const compactCount = (value) => {
        const number = Number(value || 0);
        if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
        if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
        return number.toLocaleString();
    };
    const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}` : null;
    const servicePricingModel = product?.service_pricing_model || 'fixed_price';
    const serviceIsShowcase = Boolean(product?.service_is_showcase);
    const servicePriceDisplay = product?.service_price_display || (servicePricingModel === 'hourly_rate' ? 'hourly' : servicePricingModel === 'contract_quote' ? 'quote_only' : 'fixed');
    const verificationRequiredForListing = Boolean(product?.verification_required_for_listing);
    const merchantCanTransactInApp = Boolean(merchant?.is_verified) || !verificationRequiredForListing;
    const serviceBookingLink = (() => {
        if (product?.type !== 'service') return null;
        const raw = String(product?.url || '').trim();
        if (!raw) return null;
        if (/^https?:\/\//i.test(raw)) return raw;
        if (!raw.includes(':')) return null;
        const [channel, ...rest] = raw.split(':');
        const value = rest.join(':').trim();
        if (!value) return null;
        if (channel === 'whatsapp') {
            const digits = value.replace(/[^\d]/g, '').replace(/^0/, '255');
            return digits ? `https://wa.me/${digits}` : null;
        }
        if (channel === 'phone') {
            return `tel:${value}`;
        }
        return null;
    })();
    const serviceMode = product?.service_mode || (
        serviceIsShowcase || servicePricingModel === 'showcase_only'
            ? 'showcase_only'
            : servicePricingModel === 'contract_quote'
                ? 'request_quote'
                : serviceBookingLink && String(product?.url || '').startsWith('http')
                    ? 'external_booking'
                    : 'pay_now'
    );
    const serviceModeLabels = {
        showcase_only: 'Showcase only',
        request_quote: 'Request quote',
        book_appointment: 'Book appointment',
        pay_now: 'Pay / reserve',
        external_booking: 'External booking',
    };
    const serviceSchedulingType = product?.service_scheduling_type || (serviceMode === 'external_booking' ? 'external' : 'none');
    const serviceLocationLabels = {
        provider_location: 'At provider location',
        customer_location: 'At client location',
        remote: 'Remote/online',
        hybrid: 'Hybrid',
    };
    const servicePriceUnitLabels = {
        hourly: 'hour',
        daily: 'day',
        nightly: 'night',
        weekly: 'week',
        monthly: 'month',
        yearly: 'year',
        per_person: 'person',
        per_visit: 'visit',
        per_session: 'session',
        per_project: 'project',
    };
    const serviceChargeUnitLabels = {
        fixed: 'fixed',
        hourly: 'per hour',
        daily: 'per day',
        nightly: 'per night',
        weekly: 'per week',
        monthly: 'per month',
        yearly: 'per year',
        per_person: 'per person',
        per_visit: 'per visit',
        per_session: 'per session',
        per_project: 'per project',
        optional: 'optional',
        refundable_deposit: 'refundable deposit',
    };
    const hasProductSpecifications = Boolean(
        attributes.category
        || attributes.brand_name
        || attributes.model_name
        || attributes.material
        || (Array.isArray(product?.category_attribute_values) && product.category_attribute_values.length > 0)
        || (Array.isArray(attributes.colors) && attributes.colors.length > 0)
    );
    const serviceCharges = Array.isArray(product?.service_charges) ? product.service_charges : [];
    const serviceOptions = Array.isArray(product?.service_options) ? product.service_options : [];
    const serviceRelatedProducts = Array.isArray(product?.service_related_products) ? product.service_related_products : [];
    const selectedServiceOption = serviceOptions.find((option) => String(option.id) === String(selectedServiceOptionId))
        || serviceOptions[0]
        || null;
    const includedServiceCharges = serviceCharges.filter((charge) => (
        charge?.included_in_checkout
        && ['fixed', 'refundable_deposit'].includes(charge.unit || 'fixed')
        && Number(charge.amount || 0) > 0
    ));
    const includedServiceChargesTotal = includedServiceCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
    const serviceContactUrl = (() => {
        if (product?.service_contact_channel === 'whatsapp' && product?.service_contact_value) {
            const digits = String(product.service_contact_value).replace(/[^\d]/g, '').replace(/^0/, '255');
            return digits ? `https://wa.me/${digits}` : null;
        }
        if (product?.service_contact_channel === 'phone' && product?.service_contact_value) {
            return `tel:${product.service_contact_value}`;
        }
        if (product?.service_contact_channel === 'external_link' && product?.service_contact_value) {
            return product.service_contact_value;
        }
        return null;
    })();
    const serviceTrust = product?.service_trust || {};
    const serviceTrustBlocksBooking = product?.type === 'service' && !Boolean(serviceTrust.trust_ready);
    const serviceTrustBlockReason = serviceTrust.credential_required && !serviceTrust.credential_verified
        ? 'Huduma hii inasubiri uhakiki wa leseni/cheti cha mtoa huduma.'
        : 'Huduma hii inasubiri uhakiki wa Takeer kabla ya kupokea booking au malipo.';
    const serviceTrustRows = [
        {
            label: 'Mtoa huduma amethibitishwa',
            ok: Boolean(serviceTrust.identity_verified),
            detail: serviceTrust.identity_verified ? 'KYC imehakikiwa' : 'KYC haijakamilika',
        },
        {
            label: 'Leseni/cheti cha Ujuzi',
            ok: !serviceTrust.credential_required || Boolean(serviceTrust.credential_verified),
            detail: serviceTrust.credential_required
                ? (serviceTrust.credential_verified ? (serviceTrust.credential_label || 'Imethibitishwa') : 'Inahitajika')
                : 'Hakihitajiki kwa huduma hii',
        },
        {
            label: 'Takeer SafePay',
            ok: Boolean(serviceTrust.safepay_enabled),
            detail: serviceTrust.payout_hold_days ? `Malipo hushikiliwa siku ${serviceTrust.payout_hold_days}` : 'Malipo hulindwa',
        },
    ];
    const providerServiceLocation = product?.service_provider_location || null;
    const providerMapUrl = providerServiceLocation?.lat && providerServiceLocation?.lng
        ? `https://www.google.com/maps/search/?api=1&query=${providerServiceLocation.lat},${providerServiceLocation.lng}`
        : null;
    const externalContactUrl = serviceBookingLink || serviceContactUrl || whatsappUrl;
    const isPremiumVideoProduct = product?.type === 'digital' && product?.digital_delivery_type === 'video_stream';
    const isPremiumAudioProduct = product?.type === 'digital' && product?.digital_delivery_type === 'audio_stream';
    const isGalleryPackProduct = product?.type === 'digital' && product?.digital_delivery_type === 'gallery_pack';
    const isLiveEventProduct = product?.type === 'digital' && product?.digital_delivery_type === 'live_event';
    const premiumVideo = product?.premium_video || null;
    const premiumAudio = product?.premium_audio || null;
    const galleryPack = product?.gallery_pack || null;
    const liveEvent = product?.live_event || null;
    const documentReader = product?.document_reader || null;
    const canReadDocumentOnline = product?.type === 'digital' && product?.has_access && !!documentReader?.url;
    const softwareReleases = Array.isArray(product?.software_releases) ? product.software_releases : [];
    const hasSoftwareReleases = product?.type === 'digital' && product?.digital_content_type === 'software' && softwareReleases.length > 0;
    const softwareLicenseKey = product?.software_license_key || null;
    const hasSoftwareAccessPanel = hasSoftwareReleases || (product?.type === 'digital' && product?.digital_content_type === 'software' && product?.has_access && softwareLicenseKey?.key);
    const digitalContentLabel = {
        file: 'Digital file',
        ebook: 'E-book / PDF',
        template_asset: 'Template',
        creative_asset: 'Creative asset',
        audio: 'Audio',
        video: 'Video',
        gallery: 'Gallery',
        software: 'Software / Code',
        document: 'Document pack',
        live_event: 'Live event',
    }[product?.digital_content_type] || null;
    const digitalLicenseLabel = {
        personal: 'Personal use',
        commercial: 'Commercial use',
        extended_commercial: 'Extended commercial use',
        exclusive: 'Exclusive license',
        custom: 'Custom license',
    }[product?.digital_usage_license] || null;
    const payableServiceRequest = product?.service_request_payment || null;
    const payableServiceRequestStatus = payableServiceRequest?.payment_status || null;
    const serviceRequestPaymentComplete = ['paid', 'held', 'released', 'disputed'].includes(payableServiceRequestStatus);
    const serviceRequestPaymentPending = payableServiceRequestStatus === 'payment_initiated';
    const startsAsServiceInquiry = product?.type === 'service'
        && !payableServiceRequest
        && (
            serviceMode === 'request_quote'
            || servicePricingModel === 'contract_quote'
            || servicePriceDisplay === 'quote_only'
        );
    const shouldOpenServiceRequest = product?.type === 'service'
        && !payableServiceRequest
        && !startsAsServiceInquiry
        && !serviceTrustBlocksBooking
        && ['showcase_only', 'request_quote', 'book_appointment'].includes(serviceMode);
    const isServiceContactOnly = product?.type === 'service' && !payableServiceRequest && (
        ['showcase_only', 'external_booking'].includes(serviceMode)
        || serviceSchedulingType === 'external'
        || servicePriceDisplay === 'hidden'
    );

    const hotspots = images[currentImageIndex]?.hotspots || [];
    const variants = useMemo(() => (
        (product?.variants || []).filter((variant) => (
            variant?.is_active !== false && Number(variant?.inventory_count || 0) > 0
        ))
    ), [product?.variants]);
    const hasProductVariants = Boolean(product?.has_variants && variants.length > 0);
    const variantAttributeKeys = useMemo(() => (
        [...new Set(variants.flatMap((variant) => Object.keys(variant?.attributes || {})))]
    ), [variants]);
    const variantOptionsByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            acc[key] = [...new Set(variants
                .map((variant) => variant?.attributes?.[key])
                .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
                .map((value) => String(value)))];
            return acc;
        }, {})
    ), [variantAttributeKeys, variants]);
    const availableOptionsByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            const options = variantOptionsByKey[key] || [];
            acc[key] = options.filter((option) => (
                variants.some((variant) => {
                    if (String(variant?.attributes?.[key] || '') !== String(option)) return false;
                    return variantAttributeKeys.every((otherKey) => {
                        if (otherKey === key) return true;
                        const selected = (variantFilters[otherKey] || '').toString().trim();
                        if (!selected) return true;
                        return String(variant?.attributes?.[otherKey] || '') === selected;
                    });
                })
            ));
            return acc;
        }, {})
    ), [variantAttributeKeys, variantFilters, variantOptionsByKey, variants]);
    const optionSwatchByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            acc[key] = {};
            variants.forEach((variant) => {
                const option = String(variant?.attributes?.[key] || '');
                if (!option || !variant?.swatch_image_url || acc[key][option]) return;
                acc[key][option] = variant.swatch_image_url;
            });
            return acc;
        }, {})
    ), [variantAttributeKeys, variants]);
    const filteredVariants = useMemo(() => (
        variants.filter((variant) => (
            variantAttributeKeys.every((key) => {
                const selected = (variantFilters[key] || '').toString().trim();
                return !selected || String(variant?.attributes?.[key] || '') === selected;
            })
        ))
    ), [variantAttributeKeys, variantFilters, variants]);
    const selectedVariant = filteredVariants.find((variant) => String(variant.id) === String(selectedVariantId))
        || variants.find((variant) => String(variant.id) === String(selectedVariantId))
        || filteredVariants[0]
        || variants[0]
        || null;
    const isVariantSelectionComplete = !hasProductVariants
        || variantAttributeKeys.every((key) => (variantFilters[key] || '').toString().trim().length > 0);
    const groupSaleOffer = product.group_sale_offer || null;
    const groupSaleCheckoutOpen = Boolean(groupSaleOffer?.is_checkout_open);
    const physicalFulfillmentMode = product.fulfillment_mode || 'own_stock';
    const requiresOwnedStock = product.type === 'physical' && physicalFulfillmentMode === 'own_stock';
    const groupSaleReservationMode = product.type === 'physical' && physicalFulfillmentMode === 'group_sale' && groupSaleOffer && !groupSaleCheckoutOpen;
    const fulfillmentModeLabels = {
        own_stock: 'In stock',
        supplier_sourced: 'Availability confirmed after request',
        made_to_order: 'Made after order',
        farm_harvest: 'Harvest / farm stock',
        preorder: 'Preorder',
        group_sale: 'Group sale preorder',
    };
    const fulfillmentLeadTimeLabel = physicalFulfillmentMode === 'supplier_sourced' && product.availability_lead_time_hours
        ? `Estimated confirmation: ${product.availability_lead_time_hours} hour${Number(product.availability_lead_time_hours) === 1 ? '' : 's'}`
        : product.availability_lead_time_days
            ? `Estimated preparation: ${product.availability_lead_time_days} day${Number(product.availability_lead_time_days) === 1 ? '' : 's'}`
            : null;
    const fulfillmentAvailableFromLabel = product.available_from
        ? `Expected availability: ${product.available_from}`
        : null;
    const fulfillmentGuidance = {
        supplier_sourced: {
            title: 'Availability will be confirmed',
            body: 'This seller sources the item after your order. Takeer keeps the payment protected while the seller confirms availability and fulfillment.',
            steps: ['Place the order', 'Seller confirms source and timing', 'You receive the item and confirm receipt'],
            accent: 'blue',
        },
        made_to_order: {
            title: 'Made after order',
            body: 'This item is prepared by the seller after your order is confirmed. It is ideal for handmade, custom, crafted, or freshly prepared products.',
            steps: ['Place the order', 'Seller prepares or crafts the item', 'Delivery happens when it is ready'],
            accent: 'purple',
        },
        farm_harvest: {
            title: 'Harvest / farm stock',
            body: 'This item comes from harvest or farm stock. The seller will fulfill it around the expected availability date.',
            steps: ['Reserve or order', 'Seller prepares harvest stock', 'Delivery or pickup is completed'],
            accent: 'emerald',
        },
        preorder: {
            title: 'Preorder',
            body: 'This item is ordered before it is ready. The seller will fulfill it around the expected availability date.',
            steps: ['Preorder now', 'Seller prepares availability', 'Delivery happens after release'],
            accent: 'amber',
        },
        group_sale: {
            title: 'Group sale preorder',
            body: 'This item depends on a group target. If the target is reached, checkout or fulfillment continues based on the campaign terms.',
            steps: ['Join the group sale', 'Target quantity is reached', 'Seller fulfills the orders'],
            accent: 'blue',
        },
    }[physicalFulfillmentMode] || null;
    const checkoutPrice = groupSaleCheckoutOpen
        ? Number(groupSaleOffer?.campaign_price || product.checkout_price || 0)
        : hasProductVariants
            ? Number(selectedVariant?.price || 0)
            : Number(product.type === 'service' && selectedServiceOption?.price !== null && selectedServiceOption?.price !== undefined
                ? selectedServiceOption.price
                : (product.discounted_price > 0 ? product.discounted_price : product.price || 0));
    const effectiveServicePriceDisplay = product.type === 'service' && selectedServiceOption?.price_display
        ? selectedServiceOption.price_display
        : servicePriceDisplay;
    const effectiveCheckoutPrice = product.type === 'service'
        ? checkoutPrice + includedServiceChargesTotal
        : checkoutPrice;
    const unitPriceText = productCardPriceLabel(product, checkoutPrice);
    const unitLabel = productUnitLabel(product);
    const refundPolicy = product?.refund_policy || {};
    const refundPolicyLabel = (() => {
        const windowText = refundPolicy.window_days !== null && refundPolicy.window_days !== undefined
            ? `${refundPolicy.window_days} days`
            : null;
        if (refundPolicy.note) return refundPolicy.note;
        if (refundPolicy.policy === 'final_sale') return 'Final sale unless damaged or incorrect.';
        if (refundPolicy.policy === 'strict') return windowText ? `Replacement/review within ${windowText}.` : 'Replacement/review available for damaged or incorrect items.';
        return windowText ? `Return or replacement within ${windowText}.` : 'Standard Takeer return/review policy applies.';
    })();
    const formatIncludedPackageItem = (item) => {
        const name = String(item?.name || '').trim();
        if (!name) return '';

        const quantity = Number(item?.qty || 1);
        const quantityLabel = formatQuantity(quantity || 1);
        const unit = String(item?.unit || '').trim();
        const normalizedUnit = unit.toLowerCase();
        const shouldHideUnit = !unit || ['pc', 'pcs', 'piece', 'pieces', 'unit', 'units'].includes(normalizedUnit);

        return shouldHideUnit
            ? `${quantityLabel} ${name}`
            : `${quantityLabel} ${unit} ${name}`;
    };
    const includedPackageItems = Array.isArray(product.package_content_items)
        ? product.package_content_items
            .filter((item) => item?.name)
            .map(formatIncludedPackageItem)
            .filter(Boolean)
        : [];
    const physicalProductDetails = product.type === 'physical'
        ? [
            product.package_contents ? ['Package contents', product.package_contents] : null,
            includedPackageItems.length > 0
                ? ["What's in the package", includedPackageItems]
                : null,
            refundPolicyLabel ? ['Return policy', refundPolicyLabel] : null,
        ].filter(Boolean)
        : [];
    const productFaqs = Array.isArray(product?.faqs)
        ? product.faqs.filter((faq) => faq?.question && faq?.answer)
        : [];
    const servicePriceText = (() => {
        if (product.type !== 'service') return productPriceLabel(product, effectiveCheckoutPrice);
        if (payableServiceRequest) return `TZS ${Number(payableServiceRequest.quoted_amount || product.checkout_price || 0).toLocaleString()}`;
        const selectedOptionHasPrice = selectedServiceOption?.price !== null && selectedServiceOption?.price !== undefined && selectedServiceOption?.price !== '';
        if (servicePriceDisplay === 'hidden' && !selectedOptionHasPrice) return 'Contact provider';
        if ((servicePriceDisplay === 'quote_only' || serviceMode === 'request_quote') && !selectedOptionHasPrice) return 'Quote after request';
        if (selectedServiceOption && !selectedOptionHasPrice) return 'Price varies';
        const amount = `TZS ${parseFloat(checkoutPrice || 0).toLocaleString()}`;
        if (effectiveServicePriceDisplay === 'starts_from') return `From ${amount}`;
        if (effectiveServicePriceDisplay === 'package') return `${amount} package`;
        if (servicePriceUnitLabels[effectiveServicePriceDisplay]) return `${amount} / ${servicePriceUnitLabels[effectiveServicePriceDisplay]}`;
        return amount;
    })();
    const canCheckout = !serviceTrustBlocksBooking && (groupSaleReservationMode || (hasProductVariants
        ? Boolean(selectedVariant?.id && isVariantSelectionComplete && (!requiresOwnedStock || Number(selectedVariant?.inventory_count || 0) > 0))
        : (!requiresOwnedStock || Number(product.available_stock || 0) > 0)));
    const timeInputValueFromDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const renderIntakeField = (field) => {
        const value = serviceIntakeAnswers[field.id] ?? '';
        const commonInputClass = 'w-full h-11 rounded-xl border border-input bg-background px-3 text-sm';

        if (field.type === 'textarea') {
            return (
                <textarea
                    className="w-full min-h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={value}
                    required={Boolean(field.required)}
                    placeholder={field.placeholder || ''}
                    onChange={(e) => updateIntakeAnswer(field.id, e.target.value)}
                />
            );
        }

        if (field.type === 'select') {
            return (
                <select
                    className={commonInputClass}
                    value={value}
                    required={Boolean(field.required)}
                    onChange={(e) => updateIntakeAnswer(field.id, e.target.value)}
                >
                    <option value="">Chagua...</option>
                    {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            );
        }

        if (field.type === 'checkbox') {
            return (
                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm font-semibold">
                    <input
                        type="checkbox"
                        checked={Boolean(value)}
                        required={Boolean(field.required)}
                        onChange={(e) => updateIntakeAnswer(field.id, e.target.checked)}
                    />
                    Ndiyo
                </label>
            );
        }

        if (['file', 'image'].includes(field.type)) {
            const uploadedFiles = Array.isArray(value) ? value : value?.url ? [value] : [];
            const acceptedTypes = field.type === 'image'
                ? 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif'
                : 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain';
            return (
                <div className="space-y-2">
                    <label className="relative flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 text-sm">
                        <span className="font-semibold text-foreground">
                            {uploadedFiles.length > 0
                                ? field.type === 'image' ? 'Ongeza picha nyingine' : 'Ongeza faili nyingine'
                                : field.type === 'image' ? 'Chagua picha' : 'Chagua faili'}
                        </span>
                        <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                            Pakia
                        </span>
                        <input
                            type="file"
                            multiple
                            accept={acceptedTypes}
                            required={Boolean(field.required) && uploadedFiles.length === 0}
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={(e) => {
                                uploadIntakeFiles(field, e.target.files);
                                e.target.value = '';
                            }}
                        />
                    </label>
                    {intakeUploadingField === field.id && <p className="text-xs text-muted-foreground">Inapakia...</p>}
                    {uploadedFiles.length > 0 && (
                        <div className="space-y-1.5">
                            {uploadedFiles.map((file, index) => (
                                <div key={`${file.url || file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs">
                                    <span className="min-w-0 truncate font-semibold text-emerald-800">{file.name || `Faili ${index + 1}`}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeIntakeFile(field.id, index)}
                                        className="shrink-0 font-black text-emerald-700 hover:text-red-600"
                                    >
                                        Ondoa
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (field.type === 'location') {
            return (
                <div className="space-y-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 rounded-xl justify-start"
                        onClick={() => setIntakeLocationPicker(field.id)}
                    >
                        <MapPin className="h-4 w-4 mr-2" />
                        {value?.address || field.placeholder || 'Chagua eneo kwenye ramani'}
                    </Button>
                    {value?.extraDetails && <p className="text-xs text-muted-foreground">{value.extraDetails}</p>}
                    <input className="sr-only" required={Boolean(field.required)} value={value?.address || ''} onChange={() => { }} />
                </div>
            );
        }

        return (
            <input
                type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                className={commonInputClass}
                value={value}
                required={Boolean(field.required)}
                placeholder={field.placeholder || ''}
                onChange={(e) => updateIntakeAnswer(field.id, e.target.value)}
            />
        );
    };

    const getCheckoutButtonText = () => {
        if (isPremiumVideoProduct && product.has_access) {
            return 'Tazama Video';
        }
        if (isPremiumAudioProduct && product.has_access) {
            return 'Sikiliza Audio';
        }
        if (isGalleryPackProduct && product.has_access) {
            return 'Fungua Gallery';
        }
        if (canReadDocumentOnline) {
            return 'Soma Online';
        }
        if (product.type === 'digital' && product.has_access) {
            return 'Fungua Faili';
        }
        if (payableServiceRequest) {
            return 'Pay Service Quote';
        }
        if (groupSaleReservationMode) {
            return 'Join group sale';
        }
        if (hasProductVariants) {
            if (!isVariantSelectionComplete) {
                const missing = variantAttributeKeys.find(key => !(variantFilters[key] || '').toString().trim());
                return `Chagua ${formatAttributeLabel(missing)}`;
            }
            if (!selectedVariant?.id) return "Chagua Chaguo";
            if (requiresOwnedStock && Number(selectedVariant?.inventory_count || 0) <= 0) return "Bidhaa Imeisha";
        } else {
            if (requiresOwnedStock && Number(product.available_stock || 0) <= 0) return "Bidhaa Imeisha";
        }

        if (product.type === 'service' && servicePricingModel === 'deposit_required') {
            return 'Lipa Deposit';
        }
        if (startsAsServiceInquiry) {
            return 'Start Enquiry';
        }
        if (product.type === 'service' && serviceMode === 'book_appointment') {
            return 'Book Appointment';
        }
        if (product.type === 'service') {
            return 'Pay / Reserve';
        }
        if (groupSaleCheckoutOpen) {
            return 'Buy Group Deal';
        }
        if (product.type === 'digital') {
            return 'Lipa Sasa';
        }
        return 'Nunua Kwenye Mtandao';
    };

    const serviceRequestType = (() => {
        if (serviceMode === 'request_quote') return 'quote_request';
        if (serviceMode === 'book_appointment') return 'appointment_request';
        return 'contact_request';
    })();
    const productServiceAreas = Array.isArray(product?.service_area)
        ? product.service_area.map((area) => String(area).trim()).filter(Boolean)
        : [];
    const serviceIntakeForm = Array.isArray(product?.service_intake_form) ? product.service_intake_form : [];
    const customerLocationNeeded = product?.type === 'service'
        && ['customer_location', 'hybrid'].includes(product.service_location_type);
    const serviceAreaGatingEnabled = product?.type === 'service'
        && productServiceAreas.length > 0
        && customerLocationNeeded;
    const normalizedRequestLocation = serviceRequestForm.location_text.trim().toLowerCase();
    const serviceAreaMatches = !serviceAreaGatingEnabled
        || (normalizedRequestLocation.length > 0 && productServiceAreas.some((area) => {
            const normalizedArea = area.toLowerCase();
            return normalizedRequestLocation.includes(normalizedArea) || normalizedArea.includes(normalizedRequestLocation);
        }));
    const updateIntakeAnswer = (fieldId, value) => {
        setServiceIntakeAnswers((prev) => ({ ...prev, [fieldId]: value }));
    };
    const uploadIntakeFiles = async (field, files) => {
        const selectedFiles = Array.from(files || []);
        if (selectedFiles.length === 0) return;
        setIntakeUploadingField(field.id);
        try {
            const uploadedFiles = [];
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch('/api/service-requests/intake-file', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrf(),
                    },
                    body: formData,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || 'Upload failed.');
                uploadedFiles.push(data);
            }
            setServiceIntakeAnswers((prev) => {
                const existing = Array.isArray(prev[field.id])
                    ? prev[field.id]
                    : prev[field.id]
                        ? [prev[field.id]]
                        : [];
                return { ...prev, [field.id]: [...existing, ...uploadedFiles] };
            });
            toast.success(uploadedFiles.length > 1 ? 'Mafaili yameambatanishwa.' : 'Faili limeambatanishwa.');
        } catch (error) {
            toast.error(error.message || 'Imeshindikana kuambatanisha faili.');
        } finally {
            setIntakeUploadingField(null);
        }
    };
    const removeIntakeFile = (fieldId, index) => {
        setServiceIntakeAnswers((prev) => {
            const files = Array.isArray(prev[fieldId])
                ? prev[fieldId]
                : prev[fieldId]
                    ? [prev[fieldId]]
                    : [];
            return { ...prev, [fieldId]: files.filter((_, fileIndex) => fileIndex !== index) };
        });
    };

    useEffect(() => {
        if (serviceMode !== 'book_appointment' || !serviceRequestForm.preferred_date || !product?.id || !serviceAreaMatches) {
            setServiceSlots([]);
            return;
        }

        const controller = new AbortController();
        const fetchSlots = async () => {
            setServiceSlotsLoading(true);
            try {
                const params = new URLSearchParams({
                    date: serviceRequestForm.preferred_date,
                    timezone: serviceRequestForm.timezone || 'Africa/Dar_es_Salaam',
                });
                if (selectedServiceOption?.id) {
                    params.set('service_option_id', selectedServiceOption.id);
                }
                const response = await fetch(`/api/products/${product.slug || product.id}/service-slots?${params.toString()}`, {
                    signal: controller.signal,
                    headers: { Accept: 'application/json' },
                });
                const data = await response.json().catch(() => ({}));
                setServiceSlots(response.ok ? (data.data || []) : []);
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setServiceSlots([]);
                }
            } finally {
                setServiceSlotsLoading(false);
            }
        };

        fetchSlots();
        return () => controller.abort();
    }, [serviceMode, serviceRequestForm.preferred_date, serviceRequestForm.timezone, product?.id, serviceAreaMatches, selectedServiceOption?.id]);

    const submitServiceRequest = async (e) => {
        e.preventDefault();
        if (serviceRequestSubmitting) return;

        if (!serviceRequestForm.customer_name.trim()) {
            toast.error('Tafadhali weka jina lako.');
            return;
        }
        if (!serviceRequestForm.customer_phone.trim() && !serviceRequestForm.customer_email.trim()) {
            toast.error('Tafadhali weka simu au email.');
            return;
        }
        if (serviceAreaGatingEnabled && !serviceAreaMatches) {
            toast.error('Tafadhali chagua au weka eneo ambalo huduma hii inapatikana.');
            return;
        }
        if (serviceRequestType === 'appointment_request' && product.service_scheduling_type === 'fixed_sessions' && !serviceRequestForm.selected_session_id) {
            toast.error('Tafadhali chagua session inayopatikana.');
            return;
        }

        setServiceRequestSubmitting(true);
        try {
            const res = await fetch('/api/service-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({
                    product_id: product.id,
                    request_type: serviceRequestType,
                    selected_service_option_id: selectedServiceOption?.id || undefined,
                    ...serviceRequestForm,
                    client_requirements: serviceIntakeAnswers,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Imeshindwa kutuma ombi.');
            }
            toast.success(data.message || 'Ombi limetumwa.');
            setServiceRequestOpen(false);
            setServiceRequestForm((prev) => ({
                ...prev,
                preferred_date: '',
                preferred_time: '',
                selected_slot_start: '',
                selected_slot_end: '',
                selected_session_id: '',
                location_text: '',
                message: '',
            }));
            setServiceIntakeAnswers({});
        } catch (error) {
            toast.error(error.message || 'Imeshindwa kutuma ombi.');
        } finally {
            setServiceRequestSubmitting(false);
        }
    };

    useEffect(() => {
        if (!auth?.user) return;
        setServiceRequestForm((prev) => ({
            ...prev,
            customer_name: prev.customer_name || auth.user.name || '',
            customer_phone: prev.customer_phone || auth.user.phone_number || '',
            customer_email: prev.customer_email || auth.user.email || '',
        }));
    }, [auth?.user]);

    useEffect(() => {
        if (selectedServiceOptionId || serviceOptions.length === 0) return;
        setSelectedServiceOptionId(String(serviceOptions[0].id || ''));
    }, [selectedServiceOptionId, serviceOptions]);

    useEffect(() => {
        const checkWaitlist = async () => {
            if (!auth.user) return;
            try {
                const res = await fetch(`/api/products/${product.slug}/waitlist/status?variant_id=${selectedVariant?.id || ''}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json();
                setIsOnWaitlist(data.on_waitlist);
            } catch (error) {
                console.error("Failed to check waitlist status", error);
            }
        };
        checkWaitlist();
    }, [product.slug, selectedVariant?.id, auth.user]);

    const toggleWaitlist = async () => {
        if (!auth.user) {
            toast.error("Tafadhali ingia kwenye akaunti yako kwanza.");
            return;
        }
        setIsWaitlistLoading(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/products/${product.slug}/waitlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({ variant_id: selectedVariant?.id || null })
            });
            const data = await res.json();
            setIsOnWaitlist(data.status === 'added');
            toast.success(data.message);
        } catch (error) {
            toast.error("Imeshindwa kubadili waitlist. Jaribu tena.");
        } finally {
            setIsWaitlistLoading(false);
        }
    };

    useEffect(() => {
        setSelectedVariantId('');
        setVariantFilters({});
    }, [product?.id]);

    useEffect(() => {
        if (!hasProductVariants) return;
        if (!selectedVariant?.id) return;
        if (String(selectedVariantId) !== String(selectedVariant.id)) {
            setSelectedVariantId(String(selectedVariant.id));
        }
    }, [hasProductVariants, selectedVariant, selectedVariantId]);

    useEffect(() => {
        if (!hasProductVariants || variantAttributeKeys.length === 0 || !selectedVariant) return;
        setVariantFilters((prev) => {
            const next = { ...prev };
            let changed = false;
            variantAttributeKeys.forEach((key) => {
                const current = (next[key] || '').toString().trim();
                const fallback = String(selectedVariant?.attributes?.[key] || '').trim();
                if (!current && fallback) {
                    next[key] = fallback;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [hasProductVariants, selectedVariant, variantAttributeKeys]);

    useEffect(() => {
        if (!hasProductVariants || variantAttributeKeys.length === 0) return;
        setVariantFilters((prev) => {
            const next = { ...prev };
            let changed = false;
            variantAttributeKeys.forEach((key) => {
                const value = (next[key] || '').toString().trim();
                if (!value) return;
                const available = availableOptionsByKey[key] || [];
                if (!available.includes(value)) {
                    next[key] = '';
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [availableOptionsByKey, hasProductVariants, variantAttributeKeys]);

    const formatAttributeLabel = (key) => (
        String(key || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );

    const goToPreviousMedia = () => {
        if (images.length <= 1) return;
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
        setActiveHotspot(null);
    };

    const goToNextMedia = () => {
        if (images.length <= 1) return;
        setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
        setActiveHotspot(null);
    };

    const handleGalleryTouchStart = (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        galleryTouchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
        };
    };

    const handleGalleryTouchEnd = (event) => {
        if (images.length <= 1 || !galleryTouchStartRef.current) return;

        const touch = event.changedTouches?.[0];
        if (!touch) return;

        const deltaX = touch.clientX - galleryTouchStartRef.current.x;
        const deltaY = touch.clientY - galleryTouchStartRef.current.y;
        galleryTouchStartRef.current = null;

        if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

        if (deltaX < 0) {
            goToNextMedia();
        } else {
            goToPreviousMedia();
        }
    };

    return (
        <AppLayout hideTabBar>
            <div className="min-h-screen bg-background text-foreground pb-24 md:pb-0 font-sans">
                <Head title={`${product.title} | Takeer`} />

                {/* Sticky Header with Back Button */}
                <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
                    <button
                        onClick={() => window.history.back()}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white pointer-events-auto hover:bg-black/50 transition-colors"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                </div>

                {/* Hero Image Section with Multi-image Slider */}
                <div
                    className="relative w-full aspect-square bg-muted overflow-hidden touch-pan-y select-none"
                    onTouchStart={handleGalleryTouchStart}
                    onTouchEnd={handleGalleryTouchEnd}
                >
                    <div className="w-full h-full relative group">
                        {isCurrentVideo ? (
                            <VideoPlayer
                                src={currentMedia?.image_url || currentMedia?.url}
                                processedUrl={currentMedia?.processed_url}
                                hlsUrl={currentMedia?.hls_url}
                                poster={currentMedia?.thumbnail_url || undefined}
                                className="w-full h-full object-contain bg-black transition-all duration-500"
                                autoPlay
                                muted
                                loop
                                controls={false}
                                overlayMuteToggle
                                playsInline
                                preload="metadata"
                                onPlay={() => trackContentInteraction('video_played', {
                                    context: 'product_media',
                                    media_id: currentMedia?.id || null,
                                    media_index: currentImageIndex,
                                }, `media-${currentMedia?.id || currentImageIndex}`)}
                            />
                        ) : (
                            <img
                                src={heroImage}
                                alt={product.title}
                                className="w-full h-full object-cover transition-all duration-500"
                            />
                        )}

                        {/* Hotspots Overlay */}
                        {!isCurrentVideo && hotspots.map((spot, idx) => (
                            <div
                                key={idx}
                                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveHotspot((prev) => (prev === spot ? null : spot));
                                }}
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/40 rounded-full animate-ping scale-150" />
                                    <div className={`h-8 w-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-90 ${activeHotspot === spot ? 'bg-brand-600' : 'bg-black/60 backdrop-blur-md'}`}>
                                        {spot.type === 'product' && <ShoppingBag className="h-4 w-4 text-white" />}
                                        {spot.type === 'link' && <LinkIcon className="h-4 w-4 text-white" />}
                                        {spot.type === 'text' && <Info className="h-4 w-4 text-white" />}
                                    </div>
                                </div>

                                {activeHotspot === spot && (
                                    <div
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[45] w-56"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="bg-white/95 backdrop-blur-xl p-3 rounded-2xl shadow-2xl border border-white/20 space-y-2 relative">
                                            <button
                                                onClick={() => setActiveHotspot(null)}
                                                className="absolute -top-2 -right-2 h-6 w-6 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg"
                                            >
                                                <ChevronLeft className="h-4 w-4 rotate-90" />
                                            </button>
                                            <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest">
                                                {spot.type}
                                            </p>
                                            <p className="text-sm font-bold text-foreground break-words">
                                                {spot.type === 'product' ? (spot.product?.title || `Bidhaa #${spot.data}`) : spot.data}
                                            </p>
                                            <Button
                                                size="sm"
                                                className="w-full rounded-xl h-9 px-3 bg-brand-600 text-white font-bold"
                                                onClick={() => {
                                                    if (spot.type === 'link') {
                                                        window.open(spot.data, '_blank');
                                                        return;
                                                    }
                                                    if (spot.type === 'product') {
                                                        const target = spot.product?.slug || spot.data;
                                                        if (target) window.location.href = `/product/${target}`;
                                                    }
                                                }}
                                            >
                                                {spot.type === 'product' ? 'Ione' : spot.type === 'link' ? 'Fungua' : 'Sawa'}
                                            </Button>
                                        </div>
                                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white/95" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Navigation Arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={goToPreviousMedia}
                                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/35 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                    aria-label="Previous media"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>
                                <button
                                    onClick={goToNextMedia}
                                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/35 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                    aria-label="Next media"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </>
                        )}

                        {/* Image Indicators */}
                        {images.length > 1 && (
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30">
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            setCurrentImageIndex(i);
                                            setActiveHotspot(null);
                                        }}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                                        aria-label={`Show media ${i + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                </div>

                {isPremiumVideoProduct && (
                    <section ref={premiumVideoRef} className="px-4 py-5 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                                    Premium Video
                                </p>
                                <h2 className="text-lg font-black leading-tight mt-1">
                                    {product.has_access ? 'Full video unlocked' : 'Buy to watch the full video'}
                                </h2>
                            </div>
                            {product.has_access && premiumVideo?.url ? (
                                <div className="bg-black">
                                    <div className="aspect-video">
                                        <VideoPlayer
                                            src={premiumVideo.url}
                                            hlsUrl={premiumVideo.hls_url || undefined}
                                            className="w-full h-full bg-black"
                                            controls
                                            playsInline
                                            preload="metadata"
                                            onPlay={() => trackContentInteraction('video_played', {
                                                context: 'premium_video',
                                                hls: Boolean(premiumVideo.hls_url),
                                                status: premiumVideo.status || null,
                                            }, 'premium-video')}
                                        />
                                    </div>
                                    {premiumVideo.status && premiumVideo.status !== 'ready' && (
                                        <div className="px-4 py-3 bg-amber-50 text-amber-800 text-xs font-bold">
                                            Video bado inaandaliwa kwa streaming bora. Unaweza kuanza kuitazama, kisha HLS itaonekana ikikamilika.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-5 text-sm leading-6 text-muted-foreground">
                                    <p>
                                        Trailer or preview media is shown above. Complete purchase to watch the full video inside Takeer.
                                    </p>
                                    {!product.allow_download && (
                                        <p className="mt-2 text-xs font-bold text-foreground">
                                            Downloads are disabled by the creator.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {isPremiumAudioProduct && (
                    <section ref={premiumVideoRef} className="px-4 py-5 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                                    Premium Audio
                                </p>
                                <h2 className="text-lg font-black leading-tight mt-1">
                                    {product.has_access ? 'Full audio unlocked' : 'Buy to listen to the full audio'}
                                </h2>
                            </div>
                            {product.has_access && premiumAudio?.url ? (
                                <div className="p-5 bg-slate-950">
                                    <audio
                                        src={premiumAudio.url}
                                        controls
                                        preload="metadata"
                                        className="w-full"
                                        onPlay={() => trackContentInteraction('audio_played', {
                                            context: 'premium_audio',
                                        }, 'premium-audio')}
                                    />
                                </div>
                            ) : (
                                <div className="p-5 text-sm leading-6 text-muted-foreground">
                                    <p>
                                        Preview media is shown above. Complete purchase to listen to the full audio inside Takeer.
                                    </p>
                                    {!product.allow_download && (
                                        <p className="mt-2 text-xs font-bold text-foreground">
                                            Downloads are disabled by the creator.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {isGalleryPackProduct && (
                    <section ref={premiumVideoRef} className="px-4 py-5 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                                    Gallery Pack
                                </p>
                                <h2 className="text-lg font-black leading-tight mt-1">
                                    {product.has_access ? 'Gallery unlocked' : 'Buy to unlock the gallery'}
                                </h2>
                            </div>
                            {product.has_access && galleryPack?.items?.length ? (
                                <div className="space-y-3 bg-slate-950 p-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {galleryPack.items.map((item, index) => (
                                            <div key={`${item.url}-${index}`} className="overflow-hidden rounded-xl bg-slate-900">
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => trackContentInteraction('gallery_viewed', {
                                                        context: 'gallery_pack',
                                                        gallery_index: index,
                                                        item_name: item.name || null,
                                                    })}
                                                    className="block aspect-square"
                                                >
                                                    <div className="relative h-full w-full">
                                                        {!galleryImageLoaded[index] && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                                                <Loader2 className="h-7 w-7 animate-spin text-white/70" />
                                                            </div>
                                                        )}
                                                        <img
                                                            src={item.url}
                                                            alt={item.name || `Gallery image ${index + 1}`}
                                                            className="h-full w-full object-cover"
                                                            onLoad={() => setGalleryImageLoaded((prev) => ({ ...prev, [index]: true }))}
                                                            onError={() => setGalleryImageLoaded((prev) => ({ ...prev, [index]: true }))}
                                                        />
                                                    </div>
                                                </a>
                                                {item.original_url && (
                                                    <a
                                                        href={item.original_url}
                                                        onClick={() => trackContentInteraction('gallery_original_downloaded', {
                                                            context: 'gallery_pack',
                                                            gallery_index: index,
                                                            item_name: item.name || null,
                                                        })}
                                                        className="flex items-center justify-center gap-2 border-t border-white/10 bg-white/10 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white/15"
                                                    >
                                                        <DownloadCloud className="h-3.5 w-3.5" />
                                                        Original
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {!product.allow_download && (
                                        <p className="px-1 text-[11px] font-bold text-slate-300">
                                            These are protected watermarked previews. Original downloads are disabled by the creator.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-5 text-sm leading-6 text-muted-foreground">
                                    <p>
                                        Preview media is shown above. Complete purchase to unlock protected gallery previews inside Takeer.
                                    </p>
                                    {!product.allow_download && (
                                        <p className="mt-2 text-xs font-bold text-foreground">
                                            Downloads are disabled by the creator.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {isLiveEventProduct && (
                    <section className="px-4 py-5 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                                    Live Event
                                </p>
                                <h2 className="text-lg font-black leading-tight mt-1">
                                    {product.has_access ? 'Event access unlocked' : 'Buy to unlock event access'}
                                </h2>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Starts</p>
                                        <p className="mt-1 text-sm font-black text-slate-900">
                                            {liveEvent?.starts_at ? new Date(liveEvent.starts_at).toLocaleString() : 'To be announced'}
                                        </p>
                                        {liveEvent?.duration_minutes && (
                                            <p className="mt-1 text-xs font-semibold text-slate-600">{liveEvent.duration_minutes} minutes · {liveEvent.timezone || 'local time'}</p>
                                        )}
                                    </div>
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Capacity</p>
                                        <p className="mt-1 text-sm font-black text-slate-900">
                                            {liveEvent?.capacity ? `${liveEvent.capacity} seats` : 'Open access'}
                                        </p>
                                        {liveEvent?.seats_remaining !== null && liveEvent?.seats_remaining !== undefined && (
                                            <p className="mt-1 text-xs font-semibold text-slate-600">{liveEvent.seats_remaining} remaining</p>
                                        )}
                                    </div>
                                </div>

                                {product.has_access ? (
                                    <div className="space-y-3">
                                        {liveEvent?.access_url && (
                                            <a
                                                href={liveEvent.access_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => trackContentInteraction('live_event_joined', {
                                                    context: 'live_event_access',
                                                    starts_at: liveEvent?.starts_at || null,
                                                })}
                                                className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-black text-white"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Join live event
                                            </a>
                                        )}
                                        {liveEvent?.venue && (
                                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Venue</p>
                                                <p className="mt-1 text-sm font-bold text-slate-900 whitespace-pre-line">{liveEvent.venue}</p>
                                            </div>
                                        )}
                                        {liveEvent?.replay_url && (
                                            <a
                                                href={liveEvent.replay_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => trackContentInteraction('video_played', {
                                                    context: 'live_event_replay',
                                                    starts_at: liveEvent?.starts_at || null,
                                                })}
                                                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-800"
                                            >
                                                <PlayCircle className="h-4 w-4" />
                                                Watch replay
                                            </a>
                                        )}
                                        {liveEvent?.instructions && (
                                            <p className="text-sm font-semibold leading-6 text-slate-700 whitespace-pre-line">
                                                {liveEvent.instructions}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm leading-6 text-muted-foreground">
                                        Event poster or preview media is shown above. Complete purchase to unlock the private join link, venue details, instructions, and replay if the creator provides one.
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {product.type === 'digital' && (digitalContentLabel || digitalLicenseLabel || (product.has_access && product.digital_access_instructions)) && (
                    <section className="px-4 py-4 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-blue-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Digital Asset</p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {digitalContentLabel && (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-800 border border-blue-100">{digitalContentLabel}</span>
                                )}
                                {digitalLicenseLabel && (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-800 border border-blue-100">{digitalLicenseLabel}</span>
                                )}
                            </div>
                            {product.has_access && product.digital_access_instructions && (
                                <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 whitespace-pre-line">
                                    {product.digital_access_instructions}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {canReadDocumentOnline && (
                    <section ref={documentReaderRef} className="px-4 py-5 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                                        Read Online
                                    </p>
                                    <h2 className="text-lg font-black leading-tight mt-1">
                                        {documentReader.name || 'PDF document'}
                                    </h2>
                                </div>
                                <a
                                    href={documentReader.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => trackContentInteraction('document_read', {
                                        context: 'document_reader_open',
                                        document_name: documentReader.name || null,
                                    })}
                                    className="h-10 px-3 rounded-xl bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center gap-2 text-xs font-black"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    Open
                                </a>
                            </div>
                            <div className="h-[70vh] min-h-[480px] bg-slate-100">
                                <iframe
                                    src={documentReader.url}
                                    title={documentReader.name || 'PDF reader'}
                                    onLoad={() => trackContentInteraction('document_read', {
                                        context: 'document_reader_iframe',
                                        document_name: documentReader.name || null,
                                    }, 'document-reader')}
                                    className="h-full w-full border-0"
                                />
                            </div>
                        </div>
                    </section>
                )}

                {hasSoftwareAccessPanel && (
                    <section className="px-4 py-5 bg-background max-w-2xl mx-auto">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                                    Releases
                                </p>
                                <h2 className="text-lg font-black leading-tight mt-1">
                                    {product.has_access ? 'Software downloads unlocked' : 'Buy to access releases'}
                                </h2>
                            </div>
                            {product.has_access && softwareLicenseKey?.key && (
                                <div className="m-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">License Key</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <code className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm font-black text-emerald-900 break-all">
                                            {softwareLicenseKey.key}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard?.writeText(softwareLicenseKey.key);
                                                toast.success('License key copied.');
                                            }}
                                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    {softwareLicenseKey.offline_license_url && (
                                        <a
                                            href={softwareLicenseKey.offline_license_url}
                                            onClick={() => trackContentInteraction('license_file_downloaded', {
                                                context: 'software_access_panel',
                                                license_key_id: softwareLicenseKey.id || null,
                                            })}
                                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 border border-emerald-100"
                                        >
                                            <DownloadCloud className="h-4 w-4" />
                                            Download offline license file
                                        </a>
                                    )}
                                </div>
                            )}
                            {hasSoftwareReleases ? (
                                <div className="divide-y divide-border">
                                    {softwareReleases.map((release) => (
                                        <div key={release.id} className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-black text-foreground">v{release.version}</p>
                                                        {release.is_latest && (
                                                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                                                Latest
                                                            </span>
                                                        )}
                                                    </div>
                                                    {release.title && (
                                                        <p className="mt-1 text-sm font-bold text-slate-700">{release.title}</p>
                                                    )}
                                                    {release.changelog && (
                                                        <p className="mt-2 text-sm leading-6 text-muted-foreground whitespace-pre-line">{release.changelog}</p>
                                                    )}
                                                </div>
                                                {product.has_access && release.download_url && (
                                                    <a
                                                        href={release.download_url}
                                                        onClick={() => trackContentInteraction('software_release_downloaded', {
                                                            context: 'software_releases',
                                                            release_id: release.id,
                                                            version: release.version,
                                                            is_latest: Boolean(release.is_latest),
                                                        })}
                                                        className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-xs font-black text-white inline-flex items-center gap-2"
                                                    >
                                                        <DownloadCloud className="h-4 w-4" />
                                                        Download
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-sm font-semibold text-muted-foreground">
                                    No release downloads have been published yet.
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Content Area - Pulls up slightly over the image */}
                <div className="relative z-10 -mt-6 rounded-t-3xl bg-background px-4 pt-6 pb-20 max-w-2xl mx-auto md:mt-0 md:rounded-none md:pt-10">
                    {/* Product Title & Price */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            {product.type === 'digital' && (
                                <span className="bg-brand-100 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-max uppercase tracking-widest">
                                    <DownloadCloud className="h-3 w-3" /> Mtandaoni
                                </span>
                            )}
                            {product.type === 'service' && (
                                <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-max uppercase tracking-widest">
                                    <CalendarClock className="h-3 w-3" /> Huduma / Booking
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-black leading-tight mb-2 text-foreground break-words">
                            {product.title}
                        </h1>
                        <div className="flex items-end gap-3">
                            <div className="text-3xl font-extrabold text-brand-600 leading-none">
                                {product.type === 'service' ? (
                                    <span>{servicePriceText}</span>
                                ) : unitLabel ? (
                                    <span>{unitPriceText}</span>
                                ) : (
                                    <>
                                        <span className="text-sm font-bold align-text-top mr-1">TZS</span>
                                        {parseFloat(checkoutPrice || 0).toLocaleString()}
                                    </>
                                )}
                            </div>
                            {product.discounted_price > 0 && Number(product.discounted_price) < Number(product.price) && (
                                <div className="text-lg font-bold text-muted-foreground line-through decoration-muted-foreground/60 leading-none mb-1">
                                    {parseFloat(product.price).toLocaleString()}
                                </div>
                            )}
                            {product.discounted_price > 0 && Number(product.discounted_price) < Number(product.price) && (
                                <div className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full mb-1 border border-red-200 uppercase tracking-widest">
                                    OFA
                                </div>
                            )}
                        </div>
                        {product.type === 'service' && servicePricingModel === 'hourly_rate' && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                                Bei kwa saa · Minimum {Number(product?.service_min_hours || 1)}h
                            </p>
                        )}
                        {product.type === 'physical' && unitLabel && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-brand-700">
                                Bei kwa pakiti hii · {productStockLabel(product)}
                            </p>
                        )}
                        {product.type === 'service' && (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-purple-800">
                                <span className="rounded-full bg-purple-50 border border-purple-100 px-2 py-1">
                                    {serviceModeLabels[serviceMode] || 'Service'}
                                </span>
                                {product.service_category && (
                                    <span className="rounded-full bg-purple-50 border border-purple-100 px-2 py-1">
                                        {product.service_subcategory || product.service_category}
                                    </span>
                                )}
                                {product.service_duration_minutes && (
                                    <span className="rounded-full bg-purple-50 border border-purple-100 px-2 py-1">
                                        {product.service_duration_minutes} min
                                    </span>
                                )}
                                {product.service_location_type && (
                                    <span className="rounded-full bg-purple-50 border border-purple-100 px-2 py-1">
                                        {serviceLocationLabels[product.service_location_type] || product.service_location_type}
                                    </span>
                                )}
                            </div>
                        )}
                        {product.type === 'service' && servicePricingModel === 'contract_quote' && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                                Bei kwa makubaliano (Quote/Contract)
                            </p>
                        )}
                        {product.type === 'service' && (serviceIsShowcase || servicePricingModel === 'showcase_only') && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                                Showcase only · Wateja wawasiliane moja kwa moja
                            </p>
                        )}
                        {product.type === 'service' && serviceOptions.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-purple-900">Choose option</p>
                                <div className="mt-2 grid gap-2">
                                    {serviceOptions.map((option) => {
                                        const selected = String(selectedServiceOption?.id || '') === String(option.id || '');
                                        const optionPrice = option.price !== null && option.price !== undefined
                                            ? `TZS ${Number(option.price || 0).toLocaleString()}`
                                            : 'Price varies';
                                        return (
                                            <button
                                                key={option.id || option.name}
                                                type="button"
                                                onClick={() => setSelectedServiceOptionId(String(option.id || ''))}
                                                className={cn(
                                                    'rounded-xl border bg-white px-3 py-2 text-left transition-colors',
                                                    selected ? 'border-purple-500 ring-1 ring-purple-200' : 'border-purple-100 hover:border-purple-300'
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-purple-950">{option.name}</p>
                                                        {option.description && (
                                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{option.description}</p>
                                                        )}
                                                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                                                            {option.capacity_type === 'unlimited' ? <span>Open capacity</span> : option.capacity ? <span>{option.capacity} units</span> : null}
                                                            {option.max_guests ? <span>{option.max_guests} guests</span> : null}
                                                            {option.checkin_time ? <span>In {option.checkin_time}</span> : null}
                                                            {option.checkout_time ? <span>Out {option.checkout_time}</span> : null}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-black text-purple-900">{optionPrice}</p>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                                                            {servicePriceUnitLabels[option.price_display] ? `per ${servicePriceUnitLabels[option.price_display]}` : option.price_display || 'fixed'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {product.type === 'service' && serviceRelatedProducts.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Products this provider makes or brings</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Related items from the same provider. View or buy them separately from the service.
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {serviceRelatedProducts.map((item) => (
                                        <Link
                                            key={item.id}
                                            href={item.url || `/product/${item.slug || item.id}`}
                                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <ShoppingBag className="mx-auto mt-4 h-5 w-5 text-slate-300" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-black text-slate-900">{item.title}</p>
                                                    <p className="mt-0.5 text-xs font-black text-brand-700">
                                                        TZS {Number(item.checkout_price ?? item.discounted_price ?? item.price ?? 0).toLocaleString()}
                                                    </p>
                                                    {item.fulfillment_mode && item.fulfillment_mode !== 'own_stock' && (
                                                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                            {fulfillmentModeLabels[item.fulfillment_mode] || item.fulfillment_mode}
                                                        </p>
                                                    )}
                                                </div>
                                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Merchant / Seller Info */}
                    <Link
                        href={merchantSlug ? `/m/${merchantSlug}` : '#'}
                        className="flex items-center gap-3 p-4 bg-accent/30 border border-border/50 rounded-2xl mb-6 shadow-sm hover:bg-accent/50 transition-colors"
                    >
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-brand-100 flex items-center justify-center shrink-0">
                            {merchant.avatar_url ? (
                                <img src={merchant.avatar_url} alt={merchantDisplayName} className="w-full h-full object-cover" />
                            ) : (
                                <Store className="h-6 w-6 text-brand-500" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 max-w-full">
                                    <p className="font-bold text-base text-foreground truncate">{merchantDisplayName}</p>
                                    {merchant.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />}
                                </div>
                                {(merchant.successful_sales || merchant.unsuccessful_sales) ? (
                                    <span className="text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-max border border-green-200">
                                        <ShieldCheck className="h-3 w-3" />
                                        {Math.round((merchant.successful_sales / ((merchant.successful_sales + merchant.unsuccessful_sales) || 1)) * 100)}% Trust
                                    </span>
                                ) : null}
                            </div>
                            {merchantUsername ? (
                                <p className="text-sm text-muted-foreground truncate">@{merchantUsername}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground truncate">Takeer merchant</p>
                            )}
                        </div>
                        {merchantRatingsCount > 0 && (
                            <div className="shrink-0 text-right pl-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {compactCount(merchantRatingsCount)} ratings
                                </p>
                                <p className="mt-0.5 text-2xl font-black leading-none text-foreground">
                                    {merchantRatingAverage.toFixed(1)}
                                </p>
                                <div className="mt-1 flex justify-end gap-0.5 text-amber-500">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <Star
                                            key={index}
                                            className={cn(
                                                'h-3.5 w-3.5',
                                                index < Math.round(merchantRatingAverage)
                                                    ? 'fill-amber-500'
                                                    : 'fill-transparent text-muted-foreground/40'
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </Link>

                    {isServiceProduct && (
                        <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="font-black text-base text-emerald-950 flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-emerald-700" />
                                        Ulinzi wa Takeer
                                    </h2>
                                    <p className="text-xs font-semibold text-emerald-800 mt-1">
                                        Tunakagua watoa huduma na kushikilia malipo kupitia SafePay.
                                    </p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${serviceTrust.trust_ready
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}>
                                    {serviceTrust.trust_ready ? 'Imekaguliwa' : 'Inakaguliwa'}
                                </span>
                            </div>
                            <div className="mt-4 grid gap-2">
                                {serviceTrustRows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 border border-white px-3 py-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {row.ok ? (
                                                <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                            )}
                                            <span className="text-sm font-bold text-slate-900 truncate">{row.label}</span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 text-right">{row.detail}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-white/70 border border-white px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Huduma zilizokamilika</p>
                                    <p className="text-lg font-black text-slate-950">{serviceTrust.completed_services_count || 0}</p>
                                </div>
                                <div className="rounded-xl bg-white/70 border border-white px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Migogoro</p>
                                    <p className="text-lg font-black text-slate-950">{serviceTrust.disputes_count || 0}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description Section */}
                    <div className="space-y-4 mb-8">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <Info className="h-5 w-5 text-brand-500" />
                            {isServiceProduct ? 'Maelezo ya Huduma' : 'Maelezo ya Bidhaa'}
                        </h2>
                        <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    {physicalProductDetails.length > 0 && (
                        <div className="mb-8 border-t border-border/40 pt-5">
                            <div className="space-y-3">
                                {physicalProductDetails.map(([label, value]) => (
                                    <div key={label}>
                                        <p className="text-sm font-black text-foreground">{label}</p>
                                        {Array.isArray(value) ? (
                                            <ul className="mt-1 space-y-1 text-sm leading-relaxed text-muted-foreground">
                                                {value.map((item) => (
                                                    <li key={item} className="flex gap-2">
                                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-500/70 shrink-0" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{value}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {productFaqs.length > 0 && (
                        <div className="mb-8 border-t border-border/40 pt-5">
                            <h2 className="mb-3 text-lg font-black text-foreground">Questions & Answers</h2>
                            <div className="space-y-3">
                                {productFaqs.map((faq, index) => (
                                    <details key={faq.id || `${faq.question}-${index}`} className="rounded-2xl border border-border bg-card px-4 py-3" open={index === 0}>
                                        <summary className="cursor-pointer text-sm font-black text-foreground">
                                            {faq.question}
                                        </summary>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                                            {faq.answer}
                                        </p>
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Specifications Grid */}
                    {hasProductSpecifications && (
                        <div className="space-y-6 mb-8 pt-5 border-t border-border/40">
                            <div className="grid grid-cols-2 gap-3">
                                {attributes.category && (
                                    <div className="bg-accent/20 p-3.5 rounded-2xl border border-border/10">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Kategoria</span>
                                        <span className="font-bold text-sm text-foreground">{attributes.category}</span>
                                    </div>
                                )}
                                {attributes.brand_name && (
                                    <div className="bg-accent/20 p-3.5 rounded-2xl border border-border/10">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Brand</span>
                                        <span className="font-bold text-sm text-foreground">{attributes.brand_name}</span>
                                    </div>
                                )}
                                {attributes.model_name && (
                                    <div className="bg-accent/20 p-3.5 rounded-2xl border border-border/10">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Model</span>
                                        <span className="font-bold text-sm text-foreground">{attributes.model_name}</span>
                                    </div>
                                )}
                                {attributes.material && (
                                    <div className="bg-accent/20 p-3.5 rounded-2xl border border-border/10">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Material</span>
                                        <span className="font-bold text-sm text-foreground">{attributes.material}</span>
                                    </div>
                                )}
                            </div>

                            {/* Dynamic Facets (Entered Attributes) */}
                            {product.category_attribute_values && product.category_attribute_values.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">Sifa na Usalama wa Bidhaa</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {product.category_attribute_values.map((val, idx) => {
                                            let displayValue = '';
                                            if (val.value_boolean !== null) {
                                                displayValue = val.value_boolean ? 'Ndiyo' : 'Hapana';
                                            } else if (val.value_number !== null) {
                                                displayValue = val.value_number;
                                                if (val.value_json?.unit) displayValue += ` ${val.value_json.unit}`;
                                            } else if (val.value_text) {
                                                displayValue = val.value_text;
                                            } else if (Array.isArray(val.value_json) && val.value_json.length > 0) {
                                                displayValue = val.value_json.join(', ');
                                            }

                                            if (!displayValue) return null;

                                            return (
                                                <div key={idx} className="bg-brand-50/50 border border-brand-100/50 px-3 py-2 rounded-xl group hover:bg-brand-100/50 transition-colors">
                                                    <span className="text-[11px] font-bold text-brand-800/70 block">{val.attribute?.label}</span>
                                                    <span className="text-[11px] font-black text-brand-900 whitespace-pre-line">{displayValue}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Static Attributes (Colors) */}
                            {attributes.colors && attributes.colors.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rangi Zinazopatikana</p>
                                    <div className="flex flex-wrap gap-2">
                                        {attributes.colors.map((color, i) => (
                                            <span key={i} className="px-3 py-1 rounded-lg bg-muted text-xs font-bold border border-border/50">
                                                {color}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {hasProductVariants && (
                        <div className="mb-6 rounded-2xl border border-brand-100 bg-brand-50/40 p-3.5 space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-wider text-brand-700">Chaguo</p>
                            {variantAttributeKeys.map((key) => {
                                const options = variantOptionsByKey[key] || [];
                                const availableOptions = availableOptionsByKey[key] || [];
                                const selectedValue = String(variantFilters[key] || '');
                                const hasSwatchOptions = options.some((option) => !!optionSwatchByKey?.[key]?.[option]);

                                return (
                                    <div key={key} className="space-y-1.5">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{formatAttributeLabel(key)}</p>
                                        {hasSwatchOptions ? (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {options.map((option) => {
                                                    const swatch = optionSwatchByKey?.[key]?.[option];
                                                    const isAvailable = availableOptions.includes(option);
                                                    const isSelected = selectedValue === option;
                                                    return (
                                                        <button
                                                            key={`${key}-${option}`}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => {
                                                                setVariantFilters((prev) => ({ ...prev, [key]: option }));
                                                                setSelectedVariantId('');
                                                            }}
                                                            className={`w-24 shrink-0 rounded-xl border overflow-hidden ${isSelected ? 'border-brand-600 ring-1 ring-brand-500' : isAvailable ? 'border-slate-300' : 'border-slate-200 opacity-50 cursor-not-allowed'}`}
                                                        >
                                                            <div className="h-14 bg-slate-100">
                                                                {swatch ? (
                                                                    <img src={swatch} alt={option} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500">No swatch</div>
                                                                )}
                                                            </div>
                                                            <p className="px-2 py-1 text-xs font-semibold text-left truncate">{option}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2">
                                                {options.map((option) => {
                                                    const isAvailable = availableOptions.includes(option);
                                                    const isSelected = selectedValue === option;
                                                    return (
                                                        <button
                                                            key={`${key}-${option}`}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => {
                                                                setVariantFilters((prev) => ({ ...prev, [key]: option }));
                                                                setSelectedVariantId('');
                                                            }}
                                                            className={`h-10 rounded-xl border px-2 text-sm font-semibold text-left ${isSelected ? 'border-brand-600 bg-brand-600 text-white' : isAvailable ? 'border-brand-200 bg-white text-slate-900' : 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed'}`}
                                                        >
                                                            <span className="truncate block">{option}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {selectedVariant && (
                                <div className="rounded-xl border border-brand-200 bg-white p-2.5">
                                    <p className="text-sm font-bold text-brand-900">{selectedVariant.name}</p>
                                    <p className="text-[11px] font-bold text-brand-700">
                                        {productStockLabel(product, selectedVariant.inventory_quantity ?? selectedVariant.inventory_count)}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {product.type === 'service' && (serviceHours.length > 0 || serviceLocations.length > 0 || serviceAreaType || serviceTimezone) && (
                        <div className="space-y-3 mb-8 rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                            <h3 className="font-bold text-base flex items-center gap-2 text-purple-800">
                                <CalendarClock className="h-4 w-4" />
                                Service Availability
                            </h3>

                            {serviceAreaType && (
                                <p className="text-xs font-bold uppercase tracking-wide text-purple-700">
                                    Area: {serviceAreaType === 'onsite' ? 'On-site' : serviceAreaType === 'remote' ? 'Remote' : 'Hybrid'}
                                </p>
                            )}
                            {serviceTimezone && (
                                <p className="text-xs text-purple-700">Timezone: {serviceTimezone}</p>
                            )}

                            {serviceHours.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    {serviceHours.map((row) => (
                                        <div key={`${row.dayLabel}-${row.open}`} className="rounded-xl border border-purple-200/80 bg-white/80 px-3 py-2">
                                            <p className="text-xs font-black text-purple-900">{row.dayLabel}</p>
                                            <p className="text-xs text-purple-700 mt-0.5">{row.open} - {row.close}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {serviceLocations.length > 0 && (
                                <div className="rounded-xl border border-purple-200/80 bg-white/80 p-3">
                                    <p className="text-xs font-black text-purple-900 flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" /> Main Service locations
                                    </p>
                                    <p className="text-xs text-purple-700 mt-1">{serviceLocations.join(' • ')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {product.type === 'service' && ((product.service_area || []).length > 0 || product.service_client_requirements || providerServiceLocation?.address || serviceCharges.length > 0 || serviceOptions.length > 0) && (
                        <div className="mb-2">
                            <div className="space-y-4">
                                {serviceCharges.length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-wider text-foreground">Gharama zilizojumuishwa</p>
                                        <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-white overflow-hidden">
                                            {serviceCharges.map((charge, index) => (
                                                <div key={`${charge.name}-${index}`} className="flex items-start justify-between gap-3 px-3.5 py-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-foreground">{charge.name}</p>
                                                        {charge.description && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">{charge.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-black text-foreground">
                                                            {charge.amount !== null && charge.amount !== undefined
                                                                ? `TZS ${Number(charge.amount || 0).toLocaleString()}`
                                                                : 'Amount varies'}
                                                        </p>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                            {serviceChargeUnitLabels[charge.unit] || charge.unit || 'fixed'}{charge.required ? '' : ' · optional'}
                                                            {charge.included_in_checkout ? ' · included' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {['provider_location', 'hybrid'].includes(product.service_location_type) && providerServiceLocation?.address && (
                                    <div className="rounded-xl bg-muted/30 px-3.5 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-brand-600" /> Provider venue
                                        </p>
                                        {providerServiceLocation.name && (
                                            <p className="text-sm font-black mt-1.5">{providerServiceLocation.name}</p>
                                        )}
                                        <p className="text-sm text-muted-foreground mt-1">{providerServiceLocation.address}</p>
                                        {providerServiceLocation.extraDetails && (
                                            <p className="text-xs text-muted-foreground mt-1">{providerServiceLocation.extraDetails}</p>
                                        )}
                                        {providerMapUrl && (
                                            <a href={providerMapUrl} target="_blank" rel="noreferrer" className="inline-flex mt-2 text-xs font-black text-brand-700 hover:text-brand-900">
                                                Open map
                                            </a>
                                        )}
                                    </div>
                                )}
                                {(product.service_area || []).length > 0 && (
                                    <div className="rounded-xl bg-muted/30 px-3.5 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-brand-600" /> Service area
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">{product.service_area.join(' • ')}</p>
                                    </div>
                                )}
                                {product.service_client_requirements && (
                                    <div className="rounded-xl bg-muted/30 px-3.5 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-foreground">Client requirements</p>
                                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{product.service_client_requirements}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Trust Badges / Warnings */}
                    {product.type !== 'service' && (
                        merchantCanTransactInApp ? (
                            <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-4 flex items-start gap-3 border border-green-100 dark:border-green-900/20">
                                <ShieldCheck className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-sm text-green-800 dark:text-green-500">Takeer SafePay</h4>
                                    <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-1">
                                        {(!product.type || product.type === 'physical')
                                            ? 'Pesa yako itahifadhiwa kwenye Escrow. Muuzaji atapokea pesa punde tu utakapothibitisha kuipokea mzigo wako.'
                                            : 'Utapewa link ya kupakua mara tu baada ya malipo kukamilika.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 flex items-start gap-3 border border-amber-200 dark:border-amber-900/30">
                                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-sm text-amber-800 dark:text-amber-500">Muuzaji Hajathibitishwa</h4>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                                        Muuzaji huyu hajathibitishwa na Takeer. Malipo hufanywa nje ya mtandao wetu, kwa hivyo hatuwezi kudhamini usalama wa miamala yako au kukurejeshea pesa.
                                    </p>
                                </div>
                            </div>
                        )
                    )}
                    {product.type === 'physical' && fulfillmentGuidance && (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/20 dark:bg-blue-900/10">
                            <div className="flex items-start gap-3">
                                <Info className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                                        Fulfillment flow
                                    </p>
                                    <h4 className="mt-1 text-sm font-black text-blue-900 dark:text-blue-400">
                                        {fulfillmentGuidance.title}
                                    </h4>
                                    <p className="mt-1 text-xs leading-5 text-blue-800/80 dark:text-blue-400/80">
                                        {fulfillmentGuidance.body}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                {fulfillmentGuidance.steps.map((stepLabel, index) => (
                                    <div key={stepLabel} className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-blue-900 shadow-sm dark:bg-blue-950/40 dark:text-blue-100">
                                        <span className="mr-1 text-blue-500">{index + 1}.</span>{stepLabel}
                                    </div>
                                ))}
                            </div>

                            {(fulfillmentAvailableFromLabel || fulfillmentLeadTimeLabel || product.group_sale_goal_quantity) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {fulfillmentLeadTimeLabel && (
                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-800">
                                            {fulfillmentLeadTimeLabel}
                                        </span>
                                    )}
                                    {fulfillmentAvailableFromLabel && (
                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-800">
                                            {fulfillmentAvailableFromLabel}
                                        </span>
                                    )}
                                    {product.group_sale_goal_quantity && (
                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-800">
                                            Target {product.group_sale_goal_quantity}
                                        </span>
                                    )}
                                </div>
                            )}

                            <p className="mt-3 text-[11px] font-semibold leading-5 text-blue-800/80 dark:text-blue-300/80">
                                Takeer protects the payment until fulfillment or receipt confirmation, so the seller does not receive payout before the order is completed.
                            </p>
                        </div>
                    )}
                    {serviceTrustBlocksBooking && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 flex items-start gap-3 border border-amber-200 dark:border-amber-900/30">
                            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm text-amber-800 dark:text-amber-500">Booking imesitishwa kwa muda</h4>
                                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                                    {serviceTrustBlockReason}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Bottom Bar for Purchase */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-4 flex items-center justify-between gap-4 max-w-2xl mx-auto shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Kiasi Jumla</p>
                        <p className="font-black text-lg text-foreground truncate">
                            {product.type === 'service' ? servicePriceText : `TZS ${parseFloat(effectiveCheckoutPrice || 0).toLocaleString()}`}
                        </p>
                        {product.type === 'service' && includedServiceChargesTotal > 0 && !payableServiceRequest && (
                            <p className="text-[10px] font-bold text-emerald-700">
                                Includes TZS {includedServiceChargesTotal.toLocaleString()} extra charges
                            </p>
                        )}
                        {product.type === 'physical' && fulfillmentGuidance && (
                            <p className="text-[10px] font-bold text-blue-700">
                                {fulfillmentModeLabels[physicalFulfillmentMode]}{fulfillmentLeadTimeLabel ? ` · ${fulfillmentLeadTimeLabel}` : ''}
                            </p>
                        )}
                    </div>
                    {serviceTrustBlocksBooking ? (
                        <Button
                            className="flex-[1.5] h-14 rounded-2xl text-[15px] bg-slate-200 text-slate-600 shadow-none font-black cursor-not-allowed"
                            size="lg"
                            disabled
                        >
                            Inasubiri Uhakiki
                        </Button>
                    ) : shouldOpenServiceRequest ? (
                        <Button
                            className="flex-[1.5] h-14 rounded-2xl text-[15px] bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 font-black"
                            size="lg"
                            onClick={() => setServiceRequestOpen(true)}
                        >
                            {serviceMode === 'book_appointment'
                                ? 'Request Appointment'
                                : serviceMode === 'request_quote'
                                    ? 'Request Quote'
                                    : 'Contact Provider'}
                        </Button>
                    ) : merchantCanTransactInApp && !isServiceContactOnly ? (
                        <div className="flex-[1.5] flex flex-col gap-1">
                            {payableServiceRequest && (serviceRequestPaymentComplete || serviceRequestPaymentPending) ? (
                                <Button
                                    className="h-14 rounded-2xl text-[15px] bg-slate-200 text-slate-700 shadow-none font-black"
                                    size="lg"
                                    disabled
                                >
                                    {payableServiceRequestStatus === 'held'
                                        ? 'Payment Held in SafePay'
                                        : payableServiceRequestStatus === 'disputed'
                                            ? 'Payment Disputed'
                                            : serviceRequestPaymentComplete ? 'Payment Completed' : 'Payment Pending'}
                                </Button>
                            ) : (
                                <>
                                    {!canCheckout && (
                                        <p className="text-[10px] font-bold text-red-500 text-center">
                                            {hasProductVariants && !isVariantSelectionComplete ? "Tafadhali kamilisha uchaguzi" :
                                                (requiresOwnedStock && Number(selectedVariant?.inventory_count || product.available_stock || 0) <= 0 ? "Samahani, bidhaa hii imeisha" : "")}
                                        </p>
                                    )}
                                    {!canCheckout && requiresOwnedStock && Number(selectedVariant?.inventory_count || product.available_stock || 0) <= 0 && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                toggleWaitlist();
                                            }}
                                            disabled={isWaitlistLoading}
                                            className={cn(
                                                "flex items-center justify-center gap-1.5 py-1 px-3 rounded-full border transition-all text-[10px] font-black uppercase tracking-tighter self-center",
                                                isOnWaitlist
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            <Bell className={cn("h-3 w-3", isOnWaitlist && "fill-emerald-600")} />
                                            {isOnWaitlist ? "Ninasubiri Taarifa" : "Nijulishe ikirudi"}
                                        </button>
                                    )}
                                    {canCheckout && (<Button
                                        className={`h-14 rounded-2xl text-[15px] shadow-lg ${canCheckout ? 'shadow-brand-500/20' : 'bg-slate-300 shadow-none'}`}
                                        size="lg"
                                        disabled={!canCheckout}
                                        onClick={() => {
                                            if (product.type === 'digital' && product.has_access && product.latest_order_id) {
                                                if (isPremiumVideoProduct && premiumVideo?.url) {
                                                    premiumVideoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    return;
                                                }
                                                if (isPremiumAudioProduct && premiumAudio?.url) {
                                                    premiumVideoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    return;
                                                }
                                                if (isGalleryPackProduct && galleryPack?.items?.length) {
                                                    premiumVideoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    return;
                                                }
                                                if (canReadDocumentOnline) {
                                                    documentReaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    return;
                                                }
                                                window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                                                    detail: {
                                                        itemId: product.id,
                                                        itemType: 'product',
                                                        orderId: product.latest_order_id,
                                                        productTitle: product.title,
                                                    }
                                                }));
                                                return;
                                            }
                                            if (groupSaleReservationMode) {
                                                window.location.href = groupSaleOffer.url || `/group-sale/${groupSaleOffer.slug}`;
                                                return;
                                            }
                                            if (window.__openCheckout) {
                                                window.__openCheckout({
                                                    ...product,
                                                    checkout_price: payableServiceRequest?.quoted_amount || (groupSaleCheckoutOpen ? groupSaleOffer?.campaign_price : undefined),
                                                    group_sale_campaign_id: groupSaleCheckoutOpen ? groupSaleOffer?.id : undefined,
                                                    group_sale_offer: groupSaleOffer || undefined,
                                                    service_request_payment: payableServiceRequest || undefined,
                                                    selected_service_option: selectedServiceOption || undefined,
                                                    preselected_variant_id: selectedVariant?.id || null,
                                                    preselected_variant_filters: variantFilters,
                                                });
                                            } else {
                                                alert("Checkout Modal not loaded.");
                                            }
                                        }}
                                    >
                                        <Zap className={`mr-2 h-5 w-5 ${canCheckout ? 'fill-white/20' : 'text-slate-400'}`} />
                                        {getCheckoutButtonText()}
                                    </Button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : externalContactUrl ? (
                        <a
                            href={externalContactUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-[1.5] h-14 rounded-2xl text-[15px] bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center font-black"
                        >
                            {product.type === 'service' && servicePricingModel === 'contract_quote'
                                ? 'Omba Nukuu'
                                : product.type === 'service' && (serviceMode === 'external_booking' || serviceSchedulingType === 'external')
                                    ? 'Fungua Booking'
                                    : product.type === 'service' && serviceMode === 'request_quote'
                                        ? 'Omba Nukuu'
                                        : product.type === 'service' && serviceMode === 'showcase_only'
                                            ? 'Wasiliana na Provider'
                                            : 'Wasiliana Nje ya App'}
                        </a>
                    ) : (
                        <Button
                            className="flex-[1.5] h-14 rounded-2xl text-[15px] bg-amber-500/50 text-white shadow-lg shadow-amber-500/20 cursor-not-allowed"
                            size="lg"
                            disabled
                        >
                            Wasiliana Nje ya App
                        </Button>
                    )}
                </div>

                {serviceRequestOpen && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div className="w-full max-w-lg rounded-2xl bg-background border shadow-2xl max-h-[90vh] overflow-y-auto">
                            <form onSubmit={submitServiceRequest} className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-amber-600">
                                            {serviceMode === 'book_appointment' ? 'Ombi la miadi' : serviceMode === 'request_quote' ? 'Ombi la bei' : 'Ombi la mawasiliano'}
                                        </p>
                                        <h3 className="text-xl font-black mt-1">{product.title}</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setServiceRequestOpen(false)}
                                        className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center font-black"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jina</span>
                                        <input
                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                            value={serviceRequestForm.customer_name}
                                            onChange={(e) => setServiceRequestForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                                            placeholder="Jina lako"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Simu</span>
                                        <input
                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                            value={serviceRequestForm.customer_phone}
                                            onChange={(e) => setServiceRequestForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                                            placeholder="+255..."
                                        />
                                    </label>
                                </div>

                                <label className="space-y-1.5 block">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Barua pepe si lazima</span>
                                    <input
                                        type="email"
                                        className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                        value={serviceRequestForm.customer_email}
                                        onChange={(e) => setServiceRequestForm((prev) => ({ ...prev, customer_email: e.target.value }))}
                                        placeholder="jina@example.com"
                                    />
                                </label>

                                {serviceOptions.length > 0 && (
                                    <div className="rounded-xl border bg-purple-50/40 p-3 space-y-2">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chaguo la huduma</p>
                                        <div className="grid gap-2">
                                            {serviceOptions.map((option) => {
                                                const selected = String(selectedServiceOption?.id || '') === String(option.id || '');
                                                return (
                                                    <button
                                                        key={option.id || option.name}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedServiceOptionId(String(option.id || ''));
                                                            setServiceRequestForm((prev) => ({
                                                                ...prev,
                                                                preferred_time: '',
                                                                selected_slot_start: '',
                                                                selected_slot_end: '',
                                                                selected_session_id: '',
                                                            }));
                                                        }}
                                                        className={cn(
                                                            'rounded-xl border bg-white px-3 py-2 text-left transition-colors',
                                                            selected ? 'border-amber-500 text-amber-800' : 'border-purple-100 text-muted-foreground hover:border-amber-300'
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-black">{option.name}</p>
                                                                {option.description && <p className="text-xs mt-0.5">{option.description}</p>}
                                                            </div>
                                                            <p className="text-xs font-black shrink-0">
                                                                {option.price !== null && option.price !== undefined ? `TZS ${Number(option.price || 0).toLocaleString()}` : 'Bei hubadilika'}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {serviceMode === 'book_appointment' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tarehe unayopendelea</span>
                                            <input
                                                type="date"
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={serviceRequestForm.preferred_date}
                                                disabled={serviceAreaGatingEnabled && !serviceAreaMatches}
                                                onChange={(e) => setServiceRequestForm((prev) => ({
                                                    ...prev,
                                                    preferred_date: e.target.value,
                                                    preferred_time: '',
                                                    selected_slot_start: '',
                                                    selected_slot_end: '',
                                                    selected_session_id: '',
                                                }))}
                                            />
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Muda unaopendelea</span>
                                            <input
                                                type="time"
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={serviceRequestForm.preferred_time}
                                                disabled={serviceAreaGatingEnabled && !serviceAreaMatches}
                                                onChange={(e) => setServiceRequestForm((prev) => ({ ...prev, preferred_time: e.target.value }))}
                                            />
                                        </label>
                                    </div>
                                )}

                                {serviceMode === 'book_appointment' && serviceRequestForm.preferred_date && (
                                    <div className="rounded-xl border bg-muted/20 p-3">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nafasi zinazopatikana</p>
                                        {serviceSlotsLoading ? (
                                            <p className="text-sm text-muted-foreground mt-2">Inapakia nafasi...</p>
                                        ) : serviceSlots.length === 0 ? (
                                            <p className="text-sm text-muted-foreground mt-2">
                                                {product.service_scheduling_type === 'fixed_sessions'
                                                    ? 'Hakuna session wazi kwa tarehe hii. Jaribu tarehe nyingine.'
                                                    : 'Hakuna nafasi zilizowekwa kwa tarehe hii. Bado unaweza kutuma muda unaopendelea.'}
                                            </p>
                                        ) : (
                                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {serviceSlots.slice(0, 12).map((slot) => {
                                                    const slotTime = new Date(slot.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    const slotInputTime = timeInputValueFromDate(slot.starts_at);
                                                    const selected = serviceRequestForm.selected_slot_start === slot.starts_at || (slot.session_id && String(serviceRequestForm.selected_session_id) === String(slot.session_id));
                                                    return (
                                                        <button
                                                            key={slot.session_id || slot.starts_at}
                                                            type="button"
                                                            disabled={!slot.available}
                                                            onClick={() => setServiceRequestForm((prev) => ({
                                                                ...prev,
                                                                preferred_time: slotInputTime,
                                                                selected_slot_start: slot.starts_at,
                                                                selected_slot_end: slot.ends_at,
                                                                selected_session_id: slot.session_id || '',
                                                                timezone: slot.timezone || prev.timezone,
                                                            }))}
                                                            className={cn(
                                                                'min-h-12 rounded-xl border px-2 text-sm font-bold transition-colors disabled:opacity-40',
                                                                selected ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-input bg-background hover:border-amber-300'
                                                            )}
                                                        >
                                                            <span className="block">{slot.title || slotTime}</span>
                                                            {slot.title && <span className="block text-[10px] font-semibold text-muted-foreground">{slotTime}</span>}
                                                            {slot.capacity_type === 'unlimited' ? (
                                                                <span className="block text-[10px] font-semibold text-muted-foreground">Wazi</span>
                                                            ) : slot.capacity > 1 ? (
                                                                <span className="block text-[10px] font-semibold text-muted-foreground">Zimebaki {slot.remaining}</span>
                                                            ) : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {customerLocationNeeded && (
                                    <label className="space-y-1.5 block">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Eneo lako</span>
                                        <input
                                            className={cn(
                                                'w-full h-11 rounded-xl border bg-background px-3 text-sm',
                                                serviceAreaGatingEnabled && !serviceAreaMatches && serviceRequestForm.location_text
                                                    ? 'border-red-300 focus:border-red-400'
                                                    : 'border-input'
                                            )}
                                            value={serviceRequestForm.location_text}
                                            onChange={(e) => setServiceRequestForm((prev) => ({
                                                ...prev,
                                                location_text: e.target.value,
                                                preferred_date: serviceAreaGatingEnabled ? '' : prev.preferred_date,
                                                preferred_time: serviceAreaGatingEnabled ? '' : prev.preferred_time,
                                                selected_slot_start: serviceAreaGatingEnabled ? '' : prev.selected_slot_start,
                                                selected_slot_end: serviceAreaGatingEnabled ? '' : prev.selected_slot_end,
                                            }))}
                                            placeholder="Eneo au anuani"
                                        />
                                        {serviceAreaGatingEnabled && !serviceAreaMatches && serviceRequestForm.location_text && (
                                            <p className="text-xs font-semibold text-red-600">
                                                Huduma hii inapatikana: {productServiceAreas.join(', ')}.
                                            </p>
                                        )}
                                    </label>
                                )}

                                {serviceIntakeForm.length > 0 && (
                                    <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taarifa zinazohitajika</p>
                                        <div className="space-y-3">
                                            {serviceIntakeForm.map((field) => (
                                                <label key={field.id} className="space-y-1.5 block">
                                                    <span className="text-xs font-bold text-muted-foreground">
                                                        {field.label}{field.required ? ' *' : ''}
                                                    </span>
                                                    {renderIntakeField(field)}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {serviceIntakeForm.length === 0 && (
                                    <label className="space-y-1.5 block">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ujumbe</span>
                                        <textarea
                                            className="w-full min-h-28 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                            value={serviceRequestForm.message}
                                            onChange={(e) => setServiceRequestForm((prev) => ({ ...prev, message: e.target.value }))}
                                            placeholder={product.service_client_requirements || 'Mwambie mtoa huduma unachohitaji...'}
                                        />
                                    </label>
                                )}

                                <Button
                                    type="submit"
                                    disabled={serviceRequestSubmitting}
                                    className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black"
                                >
                                    {serviceRequestSubmitting ? 'Inatuma...' : 'Tuma Ombi'}
                                </Button>
                            </form>
                        </div>
                    </div>
                )}
                <AddressPickerModal
                    isOpen={Boolean(intakeLocationPicker)}
                    onOpenChange={(open) => !open && setIntakeLocationPicker(null)}
                    initialLat={serviceIntakeAnswers[intakeLocationPicker]?.lat}
                    initialLng={serviceIntakeAnswers[intakeLocationPicker]?.lng}
                    initialAddress={serviceIntakeAnswers[intakeLocationPicker]?.address}
                    initialExtraDetails={serviceIntakeAnswers[intakeLocationPicker]?.extraDetails}
                    onSave={(location) => {
                        if (!intakeLocationPicker) return;
                        updateIntakeAnswer(intakeLocationPicker, location);
                        setServiceRequestForm((prev) => ({
                            ...prev,
                            location_text: location.address || prev.location_text,
                            preferred_date: serviceAreaGatingEnabled ? '' : prev.preferred_date,
                            preferred_time: serviceAreaGatingEnabled ? '' : prev.preferred_time,
                            selected_slot_start: serviceAreaGatingEnabled ? '' : prev.selected_slot_start,
                            selected_slot_end: serviceAreaGatingEnabled ? '' : prev.selected_slot_end,
                        }));
                    }}
                />
            </div>
        </AppLayout>
    );
}
