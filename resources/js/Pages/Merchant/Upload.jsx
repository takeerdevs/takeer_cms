import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import {
    UploadCloud, Sparkles, CheckCircle2, ChevronRight, ChevronLeft,
    Tags, AlertTriangle, PenLine, MapPin, Link as LinkIcon,
    Edit3, X, ShoppingBag, Globe, Calendar, ArrowLeft,
    FileUp, Phone, MessageCircle, ExternalLink, File, CheckCircle, Loader2,
    Plus, Search, Trash2, Info, Store, ShieldCheck, PlayCircle, Music, Images, Palette,
    BookOpen, FileText, Code2, Layers, KeyRound, Copy, RotateCcw, Ban,
    Utensils, BedDouble, Landmark, ClipboardList, CalendarClock, Car, GraduationCap, Clock3, Ship,
    DownloadCloudIcon
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import PolicyNotice from '@/Components/PolicyNotice';
import AddressPickerModal from '@/Components/AddressPickerModal';
import AutoPostTargetsPanel, { defaultAutoPostTargets } from '@/Components/Merchant/AutoPostTargetsPanel';
import WholesaleCommerceEditor from '@/Components/Merchant/WholesaleCommerceEditor';
import ProductFaqEditor from '@/Components/Merchant/ProductFaqEditor';
import ProductCertificatesEditor from '@/Components/Merchant/ProductCertificatesEditor';
import ProductDetailSectionsEditor from '@/Components/Merchant/ProductDetailSectionsEditor';
import PhysicalPackageEditor from '@/Components/Merchant/PhysicalPackageEditor';
import PhysicalStockEditor, { MissingStockLocationNotice } from '@/Components/Merchant/PhysicalStockEditor';
import VariantCommerceFields from '@/Components/Merchant/VariantCommerceFields';
import VariantIdentityEditor from '@/Components/Merchant/VariantIdentityEditor';
import PhysicalPublishPanel from '@/Components/Merchant/PhysicalPublishPanel';
import PhysicalFulfillmentEditor from '@/Components/Merchant/PhysicalFulfillmentEditor';
import ServiceBookingChannelEditor from '@/Components/Merchant/ServiceBookingChannelEditor';
import ServiceBookingPolicyEditor from '@/Components/Merchant/ServiceBookingPolicyEditor';
import ServiceIntakeFormEditor from '@/Components/Merchant/ServiceIntakeFormEditor';
import ServiceLocationAreasEditor from '@/Components/Merchant/ServiceLocationAreasEditor';
import ServiceRelatedProductsEditor from '@/Components/Merchant/ServiceRelatedProductsEditor';
import { KNOWN_UPLOAD_MODULE_KEYS, getUploadModuleConfig, publishModuleKey } from '@/lib/uploadModules';
import { RepeatableTextList, ServiceModuleCreateFields } from '@/Components/Merchant/ServiceModuleCreateFields';

const CATEGORIES = ['Nguo', 'Viatu', 'Simu na Vifaa', 'Chakula', 'Nyumba na Bustani', 'Michezo', 'Watoto', 'Afya & Uzuri', 'Nyingine'];
const DELIVERY_PROMISE_PRESETS = [
    { key: 'same_day', label: 'Leo leo', hint: 'Bidhaa hii inaweza kufika siku hiyo hiyo.', handling: [0, 0], transit: [0, 0], buyerLabel: 'Same day delivery' },
    { key: 'next_day', label: 'Kesho', hint: 'Bidhaa ifike kesho.', handling: [0, 1], transit: [1, 1], buyerLabel: 'Delivery by tomorrow' },
    { key: 'one_two', label: 'Siku 1-2', hint: 'Kwa bidhaa za kawaida ndani ya mji.', handling: [0, 1], transit: [1, 2], buyerLabel: 'Delivery in 1-2 days' },
    { key: 'made_order', label: 'Kutengenezwa', hint: 'Kwa custom/made-to-order.', handling: [2, 5], transit: [1, 2], buyerLabel: 'Made to order: delivery in 3-7 days' },
    { key: 'confirm', label: 'Tutathibitisha', hint: 'Kwa mzigo mkubwa au delivery inayobadilika.', handling: ['', ''], transit: ['', ''], buyerLabel: 'Delivery time will be confirmed in chat', confirm: true },
];

const PHYSICAL_FULFILLMENT_MODES = [
    {
        key: 'own_stock',
        label: 'Nina bidhaa mkononi',
        hint: 'Ipo kwako sasa, hata kama uliinunua kwa mkulima/supplier.',
    },
    {
        key: 'supplier_sourced',
        label: 'Sina stock, nitaitafuta',
        hint: 'Utai-confirm au kuipata kutoka supplier baada ya oda.',
    },
    {
        key: 'made_to_order',
        label: 'Natengeneza baada ya oda',
        hint: 'Tailoring, food prep, crafts, printed items, n.k.',
    },
    {
        key: 'farm_harvest',
        label: 'Mazao / mavuno',
        hint: 'Kwa mkulima au stock ya mavuno yanayotarajiwa.',
    },
    {
        key: 'preorder',
        label: 'Preorder',
        hint: 'Wateja waagize kabla bidhaa haijapatikana.',
    },
    {
        key: 'group_sale',
        label: 'Group sale',
        hint: 'Preorder yenye target quantity na deadline.',
    },
];

const CERTIFICATE_AUTHORITY_OPTIONS = [
    'TBS',
    'TFDA',
    'SGS',
    'Intertek',
    'Bureau Veritas',
    'TUV',
    'UL',
    'CE',
    'RoHS',
    'ISO',
    'Other',
];

const CERTIFICATE_OWNERSHIP_OPTIONS = [
    { key: 'supplier_owned', label: 'Supplier-owned' },
    { key: 'manufacturer_issued', label: 'Manufacturer-issued' },
    { key: 'product_specific', label: 'Product-specific' },
    { key: 'business_license', label: 'Business license' },
    { key: 'quality_standard', label: 'Quality standard' },
    { key: 'other', label: 'Other' },
];

const certificateTypeLabel = (value) => (
    CERTIFICATE_OWNERSHIP_OPTIONS.find((option) => option.key === value)?.label || value
);

const SERVICE_MODULE_PICKER = [
    {
        key: 'menu',
        icon: Utensils,
        title: 'Chakula / Menu',
        description: 'Weka chakula, vinywaji, combo, add-on, muda wa kuandaa, tags za chakula, na sehemu za menu.',
        tone: 'orange',
    },
    {
        key: 'rooms',
        icon: BedDouble,
        title: 'Vyumba / Malazi',
        description: 'Weka aina ya chumba, vitanda, idadi ya wageni, huduma zilizopo, muda wa kuingia/kutoka, na sheria za nyumba.',
        tone: 'purple',
    },
    {
        key: 'tour_departures',
        icon: Landmark,
        title: 'Safari / Ratiba ya tour',
        description: 'Weka eneo la safari, pickup, ukubwa wa kundi, ratiba ya siku, vitu vilivyojumuishwa, na mahitaji ya msafiri.',
        tone: 'emerald',
    },
    {
        key: 'custom_orders',
        icon: ClipboardList,
        title: 'Oda ya kuagiza maalum',
        description: 'Kusanya mahitaji ya mteja, muda wa kuandaa, namna ya kutoa bei, na maelezo ya pickup au delivery.',
        tone: 'slate',
    },
    {
        key: 'appointments',
        icon: CalendarClock,
        title: 'Miadi / Appointment',
        description: 'Kwa ushauri, huduma za kitaalamu, salon/afya, muda wa huduma, na maswali ya awali kwa mteja.',
        tone: 'blue',
    },
    {
        key: 'reservations',
        icon: Calendar,
        title: 'Reservation',
        description: 'Kwa meza, ukumbi, viti, idadi ya watu, maelezo ya booking, na muda wa kutembelea.',
        tone: 'amber',
    },
    {
        key: 'rentals',
        icon: Car,
        title: 'Kupangisha / Kukodisha',
        description: 'Kwa magari, vifaa, maeneo, idadi ya vitu, deposit, na masharti ya kukodisha.',
        tone: 'cyan',
    },
    {
        key: 'workshops',
        icon: GraduationCap,
        title: 'Darasa / Tukio la live',
        description: 'Kwa workshop, cohort, bootcamp, matokeo ya kujifunza, ratiba, na idadi ya washiriki.',
        tone: 'violet',
    },
    {
        key: 'online_live_events',
        icon: CalendarClock,
        title: 'Online Live Event',
        description: 'Kwa webinar, live class, online workshop, link ya kuhudhuria, ratiba, na nafasi za washiriki.',
        tone: 'blue',
    },
    {
        key: 'forwarders',
        icon: Ship,
        title: 'Forwarder / Import logistics',
        description: 'Kwa kampuni za cargo/import: warehouses za origin, collection offices, routes, nyaraka, na maelekezo ya mteja.',
        tone: 'indigo',
    },
];

const MODULE_TONE_CLASSES = {
    orange: 'border-orange-100 bg-orange-50 text-orange-700 group-hover:border-orange-300 group-hover:bg-orange-100',
    purple: 'border-purple-100 bg-purple-50 text-purple-700 group-hover:border-purple-300 group-hover:bg-purple-100',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700 group-hover:border-emerald-300 group-hover:bg-emerald-100',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 group-hover:border-slate-300 group-hover:bg-slate-100',
    blue: 'border-blue-100 bg-blue-50 text-blue-700 group-hover:border-blue-300 group-hover:bg-blue-100',
    amber: 'border-amber-100 bg-amber-50 text-amber-700 group-hover:border-amber-300 group-hover:bg-amber-100',
    cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700 group-hover:border-cyan-300 group-hover:bg-cyan-100',
    violet: 'border-violet-100 bg-violet-50 text-violet-700 group-hover:border-violet-300 group-hover:bg-violet-100',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700 group-hover:border-indigo-300 group-hover:bg-indigo-100',
};

const GENERIC_SERVICE_OPTION_TEMPLATE = {
    label: 'Service option',
    description: 'Create packages or service levels customers can choose before booking.',
    examples: ['Basic Package', 'Standard Package', 'Premium Package'],
    placeholder: 'Standard Package',
    description_placeholder: 'What is included in this option',
    fields: {
        capacity_type: false,
        capacity: false,
        max_guests: false,
        duration_minutes: true,
        checkin_time: false,
        checkout_time: false,
    },
};

const formatFileSizeMb = (value) => {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return 'Size unknown';
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const fileNameFromUrl = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return 'Attached file';

    const normalized = raw.replace(/^private:\/\//, '');
    try {
        const url = new URL(normalized, window.location.origin);
        const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
        return name || 'Attached file';
    } catch {
        const name = decodeURIComponent(normalized.split('/').filter(Boolean).pop() || '');
        return name || 'Attached file';
    }
};

const mediaTypeForFile = (file) => file?.type?.startsWith('video/') ? 'video' : 'image';
const isVideoMedia = (item) => item?.media_type === 'video'
    || item?.type === 'video'
    || item?.mime?.startsWith?.('video/')
    || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(String(item?.url || item?.localUrl || ''));

export default function Upload({ merchantUsername, merchantTimezone = 'Africa/Dar_es_Salaam', timezoneOptions = [], merchantLocations = [] }) {
    const fileInputRef = useRef(null);
    const imageContainerRef = useRef(null);
    const digitalFileRef = useRef(null);
    const coverImageRef = useRef(null);
    const draftMediaSyncTimerRef = useRef(null);
    const lastDraftMediaSyncRef = useRef('');
    const { auth } = usePage().props;
    const currentMerchant = auth?.user?.merchant_profiles?.find(m => m.username === merchantUsername)
        || auth?.user?.merchant_profiles?.[0] || {};
    const liveEventTimezoneOptions = useMemo(() => {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return Array.from(new Set([
            merchantTimezone,
            currentMerchant?.timezone,
            browserTimezone,
            ...timezoneOptions,
        ].filter(Boolean)));
    }, [merchantTimezone, currentMerchant?.timezone, timezoneOptions]);

    // Flow state: 'select', 'physical', 'digital', 'service'
    const [step, setStep] = useState('select');
    const [uploadModule, setUploadModule] = useState(null);
    const [menuDetails, setMenuDetails] = useState({
        section: 'Main menu',
        item_type: 'food',
        prep_time_minutes: '',
        dietary_tags: [],
        availability: ['dine_in', 'pickup'],
        add_ons: [],
    });
    const [roomDetails, setRoomDetails] = useState({
        room_type: 'Standard room',
        bed_type: 'Double bed',
        max_guests: 2,
        room_count: 1,
        bathrooms: '',
        checkin_time: '14:00',
        checkout_time: '10:00',
        amenities: [],
        availability: ['available'],
        booking_policy: 'manual_confirm',
    });

    const [images, setImages] = useState([]); // [{ url, localUrl, isUploading }]
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [hotspots, setHotspots] = useState({}); // { [imageIndex]: [ { id, x, y, type, data } ] }
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState(null);

    // Hotspot Modal State
    const [showHotspotModal, setShowHotspotModal] = useState(false);
    const [pendingHotspot, setPendingHotspot] = useState(null); // { x, y }
    const [hotspotType, setHotspotType] = useState('product'); // 'product', 'link', 'text'
    const [hotspotData, setHotspotData] = useState(''); // text or url or product_id

    // Manual fallback state
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualStepCompleted, setManualStepCompleted] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualCategory, setManualCategory] = useState(CATEGORIES[0]);
    const [catalogCategories, setCatalogCategories] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('');
    const [selectedCatalogSchema, setSelectedCatalogSchema] = useState(null);
    const [selectedBrandId, setSelectedBrandId] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [dynamicAttributeValues, setDynamicAttributeValues] = useState({});
    const [hasVariants, setHasVariants] = useState(false);
    const [variantDecision, setVariantDecision] = useState(null); // null | single | multi
    const [variants, setVariants] = useState([]);
    const [physicalFlowStep, setPhysicalFlowStep] = useState(1); // 1: essentials (includes variant decision), 3: details
    const [swatchModalOpen, setSwatchModalOpen] = useState(false);
    const [swatchVariantIndex, setSwatchVariantIndex] = useState(null);
    const [swatchFile, setSwatchFile] = useState(null);
    const [swatchDragOver, setSwatchDragOver] = useState(false);
    const swatchFileInputRef = useRef(null);
    const swatchCameraInputRef = useRef(null);

    const [productType, setProductType] = useState('physical'); // 'physical', 'digital', 'service'
    const [url, setUrl] = useState(''); // External link (Google Drive, Calendly, etc.)

    // Digital dual-mode: upload, external link, premium video/audio, or gallery pack.
    const [digitalDeliveryMode, setDigitalDeliveryMode] = useState('upload');
    const [digitalFile, setDigitalFile] = useState(null); // { name, url, size, type, isUploading }
    const [paidVideoFile, setPaidVideoFile] = useState(null); // { name, url, size, type, isUploading }
    const [paidAudioFile, setPaidAudioFile] = useState(null); // { name, url, size, type, isUploading }
    const [paidGalleryItems, setPaidGalleryItems] = useState([]);
    const [liveEventStartsAt, setLiveEventStartsAt] = useState('');
    const [liveEventDurationMinutes, setLiveEventDurationMinutes] = useState('90');
    const [liveEventTimezone, setLiveEventTimezone] = useState(merchantTimezone || 'Africa/Dar_es_Salaam');
    const [liveEventAccessUrl, setLiveEventAccessUrl] = useState('');
    const [liveEventVenue, setLiveEventVenue] = useState('');
    const [liveEventCapacity, setLiveEventCapacity] = useState('');
    const [liveEventReplayUrl, setLiveEventReplayUrl] = useState('');
    const [liveEventInstructions, setLiveEventInstructions] = useState('');
    const [allowDigitalDownload, setAllowDigitalDownload] = useState(false);
    const [digitalContentType, setDigitalContentType] = useState('file');
    const [digitalUsageLicense, setDigitalUsageLicense] = useState('personal');
    const [digitalAccessInstructions, setDigitalAccessInstructions] = useState('');
    const [softwareReleases, setSoftwareReleases] = useState([]);
    const [releaseForm, setReleaseForm] = useState({ version: '', title: '', changelog: '', file: null });
    const [releaseUploading, setReleaseUploading] = useState(false);
    const [releaseSaving, setReleaseSaving] = useState(false);
    const [licenseKeyEnabled, setLicenseKeyEnabled] = useState(false);
    const [licenseKeyPrefix, setLicenseKeyPrefix] = useState('');
    const [licenseActivationLimit, setLicenseActivationLimit] = useState('1');
    const [softwareLicenseKeys, setSoftwareLicenseKeys] = useState([]);
    const [softwareLicenseAnalytics, setSoftwareLicenseAnalytics] = useState(null);
    const [licenseKeyBusy, setLicenseKeyBusy] = useState(null);
    const [softwareProductSlug, setSoftwareProductSlug] = useState('');

    // Service dual-mode: 'internal' (WhatsApp/phone) or 'external' (Calendly/booking link)
    const [serviceBookingMode, setServiceBookingMode] = useState('takeer');
    const [serviceContactType, setServiceContactType] = useState('whatsapp'); // 'whatsapp' | 'phone' | 'inperson'
    const [serviceContactValue, setServiceContactValue] = useState(''); // phone number for whatsapp/phone
    const [servicePricingModel, setServicePricingModel] = useState('fixed_price');
    const [serviceBookingType, setServiceBookingType] = useState('instant');
    const [serviceHourlyRate, setServiceHourlyRate] = useState('');
    const [serviceMinHours, setServiceMinHours] = useState('1');
    const [serviceDepositAmount, setServiceDepositAmount] = useState('');
    const [showServiceDepositInfo, setShowServiceDepositInfo] = useState(false);
    const [serviceIsShowcase, setServiceIsShowcase] = useState(false);
    const [serviceMode, setServiceMode] = useState('pay_now');
    const [serviceSchedulingType, setServiceSchedulingType] = useState('none');
    const [serviceCategory, setServiceCategory] = useState('');
    const [serviceSubcategory, setServiceSubcategory] = useState('');
    const [servicePriceDisplay, setServicePriceDisplay] = useState('fixed');
    const [serviceCharges, setServiceCharges] = useState([]);
    const [serviceOptions, setServiceOptions] = useState([]);
    const [serviceTemplateKey, setServiceTemplateKey] = useState('');
    const [serviceDetails, setServiceDetails] = useState({});
    const [serviceDurationValue, setServiceDurationValue] = useState('');
    const [serviceDurationUnit, setServiceDurationUnit] = useState('minutes');
    const [serviceLocationType, setServiceLocationType] = useState('provider_location');
    const [serviceProviderLocation, setServiceProviderLocation] = useState(null);
    const [serviceProviderLocationPickerOpen, setServiceProviderLocationPickerOpen] = useState(false);
    const [serviceAreas, setServiceAreas] = useState([]);
    const [serviceAreaDraft, setServiceAreaDraft] = useState('');
    const [serviceClientRequirements, setServiceClientRequirements] = useState('');
    const [serviceIntakeForm, setServiceIntakeForm] = useState([]);
    const [serviceRelatedProductIds, setServiceRelatedProductIds] = useState([]);
    const [serviceProductSearch, setServiceProductSearch] = useState('');
    const [serviceBookingProvider, setServiceBookingProvider] = useState('manual');
    const [serviceCategoryOptionsFromApi, setServiceCategoryOptionsFromApi] = useState([]);

    const [price, setPrice] = useState('');
    const [comparePrice, setComparePrice] = useState('');
    const [showComparePrice, setShowComparePrice] = useState(false);
    const [autoPostTargets, setAutoPostTargets] = useState(defaultAutoPostTargets);
    const [refundPolicy, setRefundPolicy] = useState('standard');
    const [refundWindowDays, setRefundWindowDays] = useState('3');
    const [refundPolicyNote, setRefundPolicyNote] = useState('');
    const [productFaqs, setProductFaqs] = useState([{ question: '', answer: '', is_published: true }]);
    const [quantity, setQuantity] = useState('');
    const [selectedUnitTypeId, setSelectedUnitTypeId] = useState('');
    const [sellableQuantity, setSellableQuantity] = useState('1');
    const [packageContentUnitTypeId, setPackageContentUnitTypeId] = useState('');
    const [packageContentQuantity, setPackageContentQuantity] = useState('');
    const [packageContents, setPackageContents] = useState('');
    const [packageContentItems, setPackageContentItems] = useState([{ qty: '1', unit: 'pc', name: '' }]);
    const [returnPolicies, setReturnPolicies] = useState([]);
    const [selectedReturnPolicyId, setSelectedReturnPolicyId] = useState('');
    const [useCustomReturnPolicy, setUseCustomReturnPolicy] = useState(false);
    const [productCertificates, setProductCertificates] = useState([]);
    const [selectedProductCertificateIds, setSelectedProductCertificateIds] = useState([]);
    const [certificateForm, setCertificateForm] = useState({
        title: '',
        certificate_type: '',
        description: '',
        document_number: '',
        issuer: '',
        authority: '',
        issued_at: '',
        expires_at: '',
        visibility: 'public_summary',
        document: null,
    });
    const [isSavingCertificate, setIsSavingCertificate] = useState(false);
    const [sellingStyle, setSellingStyle] = useState('retail');
    const [pricingTiers, setPricingTiers] = useState([{ min_quantity: '', max_quantity: '', unit_price: '', label: '' }]);
    const [leadTimeTiers, setLeadTimeTiers] = useState([{ min_quantity: '', max_quantity: '', lead_time_days: '', label: '' }]);
    const [packagingDetails, setPackagingDetails] = useState([{ selling_units: '', package_quantity: '', package_unit: '', package_weight_kg: '', package_length_cm: '', package_width_cm: '', package_height_cm: '', notes: '' }]);
    const [customizationOptions, setCustomizationOptions] = useState([{ name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' }]);
    const [productSpecifications, setProductSpecifications] = useState([{ group_name: '', attribute_name: '', attribute_value: '', is_filterable: true }]);
    const [productDetailSections, setProductDetailSections] = useState([{ section_type: 'text', title: '', body: '', image_url: '', is_visible: true }]);
    const [supplyCapacityQuantity, setSupplyCapacityQuantity] = useState('');
    const [supplyCapacityPeriod, setSupplyCapacityPeriod] = useState('month');
    const [wholesaleDepositMode, setWholesaleDepositMode] = useState('quote_based');
    const [wholesaleDepositPercent, setWholesaleDepositPercent] = useState('');
    const [wholesaleBalanceDue, setWholesaleBalanceDue] = useState('before_delivery');
    const [safePayMethods, setSafePayMethods] = useState({
        mobile_money: true,
        bank_transfer: true,
        wallet: true,
        card: false,
    });
    const [minOrderQuantity, setMinOrderQuantity] = useState('');
    const [orderIncrement, setOrderIncrement] = useState('');
    const [locationInventories, setLocationInventories] = useState({}); // { location_id: quantity }
    const [availabilityLocationIds, setAvailabilityLocationIds] = useState([]);
    const [fulfillmentMode, setFulfillmentMode] = useState('own_stock');
    const [sourceDetails, setSourceDetails] = useState({
        supplier_name: '',
        supplier_phone: '',
        supplier_location: '',
        confirmation_hours: '',
        source_note: '',
    });
    const [availabilityLeadTimeDays, setAvailabilityLeadTimeDays] = useState('');
    const [availableFrom, setAvailableFrom] = useState('');
    const [groupSaleGoalQuantity, setGroupSaleGoalQuantity] = useState('');
    const [groupSaleDeadline, setGroupSaleDeadline] = useState('');
    const [description, setDescription] = useState(''); // New state for description
    const [productId, setProductId] = useState(null);
    const [isLoadingEdit, setIsLoadingEdit] = useState(false);
    const [errorDetail, setErrorDetail] = useState(null);
    const [merchantProducts, setMerchantProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [promotables, setPromotables] = useState({ bundles: [], plans: [] });
    const [promotablesLoading, setPromotablesLoading] = useState(false);
    const [shippingProfiles, setShippingProfiles] = useState([]);
    const [selectedShippingProfileId, setSelectedShippingProfileId] = useState('');
    const [deliveryPromiseOverrideEnabled, setDeliveryPromiseOverrideEnabled] = useState(false);
    const [deliveryPromise, setDeliveryPromise] = useState({
        handling_min_days: '',
        handling_max_days: '',
        transit_min_days: '',
        transit_max_days: '',
        cutoff_time: '',
        business_days_only: true,
        label: '',
        note: '',
        requires_confirmation: false,
    });
    const [digitalAccessTab, setDigitalAccessTab] = useState('plan');
    const [assignedAccessGroup, setAssignedAccessGroup] = useState(null); // { id, type, title }

    const fetchReturnPolicies = async () => {
        try {
            const res = await axios.get('/api/merchant/return-policies');
            const policies = res.data.data || [];
            setReturnPolicies(policies);
            setSelectedReturnPolicyId((current) => current || String(policies.find((policy) => policy.is_default)?.id || policies[0]?.id || ''));
        } catch (error) {
            console.error('Failed to load return policies', error);
        }
    };

    const fetchProductCertificates = async () => {
        if (!merchantUsername) return;

        try {
            const res = await axios.get(`/merchant/${merchantUsername}/product-certificates/api`);
            setProductCertificates(res.data?.certificates || []);
        } catch (error) {
            console.error('Failed to load product certificates', error);
        }
    };

    const toggleProductCertificate = (certificateId) => {
        setSelectedProductCertificateIds((current) => {
            const id = Number(certificateId);
            return current.some((value) => Number(value) === id)
                ? current.filter((value) => Number(value) !== id)
                : [...current, id];
        });
    };

    const resetCertificateForm = () => {
        setCertificateForm({
            title: '',
            certificate_type: '',
            description: '',
            document_number: '',
            issuer: '',
            authority: '',
            issued_at: '',
            expires_at: '',
            visibility: 'public_summary',
            document: null,
        });
    };

    const saveProductCertificate = async () => {
        if (!certificateForm.title.trim()) {
            toast.error('Weka jina la certificate.');
            return;
        }

        if (!certificateForm.document) {
            toast.error('Pakia file ya certificate.');
            return;
        }

        const formData = new FormData();
        Object.entries(certificateForm).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                formData.append(key, value);
            }
        });

        setIsSavingCertificate(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/product-certificates/api`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const certificate = res.data?.certificate;
            if (certificate) {
                setProductCertificates((current) => [certificate, ...current]);
                setSelectedProductCertificateIds((current) => [...new Set([...current, Number(certificate.id)])]);
            }
            resetCertificateForm();
            toast.success(res.data?.message || 'Certificate imeongezwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi certificate.');
        } finally {
            setIsSavingCertificate(false);
        }
    };

    const serviceModeOptions = [
        { key: 'showcase_only', label: 'Showcase', hint: 'Onyesha tu, hakuna checkout', icon: Store },
        { key: 'request_quote', label: 'Request Quote', hint: 'Mteja atume ombi kwanza', icon: PenLine },
        { key: 'book_appointment', label: 'Book / Request', hint: 'Mteja atume booking au ombi la huduma', icon: Calendar },
        { key: 'pay_now', label: 'Pay / Reserve', hint: 'Mteja alipe au aweke deposit', icon: ShoppingBag },
    ];
    const servicePriceOptions = [
        { key: 'hidden', label: 'Hide price' },
        { key: 'fixed', label: 'Fixed price' },
        { key: 'starts_from', label: 'Starts from' },
        { key: 'hourly', label: 'Per hour' },
        { key: 'daily', label: 'Per day' },
        { key: 'nightly', label: 'Per night' },
        { key: 'weekly', label: 'Per week' },
        { key: 'monthly', label: 'Per month' },
        { key: 'yearly', label: 'Per year' },
        { key: 'per_person', label: 'Per person' },
        { key: 'per_visit', label: 'Per visit' },
        { key: 'per_session', label: 'Per session' },
        { key: 'per_project', label: 'Per project' },
        { key: 'package', label: 'Package' },
        { key: 'quote_only', label: 'Quote only' },
    ];
    const serviceChargeUnitOptions = [
        { key: 'fixed', label: 'Fixed' },
        { key: 'hourly', label: 'Per hour' },
        { key: 'daily', label: 'Per day' },
        { key: 'nightly', label: 'Per night' },
        { key: 'weekly', label: 'Per week' },
        { key: 'monthly', label: 'Per month' },
        { key: 'yearly', label: 'Per year' },
        { key: 'per_person', label: 'Per person' },
        { key: 'per_visit', label: 'Per visit' },
        { key: 'per_session', label: 'Per session' },
        { key: 'per_project', label: 'Per project' },
        { key: 'optional', label: 'Optional' },
        { key: 'refundable_deposit', label: 'Refundable deposit' },
    ];
    const serviceLocationOptions = [
        { key: 'provider_location', label: 'Specific location' },
        { key: 'customer_location', label: 'At client location' },
        { key: 'remote', label: 'Remote/online' },
        { key: 'hybrid', label: 'Hybrid' },
    ];
    const fallbackServiceCategoryOptions = [
        { label: 'Health & Wellness', subcategories: ['Doctor appointment', 'Therapy', 'Fitness', 'Nutrition', 'Home care', 'Other'] },
        { label: 'Beauty & Personal Care', subcategories: ['Barber', 'Salon', 'Spa', 'Makeup', 'Massage', 'Other'] },
        { label: 'Home & Repairs', subcategories: ['Plumbing', 'Electrical', 'Cleaning', 'Appliance repair', 'Construction', 'Other'] },
        { label: 'Education & Training', subcategories: ['Course', 'Tutoring', 'Workshop', 'Professional training', 'Driving school', 'Other'] },
        { label: 'Professional Services', subcategories: ['Consulting', 'IT support', 'Legal', 'Accounting', 'Business services', 'Other'] },
        { label: 'Events & Hospitality', subcategories: ['Catering', 'Venue', 'Photography', 'Decor', 'MC/DJ', 'Other'] },
        { label: 'Automotive & Garage', subcategories: ['Garage service', 'Mechanic', 'Car wash', 'Vehicle inspection', 'Towing', 'Other'] },
        { label: 'Accommodation & Stays', subcategories: ['Hotel', 'Guest house', 'Lodge', 'Short stay', 'Serviced apartment', 'Other'] },
        { label: 'Transport & Hire', subcategories: ['Boat hire', 'Car hire', 'Equipment hire', 'Courier', 'Tour guide', 'Other'] },
        { label: 'Moving & Logistics', subcategories: ['House moving', 'Office moving', 'Packing', 'Truck hire', 'Storage', 'Other'] },
        { label: 'Property & Survey', subcategories: ['Land survey', 'Valuation', 'Inspection', 'Real estate service', 'Other'] },
        { label: 'Cleaning & Domestic', subcategories: ['Home cleaning', 'Office cleaning', 'Laundry', 'Pest control', 'Domestic help', 'Other'] },
        { label: 'Funeral & Emergency', subcategories: ['Morgue service', 'Funeral service', 'Ambulance', 'Emergency repair', 'Other'] },
        { label: 'Creative & Media', subcategories: ['Design', 'Video', 'Music studio', 'Printing', 'Marketing', 'Other'] },
        { label: 'Travel & Recreation', subcategories: ['Tour package', 'Boat trip', 'Safari', 'Sports booking', 'Recreation venue', 'Other'] },
        { label: 'Other', subcategories: ['Other'] },
    ];
    const serviceCategoryOptions = serviceCategoryOptionsFromApi.length > 0
        ? serviceCategoryOptionsFromApi
        : fallbackServiceCategoryOptions;
    const serviceDurationPresets = [
        { label: '15 min', value: 15, unit: 'minutes' },
        { label: '30 min', value: 30, unit: 'minutes' },
        { label: '1 hour', value: 1, unit: 'hours' },
        { label: '2 hours', value: 2, unit: 'hours' },
        { label: 'Half day', value: 4, unit: 'hours' },
        { label: 'Full day', value: 1, unit: 'days' },
    ];
    const digitalContentTypes = [
        {
            key: 'file',
            label: 'Faili ya kawaida',
            icon: File,
            description: 'PDF, ZIP, Word, Excel, slides, au faili mchanganyiko.',
            previewHint: 'Weka cover, picha ya mfano, au video fupi kwenye Media za Bidhaa.',
            uploadHint: 'PDF, ZIP, audio, video, docs, sheets, slides',
            accept: '.pdf,.epub,.zip,.rar,.7z,.mp4,.mp3,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt',
            deliveryMode: 'upload',
        },
        {
            key: 'ebook',
            label: 'E-book / PDF',
            icon: BookOpen,
            description: 'Kitabu, guide, report, workbook, au notes.',
            previewHint: 'Weka cover, sample page, au video fupi ya kuonyesha ndani ya kitabu.',
            uploadHint: 'PDF, EPUB, DOCX, ZIP bonus files',
            accept: '.pdf,.epub,.doc,.docx,.zip',
            deliveryMode: 'upload',
        },
        {
            key: 'video',
            label: 'Video',
            icon: PlayCircle,
            description: 'Lesson, tutorial, movie, au darasa lililorekodiwa.',
            previewHint: 'Weka thumbnail, trailer, au clip fupi ya kuvutia mteja.',
            uploadHint: 'MP4, MOV, WEBM',
            accept: 'video/mp4,video/quicktime,video/webm',
            deliveryMode: 'video_stream',
        },
        {
            key: 'audio',
            label: 'Audio / Music',
            icon: Music,
            description: 'Wimbo, beat, podcast, Audio Book, au somo la sauti.',
            previewHint: 'Weka cover art, sample clip, au promo fupi kwenye Media za Bidhaa.',
            uploadHint: 'MP3, WAV, M4A, AAC, OGG, FLAC',
            accept: 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac',
            deliveryMode: 'audio_stream',
        },
        {
            key: 'gallery',
            label: 'Photo Pack',
            icon: Images,
            description: 'Picha, artwork, wallpaper, au gallery ya kulipia.',
            previewHint: 'Weka sample images au previews zenye watermark kwenye Media za Bidhaa.',
            uploadHint: 'JPG, PNG, WEBP',
            accept: 'image/jpeg,image/png,image/webp',
            deliveryMode: 'gallery_pack',
        },
        {
            key: 'template_asset',
            label: 'Template',
            icon: Layers,
            description: 'Template za Canva, Figma, Notion, Excel, au pitch deck.',
            previewHint: 'Weka screenshot, mfano uliokamilika, au screen recording fupi.',
            uploadHint: 'ZIP, FIG, SKETCH, XD, PPTX, XLSX, DOCX, PDF',
            accept: '.zip,.rar,.7z,.fig,.sketch,.xd,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.pdf,.txt',
            deliveryMode: 'upload',
        },
        {
            key: 'creative_asset',
            label: 'Design Asset',
            icon: Palette,
            description: 'Design files, presets, fonts, brand kit, au asset za video/3D.',
            previewHint: 'Weka mockup, before/after, swatches, au mfano uliorenderiwa.',
            uploadHint: 'PSD, AI, EPS, SVG, presets, fonts, AEP, 3D files, ZIP',
            accept: '.zip,.rar,.7z,.psd,.ai,.eps,.svg,.ase,.abr,.pat,.atn,.xmp,.lrtemplate,.dng,.otf,.ttf,.woff,.woff2,.aep,.prproj,.fcpxml,.blend,.c4d,.obj,.fbx,.glb,.gltf',
            deliveryMode: 'upload',
        },
        {
            key: 'software',
            label: 'Software / Code',
            icon: Code2,
            description: 'Source code, scripts, plugins, config, au app files.',
            previewHint: 'Weka screenshot, demo video, changelog, au setup result.',
            uploadHint: 'ZIP, 7Z, docs, config packs',
            accept: '.zip,.rar,.7z,.pdf,.txt,.doc,.docx',
            deliveryMode: 'upload',
        },
        {
            key: 'document',
            label: 'Document Pack',
            icon: FileText,
            description: 'Contracts, spreadsheets, pitch decks, worksheets.',
            previewHint: 'Weka cover, sample page iliyofichwa kidogo, au chart screenshot.',
            uploadHint: 'PDF, DOCX, XLSX, PPTX, ZIP',
            accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip',
            deliveryMode: 'upload',
        },
        {
            key: 'custom_commission',
            label: 'Custom Work',
            icon: PenLine,
            description: 'Logo, edit, beat, report, design, au kazi utakayomalizia kwa oda.',
            previewHint: 'Weka portfolio samples, kazi za nyuma, au video fupi ya process yako.',
            uploadHint: 'No file now. Upload the final delivery from the customer order later.',
            accept: '',
            deliveryMode: 'custom_delivery',
        },
    ];
    const selectedDigitalContentType = digitalContentTypes.find(item => item.key === digitalContentType) || digitalContentTypes[0];
    const selectDigitalContentType = (item) => {
        setDigitalContentType(item.key);
        if (item.deliveryMode) {
            setDigitalDeliveryMode(item.deliveryMode);
        }
    };
    const selectDigitalDeliveryMode = (mode) => {
        setDigitalDeliveryMode(mode);
        if (mode === 'video_stream') setDigitalContentType('video');
        if (mode === 'audio_stream') setDigitalContentType('audio');
        if (mode === 'gallery_pack') setDigitalContentType('gallery');
        if (mode === 'custom_delivery') setDigitalContentType('custom_commission');
    };
    const menuSections = ['Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Desserts', 'Snacks', 'Combos', 'Add-ons', 'Main menu'];
    const menuItemTypes = [
        { key: 'food', label: 'Food' },
        { key: 'drink', label: 'Drink' },
        { key: 'combo', label: 'Combo' },
        { key: 'addon', label: 'Add-on' },
    ];
    const dietaryTagOptions = [
        { key: 'vegetarian', label: 'Vegetarian' },
        { key: 'vegan', label: 'Vegan' },
        { key: 'halal', label: 'Halal' },
        { key: 'spicy', label: 'Spicy' },
        { key: 'gluten_free', label: 'Gluten free' },
        { key: 'contains_nuts', label: 'Contains nuts' },
    ];
    const menuAvailabilityOptions = [
        { key: 'dine_in', label: 'Dine-in' },
        { key: 'pickup', label: 'Pickup' },
        { key: 'delivery', label: 'Delivery' },
    ];
    const roomTypeOptions = ['Standard room', 'Deluxe room', 'Suite', 'Family room', 'Twin room', 'Single room', 'Apartment', 'Villa', 'House', 'Whole home', 'Cottage', 'Guest house', 'Dorm bed'];
    const bedTypeOptions = ['Single bed', 'Double bed', 'Queen bed', 'King bed', 'Twin beds', 'Bunk beds', 'Multiple beds'];
    const roomAmenityOptions = [
        { key: 'wifi', label: 'Wi-Fi' },
        { key: 'air_conditioning', label: 'A/C' },
        { key: 'breakfast', label: 'Breakfast' },
        { key: 'private_bathroom', label: 'Private bath' },
        { key: 'parking', label: 'Parking' },
        { key: 'tv', label: 'TV' },
        { key: 'work_desk', label: 'Work desk' },
        { key: 'pool', label: 'Pool' },
    ];
    const roomAvailabilityOptions = [
        { key: 'available', label: 'Available' },
        { key: 'limited', label: 'Limited' },
        { key: 'occupied', label: 'Occupied' },
        { key: 'maintenance', label: 'Maintenance' },
    ];
    const roomBookingPolicyOptions = [
        { key: 'instant', label: 'Instant booking' },
        { key: 'manual_confirm', label: 'Manual confirm' },
        { key: 'request_quote', label: 'Request first' },
    ];
    const digitalLicenseOptions = [
        { key: 'personal', label: 'Personal use' },
        { key: 'commercial', label: 'Commercial use' },
        { key: 'extended_commercial', label: 'Extended commercial' },
        { key: 'exclusive', label: 'Exclusive' },
        { key: 'custom', label: 'Custom terms' },
    ];
    const intakeFieldTypes = [
        { key: 'text', label: 'Short text' },
        { key: 'textarea', label: 'Long text' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'number', label: 'Number' },
        { key: 'date', label: 'Date' },
        { key: 'select', label: 'Dropdown' },
        { key: 'checkbox', label: 'Checkbox' },
        { key: 'image', label: 'Image' },
        { key: 'file', label: 'File' },
        { key: 'location', label: 'Map location' },
    ];

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        const typeParam = params.get('type');
        const moduleParam = params.get('module');
        if (!editId && moduleParam === 'forwarders') {
            window.location.href = `/merchant/${merchantUsername}/forwarders/setup`;
            return;
        }
        if (KNOWN_UPLOAD_MODULE_KEYS.includes(moduleParam)) {
            setUploadModule(moduleParam);
        }
        if (editId) {
            setProductId(editId);
            loadProductForEdit(editId);
        } else if (['physical', 'digital', 'service'].includes(typeParam)) {
            setProductType(typeParam);
            setStep(typeParam);
            if (typeParam === 'physical') setShowManualForm(true);
            const moduleConfig = getUploadModuleConfig(moduleParam);
            if (moduleConfig?.type === 'service' && typeParam === 'service') {
                applyServiceModuleDefaults(moduleParam);
            } else if (typeParam === 'service') {
                setStep('service_modules');
            }
        }
        fetchCatalogRoot();
        fetchServiceCategories();
        fetchMerchantProducts();
        fetchPromotables();
        fetchShippingProfiles();
        fetchReturnPolicies();
        fetchProductCertificates();
    }, []);

    useEffect(() => {
        if (!productId || images.length === 0 || images.some((img) => img.isUploading)) return;

        const payload = buildMediaPayload();
        const signature = JSON.stringify({
            productId,
            media_items: payload.media_items,
            hotspots,
        });

        if (signature === lastDraftMediaSyncRef.current) return;

        clearTimeout(draftMediaSyncTimerRef.current);
        draftMediaSyncTimerRef.current = setTimeout(() => {
            persistDraftMedia(productId, { silent: true });
            lastDraftMediaSyncRef.current = signature;
        }, 700);

        return () => clearTimeout(draftMediaSyncTimerRef.current);
    }, [productId, images, hotspots]);

    const fetchCatalogRoot = async () => {
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/catalog/schema`);
            setCatalogCategories(res.data?.categories || []);
        } catch (error) {
            console.error('Failed to fetch catalog root schema', error);
        }
    };

    const fetchServiceCategories = async () => {
        try {
            const res = await axios.get('/api/service-categories');
            const options = (res.data?.data || []).map((category) => ({
                id: category.id,
                label: category.name,
                risk_level: category.risk_level || 'standard',
                required_documents: category.required_documents || ['identity'],
                requires_manual_review: Boolean(category.requires_manual_review),
                payout_hold_days: category.payout_hold_days ?? 3,
                max_first_quote_amount: category.max_first_quote_amount ?? null,
                service_template: category.service_template || null,
                service_template_key: category.service_template_key || category.service_template?.key || null,
                default_template_key: category.default_template_key || category.service_template_key || category.service_template?.key || null,
                allowed_template_keys: category.allowed_template_keys || [],
                allowed_templates: category.allowed_templates || (category.service_template ? [category.service_template] : []),
                template_config: category.template_config || null,
                template_rules: category.template_rules || null,
                subcategories: (category.children || []).map((child) => child.name),
                subcategoryConfigs: (category.children || []).map((child) => ({
                    id: child.id,
                    label: child.name,
                    option_template: child.option_template || null,
                    service_template: child.service_template || null,
                    service_template_key: child.service_template_key || child.service_template?.key || null,
                    default_template_key: child.default_template_key || child.service_template_key || child.service_template?.key || null,
                    allowed_template_keys: child.allowed_template_keys || [],
                    allowed_templates: child.allowed_templates || (child.service_template ? [child.service_template] : []),
                    template_config: child.template_config || null,
                    template_rules: child.template_rules || null,
                    risk_level: child.risk_level || category.risk_level || 'standard',
                    required_documents: child.required_documents || category.required_documents || ['identity'],
                    requires_manual_review: Boolean(child.requires_manual_review ?? category.requires_manual_review),
                    payout_hold_days: child.payout_hold_days ?? category.payout_hold_days ?? 3,
                    max_first_quote_amount: child.max_first_quote_amount ?? category.max_first_quote_amount ?? null,
                })),
                option_template: category.option_template || null,
            })).filter((category) => category.label);
            setServiceCategoryOptionsFromApi(options);
        } catch (error) {
            console.error('Failed to fetch service categories', error);
        }
    };

    const fetchCatalogForCategory = async (categoryId) => {
        if (!categoryId) {
            setSelectedCatalogSchema(null);
            return;
        }
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/catalog/schema`, { params: { category_id: categoryId } });
            setSelectedCatalogSchema(res.data?.selected || null);
        } catch (error) {
            console.error('Failed to fetch category schema', error);
        }
    };

    const fetchMerchantProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/api`);
            setMerchantProducts(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch merchant products for tagging', err);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const fetchPromotables = async () => {
        setPromotablesLoading(true);
        try {
            const [bRes, sRes] = await Promise.all([
                axios.get(`/merchant/${merchantUsername}/bundles/api`),
                axios.get(`/merchant/${merchantUsername}/subscription-plans/api`),
            ]);
            setPromotables({
                bundles: bRes.data?.data || bRes.data?.bundles || [],
                plans: sRes.data?.data || sRes.data?.plans || [],
            });
        } catch (error) {
            console.error('Failed to fetch access groups', error);
        } finally {
            setPromotablesLoading(false);
        }
    };

    const fetchShippingProfiles = async () => {
        try {
            const res = await axios.get('/api/merchant/shipping-profiles');
            const data = res.data.data || [];
            setShippingProfiles(data);
            // Pre-select default if not editing
            if (!productId) {
                const def = data.find(p => p.is_default);
                if (def) setSelectedShippingProfileId(String(def.id));
            }
        } catch (error) {
            console.error('Failed to fetch shipping profiles', error);
        }
    };

    const fetchSoftwareReleases = async (id = productId) => {
        if (!id || !merchantUsername) return;
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/${id}/releases`);
            setSoftwareReleases(Array.isArray(res.data?.data) ? res.data.data : []);
        } catch (error) {
            console.error('Failed to load software releases', error);
        }
    };

    const fetchSoftwareLicenseKeys = async (id = productId) => {
        if (!id || !merchantUsername) return;
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/${id}/license-keys`);
            setSoftwareLicenseKeys(Array.isArray(res.data?.data) ? res.data.data : []);
            setSoftwareLicenseAnalytics(res.data?.analytics || null);
        } catch (error) {
            console.error('Failed to load software license keys', error);
        }
    };

    const openHotspotEditor = (index) => {
        if (isVideoMedia(images[index])) {
            toast.info('Hotspots zinapatikana kwenye picha kwa sasa. Video itaonekana kwenye feed na post details.');
            return;
        }
        setCurrentImageIndex(index);
        setShowHotspotModal(true);
    };

    const buildMediaPayload = () => ({
        image_urls: images.map(img => img.url).filter(Boolean),
        media_items: images.map(img => ({
            url: img.url,
            type: img.media_type || img.type || 'image',
            media_type: img.media_type || img.type || 'image',
            thumbnail_url: img.thumbnail_url || null,
            processed_url: img.processed_url || null,
            hls_url: img.hls_url || null,
            mime: img.mime || null,
            size: img.size || null,
            duration_seconds: img.duration_seconds || null,
            width: img.width || null,
            height: img.height || null,
            processing_status: img.processing_status || 'ready',
        })).filter(item => item.url),
        hotspots,
    });

    const persistDraftMedia = async (id = productId, { silent = false } = {}) => {
        if (!id || images.some((img) => img.isUploading)) return;

        try {
            await axios.post(`/merchant/${merchantUsername}/products/${id}/media`, buildMediaPayload());
        } catch (error) {
            if (!silent) {
                toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi media za draft.');
            }
        }
    };

    const loadProductForEdit = async (id) => {
        setIsLoadingEdit(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/${id}/api`);
            const p = res.data.data || res.data;
            fetchSoftwareReleases(id);
            fetchSoftwareLicenseKeys(id);

            setProductType(p.type);
            setStep(p.type);
            setUploadModule(p.module_key || null);
            if (p.module_key === 'forwarders') {
                window.location.href = `/merchant/${merchantUsername}/forwarders/setup?edit=${id}`;
                return;
            }
            if (p.module_key === 'menu') {
                setMenuDetails({
                    section: p.module_details?.section || 'Main menu',
                    item_type: p.module_details?.item_type || 'food',
                    prep_time_minutes: p.module_details?.prep_time_minutes ?? '',
                    dietary_tags: Array.isArray(p.module_details?.dietary_tags) ? p.module_details.dietary_tags : [],
                    availability: Array.isArray(p.module_details?.availability) && p.module_details.availability.length > 0 ? p.module_details.availability : ['dine_in', 'pickup'],
                    add_ons: Array.isArray(p.module_details?.add_ons) ? p.module_details.add_ons : [],
                });
            } else if (p.module_key === 'rooms') {
                setRoomDetails({
                    room_type: p.module_details?.room_type || 'Standard room',
                    bed_type: p.module_details?.bed_type || 'Double bed',
                    max_guests: p.module_details?.max_guests ?? 2,
                    room_count: p.module_details?.room_count ?? 1,
                    bathrooms: p.module_details?.bathrooms ?? '',
                    checkin_time: p.module_details?.checkin_time || '14:00',
                    checkout_time: p.module_details?.checkout_time || '10:00',
                    amenities: Array.isArray(p.module_details?.amenities) ? p.module_details.amenities : [],
                    availability: Array.isArray(p.module_details?.availability) && p.module_details.availability.length > 0 ? p.module_details.availability : ['available'],
                    booking_policy: p.module_details?.booking_policy || 'manual_confirm',
                });
            } else if (p.module_key === 'tour_departures') {
                setServiceTemplateKey('tour');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                    itinerary: Array.isArray(p.module_details?.itinerary) ? p.module_details.itinerary : (p.service_details?.itinerary || []),
                    included: Array.isArray(p.module_details?.included) ? p.module_details.included : (p.service_details?.included || []),
                    excluded: Array.isArray(p.module_details?.excluded) ? p.module_details.excluded : (p.service_details?.excluded || []),
                });
            } else if (p.module_key === 'custom_orders') {
                setServiceTemplateKey('orderable_service');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                });
            } else if (p.module_key === 'appointments') {
                setServiceTemplateKey('appointment_or_quote');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                });
            } else if (p.module_key === 'reservations') {
                setServiceTemplateKey('space_booking');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                });
            } else if (p.module_key === 'rentals') {
                setServiceTemplateKey('rental');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                });
            } else if (p.module_key === 'workshops') {
                setServiceTemplateKey('learning');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                    outcomes: Array.isArray(p.module_details?.learning_outcomes) ? p.module_details.learning_outcomes : (p.service_details?.outcomes || []),
                    requirements: Array.isArray(p.module_details?.workshop_requirements) ? p.module_details.workshop_requirements : (p.service_details?.requirements || []),
                });
            } else if (p.module_key === 'forwarders') {
                setServiceTemplateKey('orderable_service');
                setServiceDetails({
                    ...(p.service_details || {}),
                    ...(p.module_details || {}),
                    origin_locations: Array.isArray(p.module_details?.origin_locations) ? p.module_details.origin_locations : [],
                    destination_locations: Array.isArray(p.module_details?.destination_locations) ? p.module_details.destination_locations : [],
                    required_fields: Array.isArray(p.module_details?.required_fields) ? p.module_details.required_fields : ['customer_id'],
                    service_types: Array.isArray(p.module_details?.service_types) ? p.module_details.service_types : ['import_forwarding'],
                });
            }
            setManualTitle(p.title);
            setPrice(p.price);
            setComparePrice(p.compare_at_price || '');
            setShowComparePrice(Boolean(p.compare_at_price));
            setRefundPolicy(p.refund_policy?.policy || 'standard');
            setRefundWindowDays(p.refund_policy?.window_days ?? '3');
            setRefundPolicyNote(p.refund_policy?.note || '');
            setUseCustomReturnPolicy(Boolean(p.refund_policy && !p.refund_policy.id && p.type === 'physical'));
            setProductFaqs(Array.isArray(p.faqs) && p.faqs.length > 0
                ? p.faqs.map((faq) => ({ question: faq.question || '', answer: faq.answer || '', is_published: faq.is_published !== false }))
                : [{ question: '', answer: '', is_published: true }]);
            setSelectedProductCertificateIds(Array.isArray(p.product_certificates)
                ? p.product_certificates.map((certificate) => Number(certificate.id)).filter(Boolean)
                : []);
            setSellingStyle(p.selling_style || 'retail');
            setPricingTiers(Array.isArray(p.pricing_tiers) && p.pricing_tiers.length > 0
                ? p.pricing_tiers.map((tier) => ({
                    min_quantity: tier.min_quantity ?? '',
                    max_quantity: tier.max_quantity ?? '',
                    unit_price: tier.unit_price ?? '',
                    label: tier.label || '',
                }))
                : [{ min_quantity: '', max_quantity: '', unit_price: '', label: '' }]);
            setLeadTimeTiers(Array.isArray(p.lead_time_tiers) && p.lead_time_tiers.length > 0
                ? p.lead_time_tiers.map((tier) => ({
                    min_quantity: tier.min_quantity ?? '',
                    max_quantity: tier.max_quantity ?? '',
                    lead_time_days: tier.lead_time_days ?? '',
                    label: tier.label || '',
                }))
                : [{ min_quantity: '', max_quantity: '', lead_time_days: '', label: '' }]);
            setPackagingDetails(Array.isArray(p.packaging_details) && p.packaging_details.length > 0
                ? p.packaging_details.map((detail) => ({
                    selling_units: detail.selling_units || '',
                    package_quantity: detail.package_quantity ?? '',
                    package_unit: detail.package_unit || '',
                    package_weight_kg: detail.package_weight_kg ?? '',
                    package_length_cm: detail.package_length_cm ?? '',
                    package_width_cm: detail.package_width_cm ?? '',
                    package_height_cm: detail.package_height_cm ?? '',
                    notes: detail.notes || '',
                }))
                : [{ selling_units: '', package_quantity: '', package_unit: '', package_weight_kg: '', package_length_cm: '', package_width_cm: '', package_height_cm: '', notes: '' }]);
            setCustomizationOptions(Array.isArray(p.customization_options) && p.customization_options.length > 0
                ? p.customization_options.map((option) => ({
                    name: option.name || '',
                    description: option.description || '',
                    min_order_quantity: option.min_order_quantity ?? '',
                    fee_type: option.fee_type || 'quote',
                    fee_amount: option.fee_amount ?? '',
                    notes: option.notes || '',
                }))
                : [{ name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' }]);
            setProductSpecifications(Array.isArray(p.specifications) && p.specifications.length > 0
                ? p.specifications.map((spec) => ({
                    group_name: spec.group_name || '',
                    attribute_name: spec.attribute_name || '',
                    attribute_value: spec.attribute_value || '',
                    is_filterable: spec.is_filterable !== false,
                }))
                : [{ group_name: '', attribute_name: '', attribute_value: '', is_filterable: true }]);
            setProductDetailSections(Array.isArray(p.detail_sections) && p.detail_sections.length > 0
                ? p.detail_sections.map((section) => ({
                    section_type: section.section_type || 'text',
                    title: section.title || '',
                    body: section.body || '',
                    image_url: section.image_url || '',
                    is_visible: section.is_visible !== false,
                }))
                : [{ section_type: 'text', title: '', body: '', image_url: '', is_visible: true }]);
            setSupplyCapacityQuantity(p.supply_capacity?.quantity ?? '');
            setSupplyCapacityPeriod(p.supply_capacity?.period || 'month');
            setWholesaleDepositMode(p.wholesale_payment_terms?.deposit_mode || 'quote_based');
            setWholesaleDepositPercent(p.wholesale_payment_terms?.deposit_percent ?? '');
            setWholesaleBalanceDue(p.wholesale_payment_terms?.balance_due || 'before_delivery');
            setSafePayMethods({
                mobile_money: (p.wholesale_payment_terms?.safepay_methods || []).includes('mobile_money') || !Array.isArray(p.wholesale_payment_terms?.safepay_methods),
                bank_transfer: (p.wholesale_payment_terms?.safepay_methods || []).includes('bank_transfer') || !Array.isArray(p.wholesale_payment_terms?.safepay_methods),
                wallet: (p.wholesale_payment_terms?.safepay_methods || []).includes('wallet') || !Array.isArray(p.wholesale_payment_terms?.safepay_methods),
                card: (p.wholesale_payment_terms?.safepay_methods || []).includes('card'),
            });
            setQuantity(p.inventory_quantity ?? p.inventory_count);
            setFulfillmentMode(p.fulfillment_mode || 'own_stock');
            setSourceDetails({
                supplier_name: p.source_details?.supplier_name || '',
                supplier_phone: p.source_details?.supplier_phone || '',
                supplier_location: p.source_details?.supplier_location || '',
                confirmation_hours: p.source_details?.confirmation_hours || p.availability_lead_time_hours || (p.fulfillment_mode === 'supplier_sourced' && p.availability_lead_time_days ? Number(p.availability_lead_time_days) * 24 : ''),
                source_note: p.source_details?.source_note || '',
            });
            setAvailabilityLeadTimeDays(p.availability_lead_time_days ?? '');
            setAvailableFrom(p.available_from || '');
            setGroupSaleGoalQuantity(p.group_sale_goal_quantity ?? '');
            setGroupSaleDeadline(p.group_sale_deadline || '');
            setSelectedUnitTypeId(p.unit_type?.id ? String(p.unit_type.id) : '');
            setSellableQuantity(p.sellable_quantity ?? '1');
            setPackageContentUnitTypeId(p.package_content_unit_type?.id ? String(p.package_content_unit_type.id) : '');
            setPackageContentQuantity(p.package_content_quantity ?? '');
            setPackageContents(p.package_contents || '');
            setPackageContentItems(Array.isArray(p.package_content_items) && p.package_content_items.length > 0
                ? p.package_content_items.map((item) => ({ qty: item.qty ?? '1', unit: item.unit || 'pc', name: item.name || '' }))
                : [{ qty: '1', unit: 'pc', name: '' }]);
            setSelectedReturnPolicyId(p.refund_policy?.id ? String(p.refund_policy.id) : '');
            setMinOrderQuantity(p.min_order_quantity ?? '');
            setOrderIncrement(p.order_increment ?? '');
            setSelectedShippingProfileId(p.shipping_profile_id ? String(p.shipping_profile_id) : '');
            setDeliveryPromiseOverrideEnabled(Boolean(p.delivery_promise?.override_enabled));
            setDeliveryPromise({
                handling_min_days: p.delivery_promise?.handling_min_days ?? '',
                handling_max_days: p.delivery_promise?.handling_max_days ?? '',
                transit_min_days: p.delivery_promise?.transit_min_days ?? '',
                transit_max_days: p.delivery_promise?.transit_max_days ?? '',
                cutoff_time: p.delivery_promise?.cutoff_time ? String(p.delivery_promise.cutoff_time).slice(0, 5) : '',
                business_days_only: p.delivery_promise?.business_days_only ?? true,
                label: p.delivery_promise?.label || '',
                note: p.delivery_promise?.note || '',
                requires_confirmation: p.delivery_promise?.requires_confirmation ?? false,
            });
            setDescription(p.attributes?.suggested_description || '');
            setSelectedCategoryId(p.attributes?.category_id ? String(p.attributes.category_id) : '');
            setSelectedSubCategoryId(p.attributes?.sub_category_id ? String(p.attributes.sub_category_id) : '');
            if (p.attributes?.category) {
                setManualCategory(p.attributes.category);
            }
            setSelectedBrandId(p.attributes?.brand_id ? String(p.attributes.brand_id) : '');
            setSelectedModelId(p.attributes?.model_id ? String(p.attributes.model_id) : '');
            setDynamicAttributeValues(
                (p.category_attribute_values || []).reduce((acc, value) => {
                    const attrId = value.category_attribute_id;
                    if (!attrId) return acc;
                    acc[attrId] = {
                        value_text: value.value_text || (Array.isArray(value.value_json) && value.value_json.length > 0 ? String(value.value_json[0]) : ''),
                        value_number: value.value_number ?? '',
                        value_boolean: value.value_boolean ?? false,
                        value_json: value.value_json ?? [],
                        value_unit: value?.value_json?.unit || '',
                    };
                    return acc;
                }, {})
            );
            setHasVariants(!!p.has_variants);
            setVariantDecision(p.has_variants ? 'multi' : 'single');
            setPhysicalFlowStep(3);
            setManualStepCompleted(true);
            setVariants((p.variants || []).map((variant, index) => ({
                id: variant.id || `existing-${index}`,
                name: variant.name || '',
                sku: variant.sku || '',
                price: variant.price ?? '',
                compare_price: variant.compare_at_price ?? '',
                quantity: variant.inventory_quantity ?? variant.inventory_count ?? 0,
                location_inventories: (variant.location_inventories || []).reduce((acc, inv) => {
                    acc[inv.merchant_location_id] = inv.quantity_decimal ?? inv.quantity;
                    return acc;
                }, {}),
                attributes: variant.attributes || {},
                swatch_image_url: variant.swatch_image_url || '',
                is_active: variant.is_active !== false,
                sort_order: variant.sort_order ?? index,
                isUploadingSwatch: false,
            })));

            if (p.location_inventories && p.location_inventories.length > 0) {
                setLocationInventories(p.location_inventories.reduce((acc, inv) => {
                    acc[inv.merchant_location_id] = inv.quantity_decimal ?? inv.quantity;
                    return acc;
                }, {}));
            }
            setAvailabilityLocationIds(Array.isArray(p.availability_location_ids) ? p.availability_location_ids.map(String) : []);

            const schemaCategoryId = p.attributes?.sub_category_id || p.attributes?.category_id;
            if (schemaCategoryId) {
                await fetchCatalogForCategory(schemaCategoryId);
            }

            // Load images for all product types
            if (p.images && p.images.length > 0) {
                const mappedImages = (p.images || []).map(img => ({
                    url: img.image_url,
                    localUrl: img.image_url,
                    media_type: img.media_type || img.type || 'image',
                    type: img.media_type || img.type || 'image',
                    thumbnail_url: img.thumbnail_url || null,
                    processed_url: img.processed_url || null,
                    hls_url: img.hls_url || null,
                    mime: img.mime || null,
                    size: img.size || null,
                    duration_seconds: img.duration_seconds || null,
                    width: img.width || null,
                    height: img.height || null,
                    processing_status: img.processing_status || 'ready',
                    isUploading: false,
                    progress: 100
                }));
                setImages(mappedImages);

                const mappedHotspots = {};
                (p.images || []).forEach((img, idx) => {
                    mappedHotspots[idx] = img.hotspots || [];
                });
                setHotspots(mappedHotspots);
            }

            if (p.type === 'physical') {
                // Show the detail/publish portion
                setAiResult({
                    category: p.attributes?.category || 'Nyingine',
                    suggested_description_swahili: p.title
                });
            } else if (p.type === 'digital') {
                setDigitalContentType(p.digital_content_type || 'file');
                setDigitalUsageLicense(p.digital_usage_license || 'personal');
                setDigitalAccessInstructions(p.digital_access_instructions || '');
                setLicenseKeyEnabled(Boolean(p.license_key_enabled));
                setLicenseKeyPrefix(p.license_key_prefix || '');
                setLicenseActivationLimit(String(p.license_activation_limit || 1));
                setSoftwareProductSlug(p.slug || '');
                // Logic: if it contains 'digital-products' or doesn't start with http, it's likely an upload
                if (p.digital_delivery_type === 'video_stream') {
                    setDigitalDeliveryMode('video_stream');
                    setAllowDigitalDownload(Boolean(p.allow_download));
                    setPaidVideoFile(p.premium_video ? {
                        name: fileNameFromUrl(p.premium_video.url || p.paid_video_url),
                        url: p.paid_video_url || p.premium_video.url,
                        size: p.premium_video.size || null,
                        type: p.premium_video.mime || 'video/mp4',
                        mime: p.premium_video.mime || 'video/mp4',
                        isUploading: false,
                        progress: 100,
                    } : null);
                } else if (p.digital_delivery_type === 'audio_stream') {
                    setDigitalDeliveryMode('audio_stream');
                    setAllowDigitalDownload(Boolean(p.allow_download));
                    setPaidAudioFile(p.premium_audio ? {
                        name: fileNameFromUrl(p.premium_audio.url || p.paid_audio_url),
                        url: p.paid_audio_url || p.premium_audio.url,
                        size: p.premium_audio.size || null,
                        type: p.premium_audio.mime || 'audio/mpeg',
                        mime: p.premium_audio.mime || 'audio/mpeg',
                        isUploading: false,
                        progress: 100,
                    } : null);
                } else if (p.digital_delivery_type === 'gallery_pack') {
                    setDigitalDeliveryMode('gallery_pack');
                    setAllowDigitalDownload(Boolean(p.allow_download));
                    setPaidGalleryItems((p.paid_gallery_items || p.gallery_pack?.items || []).map((item) => ({
                        name: item.name || fileNameFromUrl(item.url),
                        url: item.url,
                        preview_url: item.preview_url || null,
                        mime: item.mime || 'image/jpeg',
                        size: item.size || null,
                        preview_mime: item.preview_mime || null,
                        preview_size: item.preview_size || null,
                        isUploading: false,
                        progress: 100,
                    })));
                } else if (p.digital_delivery_type === 'live_event') {
                    setDigitalDeliveryMode('live_event');
                    setLiveEventStartsAt(p.live_event?.starts_at ? p.live_event.starts_at.slice(0, 16) : '');
                    setLiveEventDurationMinutes(String(p.live_event?.duration_minutes || 90));
                    setLiveEventTimezone(p.live_event?.timezone || merchantTimezone || 'Africa/Dar_es_Salaam');
                    setLiveEventAccessUrl(p.live_event?.access_url || '');
                    setLiveEventVenue(p.live_event?.venue || '');
                    setLiveEventCapacity(p.live_event?.capacity ? String(p.live_event.capacity) : '');
                    setLiveEventReplayUrl(p.live_event?.replay_url || '');
                    setLiveEventInstructions(p.live_event?.instructions || '');
                } else if (p.url && (p.url.includes('digital-products') || !p.url.startsWith('http'))) {
                    setDigitalDeliveryMode('upload');
                    setDigitalFile({
                        name: fileNameFromUrl(p.url),
                        url: p.url,
                        size: p.file_size || p.digital_file_size || null,
                        isUploading: false,
                        progress: 100
                    });
                } else {
                    setDigitalDeliveryMode('link');
                    setUrl(p.url || '');
                }

                if (p.promotable_id && p.promotable_type) {
                    const type = String(p.promotable_type).toLowerCase().includes('subscription') ? 'plan' : 'bundle';
                    setAssignedAccessGroup({
                        id: p.promotable_id,
                        type,
                        title: p.promotable?.title || p.promotable?.name || 'Assigned access',
                    });
                    setDigitalAccessTab(type);
                }
            } else if (p.type === 'service') {
                const legacyExternalScheduling = p.service_mode === 'external_booking'
                    || (p.service_booking_provider === 'external' && p.url && p.url.startsWith('http'));
                const nextServiceMode = p.service_mode === 'external_booking'
                    ? 'pay_now'
                    : p.service_mode || (
                        p.service_is_showcase || p.service_pricing_model === 'showcase_only'
                            ? 'showcase_only'
                            : p.service_pricing_model === 'contract_quote'
                                ? 'request_quote'
                                : 'pay_now'
                    );
                setServicePricingModel(p.service_pricing_model || 'fixed_price');
                setServiceBookingType(p.service_booking_type || 'instant');
                setServiceHourlyRate(p.service_hourly_rate ?? '');
                setServiceMinHours(p.service_min_hours ?? '1');
                setServiceDepositAmount(p.service_deposit_amount ?? '');
                setServiceIsShowcase(!!p.service_is_showcase);
                setServiceMode(nextServiceMode);
                setServiceSchedulingType(p.service_scheduling_type || (legacyExternalScheduling ? 'external' : nextServiceMode === 'book_appointment' ? 'recurring' : 'none'));
                setServiceCategory(p.service_category || '');
                setServiceSubcategory(p.service_subcategory || '');
                setServicePriceDisplay(p.service_price_display || (p.service_pricing_model === 'hourly_rate' ? 'hourly' : p.service_pricing_model === 'contract_quote' ? 'quote_only' : 'fixed'));
                setServiceCharges(Array.isArray(p.service_charges) ? p.service_charges : []);
                setServiceOptions(Array.isArray(p.service_options) ? p.service_options : []);
                setServiceTemplateKey(p.service_template_key || p.service_template?.key || '');
                setServiceDetails(p.service_details || p.service_template?.saved_details || {});
                setServiceDurationFromMinutes(p.service_duration_minutes);
                setServiceLocationType(p.service_location_type || 'provider_location');
                setServiceProviderLocation(p.service_provider_location || null);
                setServiceAreas(Array.isArray(p.service_area) ? p.service_area.filter(Boolean) : []);
                setServiceClientRequirements(p.service_client_requirements || '');
                setServiceIntakeForm(Array.isArray(p.service_intake_form) ? p.service_intake_form : []);
                setServiceRelatedProductIds(Array.isArray(p.service_related_product_ids) ? p.service_related_product_ids.map((id) => Number(id)).filter(Boolean) : []);
                setServiceBookingProvider(p.service_booking_provider || (legacyExternalScheduling ? 'external' : 'manual'));
                if (p.service_booking_provider === 'manual' && !p.service_contact_value && !p.url) {
                    setServiceBookingMode('takeer');
                } else if (p.url && p.url.includes(':') && !p.url.startsWith('http')) {
                    setServiceBookingMode('internal');
                    const [t, v] = p.url.split(':');
                    setServiceContactType(t);
                    setServiceContactValue(v);
                } else {
                    setServiceBookingMode(p.service_contact_value ? 'internal' : 'external');
                    if (p.service_contact_channel) setServiceContactType(p.service_contact_channel);
                    if (p.service_contact_value) setServiceContactValue(p.service_contact_value);
                    setUrl(p.url || '');
                }
            }

        } catch (err) {
            toast.error('Imeshindwa kupakia taarifa za bidhaa.');
            console.error(err);
        } finally {
            setIsLoadingEdit(false);
        }
    };

    const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

    const selectedRootCategory = catalogCategories.find((c) => String(c.id) === String(selectedCategoryId));
    const selectedSubCategories = selectedRootCategory?.children || [];
    const selectedSchemaAttributes = selectedCatalogSchema?.attributes || [];
    const facetAttributesForForm = hasVariants
        ? selectedSchemaAttributes.filter((attr) => !attr.is_variant_axis)
        : selectedSchemaAttributes;
    const selectedSchemaBrands = selectedCatalogSchema?.brands || [];
    const selectedSchemaModels = selectedSchemaBrands.find((brand) => String(brand.id) === String(selectedBrandId))?.models || [];
    const selectedSchemaUnitTypes = selectedCatalogSchema?.unit_types || [];
    const selectedUnitType = selectedSchemaUnitTypes.find((unit) => String(unit.id) === String(selectedUnitTypeId)) || null;
    const selectedPackageContentUnitType = selectedSchemaUnitTypes.find((unit) => String(unit.id) === String(packageContentUnitTypeId)) || null;
    const stockStep = selectedUnitType?.allows_decimal ? '0.001' : '1';
    const stockUnitLabel = selectedUnitType?.symbol || selectedUnitType?.name || 'units';
    const quantityChipLabel = (entry) => entry?.label || `${entry?.quantity ?? entry?.value ?? ''} ${stockUnitLabel}`.trim();
    const unitDisplayName = (unit, quantity = 1) => {
        const code = String(unit?.code || '').toLowerCase();
        const raw = unit?.symbol || unit?.name || 'unit';
        const number = Number(quantity || 1);
        if (code === 'piece' || raw === 'piece') return number === 1 ? 'pc' : 'pcs';
        if (code === 'pair' || raw === 'pair') return number === 1 ? 'pair' : 'pairs';
        if (code === 'dozen' || raw === 'doz') return number === 1 ? 'dozen' : 'dozens';
        return raw;
    };
    const formatPackageQuantity = (value) => {
        const number = Number(value || 0);
        if (!Number.isFinite(number) || number <= 0) return '';
        return number.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    };
    const packagePreviewLabel = (() => {
        if (!selectedUnitType) return '';
        const saleQuantity = Number(sellableQuantity || 1);
        const saleUnit = unitDisplayName(selectedUnitType, saleQuantity);
        const base = `${formatPackageQuantity(saleQuantity || 1) || '1'} ${saleUnit}`;
        if (!selectedPackageContentUnitType || !packageContentQuantity) return base;
        const content = `${formatPackageQuantity(packageContentQuantity)} ${unitDisplayName(selectedPackageContentUnitType, packageContentQuantity)}`;
        if (['piece', 'pc', 'unit'].includes(String(selectedUnitType.code || selectedUnitType.symbol || '').toLowerCase()) && saleQuantity > 1) {
            return `${formatPackageQuantity(saleQuantity)} ${saleUnit} (${content})`;
        }
        return `${base} (${content})`;
    })();
    const wholesalePricingUnitLabel = packagePreviewLabel || stockUnitLabel || 'unit';
    const cleanPackageContentItems = packageContentItems
        .map((item) => ({
            qty: item.qty || '1',
            unit: String(item.unit || '').trim(),
            name: String(item.name || '').trim(),
        }))
        .filter((item) => item.name);
    const cleanProductFaqs = productFaqs
        .map((faq) => ({
            question: String(faq.question || '').trim(),
            answer: String(faq.answer || '').trim(),
            is_published: faq.is_published !== false,
        }))
        .filter((faq) => faq.question && faq.answer);
    const wholesaleEnabled = step === 'physical' && ['wholesale', 'both'].includes(sellingStyle);
    const wholesaleOnly = step === 'physical' && sellingStyle === 'wholesale';
    const retailPriceEnabled = step !== 'physical' || sellingStyle !== 'wholesale';
    const cleanPricingTiers = pricingTiers
        .map((tier) => ({
            min_quantity: tier.min_quantity,
            max_quantity: tier.max_quantity || null,
            unit_price: tier.unit_price,
            currency: 'TZS',
            label: String(tier.label || '').trim(),
        }))
        .filter((tier) => tier.min_quantity !== '' && tier.unit_price !== '');
    const cleanLeadTimeTiers = leadTimeTiers
        .map((tier) => ({
            min_quantity: tier.min_quantity,
            max_quantity: tier.max_quantity || null,
            lead_time_days: tier.lead_time_days || null,
            label: String(tier.label || '').trim(),
        }))
        .filter((tier) => tier.min_quantity !== '' && (tier.lead_time_days !== null || tier.label));
    const cleanPackagingDetails = packagingDetails
        .map((detail) => ({
            selling_units: String(detail.selling_units || '').trim(),
            package_quantity: detail.package_quantity || null,
            package_unit: String(detail.package_unit || '').trim(),
            package_weight_kg: detail.package_weight_kg || null,
            package_length_cm: detail.package_length_cm || null,
            package_width_cm: detail.package_width_cm || null,
            package_height_cm: detail.package_height_cm || null,
            notes: String(detail.notes || '').trim(),
        }))
        .filter((detail) => detail.selling_units || detail.package_quantity || detail.notes);
    const cleanCustomizationOptions = customizationOptions
        .map((option) => ({
            name: String(option.name || '').trim(),
            description: String(option.description || '').trim(),
            min_order_quantity: option.min_order_quantity || null,
            fee_type: option.fee_type || 'quote',
            fee_amount: option.fee_amount || null,
            currency: 'TZS',
            notes: String(option.notes || '').trim(),
        }))
        .filter((option) => option.name);
    const cleanProductSpecifications = productSpecifications
        .map((spec) => ({
            group_name: String(spec.group_name || '').trim(),
            attribute_name: String(spec.attribute_name || '').trim(),
            attribute_value: String(spec.attribute_value || '').trim(),
            is_filterable: spec.is_filterable !== false,
        }))
        .filter((spec) => spec.attribute_name && spec.attribute_value);
    const cleanProductDetailSections = productDetailSections
        .map((section) => ({
            section_type: section.section_type || 'text',
            title: String(section.title || '').trim(),
            body: String(section.body || '').trim(),
            image_url: String(section.image_url || '').trim(),
            is_visible: section.is_visible !== false,
        }))
        .filter((section) => section.title || section.body || section.image_url);
    const selectedReturnPolicy = returnPolicies.find((policy) => String(policy.id) === String(selectedReturnPolicyId)) || null;
    const effectiveRefundPolicy = useCustomReturnPolicy ? refundPolicy : (selectedReturnPolicy?.policy || refundPolicy);
    const effectiveRefundWindowDays = useCustomReturnPolicy ? refundWindowDays : (selectedReturnPolicy?.window_days ?? refundWindowDays);
    const effectiveRefundPolicyNote = useCustomReturnPolicy ? refundPolicyNote : (selectedReturnPolicy?.note || refundPolicyNote);
    const hasPromiseDayValue = (value) => value !== null && value !== undefined && value !== '';
    const isSameDayDeliveryPromise = (promise) => {
        const label = String(promise.label || '').toLowerCase();
        const hasExplicitDays = [
            promise.handling_min_days,
            promise.handling_max_days,
            promise.transit_min_days,
            promise.transit_max_days,
        ].some(hasPromiseDayValue);

        return label.includes('same day')
            || label.includes('leo leo')
            || (hasExplicitDays && Number(promise.handling_max_days || 0) <= 0 && Number(promise.transit_max_days || 0) <= 0);
    };
    const showDeliveryPromiseDays = !deliveryPromise.requires_confirmation;
    const showDeliveryPromiseCutoff = showDeliveryPromiseDays && isSameDayDeliveryPromise(deliveryPromise);
    const updateDeliveryPromise = (key, value) => setDeliveryPromise(prev => ({ ...prev, [key]: value }));
    const applyDeliveryPromisePreset = (preset) => {
        setDeliveryPromise(prev => ({
            ...prev,
            handling_min_days: preset.handling[0],
            handling_max_days: preset.handling[1],
            transit_min_days: preset.transit[0],
            transit_max_days: preset.transit[1],
            label: preset.buyerLabel,
            requires_confirmation: Boolean(preset.confirm),
            cutoff_time: preset.key === 'same_day' ? prev.cutoff_time : '',
        }));
    };
    const renderDeliveryPromiseOverride = () => (
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 text-emerald-700" />
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-900">Muda wa bidhaa hii kufika</p>
                        <p className="text-xs text-emerald-800/80">Tumia hapa tu kama bidhaa hii ni tofauti na delivery template uliyochagua.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setDeliveryPromiseOverrideEnabled(prev => !prev)}
                    className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${deliveryPromiseOverrideEnabled ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}
                >
                    {deliveryPromiseOverrideEnabled ? 'Override on' : 'Use profile'}
                </button>
            </div>
            {deliveryPromiseOverrideEnabled && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {DELIVERY_PROMISE_PRESETS.map((preset) => (
                            <button key={preset.key} type="button" onClick={() => applyDeliveryPromisePreset(preset)} className={`rounded-2xl border bg-white px-3 py-2 text-left transition hover:border-emerald-300 ${deliveryPromise.label === preset.buyerLabel ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-emerald-100'}`}>
                                <span className="block text-xs font-black text-emerald-900">{preset.label}</span>
                                <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-emerald-700/75">{preset.hint}</span>
                            </button>
                        ))}
                    </div>
                    {showDeliveryPromiseDays ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <Input type="number" min="0" placeholder="Kuandaa kuanzia" value={deliveryPromise.handling_min_days} onChange={e => updateDeliveryPromise('handling_min_days', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                                <Input type="number" min="0" placeholder="Kuandaa mpaka" value={deliveryPromise.handling_max_days} onChange={e => updateDeliveryPromise('handling_max_days', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                                <Input type="number" min="0" placeholder="Safari kuanzia" value={deliveryPromise.transit_min_days} onChange={e => updateDeliveryPromise('transit_min_days', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                                <Input type="number" min="0" placeholder="Safari mpaka" value={deliveryPromise.transit_max_days} onChange={e => updateDeliveryPromise('transit_max_days', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                            </div>
                            {showDeliveryPromiseCutoff && (
                                <Input type="time" value={deliveryPromise.cutoff_time} onChange={e => updateDeliveryPromise('cutoff_time', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
                            Siku na deadline zimefichwa kwa sababu muda utathibitishwa kwenye chat.
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                        <Input placeholder="Maneno ya mteja, mf. Made to order: siku 3-5" value={deliveryPromise.label} onChange={e => updateDeliveryPromise('label', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => updateDeliveryPromise('business_days_only', !deliveryPromise.business_days_only)} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${deliveryPromise.business_days_only ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}>
                            {deliveryPromise.business_days_only ? 'Siku za kazi' : 'Kila siku'}
                        </button>
                        <button type="button" onClick={() => setDeliveryPromise(prev => ({ ...prev, requires_confirmation: !prev.requires_confirmation, cutoff_time: prev.requires_confirmation ? prev.cutoff_time : '' }))} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${deliveryPromise.requires_confirmation ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}>
                            {deliveryPromise.requires_confirmation ? 'Tuta-confirm kwa chat' : 'Mteja aone estimate'}
                        </button>
                    </div>
                    <Input placeholder="Ujumbe wa ziada, mf. Kwa mzigo mkubwa tutapanga cargo kwenye chat" value={deliveryPromise.note} onChange={e => updateDeliveryPromise('note', e.target.value)} className="h-10 bg-white text-xs font-bold" />
                </div>
            )}
        </div>
    );
    const renderProductFaqEditor = () => (
        <ProductFaqEditor productFaqs={productFaqs} setProductFaqs={setProductFaqs} />
    );
    const renderPhysicalPackageEditor = ({ compact = false, className = '' } = {}) => {
        if (step !== 'physical' || selectedSchemaUnitTypes.length === 0) return null;

        return (
            <PhysicalPackageEditor
                compact={compact}
                className={className}
                selectedSchemaUnitTypes={selectedSchemaUnitTypes}
                selectedUnitTypeId={selectedUnitTypeId}
                setSelectedUnitTypeId={setSelectedUnitTypeId}
                stockUnitLabel={stockUnitLabel}
                stockStep={stockStep}
                sellableQuantity={sellableQuantity}
                setSellableQuantity={setSellableQuantity}
                selectedPackageContentUnitType={selectedPackageContentUnitType}
                packageContentQuantity={packageContentQuantity}
                setPackageContentQuantity={setPackageContentQuantity}
                packageContentUnitTypeId={packageContentUnitTypeId}
                setPackageContentUnitTypeId={setPackageContentUnitTypeId}
                packageContentItems={packageContentItems}
                setPackageContentItems={setPackageContentItems}
                cleanPackageContentItems={cleanPackageContentItems}
                formatPackageQuantity={formatPackageQuantity}
                packageContents={packageContents}
                setPackageContents={setPackageContents}
                packagePreviewLabel={packagePreviewLabel}
                minOrderQuantity={minOrderQuantity}
                setMinOrderQuantity={setMinOrderQuantity}
                selectedUnitType={selectedUnitType}
                quantityChipLabel={quantityChipLabel}
            />
        );
    };
    const renderWholesaleEditor = ({ className = '' } = {}) => {
        if (step !== 'physical') return null;

        return (
            <WholesaleCommerceEditor
                className={className}
                sellingStyle={sellingStyle}
                setSellingStyle={setSellingStyle}
                wholesaleEnabled={wholesaleEnabled}
                supplyCapacityQuantity={supplyCapacityQuantity}
                setSupplyCapacityQuantity={setSupplyCapacityQuantity}
                supplyCapacityPeriod={supplyCapacityPeriod}
                setSupplyCapacityPeriod={setSupplyCapacityPeriod}
                wholesaleDepositMode={wholesaleDepositMode}
                setWholesaleDepositMode={setWholesaleDepositMode}
                wholesaleDepositPercent={wholesaleDepositPercent}
                setWholesaleDepositPercent={setWholesaleDepositPercent}
                wholesaleBalanceDue={wholesaleBalanceDue}
                setWholesaleBalanceDue={setWholesaleBalanceDue}
                safePayMethods={safePayMethods}
                setSafePayMethods={setSafePayMethods}
                pricingTiers={pricingTiers}
                setPricingTiers={setPricingTiers}
                leadTimeTiers={leadTimeTiers}
                setLeadTimeTiers={setLeadTimeTiers}
                packagingDetails={packagingDetails}
                setPackagingDetails={setPackagingDetails}
                customizationOptions={customizationOptions}
                setCustomizationOptions={setCustomizationOptions}
                productSpecifications={productSpecifications}
                setProductSpecifications={setProductSpecifications}
                pricingUnitLabel={wholesalePricingUnitLabel}
                packagingUnitOptions={selectedSchemaUnitTypes}
            />
        );
    };
    const renderProductDetailSectionsEditor = () => {
        if (step !== 'physical') return null;

        return (
            <ProductDetailSectionsEditor
                productDetailSections={productDetailSections}
                setProductDetailSections={setProductDetailSections}
                onUploadSectionImage={uploadProductDetailSectionImage}
            />
        );
    };
    const physicalLocations = merchantLocations.length > 0 ? merchantLocations : (currentMerchant?.locations || []);
    const servingLocations = physicalLocations.filter((loc) => String(loc.type || 'SHOP').toUpperCase() === 'SHOP' || !loc.type);
    const toggleAvailabilityLocation = (locationId) => {
        const id = String(locationId);
        setAvailabilityLocationIds((current) => (
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
        ));
    };
    const renderServingLocationSelector = () => {
        if (servingLocations.length === 0) {
            return (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
                    Add a shop location in Settings when this service is tied to a specific branch. For now it remains available without a branch restriction.
                </div>
            );
        }

        const mode = availabilityLocationIds.length === 0 ? 'all' : 'selected';

        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">Inapatikana kwenye shop gani?</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Acha ipatikane shops zote, au chagua matawi maalum.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <button
                        type="button"
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-black ${mode === 'all' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                        onClick={() => setAvailabilityLocationIds([])}
                    >
                        Shops zote zinazofanya kazi
                    </button>
                    <button
                        type="button"
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-black ${mode === 'selected' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                        onClick={() => setAvailabilityLocationIds([String(servingLocations[0].id)])}
                    >
                        Matawi uliyochagua tu
                    </button>
                </div>
                {mode === 'selected' && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {servingLocations.map((loc) => (
                            <label key={loc.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={availabilityLocationIds.includes(String(loc.id))}
                                    onChange={() => toggleAvailabilityLocation(loc.id)}
                                />
                                <span>
                                    <span className="block">{loc.name}</span>
                                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{loc.address}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        );
    };
    const selectedFulfillmentMode = PHYSICAL_FULFILLMENT_MODES.find((mode) => mode.key === fulfillmentMode) || PHYSICAL_FULFILLMENT_MODES[0];
    const availabilityDateCopy = {
        farm_harvest: {
            label: 'Expected harvest / ready date',
            helper: 'Date when the harvest or farm stock should be ready for pickup or delivery.',
            placeholder: 'Choose harvest ready date',
        },
        preorder: {
            label: 'Expected stock arrival date',
            helper: 'Date when preorder stock is expected to arrive or become available to customers.',
            placeholder: 'Choose expected arrival date',
        },
        group_sale: {
            label: 'Expected fulfillment date',
            helper: 'Date when orders should be fulfilled after the group target is reached.',
            placeholder: 'Choose fulfillment date',
        },
    }[fulfillmentMode] || null;
    const categoryAllowedFulfillmentModes = selectedCatalogSchema?.allowed_fulfillment_modes || selectedRootCategory?.allowed_fulfillment_modes || [];
    const fulfillmentModeOptions = categoryAllowedFulfillmentModes.length > 0
        ? PHYSICAL_FULFILLMENT_MODES.filter((mode) => categoryAllowedFulfillmentModes.includes(mode.key))
        : PHYSICAL_FULFILLMENT_MODES;
    const requiresLocationInventory = fulfillmentMode === 'own_stock' && retailPriceEnabled;
    const updateSourceDetail = (key, value) => {
        setSourceDetails((prev) => ({ ...prev, [key]: value }));
    };
    useEffect(() => {
        if (selectedUnitTypeId || selectedSchemaUnitTypes.length === 0) return;
        const defaultUnit = selectedSchemaUnitTypes.find((unit) => unit.is_default) || selectedSchemaUnitTypes[0];
        if (!defaultUnit) return;
        setSelectedUnitTypeId(String(defaultUnit.id));
        setMinOrderQuantity(defaultUnit.min_order_quantity ?? '');
        setOrderIncrement(defaultUnit.order_increment ?? '');
    }, [selectedSchemaUnitTypes, selectedUnitTypeId]);
    useEffect(() => {
        if (fulfillmentModeOptions.some((mode) => mode.key === fulfillmentMode)) return;
        setFulfillmentMode(fulfillmentModeOptions[0]?.key || 'own_stock');
    }, [fulfillmentModeOptions, fulfillmentMode]);
    useEffect(() => {
        const safety = aiResult?.safety_attributes;
        if (!safety || facetAttributesForForm.length === 0) return;

        setDynamicAttributeValues((prev) => {
            let changed = false;
            const next = { ...prev };

            facetAttributesForForm.forEach((attr) => {
                const extracted = safety[attr.key];
                if (extracted === undefined || extracted === null || extracted === '') return;
                const current = next[attr.id] || {};

                if (attr.input_type === 'multiselect' && Array.isArray(extracted) && extracted.length > 0 && (!Array.isArray(current.value_json) || current.value_json.length === 0)) {
                    next[attr.id] = { ...current, value_json: extracted };
                    changed = true;
                    return;
                }

                if (['text', 'textarea', 'date', 'select'].includes(attr.input_type) && !current.value_text) {
                    next[attr.id] = { ...current, value_text: Array.isArray(extracted) ? extracted.join(', ') : String(extracted) };
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [aiResult, facetAttributesForForm]);
    const serviceNeedsCatalogPrice = step !== 'service' || (
        ['pay_now', 'book_appointment'].includes(serviceMode)
        && !['hidden', 'quote_only'].includes(servicePriceDisplay)
    );
    const serviceAreaList = serviceAreas.map((item) => String(item).trim()).filter(Boolean);
    const serviceAreasGateBuyerRequests = ['customer_location', 'hybrid'].includes(serviceLocationType);
    const serviceAreasHelperText = serviceAreasGateBuyerRequests
        ? 'These areas gate buyer requests for client-location services and help show where you can travel.'
        : serviceLocationType === 'remote'
            ? 'For remote services, areas are discovery hints only. Buyer requests are not blocked by location.'
            : 'For provider-location services, areas are discovery hints. Customers can still request or book if they can come to your venue.';
    const selectedServiceCategory = serviceCategoryOptions.find((option) => option.label === serviceCategory);
    const selectedServiceSubcategoryConfig = selectedServiceCategory?.subcategoryConfigs?.find((option) => option.label === serviceSubcategory);
    const selectedServiceTemplateOptions = selectedServiceSubcategoryConfig?.allowed_templates?.length
        ? selectedServiceSubcategoryConfig.allowed_templates
        : (selectedServiceCategory?.allowed_templates || []);
    const selectedServiceTemplate = selectedServiceTemplateOptions.find((template) => template.key === serviceTemplateKey)
        || selectedServiceSubcategoryConfig?.service_template
        || selectedServiceCategory?.service_template
        || (serviceTemplateKey ? { key: serviceTemplateKey, label: serviceTemplateKey.replace(/_/g, ' ') } : null);
    const selectedServiceTemplateKey = selectedServiceTemplate?.key || selectedServiceSubcategoryConfig?.service_template_key || selectedServiceCategory?.service_template_key || serviceTemplateKey || '';
    const selectedServiceSubtypeOptions = selectedServiceTemplate?.subtypes || [];
    const selectedServiceSubtypeKey = serviceDetails.service_subtype
        || (selectedServiceTemplateKey === 'rental' ? serviceDetails.rental_type : '')
        || selectedServiceSubtypeOptions[0]?.key
        || '';
    const baseServiceTrustPolicy = selectedServiceSubcategoryConfig || selectedServiceCategory || null;
    const templateTrustRule = selectedServiceTemplateKey
        ? (selectedServiceSubcategoryConfig?.template_rules?.[selectedServiceTemplateKey] || selectedServiceCategory?.template_rules?.[selectedServiceTemplateKey] || null)
        : null;
    const subtypeTrustRule = selectedServiceSubtypeKey
        ? (templateTrustRule?.subtypes?.[selectedServiceSubtypeKey] || templateTrustRule?.rental_types?.[selectedServiceSubtypeKey] || null)
        : null;
    const selectedServiceTrustPolicy = baseServiceTrustPolicy
        ? { ...baseServiceTrustPolicy, ...(templateTrustRule || {}), ...(subtypeTrustRule || {}) }
        : null;
    const selectedServiceTemplateDefaults = selectedServiceTemplate?.recommended_defaults || {};
    const selectedServiceTemplateSections = selectedServiceTemplate?.merchant_fields?.detail_sections || [];
    const hasConcreteServiceSubtype = Boolean(selectedServiceSubtypeKey && selectedServiceSubtypeKey !== 'none');
    const serviceTrustDocumentLabels = {
        identity: 'KYC',
        tin: 'TIN',
        business_license: 'Leseni ya biashara',
        registration: 'Usajili wa biashara',
        professional_license: 'Leseni/cheti cha taaluma',
        ownership_proof: 'Uthibitisho wa umiliki',
        vehicle_registration: 'Kadi/registration ya chombo',
        insurance: 'Bima',
        operating_permit: 'Kibali cha uendeshaji',
    };
    const selectedServiceRequiredDocuments = (selectedServiceTrustPolicy?.required_documents || [])
        .map((document) => serviceTrustDocumentLabels[document] || document)
        .filter(Boolean);
    const serviceOptionNeedsSubcategory = Boolean(selectedServiceCategory?.subcategories?.length);
    const serviceOptionCategoryReady = Boolean(serviceCategory) && (!serviceOptionNeedsSubcategory || Boolean(serviceSubcategory));
    const serviceOptionTemplate = serviceOptionCategoryReady
        ? selectedServiceSubcategoryConfig?.option_template || selectedServiceCategory?.option_template || GENERIC_SERVICE_OPTION_TEMPLATE
        : null;
    const serviceOptionFieldConfig = serviceOptionTemplate?.fields || {};
    const serviceOptionFieldEnabled = (key) => Boolean(serviceOptionTemplate) && serviceOptionFieldConfig[key] !== false;
    const serviceOptionDefaultCapacityType = serviceOptionFieldEnabled('capacity_type') ? 'limited' : 'unlimited';
    const defaultTemplateForConfig = (config) => config?.default_template_key || config?.service_template?.key || config?.service_template_key || '';
    const updateServiceSubtype = (subtypeKey) => {
        setServiceDetails((prev) => ({
            ...(prev || {}),
            service_subtype: subtypeKey,
            ...(selectedServiceTemplateKey === 'rental' ? { rental_type: subtypeKey === 'none' ? '' : subtypeKey } : {}),
        }));
    };
    const updateServiceDetail = (key, value) => {
        setServiceDetails((prev) => ({ ...(prev || {}), [key]: value }));
    };
    const applyServiceTemplateDefaults = (template) => {
        if (!template) return;

        const defaults = template.recommended_defaults || {};
        setServiceTemplateKey(template.key || '');
        setServiceDetails((prev) => {
            const subtypes = template.subtypes || [];
            const currentSubtype = prev?.service_subtype || (template.key === 'rental' ? prev?.rental_type : '');
            const nextSubtype = subtypes.some((subtype) => subtype.key === currentSubtype)
                ? currentSubtype
                : (subtypes[0]?.key || '');

            return {
                ...(prev || {}),
                ...(nextSubtype ? { service_subtype: nextSubtype } : {}),
                ...(template.key === 'rental' && nextSubtype && nextSubtype !== 'none' ? { rental_type: nextSubtype } : {}),
            };
        });
        if (defaults.service_mode) {
            setServiceMode(defaults.service_mode);
            setServiceIsShowcase(defaults.service_mode === 'showcase_only');
        }
        if (defaults.service_scheduling_type) {
            setServiceSchedulingType(defaults.service_scheduling_type);
        }
        if (defaults.service_price_display) {
            setServicePriceDisplay(defaults.service_price_display);
        }
        if (defaults.service_location_type) {
            setServiceLocationType(defaults.service_location_type);
        }

        if (template.key === 'stay' && serviceOptions.length === 0) {
            setServiceOptions([{
                id: `option_${Date.now()}`,
                name: 'Standard Room',
                description: '',
                price: '',
                price_display: 'nightly',
                capacity_type: 'limited',
                capacity: 1,
                max_guests: 2,
                duration_minutes: '',
                checkin_time: '14:00',
                checkout_time: '10:00',
                buffer_minutes: '',
            }]);
        }

        if (template.key === 'tour' && (!serviceDetails?.itinerary || serviceDetails.itinerary.length === 0)) {
            setServiceDetails((prev) => ({
                ...(prev || {}),
                itinerary: [
                    { day: 1, title: '', description: '' },
                    { day: 2, title: '', description: '' },
                ],
                included: prev?.included || [],
                excluded: prev?.excluded || [],
            }));
        }

        if (template.key === 'learning' && (!serviceDetails?.outcomes || serviceDetails.outcomes.length === 0)) {
            setServiceDetails((prev) => ({
                ...(prev || {}),
                outcomes: [''],
                requirements: prev?.requirements || [],
            }));
        }
    };
    const addServiceCharge = () => {
        setServiceCharges((prev) => ([
            ...prev,
            {
                id: `charge_${Date.now()}`,
                name: '',
                amount: '',
                unit: 'fixed',
                required: true,
                included_in_checkout: false,
                description: '',
            },
        ]));
    };
    const updateServiceCharge = (index, updates) => {
        setServiceCharges((prev) => prev.map((charge, chargeIndex) => (
            chargeIndex === index ? { ...charge, ...updates } : charge
        )));
    };
    const removeServiceCharge = (index) => {
        setServiceCharges((prev) => prev.filter((_, chargeIndex) => chargeIndex !== index));
    };
    const addServiceOption = () => {
        if (!serviceOptionCategoryReady) {
            toast.error(serviceOptionNeedsSubcategory ? 'Choose a service subcategory first.' : 'Choose a service category first.');
            return;
        }

        setServiceOptions((prev) => ([
            ...prev,
            {
                id: `option_${Date.now()}`,
                name: '',
                description: '',
                price: '',
                price_display: serviceOptionTemplate?.default_price_display || (servicePriceDisplay === 'hidden' || servicePriceDisplay === 'quote_only' ? 'fixed' : servicePriceDisplay),
                capacity_type: serviceOptionTemplate?.default_capacity_type || serviceOptionDefaultCapacityType,
                capacity: 1,
                max_guests: '',
                duration_minutes: serviceDurationMinutes || '',
                checkin_time: '',
                checkout_time: '',
                buffer_minutes: '',
            },
        ]));
    };
    const updateServiceOption = (index, updates) => {
        setServiceOptions((prev) => prev.map((option, optionIndex) => (
            optionIndex === index ? { ...option, ...updates } : option
        )));
    };
    const removeServiceOption = (index) => {
        setServiceOptions((prev) => prev.filter((_, optionIndex) => optionIndex !== index));
    };
    const physicalMerchantProducts = merchantProducts.filter((item) => (
        item.type === 'physical'
        && item.status === 'published'
        && String(item.id) !== String(productId || '')
    ));
    const serviceProductSearchTerm = serviceProductSearch.trim().toLowerCase();
    const filteredPhysicalMerchantProducts = physicalMerchantProducts.filter((item) => {
        if (!serviceProductSearchTerm) return true;

        return [
            item.title,
            item.description,
            item.slug,
            item.sku,
        ].some((value) => String(value || '').toLowerCase().includes(serviceProductSearchTerm));
    });
    const visiblePhysicalMerchantProducts = filteredPhysicalMerchantProducts.slice(0, 10);
    const updateMenuDetail = (key, value) => {
        setMenuDetails((prev) => ({ ...prev, [key]: value }));
    };
    const toggleMenuArrayValue = (key, value) => {
        setMenuDetails((prev) => {
            const current = Array.isArray(prev[key]) ? prev[key] : [];
            return {
                ...prev,
                [key]: current.includes(value)
                    ? current.filter((item) => item !== value)
                    : [...current, value],
            };
        });
    };
    const updateMenuAddOn = (index, key, value) => {
        setMenuDetails((prev) => ({
            ...prev,
            add_ons: (prev.add_ons || []).map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
        }));
    };
    const addMenuAddOn = () => {
        setMenuDetails((prev) => ({
            ...prev,
            add_ons: [...(prev.add_ons || []), { name: '', price: '' }],
        }));
    };
    const removeMenuAddOn = (index) => {
        setMenuDetails((prev) => ({
            ...prev,
            add_ons: (prev.add_ons || []).filter((_, rowIndex) => rowIndex !== index),
        }));
    };
    const updateRoomDetail = (key, value) => {
        setRoomDetails((prev) => ({ ...prev, [key]: value }));
    };
    const toggleRoomArrayValue = (key, value) => {
        setRoomDetails((prev) => {
            const current = Array.isArray(prev[key]) ? prev[key] : [];
            return {
                ...prev,
                [key]: current.includes(value)
                    ? current.filter((item) => item !== value)
                    : [...current, value],
            };
        });
    };
    const toggleServiceRelatedProduct = (id) => {
        const productIdNumber = Number(id);
        if (!productIdNumber) return;
        setServiceRelatedProductIds((prev) => (
            prev.includes(productIdNumber)
                ? prev.filter((item) => item !== productIdNumber)
                : [...prev, productIdNumber].slice(0, 12)
        ));
    };
    const serviceOptionsForPayload = serviceOptions
        .map((option) => ({
            id: String(option.id || `option_${Date.now()}`).trim(),
            name: String(option.name || '').trim(),
            description: String(option.description || '').trim(),
            price: option.price === '' || option.price === null || option.price === undefined ? null : Number(option.price),
            price_display: option.price_display || servicePriceDisplay || 'fixed',
            capacity_type: option.capacity_type === 'unlimited' ? 'unlimited' : 'limited',
            capacity: option.capacity_type === 'unlimited' ? null : Number(option.capacity || 1),
            max_guests: option.max_guests === '' || option.max_guests === null || option.max_guests === undefined ? null : Number(option.max_guests),
            duration_minutes: option.duration_minutes === '' || option.duration_minutes === null || option.duration_minutes === undefined ? null : Number(option.duration_minutes),
            checkin_time: option.checkin_time || null,
            checkout_time: option.checkout_time || null,
            buffer_minutes: option.buffer_minutes === '' || option.buffer_minutes === null || option.buffer_minutes === undefined ? null : Number(option.buffer_minutes),
        }))
        .filter((option) => option.name);
    const serviceChargesForPayload = serviceCharges
        .map((charge) => ({
            name: String(charge.name || '').trim(),
            amount: charge.amount === '' || charge.amount === null || charge.amount === undefined ? null : Number(charge.amount),
            unit: charge.unit || 'fixed',
            required: Boolean(charge.required),
            included_in_checkout: Boolean(charge.included_in_checkout),
            description: String(charge.description || '').trim(),
        }))
        .filter((charge) => charge.name);
    const addServiceArea = () => {
        const area = serviceAreaDraft.trim();
        if (!area) return;
        if (serviceAreaList.some((item) => item.toLowerCase() === area.toLowerCase())) {
            toast.error('Area already added.');
            return;
        }
        setServiceAreas((prev) => [...prev, area]);
        setServiceAreaDraft('');
    };
    const removeServiceArea = (area) => {
        setServiceAreas((prev) => prev.filter((item) => item !== area));
    };
    const automaticCustomerLocationField = (() => {
        if (!['customer_location', 'hybrid'].includes(serviceLocationType)) return null;
        return {
            id: 'customer_service_location',
            type: 'location',
            label: serviceLocationType === 'hybrid' ? 'Customer location if provider should come to you' : 'Service address',
            required: serviceLocationType === 'customer_location',
            placeholder: 'Pick location on map',
            options: [],
        };
    })();
    const serviceIntakeFormForPayload = (() => {
        const manualFields = serviceIntakeForm
            .map((field) => ({
                id: String(field.id || '').trim(),
                type: field.type || 'text',
                label: String(field.label || '').trim(),
                required: Boolean(field.required),
                placeholder: String(field.placeholder || '').trim(),
                options: Array.isArray(field.options) ? field.options : String(field.options || '').split('\n'),
            }))
            .filter((field) => field.id && field.label);

        if (!automaticCustomerLocationField || manualFields.some((field) => field.id === automaticCustomerLocationField.id)) {
            return manualFields;
        }

        return [automaticCustomerLocationField, ...manualFields];
    })();
    const serviceDurationMinutes = (() => {
        const value = Number(serviceDurationValue);
        if (!Number.isFinite(value) || value <= 0) return '';
        if (serviceDurationUnit === 'hours') return Math.round(value * 60);
        if (serviceDurationUnit === 'days') return Math.round(value * 1440);
        if (serviceDurationUnit === 'weeks') return Math.round(value * 10080);
        if (serviceDurationUnit === 'months') return Math.round(value * 43200);
        if (serviceDurationUnit === 'years') return Math.round(value * 525600);
        return Math.round(value);
    })();
    const setServiceDurationFromMinutes = (minutes) => {
        const numeric = Number(minutes);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            setServiceDurationValue('');
            setServiceDurationUnit('minutes');
            return;
        }

        if (numeric % 525600 === 0) {
            setServiceDurationValue(String(numeric / 525600));
            setServiceDurationUnit('years');
        } else if (numeric % 43200 === 0) {
            setServiceDurationValue(String(numeric / 43200));
            setServiceDurationUnit('months');
        } else if (numeric % 10080 === 0) {
            setServiceDurationValue(String(numeric / 10080));
            setServiceDurationUnit('weeks');
        } else if (numeric % 1440 === 0) {
            setServiceDurationValue(String(numeric / 1440));
            setServiceDurationUnit('days');
        } else if (numeric % 60 === 0) {
            setServiceDurationValue(String(numeric / 60));
            setServiceDurationUnit('hours');
        } else {
            setServiceDurationValue(String(numeric));
            setServiceDurationUnit('minutes');
        }
    };
    const addServiceIntakeField = () => {
        setServiceIntakeForm((prev) => ([
            ...prev,
            {
                id: `field_${Date.now()}`,
                type: 'text',
                label: '',
                required: false,
                placeholder: '',
                options: [],
            },
        ]));
    };
    const updateServiceIntakeField = (index, updates) => {
        setServiceIntakeForm((prev) => prev.map((field, fieldIndex) => (
            fieldIndex === index ? { ...field, ...updates } : field
        )));
    };
    const removeServiceIntakeField = (index) => {
        setServiceIntakeForm((prev) => prev.filter((_, fieldIndex) => fieldIndex !== index));
    };
    const defaultUnitForAttribute = (attr, current) => {
        const options = Array.isArray(attr?.unit_options) ? attr.unit_options.filter(Boolean) : [];
        if (options.length === 0) return current?.value_unit || '';
        return current?.value_unit || options[0];
    };

    useEffect(() => {
        if (!selectedModelId) return;
        const stillValid = selectedSchemaModels.some((model) => String(model.id) === String(selectedModelId));
        if (!stillValid) {
            setSelectedModelId('');
        }
    }, [selectedModelId, selectedSchemaModels]);

    const categoryDisplayName = (category) => {
        const labels = category?.localized_labels || {};
        return labels.sw || labels.en || category?.name || '';
    };

    const categorySearchText = (category) => {
        const labels = category?.localized_labels || {};
        return [category?.name, labels.sw, labels.en, category?.slug].filter(Boolean).join(' ');
    };

    const findCategoryName = (categoryId) => {
        const root = catalogCategories.find((c) => c.id === Number(categoryId));
        if (root) return root.name;
        for (const category of catalogCategories) {
            const child = (category.children || []).find((c) => c.id === Number(categoryId));
            if (child) return child.name;
        }
        return null;
    };

    const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const findCategoryByLabel = (label) => {
        const target = normalizeText(label);
        if (!target) return null;
        return (catalogCategories || []).find((category) => {
            const current = normalizeText(categorySearchText(category));
            return current === target || current.includes(target) || target.includes(current);
        }) || null;
    };
    const findSubCategoryByLabel = (children, label) => {
        const target = normalizeText(label);
        if (!target) return null;
        return (children || []).find((child) => {
            const current = normalizeText(categorySearchText(child));
            return current === target || current.includes(target) || target.includes(current);
        }) || null;
    };

    const onSelectRootCategory = async (value, { stayOnDetails = false } = {}) => {
        setSelectedCategoryId(value);
        setSelectedSubCategoryId('');
        setSelectedBrandId('');
        setSelectedModelId('');
        setSelectedUnitTypeId('');
        setSellableQuantity('1');
        setMinOrderQuantity('');
        setOrderIncrement('');
        setDynamicAttributeValues({});
        setHasVariants(false);
        setVariantDecision(null);
        setPhysicalFlowStep(stayOnDetails ? 3 : 1);
        setManualStepCompleted(stayOnDetails);
        setVariants([]);
        if (value) {
            await fetchCatalogForCategory(value);
            const name = findCategoryName(Number(value));
            if (name) setManualCategory(name);
        } else {
            setSelectedCatalogSchema(null);
        }
    };

    const onSelectSubCategory = async (value, { stayOnDetails = false } = {}) => {
        setSelectedSubCategoryId(value);
        setSelectedBrandId('');
        setSelectedModelId('');
        setSelectedUnitTypeId('');
        setSellableQuantity('1');
        setMinOrderQuantity('');
        setOrderIncrement('');
        setDynamicAttributeValues({});
        setHasVariants(false);
        setVariantDecision(null);
        setPhysicalFlowStep(stayOnDetails ? 3 : 1);
        setManualStepCompleted(stayOnDetails);
        setVariants([]);
        if (value) {
            await fetchCatalogForCategory(value);
            const name = findCategoryName(Number(value));
            if (name) setManualCategory(name);
        } else if (selectedCategoryId) {
            await fetchCatalogForCategory(selectedCategoryId);
            const name = findCategoryName(Number(selectedCategoryId));
            if (name) setManualCategory(name);
            if (stayOnDetails) {
                setPhysicalFlowStep(3);
                setManualStepCompleted(true);
            }
        }
    };

    const applyServiceModuleDefaults = (moduleKey) => {
        const moduleConfig = getUploadModuleConfig(moduleKey);
        if (moduleConfig?.type !== 'service') return;

        const defaults = moduleConfig.defaults || {};
        setServiceCategory(moduleConfig.category || '');
        setServiceSubcategory(moduleConfig.subcategory || '');
        setServiceTemplateKey(moduleConfig.serviceTemplateKey || '');
        if (moduleConfig.serviceSubtypeKey) {
            setServiceDetails((prev) => ({
                ...(prev || {}),
                service_subtype: moduleConfig.serviceSubtypeKey,
                ...(moduleConfig.serviceTemplateKey === 'rental' ? { rental_type: moduleConfig.serviceSubtypeKey } : {}),
            }));
        }
        if (defaults.servicePriceDisplay) setServicePriceDisplay(defaults.servicePriceDisplay);
        if (defaults.serviceMode) {
            setServiceMode(defaults.serviceMode);
            setServiceIsShowcase(defaults.serviceMode === 'showcase_only');
        }
        if (defaults.serviceBookingType) setServiceBookingType(defaults.serviceBookingType);
        if (defaults.serviceSchedulingType) setServiceSchedulingType(defaults.serviceSchedulingType);
        if (defaults.serviceDurationValue) setServiceDurationValue(defaults.serviceDurationValue);
        if (defaults.serviceDurationUnit) setServiceDurationUnit(defaults.serviceDurationUnit);
        if (defaults.serviceLocationType) setServiceLocationType(defaults.serviceLocationType);
        if (defaults.serviceDetails) {
            setServiceDetails((prev) => ({
                ...(prev || {}),
                ...defaults.serviceDetails,
            }));
        }
    };

    const handleModuleSelect = (moduleKey) => {
        const moduleConfig = getUploadModuleConfig(moduleKey);
        if (!moduleConfig) return;

        if (moduleKey === 'forwarders') {
            window.location.href = `/merchant/${merchantUsername}/forwarders/setup`;
            return;
        }

        setUploadModule(moduleKey);
        if (moduleConfig.type === 'physical') {
            setProductType('physical');
            setStep('physical');
            setShowManualForm(true);
            setManualStepCompleted(false);
            setPhysicalFlowStep(1);
            return;
        }

        setProductType('service');
        setStep('service');
        applyServiceModuleDefaults(moduleKey);
    };

    const handleCustomServiceSelect = () => {
        setUploadModule(null);
        setProductType('service');
        setStep('service');
        setServiceCategory('');
        setServiceSubcategory('');
        setServiceTemplateKey('');
        setServiceDetails({});
    };

    const handleTypeSelect = (type) => {
        setProductType(type);
        setStep(type === 'service' ? 'service_modules' : type);
        if (type === 'physical') {
            setShowManualForm(true);
            setManualStepCompleted(false);
            setPhysicalFlowStep(1);
        }
    };

    const handleUploadBack = () => {
        if (step === 'service') {
            setStep('service_modules');
            return;
        }

        setStep('select');
    };

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const startIndex = images.length;
        const newImages = files.map((file, idx) => ({
            file,
            localUrl: URL.createObjectURL(file),
            media_type: mediaTypeForFile(file),
            type: mediaTypeForFile(file),
            mime: file.type || null,
            size: file.size || null,
            thumbnail_url: null,
            processing_status: mediaTypeForFile(file) === 'video' ? 'pending' : 'ready',
            isUploading: true,
            progress: 0,
            url: null
        }));

        setImages(prev => [...prev, ...newImages]);

        newImages.forEach((img, idx) => {
            uploadFile(img.file, startIndex + idx);
        });
    };

    const uploadFile = async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'products');

        try {
            const res = await axios.post(`/merchant/${merchantUsername}/upload/media`, formData, {
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setImages(prev => {
                        const updated = [...prev];
                        if (updated[index]) updated[index].progress = percentCompleted;
                        return updated;
                    });
                }
            });

            const s3Url = res.data.url;
            setImages(prev => {
                const updated = [...prev];
                if (updated[index]) {
                    updated[index].url = s3Url;
                    updated[index].media_type = updated[index].media_type || (res.data.mime?.startsWith?.('video/') ? 'video' : 'image');
                    updated[index].type = updated[index].media_type;
                    updated[index].mime = res.data.mime || updated[index].mime || null;
                    updated[index].size = res.data.size || updated[index].size || null;
                    updated[index].processing_status = updated[index].media_type === 'video' ? 'pending' : 'ready';
                    updated[index].isUploading = false;
                    updated[index].progress = 100;
                }
                return updated;
            });

            // If it's the first image, trigger AI analysis for physical products
            /*
            if (index === 0 && step === 'physical') {
                analyzeImageWithAI(s3Url);
            }
            */
        } catch (err) {
            toast.error('Imeshindwa kupakia media.');
            setImages(prev => prev.filter((_, i) => i !== index));
        }
    };

    const uploadVariantSwatch = async (variantIndex, file) => {
        if (!file) return false;
        setVariants((prev) => prev.map((variant, idx) => (
            idx === variantIndex ? { ...variant, isUploadingSwatch: true } : variant
        )));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'variant-swatches');

        try {
            const res = await axios.post(`/merchant/${merchantUsername}/upload/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const swatchUrl = res.data?.url || '';
            setVariants((prev) => prev.map((variant, idx) => (
                idx === variantIndex ? { ...variant, swatch_image_url: swatchUrl, isUploadingSwatch: false } : variant
            )));
            return true;
        } catch (error) {
            setVariants((prev) => prev.map((variant, idx) => (
                idx === variantIndex ? { ...variant, isUploadingSwatch: false } : variant
            )));
            toast.error('Imeshindwa kupakia swatch image.');
            return false;
        }
    };

    const uploadProductDetailSectionImage = async (sectionIndex, file) => {
        if (!file) return false;

        if (!file.type?.startsWith('image/')) {
            toast.error('Tafadhali pakia picha tu kwa product detail section.');
            return false;
        }

        const localPreviewUrl = URL.createObjectURL(file);
        setProductDetailSections((prev) => prev.map((section, idx) => (
            idx === sectionIndex
                ? { ...section, local_image_url: localPreviewUrl, is_uploading_image: true, upload_progress: 0 }
                : section
        )));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'product-detail-sections');

        try {
            const res = await axios.post(`/merchant/${merchantUsername}/upload/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = progressEvent.total
                        ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        : 0;
                    setProductDetailSections((prev) => prev.map((section, idx) => (
                        idx === sectionIndex ? { ...section, upload_progress: percentCompleted } : section
                    )));
                },
            });

            const imageUrl = res.data?.url || '';
            setProductDetailSections((prev) => prev.map((section, idx) => (
                idx === sectionIndex
                    ? { ...section, image_url: imageUrl, local_image_url: imageUrl, is_uploading_image: false, upload_progress: 100 }
                    : section
            )));
            return true;
        } catch (error) {
            setProductDetailSections((prev) => prev.map((section, idx) => (
                idx === sectionIndex
                    ? { ...section, is_uploading_image: false, upload_progress: 0, local_image_url: section.image_url || '' }
                    : section
            )));
            toast.error('Imeshindwa kupakia picha ya product details.');
            return false;
        } finally {
            URL.revokeObjectURL(localPreviewUrl);
        }
    };

    const openSwatchModal = (variantIndex) => {
        setSwatchVariantIndex(variantIndex);
        setSwatchFile(null);
        setSwatchDragOver(false);
        setSwatchModalOpen(true);
    };

    const onSwatchDrop = (e) => {
        e.preventDefault();
        setSwatchDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) setSwatchFile(file);
    };

    const submitSwatchModal = async () => {
        if (swatchVariantIndex === null || !swatchFile) {
            toast.error('Tafadhali chagua picha ya swatch kwanza.');
            return;
        }
        const ok = await uploadVariantSwatch(swatchVariantIndex, swatchFile);
        if (ok) {
            setSwatchModalOpen(false);
            setSwatchFile(null);
            setSwatchVariantIndex(null);
        }
    };

    const variantAxisAttributes = selectedSchemaAttributes.filter((attr) =>
        !!attr.is_variant_axis && attr.input_type === 'select' && (attr.options || []).length > 0
    );
    const variantAttributeName = (attributeValues = {}) => (
        variantAxisAttributes
            .map((axis) => attributeValues?.[axis.key])
            .filter(Boolean)
            .join(' / ')
    );
    const variantSellingNameSuggestions = (variant) => {
        const attributeName = variantAttributeName(variant?.attributes || {});
        const suggestions = [
            attributeName,
            attributeName ? `${manualTitle || 'Product'} - ${attributeName}` : '',
            variant?.sku ? `${attributeName || manualTitle || 'Variant'} (${variant.sku})` : '',
        ].filter((value, index, arr) => value && arr.indexOf(value) === index);

        return suggestions.slice(0, 3);
    };
    const isVariantConfigured = (variant) => {
        const name = (variant?.name || '').trim();
        const rawPrice = variant?.price;
        const rawQuantity = variant?.quantity;
        const hasPrice = rawPrice !== '' && rawPrice !== null && !Number.isNaN(Number(rawPrice));
        const hasQuantity = rawQuantity !== '' && rawQuantity !== null && !Number.isNaN(Number(rawQuantity));
        return !!(name || variantAttributeName(variant?.attributes || {})) && (wholesaleOnly || hasPrice) && hasQuantity;
    };
    const merchantVariantOptionPreview = useMemo(() => (
        variantAxisAttributes.reduce((acc, axis) => {
            const options = (axis.options || []).filter(Boolean).map((option) => String(option));
            acc[axis.key] = options.map((option) => {
                const exactVariant = variants.find((variant) => (
                    String(variant?.attributes?.[axis.key] || '') === option && isVariantConfigured(variant)
                )) || variants.find((variant) => String(variant?.attributes?.[axis.key] || '') === option);

                return {
                    option,
                    swatch: exactVariant?.swatch_image_url || '',
                    price: exactVariant?.price ?? null,
                    stock: exactVariant?.quantity ?? null,
                    configured: !!exactVariant && isVariantConfigured(exactVariant),
                };
            });
            return acc;
        }, {})
    ), [variantAxisAttributes, variants]);

    const generateVariantsFromFacets = () => {
        if (variantAxisAttributes.length === 0) {
            toast.error('Hakuna variant options zilizowekwa kwenye admin kwa category hii.');
            return;
        }

        const cartesian = variantAxisAttributes.reduce((acc, axis) => {
            const axisOptions = (axis.options || []).filter(Boolean).map((option) => String(option));
            if (axisOptions.length === 0) return acc;
            if (acc.length === 0) return axisOptions.map((option) => ({ [axis.key]: option }));
            return acc.flatMap((current) => axisOptions.map((option) => ({ ...current, [axis.key]: option })));
        }, []);

        if (cartesian.length === 0) {
            toast.error('Hakuna combinations za variants zilizopatikana.');
            return;
        }

        setVariants(cartesian.map((attributeValues, index) => {
            const name = variantAttributeName(attributeValues);

            return {
                id: `gen-${Date.now()}-${index}`,
                name: name || `Variant ${index + 1}`,
                sku: '',
                price: '',
                compare_price: '',
                quantity: 0,
                location_inventories: {},
                attributes: attributeValues,
                swatch_image_url: '',
                is_active: true,
                sort_order: index,
                isUploadingSwatch: false,
            };
        }));
    };

    const sumLocationInventory = (inventories = {}) => (
        Object.values(inventories || {}).reduce((sum, value) => {
            const amount = Number(value);
            return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
        }, 0)
    );
    const locationStockTotal = sumLocationInventory(locationInventories);
    const configuredPhysicalVariants = step === 'physical' && hasVariants
        ? variants.filter(isVariantConfigured)
        : [];
    const configuredVariantStockTotal = configuredPhysicalVariants.reduce((sum, variant) => (
        sum + sumLocationInventory(variant.location_inventories || {})
    ), 0);
    const isUploadingMedia = images.some(img => img.isUploading);
    const isUploadingProductDetailSectionImage = productDetailSections.some((section) => section.is_uploading_image);
    const activeUploadModule = getUploadModuleConfig(uploadModule);
    const isMenuUpload = activeUploadModule?.key === 'menu' && step === 'physical';
    const isModuleServiceUpload = step === 'service' && activeUploadModule?.type === 'service';
    const useFocusedModuleServiceForm = isModuleServiceUpload && uploadModule !== 'forwarders';
    const showRoomDetailsForm = !useFocusedModuleServiceForm && step === 'service' && (uploadModule === 'rooms' || selectedServiceTemplateKey === 'stay') && hasConcreteServiceSubtype;
    const showReservationDetailsForm = !useFocusedModuleServiceForm && step === 'service' && (uploadModule === 'reservations' || selectedServiceTemplateKey === 'space_booking') && hasConcreteServiceSubtype;
    const showRentalDetailsForm = !useFocusedModuleServiceForm && step === 'service' && (uploadModule === 'rentals' || selectedServiceTemplateKey === 'rental') && hasConcreteServiceSubtype;
    const showWorkshopDetailsForm = !useFocusedModuleServiceForm && step === 'service' && (uploadModule === 'workshops' || selectedServiceTemplateKey === 'learning') && hasConcreteServiceSubtype;
    const showingSpecializedServiceForm = useFocusedModuleServiceForm
        || showRoomDetailsForm
        || showReservationDetailsForm
        || showRentalDetailsForm
        || showWorkshopDetailsForm;
    const isFocusedPhysicalModule = step === 'physical' && Boolean(activeUploadModule?.focusedPhysical);
    const showGenericPhysicalCatalog = step === 'physical' && !isFocusedPhysicalModule;
    const showGenericPhysicalFulfillment = step === 'physical' && !isFocusedPhysicalModule;
    const physicalDetailsReady = isFocusedPhysicalModule || physicalFlowStep >= 3;
    const physicalPublishDisabledReason = (() => {
        if (step !== 'physical') return '';
        if (isUploadingMedia) return 'Subiri media zimalize kupanda.';
        if (isUploadingProductDetailSectionImage) return 'Subiri picha za in-depth product details zimalize kupanda.';
        if (isFocusedPhysicalModule) return '';
        if (requiresLocationInventory && physicalLocations.length === 0) return 'Ongeza angalau duka au eneo la stock/pickup kwenye Mipangilio.';
        if (requiresLocationInventory && !hasVariants && locationStockTotal <= 0) return `Weka stock kwenye angalau eneo moja (${stockUnitLabel}).`;
        if (hasVariants && configuredPhysicalVariants.length === 0) return wholesaleOnly ? 'Jaza angalau variant moja.' : 'Jaza angalau variant moja yenye bei.';
        if (requiresLocationInventory && hasVariants && configuredVariantStockTotal <= 0) return 'Weka stock ya angalau variant moja kwenye duka au eneo la stock/pickup.';
        if (fulfillmentMode === 'supplier_sourced' && (!sourceDetails.supplier_name?.trim() || !sourceDetails.supplier_phone?.trim())) return 'Weka jina na simu ya supplier kwa Takeer.';
        if (fulfillmentMode === 'supplier_sourced' && sourceDetails.confirmation_hours === '') return 'Weka muda wa kuthibitisha au kupata bidhaa kwa masaa.';
        if (fulfillmentMode === 'made_to_order' && availabilityLeadTimeDays === '') return 'Weka muda wa kuandaa bidhaa.';
        if (['farm_harvest', 'preorder', 'group_sale'].includes(fulfillmentMode) && !availableFrom) return 'Weka tarehe bidhaa inatarajiwa kupatikana.';
        if (fulfillmentMode === 'group_sale' && (!groupSaleGoalQuantity || !groupSaleDeadline)) return 'Group sale inahitaji target quantity na deadline.';
        return '';
    })();

    const analyzeImageWithAI = async (imageUrl) => {
        setIsAnalyzing(true);
        toast.loading('AI inaangalia picha yako...', { id: 'ai-analyze' });

        try {
            const res = await axios.post(`/merchant/${merchantUsername}/upload/draft`, {
                image_url: imageUrl,
                ...buildMediaPayload(),
            });

            const draft = res.data.ai_draft || {};
            if (res.data.product_id) {
                setProductId(res.data.product_id);
            }
            setAiResult(draft);
            if (draft.suggested_description_swahili) {
                setManualTitle(draft.suggested_description_swahili);
            } else if (draft.category || draft.sub_category) {
                setManualTitle([draft.category, draft.sub_category].filter(Boolean).join(' - '));
            }
            if (draft.category) {
                const rootCategory = findCategoryByLabel(draft.category);
                if (rootCategory) {
                    await onSelectRootCategory(String(rootCategory.id));
                    setManualCategory(rootCategory.name);
                    if (draft.sub_category) {
                        const matchedSubCategory = findSubCategoryByLabel(rootCategory.children || [], draft.sub_category);
                        if (matchedSubCategory) {
                            await onSelectSubCategory(String(matchedSubCategory.id));
                        }
                    }
                }
            }
            setShowManualForm(true);
            setManualStepCompleted(false);
            toast.success(res.data.message, { id: 'ai-analyze' });
            setErrorDetail(null);
        } catch (error) {
            const data = error.response?.data || {};
            const msg = data.error_detail || data.message || 'Imeshindwa kutambua bidhaa.';
            setErrorDetail(msg);
            toast.error(msg, { id: 'ai-analyze' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDigitalFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setDigitalFile({ name: file.name, size: file.size, type: file.type, isUploading: true, progress: 0, url: null });

        try {
            const res = await uploadPrivateChunkedMedia(
                file,
                'digital-products',
                file.type || 'application/octet-stream',
                (progress) => setDigitalFile(prev => ({ ...prev, progress })),
            );

            setDigitalFile(prev => ({
                ...prev,
                isUploading: false,
                progress: 100,
                url: res.data.url,
                mime: res.data.mime || file.type,
                size: res.data.size || file.size,
            }));
        } catch (err) {
            toast.error('Imeshindwa kupakia faili lako la digitali.');
            setDigitalFile(prev => ({ ...prev, isUploading: false, error: true }));
        }
    };

    const handlePaidVideoSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type?.startsWith('video/')) {
            toast.error('Tafadhali chagua video file.');
            return;
        }

        setPaidVideoFile({ name: file.name, size: file.size, type: file.type, isUploading: true, progress: 0, url: null });

        try {
            const endpoint = `/merchant/${merchantUsername}/upload/media`;
            const chunkThreshold = 100 * 1024 * 1024;
            const chunkSize = 20 * 1024 * 1024;
            let res;

            if (file.size > chunkThreshold) {
                const uploadId = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const totalChunks = Math.ceil(file.size / chunkSize);

                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
                    const start = chunkIndex * chunkSize;
                    const end = Math.min(file.size, start + chunkSize);
                    const formData = new FormData();
                    formData.append('file', file.slice(start, end), file.name);
                    formData.append('type', 'private');
                    formData.append('folder', 'premium-videos');
                    formData.append('upload_id', uploadId);
                    formData.append('chunk_index', String(chunkIndex));
                    formData.append('total_chunks', String(totalChunks));
                    formData.append('original_name', file.name);
                    formData.append('mime', file.type || 'video/mp4');

                    res = await axios.post(endpoint, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        onUploadProgress: (progressEvent) => {
                            const chunkProgress = progressEvent.total ? progressEvent.loaded / progressEvent.total : 0;
                            const percentCompleted = Math.round(((chunkIndex + chunkProgress) / totalChunks) * 100);
                            setPaidVideoFile(prev => ({ ...prev, progress: percentCompleted }));
                        }
                    });
                }
            } else {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', 'private');
                formData.append('folder', 'premium-videos');

                res = await axios.post(endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setPaidVideoFile(prev => ({ ...prev, progress: percentCompleted }));
                    }
                });
            }

            setPaidVideoFile(prev => ({
                ...prev,
                isUploading: false,
                progress: 100,
                url: res.data.url,
                mime: res.data.mime || file.type,
                size: res.data.size || file.size,
            }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kupakia premium video.');
            setPaidVideoFile(prev => ({ ...prev, isUploading: false, error: true }));
        }
    };

    const uploadPrivateChunkedMedia = async (file, folder, fallbackMime, onProgress) => {
        const endpoint = `/merchant/${merchantUsername}/upload/media`;
        const chunkThreshold = 100 * 1024 * 1024;
        const chunkSize = 20 * 1024 * 1024;
        let res;

        if (file.size > chunkThreshold) {
            const uploadId = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const totalChunks = Math.ceil(file.size / chunkSize);

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
                const start = chunkIndex * chunkSize;
                const end = Math.min(file.size, start + chunkSize);
                const formData = new FormData();
                formData.append('file', file.slice(start, end), file.name);
                formData.append('type', 'private');
                formData.append('folder', folder);
                formData.append('upload_id', uploadId);
                formData.append('chunk_index', String(chunkIndex));
                formData.append('total_chunks', String(totalChunks));
                formData.append('original_name', file.name);
                formData.append('mime', file.type || fallbackMime);

                res = await axios.post(endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const chunkProgress = progressEvent.total ? progressEvent.loaded / progressEvent.total : 0;
                        onProgress(Math.round(((chunkIndex + chunkProgress) / totalChunks) * 100));
                    }
                });
            }

            return res;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'private');
        formData.append('folder', folder);

        return axios.post(endpoint, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            }
        });
    };

    const handleReleaseFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setReleaseUploading(true);
        setReleaseForm(prev => ({ ...prev, file: { name: file.name, size: file.size, type: file.type, isUploading: true, progress: 0 } }));

        try {
            const res = await uploadPrivateChunkedMedia(
                file,
                'digital-products',
                file.type || 'application/octet-stream',
                (progress) => setReleaseForm(prev => ({ ...prev, file: { ...prev.file, progress } })),
            );

            setReleaseForm(prev => ({
                ...prev,
                file: {
                    ...prev.file,
                    isUploading: false,
                    progress: 100,
                    url: res.data.url,
                    mime: res.data.mime || file.type,
                    size: res.data.size || file.size,
                },
            }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kupakia release file.');
            setReleaseForm(prev => ({ ...prev, file: { ...prev.file, isUploading: false, error: true } }));
        } finally {
            setReleaseUploading(false);
        }
    };

    const saveSoftwareRelease = async () => {
        if (!productId) {
            toast.error('Hifadhi bidhaa kwanza kabla ya kuongeza releases.');
            return;
        }
        if (!releaseForm.version.trim()) {
            toast.error('Weka version ya release.');
            return;
        }
        if (!releaseForm.file?.url) {
            toast.error('Pakia release file kwanza.');
            return;
        }

        setReleaseSaving(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/products/${productId}/releases`, {
                version: releaseForm.version.trim(),
                title: releaseForm.title.trim() || null,
                changelog: releaseForm.changelog.trim() || null,
                file_url: releaseForm.file.url,
                mime: releaseForm.file.mime || releaseForm.file.type || null,
                size: releaseForm.file.size || null,
                status: 'published',
                is_latest: true,
            });
            toast.success('Release imeongezwa.');
            setReleaseForm({ version: '', title: '', changelog: '', file: null });
            fetchSoftwareReleases(productId);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kuhifadhi release.');
        } finally {
            setReleaseSaving(false);
        }
    };

    const deleteSoftwareRelease = async (releaseId) => {
        if (!productId || !releaseId) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/products/${productId}/releases/${releaseId}`);
            toast.success('Release imefutwa.');
            fetchSoftwareReleases(productId);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kufuta release.');
        }
    };

    const copyLicenseKey = async (key) => {
        try {
            await navigator.clipboard.writeText(key);
            toast.success('License key copied.');
        } catch {
            toast.error('Imeshindwa ku-copy license key.');
        }
    };

    const copyToClipboard = async (value, successMessage = 'Copied.') => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(successMessage);
        } catch {
            toast.error('Imeshindwa ku-copy.');
        }
    };

    const updateLicenseKeyStatus = async (licenseId, action) => {
        if (!productId || !licenseId) return;
        setLicenseKeyBusy(`${action}-${licenseId}`);
        try {
            await axios.post(`/merchant/${merchantUsername}/products/${productId}/license-keys/${licenseId}/${action}`);
            toast.success(action === 'revoke' ? 'License key imezimwa.' : 'License key mpya imetengenezwa.');
            fetchSoftwareLicenseKeys(productId);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kusasisha license key.');
        } finally {
            setLicenseKeyBusy(null);
        }
    };

    const handlePaidAudioSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type?.startsWith('audio/')) {
            toast.error('Tafadhali chagua audio file.');
            return;
        }

        setPaidAudioFile({ name: file.name, size: file.size, type: file.type, isUploading: true, progress: 0, url: null });

        try {
            const res = await uploadPrivateChunkedMedia(
                file,
                'premium-audio',
                'audio/mpeg',
                (progress) => setPaidAudioFile(prev => ({ ...prev, progress })),
            );

            setPaidAudioFile(prev => ({
                ...prev,
                isUploading: false,
                progress: 100,
                url: res.data.url,
                mime: res.data.mime || file.type,
                size: res.data.size || file.size,
            }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kupakia premium audio.');
            setPaidAudioFile(prev => ({ ...prev, isUploading: false, error: true }));
        }
    };

    const handlePaidGallerySelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const imageFiles = files.filter(file => file.type?.startsWith('image/'));
        if (imageFiles.length !== files.length) {
            toast.error('Tafadhali chagua picha pekee kwa gallery pack.');
            return;
        }

        const placeholders = imageFiles.map((file) => ({
            localId: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            size: file.size,
            mime: file.type,
            isUploading: true,
            progress: 0,
            url: null,
            preview_url: null,
        }));

        setPaidGalleryItems(prev => [...prev, ...placeholders]);

        await Promise.all(placeholders.map(async (placeholder, index) => {
            const file = imageFiles[index];
            try {
                const res = await uploadPrivateChunkedMedia(
                    file,
                    'premium-gallery',
                    file.type || 'image/jpeg',
                    (progress) => setPaidGalleryItems(prev => prev.map(item => (
                        item.localId === placeholder.localId ? { ...item, progress } : item
                    ))),
                );

                setPaidGalleryItems(prev => prev.map(item => (
                    item.localId === placeholder.localId
                        ? {
                            ...item,
                            isUploading: false,
                            progress: 100,
                            url: res.data.url,
                            preview_url: null,
                            mime: res.data.mime || file.type,
                            size: res.data.size || file.size,
                        }
                        : item
                )));
            } catch (err) {
                toast.error(err.response?.data?.message || `Imeshindwa kupakia ${file.name}.`);
                setPaidGalleryItems(prev => prev.map(item => (
                    item.localId === placeholder.localId ? { ...item, isUploading: false, error: true } : item
                )));
            }
        }));
    };

    const publishProduct = async () => {
        const serviceNeedsCatalogPrice = step === 'service' && (
            ['pay_now', 'book_appointment'].includes(serviceMode)
            && !['hidden', 'quote_only'].includes(servicePriceDisplay)
        );
        if (
            !price
            && retailPriceEnabled
            && !(step === 'digital' && assignedAccessGroup)
            && !(step === 'physical' && hasVariants)
            && !(step === 'service' && !serviceNeedsCatalogPrice)
        ) {
            toast.error('Tafadhali weka bei ya bidhaa au assign access group.');
            return;
        }
        if (step === 'physical' && images.length === 0) {
            toast.error('Tafadhali ongeza angalau picha au video moja ya bidhaa.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && !selectedCategoryId) {
            toast.error('Tafadhali chagua category ya bidhaa.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && physicalFlowStep < 3) {
            toast.error('Kamilisha hatua za juu kwanza.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && requiresLocationInventory && physicalLocations.length === 0) {
            toast.error('Tafadhali ongeza angalau duka au eneo la stock/pickup kwenye Mipangilio.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && requiresLocationInventory && !hasVariants && locationStockTotal <= 0) {
            toast.error(`Tafadhali weka stock kwenye angalau duka au eneo la stock/pickup (${stockUnitLabel}).`);
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && fulfillmentMode === 'supplier_sourced' && (!sourceDetails.supplier_name?.trim() || !sourceDetails.supplier_phone?.trim())) {
            toast.error('Tafadhali weka jina na simu ya supplier. Taarifa hizi ni za Takeer tu.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && fulfillmentMode === 'supplier_sourced' && sourceDetails.confirmation_hours === '') {
            toast.error('Tafadhali weka masaa yanayohitajika kuthibitisha au kupata bidhaa.');
            return;
        }
        if (wholesaleEnabled) {
            if (!minOrderQuantity) {
                toast.error('Wholesale inahitaji minimum order quantity.');
                return;
            }
            if (cleanPricingTiers.length === 0) {
                toast.error('Ongeza angalau pricing tier moja kwa wholesale.');
                return;
            }
            if (!Object.values(safePayMethods).some(Boolean)) {
                toast.error('Chagua angalau njia moja ya Takeer SafePay.');
                return;
            }
        }
        if (step === 'physical' && !isFocusedPhysicalModule && fulfillmentMode === 'made_to_order' && availabilityLeadTimeDays === '') {
            toast.error('Tafadhali weka siku ngapi zinahitajika kuandaa bidhaa.');
            return;
        }
        if (step === 'digital' && digitalDeliveryMode === 'custom_delivery' && availabilityLeadTimeDays === '') {
            toast.error('Tafadhali weka siku ngapi zinahitajika kumaliza custom work.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && ['farm_harvest', 'preorder', 'group_sale'].includes(fulfillmentMode) && !availableFrom) {
            toast.error('Tafadhali weka tarehe ambayo bidhaa inatarajiwa kupatikana.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && fulfillmentMode === 'group_sale' && (!groupSaleGoalQuantity || !groupSaleDeadline)) {
            toast.error('Group sale inahitaji target quantity na deadline.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && variantAxisAttributes.length > 0 && variantDecision === null) {
            toast.error('Chagua kama bidhaa ina variants au la.');
            return;
        }
        if (step === 'physical' && !isFocusedPhysicalModule && hasVariants) {
            const configuredVariants = configuredPhysicalVariants;
            if (configuredVariants.length === 0) {
                toast.error(wholesaleOnly ? 'Jaza angalau variant moja.' : 'Jaza angalau variant moja yenye bei.');
                return;
            }
            const invalidVariantQuantity = configuredVariants.find((variant) => Number(variant.quantity) < 0 || Number.isNaN(Number(variant.quantity)));
            if (invalidVariantQuantity) {
                toast.error('Quantity ya variant lazima iwe 0 au zaidi.');
                return;
            }
            if (requiresLocationInventory && configuredVariantStockTotal <= 0) {
                toast.error('Tafadhali weka stock ya angalau variant moja kwenye duka au eneo la stock/pickup.');
                return;
            }
        }
        const missingRequiredAttribute = facetAttributesForForm.find((attr) => {
            if (!attr.is_required) return false;
            const current = dynamicAttributeValues[attr.id] || {};
            if (attr.input_type === 'boolean') return false;
            if (attr.input_type === 'number') {
                const missingNumber = current.value_number === undefined || current.value_number === '';
                if (missingNumber) return true;
                if (attr.ui_hint === 'number_with_unit' && (attr.unit_options || []).length > 0) {
                    return !defaultUnitForAttribute(attr, current).toString().trim();
                }
                return false;
            }
            if (attr.input_type === 'multiselect') {
                return !Array.isArray(current.value_json) || current.value_json.length === 0;
            }
            return !(current.value_text || '').toString().trim();
        });
        if (step === 'physical' && !isFocusedPhysicalModule && missingRequiredAttribute) {
            toast.error(`Tafadhali jaza ${missingRequiredAttribute.label}.`);
            return;
        }
        if (step === 'digital') {
            if (digitalDeliveryMode === 'upload' && !digitalFile) {
                toast.error('Tafadhali pakia faili la bidhaa yako.');
                return;
            }
            if (digitalDeliveryMode === 'video_stream' && !paidVideoFile) {
                toast.error('Tafadhali pakia full premium video.');
                return;
            }
            if (digitalDeliveryMode === 'audio_stream' && !paidAudioFile) {
                toast.error('Tafadhali pakia premium audio.');
                return;
            }
            if (digitalDeliveryMode === 'gallery_pack' && paidGalleryItems.filter(item => item.url && !item.error).length === 0) {
                toast.error('Tafadhali pakia picha za gallery pack.');
                return;
            }
            if (digitalDeliveryMode === 'live_event') {
                if (!liveEventStartsAt) {
                    toast.error('Tafadhali weka muda wa live event/webinar.');
                    return;
                }
                if (!liveEventAccessUrl && !liveEventVenue) {
                    toast.error('Weka meeting link au venue ya tukio.');
                    return;
                }
            }
            if (digitalDeliveryMode === 'link' && !url) {
                toast.error('Tafadhali weka link ya kupakua.');
                return;
            }
        }
        if (step === 'service') {
            if (!serviceCategory) {
                toast.error('Tafadhali chagua category ya huduma kwa usalama wa wateja.');
                return;
            }
            if (selectedServiceCategory?.subcategories?.length && !serviceSubcategory) {
                toast.error('Tafadhali chagua subcategory ya huduma kwa usalama wa wateja.');
                return;
            }
            if (serviceNeedsCatalogPrice && !price) {
                toast.error('Tafadhali weka bei ya huduma.');
                return;
            }
            if (servicePriceDisplay === 'hourly' && !serviceHourlyRate && !price) {
                toast.error('Tafadhali weka bei kwa saa.');
                return;
            }
            if (serviceBookingMode === 'internal' && !serviceContactValue && serviceMode !== 'book_appointment') {
                toast.error('Tafadhali weka namba ya simu au WhatsApp.');
                return;
            }
            if ((serviceSchedulingType === 'external' || serviceBookingMode === 'external') && !url) {
                toast.error('Tafadhali weka link ya booking.');
                return;
            }
        }
        if (!description) {
            toast.error('Tafadhali jaza maelezo ya bidhaa/huduma.');
            return;
        }

        toast.loading('Inapakia bidhaa...', { id: 'publish' });

        // Ensure everything has finished uploading
        if (isUploadingMedia) {
            toast.error('Tafadhali subiri media zimalize kupanda.');
            return;
        }
        if (step === 'physical' && isUploadingProductDetailSectionImage) {
            toast.error('Tafadhali subiri picha za in-depth product details zimalize kupanda.');
            return;
        }

        if (step === 'digital' && digitalDeliveryMode === 'upload' && digitalFile?.isUploading) {
            toast.error('Tafadhali subiri faili la digitali limalize kupanda.');
            return;
        }
        if (step === 'digital' && digitalDeliveryMode === 'video_stream' && paidVideoFile?.isUploading) {
            toast.error('Tafadhali subiri premium video imalize kupanda.');
            return;
        }
        if (step === 'digital' && digitalDeliveryMode === 'audio_stream' && paidAudioFile?.isUploading) {
            toast.error('Tafadhali subiri premium audio imalize kupanda.');
            return;
        }
        if (step === 'digital' && digitalDeliveryMode === 'gallery_pack' && paidGalleryItems.some(item => item.isUploading)) {
            toast.error('Tafadhali subiri picha za gallery zimalize kupanda.');
            return;
        }
        if (step === 'physical' && hasVariants && variants.some((variant) => variant.isUploadingSwatch)) {
            toast.error('Tafadhali subiri swatch images zimalize kupanda.');
            return;
        }

        try {
            const publishVariants = step === 'physical' && hasVariants
                ? variants.filter(isVariantConfigured)
                : [];
            const mediaPayload = buildMediaPayload();
            const res = await axios.post(`/merchant/${merchantUsername}/upload/publish`, {
                ...mediaPayload,
                type: productType,
                module_key: publishModuleKey(uploadModule, step),
                module_details: uploadModule === 'menu' && step === 'physical' ? {
                    ...menuDetails,
                    prep_time_minutes: menuDetails.prep_time_minutes !== '' ? Number(menuDetails.prep_time_minutes) : null,
                    add_ons: (menuDetails.add_ons || []).filter((row) => row.name?.trim()).map((row) => ({
                        name: row.name.trim(),
                        price: row.price !== '' ? Number(row.price || 0) : 0,
                    })),
                } : uploadModule === 'rooms' && step === 'service' ? {
                    ...roomDetails,
                    max_guests: roomDetails.max_guests !== '' ? Number(roomDetails.max_guests || 1) : null,
                    room_count: roomDetails.room_count !== '' ? Number(roomDetails.room_count || 1) : null,
                    bathrooms: roomDetails.bathrooms !== '' ? Number(roomDetails.bathrooms || 0) : null,
                } : uploadModule === 'tour_departures' && step === 'service' ? {
                    destination: serviceDetails.destination || '',
                    duration_label: serviceDetails.duration_label || '',
                    pickup_point: serviceDetails.pickup_point || '',
                    dropoff_point: serviceDetails.dropoff_point || '',
                    group_size: serviceDetails.group_size !== '' && serviceDetails.group_size !== undefined ? Number(serviceDetails.group_size || 0) : null,
                    departure_type: serviceDetails.departure_type || 'scheduled',
                    itinerary: Array.isArray(serviceDetails.itinerary) ? serviceDetails.itinerary : [],
                    included: Array.isArray(serviceDetails.included) ? serviceDetails.included.filter(Boolean) : [],
                    excluded: Array.isArray(serviceDetails.excluded) ? serviceDetails.excluded.filter(Boolean) : [],
                    requirements: serviceDetails.requirements || '',
                } : uploadModule === 'custom_orders' && step === 'service' ? {
                    customization_notes: serviceDetails.customization_notes || '',
                    lead_time: serviceDetails.lead_time || '',
                    pickup_delivery_notes: serviceDetails.pickup_delivery_notes || '',
                    quote_policy: serviceDetails.quote_policy || 'quote_after_request',
                    minimum_order: serviceDetails.minimum_order !== '' && serviceDetails.minimum_order !== undefined ? Number(serviceDetails.minimum_order || 0) : null,
                } : uploadModule === 'appointments' && step === 'service' ? {
                    appointment_duration_minutes: serviceDurationMinutes ? Number(serviceDurationMinutes) : Number(serviceDetails.appointment_duration_minutes || 60),
                    buffer_minutes: serviceDetails.buffer_minutes !== '' && serviceDetails.buffer_minutes !== undefined ? Number(serviceDetails.buffer_minutes || 0) : 15,
                    capacity: serviceDetails.capacity !== '' && serviceDetails.capacity !== undefined ? Number(serviceDetails.capacity || 1) : 1,
                    appointment_location_mode: serviceDetails.appointment_location_mode || serviceLocationType || 'provider_location',
                    booking_policy: serviceDetails.booking_policy || 'manual_confirm',
                    preparation_notes: serviceDetails.preparation_notes || '',
                } : uploadModule === 'reservations' && step === 'service' ? {
                    reservation_type: serviceDetails.reservation_type || 'table',
                    seating_type: serviceDetails.seating_type || 'Standard seating',
                    reservation_duration_minutes: serviceDurationMinutes ? Number(serviceDurationMinutes) : Number(serviceDetails.reservation_duration_minutes || 90),
                    party_size_limit: serviceDetails.party_size_limit !== '' && serviceDetails.party_size_limit !== undefined ? Number(serviceDetails.party_size_limit || 0) : null,
                    reservation_policy: serviceDetails.reservation_policy || 'manual_confirm',
                    deposit_amount: serviceDetails.deposit_amount !== '' && serviceDetails.deposit_amount !== undefined
                        ? Number(serviceDetails.deposit_amount || 0)
                        : (serviceDetails.deposit_note !== '' && serviceDetails.deposit_note !== undefined && !Number.isNaN(Number(serviceDetails.deposit_note))
                            ? Number(serviceDetails.deposit_note || 0)
                            : null),
                    deposit_note: serviceDetails.deposit_note || '',
                    reservation_notes: serviceDetails.reservation_notes || '',
                } : uploadModule === 'rentals' && step === 'service' ? {
                    rental_type: serviceDetails.rental_type || 'equipment',
                    rental_unit: serviceDetails.rental_unit || 'day',
                    rental_duration_minutes: serviceDurationMinutes ? Number(serviceDurationMinutes) : Number(serviceDetails.rental_duration_minutes || 1440),
                    available_units: serviceDetails.available_units !== '' && serviceDetails.available_units !== undefined ? Number(serviceDetails.available_units || 1) : 1,
                    security_deposit: serviceDetails.security_deposit !== '' && serviceDetails.security_deposit !== undefined ? Number(serviceDetails.security_deposit || 0) : null,
                    rental_policy: serviceDetails.rental_policy || 'manual_confirm',
                    pickup_return_notes: serviceDetails.pickup_return_notes || '',
                    included_items: Array.isArray(serviceDetails.included_items) ? serviceDetails.included_items.filter(Boolean) : [],
                    rental_requirements: serviceDetails.rental_requirements || '',
                } : uploadModule === 'workshops' && step === 'service' ? {
                    workshop_format: serviceDetails.workshop_format || 'live_session',
                    session_count: serviceDetails.session_count !== '' && serviceDetails.session_count !== undefined ? Number(serviceDetails.session_count || 1) : 1,
                    workshop_duration_minutes: serviceDurationMinutes ? Number(serviceDurationMinutes) : Number(serviceDetails.workshop_duration_minutes || 120),
                    workshop_capacity: serviceDetails.workshop_capacity !== '' && serviceDetails.workshop_capacity !== undefined ? Number(serviceDetails.workshop_capacity || 0) : null,
                    workshop_level: serviceDetails.workshop_level || 'All levels',
                    enrollment_policy: serviceDetails.enrollment_policy || 'manual_confirm',
                    workshop_location_mode: serviceDetails.workshop_location_mode || serviceLocationType || 'provider_location',
                    workshop_start_note: serviceDetails.workshop_start_note || '',
                    learning_outcomes: Array.isArray(serviceDetails.learning_outcomes) ? serviceDetails.learning_outcomes.filter(Boolean) : Array.isArray(serviceDetails.outcomes) ? serviceDetails.outcomes.filter(Boolean) : [],
                    workshop_requirements: Array.isArray(serviceDetails.workshop_requirements) ? serviceDetails.workshop_requirements.filter(Boolean) : Array.isArray(serviceDetails.requirements) ? serviceDetails.requirements.filter(Boolean) : [],
                    materials_included: Array.isArray(serviceDetails.materials_included) ? serviceDetails.materials_included.filter(Boolean) : [],
                } : uploadModule === 'forwarders' && step === 'service' ? {
                    legal_name: serviceDetails.legal_name || '',
                    contact_person: serviceDetails.contact_person || '',
                    contact_email: serviceDetails.contact_email || '',
                    whatsapp_phone: serviceDetails.whatsapp_phone || serviceContactValue || '',
                    website: serviceDetails.website || '',
                    logo_url: serviceDetails.logo_url || '',
                    service_types: Array.isArray(serviceDetails.service_types) ? serviceDetails.service_types.filter(Boolean) : ['import_forwarding'],
                    required_fields: Array.isArray(serviceDetails.required_fields) ? serviceDetails.required_fields.filter(Boolean) : ['customer_id'],
                    origin_locations: Array.isArray(serviceDetails.origin_locations) ? serviceDetails.origin_locations : [],
                    destination_locations: Array.isArray(serviceDetails.destination_locations) ? serviceDetails.destination_locations : [],
                    merchant_instructions: serviceDetails.merchant_instructions || '',
                    customer_instructions: serviceDetails.customer_instructions || '',
                    license_notes: serviceDetails.license_notes || '',
                    rates_info: serviceDetails.rates_info || '',
                } : null,
                // Digital product: either the uploaded file or external link
                digital_file_url: (step === 'digital' && digitalDeliveryMode === 'upload') ? digitalFile?.url : null,
                digital_delivery_type: step === 'digital'
                    ? (digitalDeliveryMode === 'video_stream' ? 'video_stream' : digitalDeliveryMode === 'audio_stream' ? 'audio_stream' : digitalDeliveryMode === 'gallery_pack' ? 'gallery_pack' : digitalDeliveryMode === 'live_event' ? 'live_event' : digitalDeliveryMode === 'custom_delivery' ? 'custom_delivery' : digitalDeliveryMode === 'link' ? 'external_link' : 'file')
                    : null,
                digital_content_type: step === 'digital' ? digitalContentType : null,
                digital_usage_license: step === 'digital' ? digitalUsageLicense : null,
                digital_access_instructions: step === 'digital' ? digitalAccessInstructions : null,
                license_key_enabled: step === 'digital' && digitalContentType === 'software' ? licenseKeyEnabled : false,
                license_key_prefix: step === 'digital' && digitalContentType === 'software' ? licenseKeyPrefix : null,
                license_activation_limit: step === 'digital' && digitalContentType === 'software' ? Number(licenseActivationLimit || 1) : 1,
                paid_video_url: (step === 'digital' && digitalDeliveryMode === 'video_stream') ? paidVideoFile?.url : null,
                paid_video_mime: (step === 'digital' && digitalDeliveryMode === 'video_stream') ? paidVideoFile?.mime || paidVideoFile?.type : null,
                paid_video_size: (step === 'digital' && digitalDeliveryMode === 'video_stream') ? paidVideoFile?.size : null,
                paid_audio_url: (step === 'digital' && digitalDeliveryMode === 'audio_stream') ? paidAudioFile?.url : null,
                paid_audio_mime: (step === 'digital' && digitalDeliveryMode === 'audio_stream') ? paidAudioFile?.mime || paidAudioFile?.type : null,
                paid_audio_size: (step === 'digital' && digitalDeliveryMode === 'audio_stream') ? paidAudioFile?.size : null,
                paid_gallery_items: (step === 'digital' && digitalDeliveryMode === 'gallery_pack')
                    ? paidGalleryItems.filter(item => item.url && !item.error).map(item => ({
                        url: item.url,
                        preview_url: item.preview_url || null,
                        name: item.name,
                        mime: item.mime || item.type,
                        size: item.size,
                        preview_mime: item.preview_mime || null,
                        preview_size: item.preview_size || null,
                    }))
                    : null,
                live_event_starts_at: (step === 'digital' && digitalDeliveryMode === 'live_event') ? liveEventStartsAt : null,
                live_event_duration_minutes: (step === 'digital' && digitalDeliveryMode === 'live_event') ? Number(liveEventDurationMinutes || 0) || null : null,
                live_event_timezone: (step === 'digital' && digitalDeliveryMode === 'live_event') ? liveEventTimezone : null,
                live_event_access_url: (step === 'digital' && digitalDeliveryMode === 'live_event') ? liveEventAccessUrl : null,
                live_event_venue: (step === 'digital' && digitalDeliveryMode === 'live_event') ? liveEventVenue : null,
                live_event_capacity: (step === 'digital' && digitalDeliveryMode === 'live_event') ? Number(liveEventCapacity || 0) || null : null,
                live_event_replay_url: (step === 'digital' && digitalDeliveryMode === 'live_event') ? liveEventReplayUrl : null,
                live_event_instructions: (step === 'digital' && digitalDeliveryMode === 'live_event') ? liveEventInstructions : null,
                allow_download: (step === 'digital' && ['video_stream', 'audio_stream', 'gallery_pack'].includes(digitalDeliveryMode)) ? allowDigitalDownload : true,
                url: step === 'digital'
                    ? (digitalDeliveryMode === 'link' ? url : null)
                    : step === 'service'
                        ? (serviceSchedulingType === 'external' || serviceBookingMode === 'external'
                            ? url
                            : serviceBookingMode === 'internal'
                                ? `${serviceContactType}:${serviceContactValue}`
                                : null)
                        : null,
                price: wholesaleOnly
                    ? 0
                    : step === 'service'
                        ? (
                            servicePriceDisplay === 'hourly'
                                ? parseFloat(serviceHourlyRate || price || 0)
                                : (['showcase_only', 'request_quote'].includes(serviceMode) || ['hidden', 'quote_only'].includes(servicePriceDisplay))
                                    ? 0
                                    : (price === '' ? 0 : parseFloat(price))
                        )
                        : (price === '' ? 0 : parseFloat(price)),
                compare_price: wholesaleOnly ? null : (comparePrice ? parseFloat(comparePrice) : null),
                service_pricing_model: step === 'service'
                    ? (
                        serviceMode === 'showcase_only' ? 'showcase_only'
                            : serviceMode === 'request_quote' || servicePriceDisplay === 'quote_only' ? 'contract_quote'
                                : servicePriceDisplay === 'hourly' ? 'hourly_rate'
                                    : serviceDepositAmount ? 'deposit_required'
                                        : 'fixed_price'
                    )
                    : 'fixed_price',
                service_booking_type: step === 'service' ? serviceBookingType : 'instant',
                service_category_id: step === 'service' ? selectedServiceCategory?.id || null : null,
                service_subcategory_id: step === 'service' ? selectedServiceSubcategoryConfig?.id || null : null,
                service_hourly_rate: step === 'service' && servicePriceDisplay === 'hourly'
                    ? Number(serviceHourlyRate || price || 0)
                    : null,
                service_min_hours: step === 'service' && servicePriceDisplay === 'hourly'
                    ? Number(serviceMinHours || 1)
                    : null,
                service_deposit_amount: step === 'service' && serviceDepositAmount
                    ? Number(serviceDepositAmount || 0)
                    : null,
                service_is_showcase: step === 'service' ? serviceMode === 'showcase_only' : false,
                service_mode: step === 'service' ? serviceMode : 'pay_now',
                service_scheduling_type: step === 'service' ? serviceSchedulingType : 'none',
                service_category: step === 'service' ? serviceCategory || null : null,
                service_subcategory: step === 'service' ? serviceSubcategory || null : null,
                service_template_key: step === 'service' ? selectedServiceTemplateKey || null : null,
                service_price_display: step === 'service' ? servicePriceDisplay : 'fixed',
                service_charges: step === 'service' ? serviceChargesForPayload : [],
                service_options: step === 'service' ? serviceOptionsForPayload : [],
                service_details: step === 'service' ? serviceDetails || {} : {},
                service_duration_minutes: step === 'service' && serviceDurationMinutes ? Number(serviceDurationMinutes) : null,
                service_location_type: step === 'service' ? serviceLocationType : null,
                service_provider_location: step === 'service' && ['provider_location', 'customer_location', 'hybrid'].includes(serviceLocationType)
                    ? serviceProviderLocation
                    : null,
                service_area: step === 'service' ? serviceAreaList : [],
                service_client_requirements: step === 'service' ? serviceClientRequirements : null,
                service_intake_form: step === 'service' ? serviceIntakeFormForPayload : [],
                service_related_product_ids: step === 'service'
                    ? serviceRelatedProductIds.filter((id) => physicalMerchantProducts.some((item) => Number(item.id) === Number(id)))
                    : [],
                service_booking_provider: step === 'service'
                    ? (serviceSchedulingType === 'external' ? 'external' : serviceBookingProvider)
                    : 'manual',
                service_booking_mode: step === 'service' ? serviceBookingMode : 'takeer',
                service_contact_channel: step === 'service' ? serviceContactType : null,
                service_contact_value: step === 'service' ? serviceContactValue : null,
                availability_location_ids: step === 'service' ? availabilityLocationIds.map((id) => Number(id)).filter(Boolean) : [],
                publish_targets: autoPostTargets,
                fulfillment_mode: step === 'physical' ? fulfillmentMode : 'own_stock',
                selling_style: step === 'physical' ? sellingStyle : 'retail',
                source_details: step === 'physical' ? sourceDetails : null,
                availability_lead_time_days: step === 'digital' && digitalDeliveryMode === 'custom_delivery' && availabilityLeadTimeDays !== ''
                    ? Number(availabilityLeadTimeDays)
                    : step === 'physical' && fulfillmentMode === 'supplier_sourced' && sourceDetails.confirmation_hours !== ''
                        ? Math.max(1, Math.ceil(Number(sourceDetails.confirmation_hours || 0) / 24))
                        : step === 'physical' && availabilityLeadTimeDays !== ''
                            ? Number(availabilityLeadTimeDays)
                            : null,
                available_from: step === 'physical' && availableFrom ? availableFrom : null,
                group_sale_goal_quantity: step === 'physical' && groupSaleGoalQuantity !== '' ? Number(groupSaleGoalQuantity) : null,
                group_sale_deadline: step === 'physical' && groupSaleDeadline ? groupSaleDeadline : null,
                quantity: step === 'physical' && !hasVariants ? (isFocusedPhysicalModule ? 99999 : (requiresLocationInventory ? locationStockTotal : 99999)) : 99999,
                product_unit_type_id: step === 'physical' && selectedUnitTypeId ? Number(selectedUnitTypeId) : null,
                sellable_quantity: step === 'physical' ? Number(sellableQuantity || 1) : 1,
                package_content_unit_type_id: step === 'physical' && packageContentUnitTypeId ? Number(packageContentUnitTypeId) : null,
                package_content_quantity: step === 'physical' && packageContentQuantity !== '' ? Number(packageContentQuantity) : null,
                package_contents: step === 'physical' ? packageContents.trim() || null : null,
                package_content_items: step === 'physical' ? cleanPackageContentItems : [],
                return_policy_id: step === 'physical' && !useCustomReturnPolicy && selectedReturnPolicyId ? Number(selectedReturnPolicyId) : null,
                min_order_quantity: step === 'physical' && minOrderQuantity !== '' ? Number(minOrderQuantity) : null,
                order_increment: step === 'physical' && orderIncrement !== '' ? Number(orderIncrement) : null,
                supply_capacity_quantity: wholesaleEnabled && supplyCapacityQuantity !== '' ? Number(supplyCapacityQuantity) : null,
                supply_capacity_period: wholesaleEnabled ? supplyCapacityPeriod : null,
                wholesale_deposit_mode: wholesaleEnabled ? wholesaleDepositMode : 'quote_based',
                wholesale_deposit_percent: wholesaleEnabled && wholesaleDepositPercent !== '' ? Number(wholesaleDepositPercent) : null,
                wholesale_balance_due: wholesaleEnabled ? wholesaleBalanceDue : 'before_delivery',
                safepay_mobile_money_enabled: wholesaleEnabled ? Boolean(safePayMethods.mobile_money) : true,
                safepay_bank_transfer_enabled: wholesaleEnabled ? Boolean(safePayMethods.bank_transfer) : true,
                safepay_wallet_enabled: wholesaleEnabled ? Boolean(safePayMethods.wallet) : true,
                safepay_card_enabled: wholesaleEnabled ? Boolean(safePayMethods.card) : false,
                pricing_tiers: wholesaleEnabled ? cleanPricingTiers : [],
                lead_time_tiers: wholesaleEnabled ? cleanLeadTimeTiers : [],
                packaging_details: wholesaleEnabled ? cleanPackagingDetails : [],
                customization_options: wholesaleEnabled ? cleanCustomizationOptions : [],
                product_specifications: wholesaleEnabled ? cleanProductSpecifications : [],
                product_detail_sections: step === 'physical' ? cleanProductDetailSections : [],
                refund_policy: step === 'physical' ? effectiveRefundPolicy : undefined,
                refund_window_days: step === 'physical' && effectiveRefundPolicy !== 'final_sale' && effectiveRefundWindowDays !== '' && effectiveRefundWindowDays !== null ? Number(effectiveRefundWindowDays) : null,
                refund_policy_note: step === 'physical' ? String(effectiveRefundPolicyNote || '').trim() || null : null,
                faqs: step === 'physical' ? cleanProductFaqs : [],
                product_certificate_ids: step === 'physical'
                    ? selectedProductCertificateIds
                        .map((id) => Number(id))
                        .filter((id) => productCertificates.some((certificate) => Number(certificate.id) === id))
                    : [],
                has_variants: step === 'physical' ? hasVariants : false,
                variants: publishVariants.map((variant, index) => ({
                    name: variant.name,
                    sku: variant.sku || null,
                    price: wholesaleOnly ? 0 : (variant.price !== '' ? Number(variant.price) : null),
                    compare_price: wholesaleOnly ? null : (variant.compare_price !== '' ? Number(variant.compare_price) : null),
                    quantity: requiresLocationInventory ? Number(variant.quantity || 0) : 99999,
                    attributes: variant.attributes || {},
                    swatch_image_url: variant.swatch_image_url || null,
                    is_active: true,
                    sort_order: index,
                    location_inventories: requiresLocationInventory ? (variant.location_inventories || {}) : {},
                })),
                location_inventories: requiresLocationInventory ? locationInventories : {},
                title: manualTitle,
                category: manualCategory,
                category_id: selectedCategoryId ? Number(selectedCategoryId) : null,
                sub_category_id: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
                brand_id: selectedBrandId ? Number(selectedBrandId) : null,
                model_id: selectedModelId ? Number(selectedModelId) : null,
                attribute_values: facetAttributesForForm.map((attr) => {
                    const current = dynamicAttributeValues[attr.id] || {};
                    return {
                        category_attribute_id: attr.id,
                        value_text: ['text', 'textarea', 'select', 'date'].includes(attr.input_type) ? (current.value_text || '') : null,
                        value_number: attr.input_type === 'number' && current.value_number !== '' ? Number(current.value_number) : null,
                        value_boolean: attr.input_type === 'boolean' ? !!current.value_boolean : null,
                        value_json: attr.input_type === 'select'
                            ? ((current.value_text || '').trim() ? [current.value_text] : [])
                            : attr.input_type === 'multiselect'
                                ? (Array.isArray(current.value_json) ? current.value_json : [])
                                : attr.input_type === 'number' && attr.ui_hint === 'number_with_unit'
                                    ? { unit: defaultUnitForAttribute(attr, current) || null }
                                    : (Array.isArray(current.value_json) ? current.value_json : []),
                    };
                }),
                description: description, // Include description in the payload
                product_id: productId,
                shipping_profile_id: selectedShippingProfileId ? Number(selectedShippingProfileId) : null,
                delivery_promise_override_enabled: deliveryPromiseOverrideEnabled,
                delivery_handling_min_days: deliveryPromiseOverrideEnabled ? (deliveryPromise.handling_min_days || null) : null,
                delivery_handling_max_days: deliveryPromiseOverrideEnabled ? (deliveryPromise.handling_max_days || null) : null,
                delivery_transit_min_days: deliveryPromiseOverrideEnabled ? (deliveryPromise.transit_min_days || null) : null,
                delivery_transit_max_days: deliveryPromiseOverrideEnabled ? (deliveryPromise.transit_max_days || null) : null,
                delivery_cutoff_time: deliveryPromiseOverrideEnabled && showDeliveryPromiseCutoff ? (deliveryPromise.cutoff_time || null) : null,
                delivery_business_days_only: deliveryPromise.business_days_only,
                delivery_promise_label: deliveryPromiseOverrideEnabled ? (deliveryPromise.label || null) : null,
                delivery_promise_note: deliveryPromiseOverrideEnabled ? (deliveryPromise.note || null) : null,
                delivery_requires_confirmation: deliveryPromiseOverrideEnabled && deliveryPromise.requires_confirmation,
                access_group_type: step === 'digital' ? assignedAccessGroup?.type || null : null,
                access_group_id: step === 'digital' ? assignedAccessGroup?.id || null : null,
            });

            const data = res.data;

            toast.success(data.message || 'Tayari! Bidhaa imewekwa sokoni kikamilifu.', { id: 'publish' });
            setTimeout(() => {
                resetForm();
                if (merchantUsername || data.merchantUsername) {
                    window.location.href = `/merchant/${merchantUsername || data.merchantUsername}/dashboard`;
                } else {
                    window.location.href = '/merchant/dashboard'; // fallback
                }
            }, 1500);

        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Imeshindwa kuweka bidhaa.';
            toast.error(msg, { id: 'publish' });
        }
    };

    const submitManual = async () => {
        if (!manualTitle) {
            toast.error('Tafadhali weka jina la bidhaa.');
            return;
        }
        if (isFocusedPhysicalModule) {
            setAiResult({ category: activeUploadModule?.title || 'Bidhaa maalum', sub_category: '', colors: [], suggested_description_swahili: manualTitle });
            setShowManualForm(false);
            setManualStepCompleted(true);
            setPhysicalFlowStep(3);
            return;
        }
        if (variantAxisAttributes.length > 0 && variantDecision === null) {
            toast.error('Chagua kama bidhaa ina variants au la.');
            return;
        }
        toast.loading('Inaunda bidhaa...', { id: 'manual-draft' });
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/upload/manual`, {
                title: manualTitle,
                category: manualCategory,
                category_id: selectedCategoryId ? Number(selectedCategoryId) : null,
                sub_category_id: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
                ...buildMediaPayload(),
            });
            const data = res.data;
            if (data.product_id) {
                setProductId(data.product_id);
            }
            toast.success(data.message, { id: 'manual-draft' });
            setAiResult({ category: manualCategory, sub_category: '', colors: [], suggested_description_swahili: manualTitle });
            setShowManualForm(false);
            setManualStepCompleted(true);
            setPhysicalFlowStep(3);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Imeshindwa kuunda bidhaa.';
            toast.error(msg, { id: 'manual-draft' });
        }
    };


    const resetForm = () => {
        setStep('select');
        setImages([]);
        setCurrentImageIndex(0);
        setHotspots({});
        setAiResult(null);
        setProductType('physical');
        setUrl('');
        setDigitalFile(null);
        setPaidVideoFile(null);
        setPaidAudioFile(null);
        setPaidGalleryItems([]);
        setLiveEventStartsAt('');
        setLiveEventDurationMinutes('90');
        setLiveEventTimezone(merchantTimezone || 'Africa/Dar_es_Salaam');
        setLiveEventAccessUrl('');
        setLiveEventVenue('');
        setLiveEventCapacity('');
        setLiveEventReplayUrl('');
        setLiveEventInstructions('');
        setAllowDigitalDownload(false);
        setDigitalDeliveryMode('upload');
        setDigitalContentType('file');
        setDigitalUsageLicense('personal');
        setDigitalAccessInstructions('');
        setSoftwareReleases([]);
        setReleaseForm({ version: '', title: '', changelog: '', file: null });
        setReleaseUploading(false);
        setReleaseSaving(false);
        setLicenseKeyEnabled(false);
        setLicenseKeyPrefix('');
        setLicenseActivationLimit('1');
        setSoftwareLicenseKeys([]);
        setSoftwareLicenseAnalytics(null);
        setLicenseKeyBusy(null);
        setSoftwareProductSlug('');
        setServiceBookingMode('internal');
        setServiceContactType('whatsapp');
        setServiceContactValue('');
        setServicePricingModel('fixed_price');
        setServiceBookingType('instant');
        setServiceHourlyRate('');
        setServiceMinHours('1');
        setServiceDepositAmount('');
        setServiceIsShowcase(false);
        setServiceMode('pay_now');
        setServiceSchedulingType('none');
        setServiceCategory('');
        setServiceSubcategory('');
        setServicePriceDisplay('fixed');
        setServiceCharges([]);
        setServiceOptions([]);
        setServiceTemplateKey('');
        setServiceDetails({});
        setServiceDurationValue('');
        setServiceDurationUnit('minutes');
        setServiceLocationType('provider_location');
        setServiceProviderLocation(null);
        setServiceAreas([]);
        setServiceAreaDraft('');
        setServiceClientRequirements('');
        setServiceIntakeForm([]);
        setServiceRelatedProductIds([]);
        setServiceBookingProvider('manual');
        setPrice('');
        setComparePrice('');
        setShowComparePrice(false);
        setAutoPostTargets({
            takeer: true,
            instagram: false,
            facebook: false,
            x: false,
        });
        setSellingStyle('retail');
        setPricingTiers([{ min_quantity: '', max_quantity: '', unit_price: '', label: '' }]);
        setLeadTimeTiers([{ min_quantity: '', max_quantity: '', lead_time_days: '', label: '' }]);
        setPackagingDetails([{ selling_units: '', package_quantity: '', package_unit: '', package_weight_kg: '', package_length_cm: '', package_width_cm: '', package_height_cm: '', notes: '' }]);
        setCustomizationOptions([{ name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' }]);
        setProductSpecifications([{ group_name: '', attribute_name: '', attribute_value: '', is_filterable: true }]);
        setProductDetailSections([{ section_type: 'text', title: '', body: '', image_url: '', is_visible: true }]);
        setSupplyCapacityQuantity('');
        setSupplyCapacityPeriod('month');
        setWholesaleDepositMode('quote_based');
        setWholesaleDepositPercent('');
        setWholesaleBalanceDue('before_delivery');
        setSafePayMethods({ mobile_money: true, bank_transfer: true, wallet: true, card: false });
        setQuantity('');
        setLocationInventories({});
        setAvailabilityLocationIds([]);
        setFulfillmentMode('own_stock');
        setSourceDetails({ supplier_name: '', supplier_phone: '', supplier_location: '', confirmation_hours: '', source_note: '' });
        setAvailabilityLeadTimeDays('');
        setAvailableFrom('');
        setGroupSaleGoalQuantity('');
        setGroupSaleDeadline('');
        setDescription(''); // Reset description
        setErrorDetail(null);
        setShowManualForm(false);
        setManualStepCompleted(false);
        setManualTitle('');
        setManualCategory(CATEGORIES[0]);
        setProductId(null);
        setUploadModule(null);
        setMenuDetails({
            section: 'Main menu',
            item_type: 'food',
            prep_time_minutes: '',
            dietary_tags: [],
            availability: ['dine_in', 'pickup'],
            add_ons: [],
        });
        setRoomDetails({
            room_type: 'Standard room',
            bed_type: 'Double bed',
            max_guests: 2,
            room_count: 1,
            bathrooms: '',
            checkin_time: '14:00',
            checkout_time: '10:00',
            amenities: [],
            availability: ['available'],
            booking_policy: 'manual_confirm',
        });
        setAssignedAccessGroup(null);
        setDigitalAccessTab('plan');
        setSelectedCategoryId('');
        setSelectedSubCategoryId('');
        setSelectedCatalogSchema(null);
        setSelectedBrandId('');
        setSelectedModelId('');
        setDynamicAttributeValues({});
        setHasVariants(false);
        setVariantDecision(null);
        setPhysicalFlowStep(1);
        setVariants([]);
    };

    const handleImageClick = (e) => {
        if (!imageContainerRef.current) return;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingHotspot({ x, y });
        setHotspotType('product');
        setHotspotData('');
        setShowHotspotModal(true);
    };

    const syncHotspotsToBackend = async (imageIndex, updatedHotspots) => {
        if (!productId) return;
        try {
            await axios.post(`/merchant/${merchantUsername}/products/${productId}/hotspots`, {
                image_index: imageIndex,
                hotspots: updatedHotspots
            });
        } catch (err) {
            console.error('Failed to sync hotspots', err);
            toast.error('Imeshindwa kusawazisha alama.');
        }
    };

    const saveHotspot = () => {
        if (!hotspotData.trim()) {
            toast.error('Tafadhali jaza taarifa za hotspot.');
            return;
        }
        const newHotspot = {
            id: Date.now().toString(),
            x: pendingHotspot.x,
            y: pendingHotspot.y,
            type: hotspotType,
            data: hotspotData,
        };
        const currentList = hotspots[currentImageIndex] || [];
        const nextList = [...currentList, newHotspot];

        setHotspots({
            ...hotspots,
            [currentImageIndex]: nextList
        });

        syncHotspotsToBackend(currentImageIndex, nextList);

        setShowHotspotModal(false);
        setPendingHotspot(null);
    };

    const removeHotspot = (indexToRemove) => {
        const currentList = hotspots[currentImageIndex] || [];
        const nextList = currentList.filter((_, idx) => idx !== indexToRemove);

        setHotspots({
            ...hotspots,
            [currentImageIndex]: nextList
        });

        syncHotspotsToBackend(currentImageIndex, nextList);
    };

    // ─── RENDERING HELPERS ───
    if (isLoadingEdit) {
        return (
            <AppLayout>
                <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
                    <p className="font-bold text-muted-foreground">Inapakia taarifa za bidhaa...</p>
                </div>
            </AppLayout>
        );
    }

    if (step === 'service_modules') {
        return (
            <AppLayout>
                <Head title="Chagua Aina ya Huduma | Takeer" />
                <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setStep('select')}
                            className="h-10 w-10 bg-accent rounded-full flex items-center justify-center hover:bg-accent/80 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Chagua aina ya huduma</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Chagua muundo unaofanana na huduma unayotaka kuweka.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {SERVICE_MODULE_PICKER.map((module) => {
                            const Icon = module.icon;
                            const toneClass = MODULE_TONE_CLASSES[module.tone] || MODULE_TONE_CLASSES.slate;

                            return (
                                <button
                                    key={module.key}
                                    type="button"
                                    onClick={() => handleModuleSelect(module.key)}
                                    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${toneClass}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="text-base font-black text-slate-950">{module.title}</h2>
                                            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{module.description}</p>
                                        </div>
                                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-black text-slate-950">Tengeneza huduma ya kawaida</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    Tumia fomu ya kawaida kama hakuna aina hapo juu inayofanana na huduma yako.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={handleCustomServiceSelect}
                                className="h-11 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Huduma ya kawaida
                            </Button>
                        </div>
                    </div>

                    <PolicyNotice />
                </div>
            </AppLayout>
        );
    }

    if (step === 'select') {
        return (
            <AppLayout>
                <Head title={uploadModule === 'menu' ? 'Ongeza Menu Item | Takeer' : 'Chagua Aina ya Bidhaa | Takeer'} />
                <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 pb-24">
                    <div className="flex flex-col items-center justify-center space-y-6">
                        {/* ── Merchant Identity ── */}
                        <div className="flex flex-col items-center gap-2 mt-4">
                            {currentMerchant.avatar_url ? (
                                <img
                                    src={currentMerchant.avatar_url}
                                    alt={currentMerchant.display_name}
                                    className="h-20 w-20 rounded-full object-cover ring-4 ring-brand-100 shadow-md p-1.5"
                                />
                            ) : (
                                <div className="h-20 w-20 rounded-full bg-brand-50 flex items-center justify-center ring-4 ring-brand-100 shadow-md">
                                    <Store className="h-10 w-10 text-brand-600" />
                                </div>
                            )}
                            <div className="text-center">
                                <p className="font-black text-lg text-foreground">{currentMerchant.display_name || currentMerchant.username || 'Biashara Yangu'}</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">@{currentMerchant.username || 'biasharayangu'}</p>
                            </div>
                        </div>

                        {/* ── Title ── */}
                        <div className="text-center space-y-2">
                            <h1 className="text-3xl font-black tracking-tight flex items-center justify-center gap-2">
                                {uploadModule === 'menu' ? 'Ongeza nini kwenye menu?' : 'Unataka uuze nini leo?'} <Sparkles className="h-6 w-6 text-brand-600" />
                            </h1>
                            <p className="text-muted-foreground">{uploadModule === 'menu' ? 'Tumia product flow kuongeza chakula, kinywaji, add-on, au combo.' : 'Chagua aina ya bidhaa.'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => handleTypeSelect('physical')}
                            className="group relative flex items-center gap-6 p-6 bg-white border border-border rounded-[1rem] hover:border-brand-500 hover:ring-4 hover:ring-brand-500/10 transition-all text-left shadow-sm"
                        >
                            <div className="h-16 w-16 bg-brand-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <ShoppingBag className="h-8 w-8 text-brand-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{uploadModule === 'menu' ? 'Menu Item' : 'Bidhaa ya Kushikika'}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{uploadModule === 'menu' ? 'Chakula, kinywaji, combo, add-on, au bidhaa ya mgahawa.' : 'Nguo, viatu, simu, n.k. (Inatumia AI na Hotspots)'}</p>
                            </div>
                            <ChevronRight className="h-6 w-6 ml-auto text-muted-foreground opacity-50 text-brand-600" />
                        </button>

                        <button
                            onClick={() => handleTypeSelect('digital')}
                            className="group relative flex items-center gap-6 p-6 bg-white border border-border rounded-[1rem] hover:border-blue-500 hover:ring-4 hover:ring-blue-500/10 transition-all text-left shadow-sm"
                        >
                            <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <DownloadCloudIcon className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Bidhaa ya Digitali (Downloads)</h3>
                                <p className="text-sm text-muted-foreground mt-1">Vitabu, Video, Audio/Sauti, Picha, au Link ya kupakua.</p>
                            </div>
                            <ChevronRight className="h-6 w-6 ml-auto text-muted-foreground opacity-50 group-hover:text-blue-600" />
                        </button>

                        <button
                            onClick={() => handleTypeSelect('service')}
                            className="group relative flex items-center gap-6 p-6 bg-white border border-border rounded-[1rem] hover:border-purple-500 hover:ring-4 hover:ring-purple-500/10 transition-all text-left shadow-sm"
                        >
                            <div className="h-16 w-16 bg-purple-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Calendar className="h-8 w-8 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Huduma / Miadi</h3>
                                <p className="text-sm text-muted-foreground mt-1">Saluni, ushauri, booking, au mafunzo ya ana kwa ana.</p>
                            </div>
                            <ChevronRight className="h-6 w-6 ml-auto text-muted-foreground opacity-50 group-hover:text-purple-600" />
                        </button>
                    </div>

                    <PolicyNotice />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={uploadModule === 'menu' ? 'Weka Menu Item | Takeer' : 'Weka Bidhaa Mpya | Takeer'} />

            <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={handleUploadBack}
                        className="h-10 w-10 bg-accent rounded-full flex items-center justify-center hover:bg-accent/80 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2">
                            {step === 'physical' ? (uploadModule === 'menu' ? 'Menu Item Mpya' : 'Bidhaa Mpya') : step === 'digital' ? 'Bidhaa ya Digital' : 'Huduma Mpya'}
                        </h1>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                            {(step || '').toUpperCase()} FLOW
                        </p>
                    </div>
                </div>

                {/* ── SECTIONS BASED ON PROTYPE ── */}

                {/* ── SHARED MEDIA SECTION: Sequential Gallery ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{uploadModule === 'menu' ? 'Media za Menu Item' : 'Media za Bidhaa'}</label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                className="group relative aspect-[4/5] bg-accent rounded-[1.5rem] overflow-hidden border-2 border-transparent hover:border-brand-500 transition-all cursor-pointer shadow-sm"
                                onClick={() => openHotspotEditor(idx)}
                            >
                                {isVideoMedia(img) ? (
                                    <>
                                        <video src={img.localUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="h-11 w-11 rounded-full bg-black/55 flex items-center justify-center">
                                                <PlayCircle className="h-6 w-6 text-white" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <img src={img.localUrl} alt={`Media ${idx + 1}`} className="w-full h-full object-cover" />
                                )}

                                {img.isUploading && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10 transition-all duration-300">
                                        <div className="h-10 w-10 relative mb-2">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                                                <circle
                                                    cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10"
                                                    strokeDasharray={`${(img.progress || 0) * 2.83} 283`}
                                                    strokeLinecap="round" className="text-brand-400 transition-all duration-300"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[10px] font-bold">{img.progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                    <div className="flex items-center gap-1.5 text-white">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{isVideoMedia(img) ? 'Video ya feed/post' : 'Gusa kuweka Hotspot'}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter((_, i) => i !== idx)); }}
                                    className="absolute top-2 right-2 h-7 w-7 bg-white/90 backdrop-blur text-red-600 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 active:scale-95 z-20"
                                >
                                    <X className="h-4 w-4" />
                                </button>

                                {hotspots[idx]?.length > 0 && (
                                    <div className="absolute bottom-2 right-2 h-6 w-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                                        {hotspots[idx].length}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* The "Add Next" Slot */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-[4/5] bg-brand-50/50 border-2 border-dashed border-brand-200 rounded-[1.5rem] flex flex-col items-center justify-center gap-3 hover:bg-brand-50 hover:border-brand-400 transition-all cursor-pointer group"
                        >
                            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-brand-600">
                                <Plus className="h-6 w-6" />
                            </div>
                            <div className="text-center px-2">
                                <span className="text-[11px] font-black text-brand-900 block uppercase tracking-wider">Ongeza Media</span>
                                <span className="text-[9px] text-brand-600 font-bold opacity-60">Slot {images.length + 1}</span>
                            </div>
                            <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageSelect}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic font-medium px-1">Tip: Click an image to add interactive hotspots. Videos will appear as playable media on post details.</p>
                </div>

                {step === 'physical' && (
                    <>
                        <div className="text-center">
                            <button
                                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors"
                                onClick={() => setShowManualForm(true)}
                            >
                                <PenLine className="h-4 w-4" />
                                Au ingiza maelezo mwenyewe bila picha
                            </button>
                        </div>

                        {showManualForm && (
                            <Card className="animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-amber-50 p-4 border-b flex items-center gap-2 text-amber-800">
                                    <PenLine className="h-5 w-5" />
                                    <h3 className="font-bold">Ingiza Maelezo Mwenyewe</h3>
                                </div>
                                <CardContent className="p-5 space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{uploadModule === 'menu' ? 'Jina la Menu Item' : 'Jina la Bidhaa'}</label>
                                        <Input
                                            placeholder={uploadModule === 'menu' ? 'Mf. Pilau ya Kuku' : 'Mf. Viatu vya Ngozi Nyekundu'}
                                            value={manualTitle}
                                            onChange={e => setManualTitle(e.target.value)}
                                            className="h-12"
                                        />
                                    </div>
                                    {showGenericPhysicalCatalog && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategoria</label>
                                            <select
                                                className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={selectedCategoryId}
                                                onChange={async (e) => onSelectRootCategory(e.target.value)}
                                            >
                                                <option value="">Chagua kategoria</option>
                                                {(catalogCategories || []).map((category) => (
                                                    <option key={category.id} value={category.id}>{categoryDisplayName(category)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {showGenericPhysicalCatalog && selectedSubCategories.length > 0 && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subcategory</label>
                                            <select
                                                className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={selectedSubCategoryId}
                                                onChange={async (e) => onSelectSubCategory(e.target.value)}
                                            >
                                                <option value="">Hakuna subcategory maalum</option>
                                                {selectedSubCategories.map((child) => (
                                                    <option key={child.id} value={child.id}>{categoryDisplayName(child)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {showGenericPhysicalCatalog && variantAxisAttributes.length > 0 && (
                                        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Variants Setup</p>
                                                <p className="text-sm text-slate-700">
                                                    Je, una bidhaa hii nyingine unayouza yenye utofauti wa {variantAxisAttributes.map((axis) => axis.label).join(' / ')}?
                                                </p>
                                                <p className="text-xs leading-5 text-slate-500">
                                                    Kama ni brand, aina, harufu, formula, au bidhaa tofauti, iweke kama bidhaa nyingine.
                                                </p>
                                            </div>
                                            <div className="grid sm:grid-cols-2 gap-2">
                                                <Button
                                                    type="button"
                                                    variant={variantDecision === 'single' ? 'default' : 'outline'}
                                                    className={variantDecision === 'single' ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''}
                                                    onClick={() => {
                                                        setVariantDecision('single');
                                                        setHasVariants(false);
                                                        setVariants([]);
                                                    }}
                                                >
                                                    Hapana, ni bidhaa moja
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={variantDecision === 'multi' ? 'default' : 'outline'}
                                                    className={variantDecision === 'multi' ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''}
                                                    onClick={() => {
                                                        setVariantDecision('multi');
                                                        setHasVariants(true);
                                                        if (variants.length === 0) generateVariantsFromFacets();
                                                    }}
                                                >
                                                    Ndio, bidhaa ile ile ina variants
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="flex-1" onClick={() => setShowManualForm(false)}>Rudi</Button>
                                        <Button
                                            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white"
                                            onClick={submitManual}
                                            disabled={variantAxisAttributes.length > 0 && variantDecision === null}
                                        >
                                            Endelea
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {(images.length > 0 || aiResult) && manualStepCompleted && (
                            <div className="animate-in fade-in slide-in-from-top-4 space-y-6">
                                <Card className="border-slate-200 shadow-sm overflow-hidden rounded-[2rem]">
                                    <div className="bg-slate-50 p-4 border-b flex items-center gap-2 text-slate-800">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <h3 className="font-bold uppercase tracking-widest text-xs">{isMenuUpload ? 'Menu setup' : 'Facets & Specifications'}</h3>
                                    </div>
                                    <CardContent className="p-5 space-y-4">
                                        {showGenericPhysicalCatalog && (
                                            <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-wider text-brand-900">Product setup</p>
                                                        <p className="text-xs text-brand-700">Badilisha jina, category, au subcategory bila kurudi mwanzo.</p>
                                                    </div>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jina la Bidhaa</label>
                                                        <Input
                                                            placeholder="Mf. Sukari kilo 50"
                                                            value={manualTitle}
                                                            onChange={e => setManualTitle(e.target.value)}
                                                            className="h-12"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategoria</label>
                                                        <select
                                                            className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                            value={selectedCategoryId}
                                                            onChange={async (e) => onSelectRootCategory(e.target.value, { stayOnDetails: true })}
                                                        >
                                                            <option value="">Chagua kategoria</option>
                                                            {(catalogCategories || []).map((category) => (
                                                                <option key={category.id} value={category.id}>{categoryDisplayName(category)}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subcategory</label>
                                                        <select
                                                            className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                            value={selectedSubCategoryId}
                                                            onChange={async (e) => onSelectSubCategory(e.target.value, { stayOnDetails: true })}
                                                            disabled={selectedSubCategories.length === 0}
                                                        >
                                                            <option value="">Hakuna subcategory maalum</option>
                                                            {selectedSubCategories.map((child) => (
                                                                <option key={child.id} value={child.id}>{categoryDisplayName(child)}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {showGenericPhysicalCatalog && variantAxisAttributes.length > 0 && (
                                            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Variants Setup</p>
                                                    <p className="text-sm text-slate-700">
                                                        Je, una bidhaa hii nyingine unayouza yenye utofauti wa {variantAxisAttributes.map((axis) => axis.label).join(' / ')}?
                                                    </p>
                                                    <p className="text-xs leading-5 text-slate-500">
                                                        Kama ni brand, aina, harufu, formula, au bidhaa tofauti, iweke kama bidhaa nyingine.
                                                    </p>
                                                </div>
                                                <div className="grid sm:grid-cols-2 gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={variantDecision === 'single' ? 'default' : 'outline'}
                                                        className={variantDecision === 'single' ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''}
                                                        onClick={() => {
                                                            setVariantDecision('single');
                                                            setHasVariants(false);
                                                            setVariants([]);
                                                        }}
                                                    >
                                                        Hapana, ni bidhaa moja
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={variantDecision === 'multi' ? 'default' : 'outline'}
                                                        className={variantDecision === 'multi' ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''}
                                                        onClick={() => {
                                                            setVariantDecision('multi');
                                                            setHasVariants(true);
                                                            if (variants.length === 0) generateVariantsFromFacets();
                                                        }}
                                                    >
                                                        Ndio, bidhaa ile ile ina variants
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {showGenericPhysicalCatalog && selectedSchemaBrands.length > 0 && (
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand</label>
                                                    <select
                                                        className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                        value={selectedBrandId}
                                                        onChange={(e) => {
                                                            setSelectedBrandId(e.target.value);
                                                            setSelectedModelId('');
                                                        }}
                                                    >
                                                        <option value="">Chagua brand</option>
                                                        {selectedSchemaBrands.map((brand) => (
                                                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {selectedSchemaModels.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Model</label>
                                                        <select
                                                            className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                            value={selectedModelId}
                                                            onChange={(e) => setSelectedModelId(e.target.value)}
                                                        >
                                                            <option value="">Chagua model</option>
                                                            {selectedSchemaModels.map((model) => (
                                                                <option key={model.id} value={model.id}>{model.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {showGenericPhysicalCatalog && facetAttributesForForm.length > 0 && (
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                {facetAttributesForForm.map((attr) => {
                                                    const current = dynamicAttributeValues[attr.id] || {};
                                                    return (
                                                        <div key={attr.id} className="space-y-1.5">
                                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                                {attr.label}{attr.is_required ? ' *' : ''}
                                                            </label>
                                                            {attr.input_type === 'select' ? (
                                                                <select
                                                                    className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                                    value={current.value_text || ''}
                                                                    onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                        ...prev,
                                                                        [attr.id]: { ...current, value_text: e.target.value },
                                                                    }))}
                                                                >
                                                                    <option value="">Select option</option>
                                                                    {(attr.options || []).map((option) => (
                                                                        <option key={option} value={option}>{option}</option>
                                                                    ))}
                                                                </select>
                                                            ) : attr.input_type === 'multiselect' ? (
                                                                <div className="min-h-12 rounded-xl border border-input bg-background p-2">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {(attr.options || []).map((option) => {
                                                                            const selected = Array.isArray(current.value_json) && current.value_json.includes(option);
                                                                            return (
                                                                                <button
                                                                                    type="button"
                                                                                    key={option}
                                                                                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}
                                                                                    onClick={() => setDynamicAttributeValues((prev) => {
                                                                                        const existing = Array.isArray(current.value_json) ? current.value_json : [];
                                                                                        return {
                                                                                            ...prev,
                                                                                            [attr.id]: {
                                                                                                ...current,
                                                                                                value_json: selected
                                                                                                    ? existing.filter((value) => value !== option)
                                                                                                    : [...existing, option],
                                                                                            },
                                                                                        };
                                                                                    })}
                                                                                >
                                                                                    {option}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : attr.input_type === 'boolean' ? (
                                                                <label className="h-12 rounded-xl border border-input bg-background px-3 text-sm flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!current.value_boolean}
                                                                        onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                            ...prev,
                                                                            [attr.id]: { ...current, value_boolean: e.target.checked },
                                                                        }))}
                                                                    />
                                                                    Yes
                                                                </label>
                                                            ) : attr.input_type === 'number' && attr.ui_hint === 'number_with_unit' ? (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        value={current.value_number ?? ''}
                                                                        onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                            ...prev,
                                                                            [attr.id]: { ...current, value_number: e.target.value },
                                                                        }))}
                                                                        placeholder={attr.key}
                                                                        className="h-12 col-span-2"
                                                                    />
                                                                    <select
                                                                        className="h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                                        value={defaultUnitForAttribute(attr, current)}
                                                                        onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                            ...prev,
                                                                            [attr.id]: { ...current, value_unit: e.target.value },
                                                                        }))}
                                                                    >
                                                                        {(attr.unit_options || []).length === 0 && <option value="">Unit</option>}
                                                                        {(attr.unit_options || []).map((unit) => (
                                                                            <option key={unit} value={unit}>{unit}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ) : attr.input_type === 'textarea' ? (
                                                                <Textarea
                                                                    value={current.value_text || ''}
                                                                    onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                        ...prev,
                                                                        [attr.id]: { ...current, value_text: e.target.value },
                                                                    }))}
                                                                    placeholder={attr.key}
                                                                    className="min-h-[96px]"
                                                                />
                                                            ) : attr.input_type === 'date' ? (
                                                                <Input
                                                                    type="date"
                                                                    value={current.value_text || ''}
                                                                    onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                        ...prev,
                                                                        [attr.id]: { ...current, value_text: e.target.value },
                                                                    }))}
                                                                    className="h-12"
                                                                />
                                                            ) : (
                                                                <Input
                                                                    type={attr.input_type === 'number' ? 'number' : 'text'}
                                                                    value={attr.input_type === 'number' ? (current.value_number ?? '') : (current.value_text || '')}
                                                                    onChange={(e) => setDynamicAttributeValues((prev) => ({
                                                                        ...prev,
                                                                        [attr.id]: attr.input_type === 'number'
                                                                            ? { ...current, value_number: e.target.value }
                                                                            : { ...current, value_text: e.target.value },
                                                                    }))}
                                                                    placeholder={attr.key}
                                                                    className="h-12"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {showGenericPhysicalCatalog && hasVariants && variantAxisAttributes.length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-500">
                                                    Weka taarifa ya {manualTitle} {variantAxisAttributes.map((axis) => axis.label).join(', ')} unazouza tu hapa chini.
                                                </p>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
                                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                                                        Mwonekano kwa mteja
                                                    </p>
                                                    {variantAxisAttributes.map((axis) => {
                                                        const optionCards = merchantVariantOptionPreview?.[axis.key] || [];
                                                        const hasSwatch = optionCards.some((entry) => !!entry.swatch);
                                                        return (
                                                            <div key={`preview-${axis.key}`} className="space-y-1.5">
                                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{axis.label}</p>
                                                                {hasSwatch ? (
                                                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                                                        {optionCards.map((entry) => (
                                                                            <div
                                                                                key={`${axis.key}-${entry.option}`}
                                                                                className={`w-28 shrink-0 rounded-xl border overflow-hidden ${entry.configured ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-100'}`}
                                                                            >
                                                                                <div className="h-16 bg-slate-100">
                                                                                    {entry.swatch ? (
                                                                                        <img src={entry.swatch} alt={entry.option} className="h-full w-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="h-full w-full flex items-center justify-center text-[10px] font-semibold text-slate-400">
                                                                                            No swatch
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="px-2 py-1.5">
                                                                                    <p className="text-xs font-bold truncate text-slate-800">{entry.option}</p>
                                                                                    {entry.configured ? (
                                                                                        <p className="text-[11px] text-slate-600">
                                                                                            TZS {Number(entry.price || 0).toLocaleString()} · Stock {Number(entry.stock || 0)}
                                                                                        </p>
                                                                                    ) : (
                                                                                        <p className="text-[10px] text-slate-500">Pending data</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {optionCards.map((entry) => (
                                                                            <span
                                                                                key={`${axis.key}-${entry.option}`}
                                                                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs border ${entry.configured ? 'border-slate-300 text-slate-700 bg-white' : 'border-dashed border-slate-300 text-slate-400 bg-slate-100'}`}
                                                                            >
                                                                                {entry.option}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {step === 'physical' && physicalDetailsReady && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Maelezo ya Bidhaa *</label>
                                                <Textarea
                                                    placeholder="Elezea bidhaa yako kwa kifupi: ubora, matumizi, faida, na maelezo muhimu kwa mnunuzi."
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    className="min-h-[110px] rounded-2xl bg-white border-border"
                                                    required
                                                />
                                            </div>
                                        )}

                                        {step === 'physical' && physicalDetailsReady && uploadModule === 'menu' && (
                                            <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 space-y-4">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-wider text-orange-800">Maelezo ya menu</p>
                                                    <p className="text-xs text-orange-700 mt-1">Maelezo haya yanaamua chakula au kinywaji kitaonekanaje kwenye menu kwa wateja.</p>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <label className="space-y-1.5">
                                                        <span className="text-[11px] font-semibold text-slate-700">Section</span>
                                                        <select
                                                            className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                                            value={menuDetails.section}
                                                            onChange={(e) => updateMenuDetail('section', e.target.value)}
                                                        >
                                                            {menuSections.map(section => <option key={section} value={section}>{section}</option>)}
                                                        </select>
                                                    </label>
                                                    <label className="space-y-1.5">
                                                        <span className="text-[11px] font-semibold text-slate-700">Item type</span>
                                                        <select
                                                            className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                                            value={menuDetails.item_type}
                                                            onChange={(e) => updateMenuDetail('item_type', e.target.value)}
                                                        >
                                                            {menuItemTypes.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
                                                        </select>
                                                    </label>
                                                    <label className="space-y-1.5">
                                                        <span className="text-[11px] font-semibold text-slate-700">Prep time</span>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="h-11 bg-white"
                                                            placeholder="Minutes"
                                                            value={menuDetails.prep_time_minutes}
                                                            onChange={(e) => updateMenuDetail('prep_time_minutes', e.target.value)}
                                                        />
                                                    </label>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="text-[11px] font-semibold text-slate-700">Available for</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {menuAvailabilityOptions.map(option => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                onClick={() => toggleMenuArrayValue('availability', option.key)}
                                                                className={`rounded-full border px-3 py-1.5 text-xs font-black ${menuDetails.availability.includes(option.key) ? 'border-orange-500 bg-white text-orange-700' : 'border-slate-200 bg-white/60 text-slate-500'}`}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="text-[11px] font-semibold text-slate-700">Tags</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {dietaryTagOptions.map(option => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                onClick={() => toggleMenuArrayValue('dietary_tags', option.key)}
                                                                className={`rounded-full border px-3 py-1.5 text-xs font-black ${menuDetails.dietary_tags.includes(option.key) ? 'border-emerald-500 bg-white text-emerald-700' : 'border-slate-200 bg-white/60 text-slate-500'}`}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[11px] font-semibold text-slate-700">Add-ons</p>
                                                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs font-bold bg-white" onClick={addMenuAddOn}>
                                                            <Plus className="h-3.5 w-3.5 mr-1" /> Add
                                                        </Button>
                                                    </div>
                                                    {(menuDetails.add_ons || []).length === 0 ? (
                                                        <p className="rounded-xl border border-dashed border-orange-200 bg-white/70 px-3 py-2 text-xs font-semibold text-orange-800">
                                                            Add-ons are optional, for example extra cheese, chips, sauce, or toppings.
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {menuDetails.add_ons.map((row, index) => (
                                                                <div key={index} className="grid grid-cols-[1fr_120px_36px] gap-2">
                                                                    <Input className="h-10 bg-white" placeholder="Add-on name" value={row.name || ''} onChange={(e) => updateMenuAddOn(index, 'name', e.target.value)} />
                                                                    <Input className="h-10 bg-white" type="number" min="0" placeholder="Price" value={row.price || ''} onChange={(e) => updateMenuAddOn(index, 'price', e.target.value)} />
                                                                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-lg" onClick={() => removeMenuAddOn(index)}>
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {showGenericPhysicalCatalog && physicalFlowStep >= 3 && hasVariants && (
                                            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                                <div className="space-y-3">
                                                    <div className="space-y-2">
                                                        {variants.map((variant, index) => (
                                                            <div key={variant.id || index} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                                                <VariantIdentityEditor
                                                                    variant={variant}
                                                                    index={index}
                                                                    setVariants={setVariants}
                                                                    variantAxisAttributes={variantAxisAttributes}
                                                                    generatedName={variantAttributeName(variant.attributes)}
                                                                    suggestions={variantSellingNameSuggestions(variant)}
                                                                />

                                                                <VariantCommerceFields
                                                                    variant={variant}
                                                                    index={index}
                                                                    setVariants={setVariants}
                                                                    wholesaleOnly={wholesaleOnly}
                                                                    requiresLocationInventory={requiresLocationInventory}
                                                                    physicalLocations={physicalLocations}
                                                                    stockStep={stockStep}
                                                                    openSwatchModal={openSwatchModal}
                                                                />

                                                                {variant.swatch_image_url && (
                                                                    <div className="flex items-center gap-2">
                                                                        <img src={variant.swatch_image_url} alt="swatch" className="h-8 w-8 rounded border border-slate-200 object-cover" />
                                                                        <Input
                                                                            className="h-10"
                                                                            placeholder="Swatch URL"
                                                                            value={variant.swatch_image_url}
                                                                            onChange={(e) => setVariants((prev) => prev.map((row, idx) => idx === index ? { ...row, swatch_image_url: e.target.value } : row))}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {isMenuUpload && physicalDetailsReady && (
                                    <Card className="border-orange-100 shadow-sm overflow-hidden rounded-[2rem]">
                                        <div className="bg-orange-50 p-4 border-b flex items-center gap-2 text-orange-800">
                                            <ShoppingBag className="h-5 w-5" />
                                            <h3 className="font-bold uppercase tracking-widest text-xs">Menu Pricing</h3>
                                        </div>
                                        <CardContent className="p-5 space-y-4">
                                            {renderWholesaleEditor()}
                                            {renderProductDetailSectionsEditor()}
                                            {retailPriceEnabled ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-orange-700 uppercase tracking-wider">Bei ya Reja Reja (TZS)</label>
                                                        <Input type="number" placeholder="Mf. 12000" className="h-12 text-lg font-black bg-white border-orange-200" value={price} onChange={e => setPrice(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bei ya awali</label>
                                                        <Input type="number" placeholder="Mf. 15000" className="h-12 text-lg font-black border-dashed bg-white" value={comparePrice} onChange={e => setComparePrice(e.target.value)} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs font-semibold leading-5 text-emerald-900">
                                                    Wholesale-only product. Bei ya mteja itatoka kwenye pricing tiers na proforma ya Takeer SafePay.
                                                </div>
                                            )}
                                            <PhysicalPublishPanel
                                                boxed={false}
                                                showShippingProfile={false}
                                                shippingProfiles={shippingProfiles}
                                                selectedShippingProfileId={selectedShippingProfileId}
                                                setSelectedShippingProfileId={setSelectedShippingProfileId}
                                                faqEditor={renderProductFaqEditor()}
                                                onPublish={publishProduct}
                                                disabledReason={physicalPublishDisabledReason}
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                                {showGenericPhysicalFulfillment && physicalFlowStep >= 3 && !hasVariants && (
                                    <Card className="border-brand-100 shadow-sm overflow-hidden rounded-[2rem]">
                                        <div className="bg-brand-50 p-4 border-b flex items-center gap-2 text-brand-800">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <h3 className="font-bold uppercase tracking-widest text-xs">Fulfillment, Stock & Pricing</h3>
                                        </div>
                                        <CardContent className="p-5 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {step === 'physical' && (
                                                    <PhysicalFulfillmentEditor
                                                        fulfillmentMode={fulfillmentMode}
                                                        setFulfillmentMode={setFulfillmentMode}
                                                        fulfillmentModeOptions={fulfillmentModeOptions}
                                                        selectedCatalogSchema={selectedCatalogSchema}
                                                        sourceDetails={sourceDetails}
                                                        updateSourceDetail={updateSourceDetail}
                                                        availabilityLeadTimeDays={availabilityLeadTimeDays}
                                                        setAvailabilityLeadTimeDays={setAvailabilityLeadTimeDays}
                                                        availabilityDateCopy={availabilityDateCopy}
                                                        availableFrom={availableFrom}
                                                        setAvailableFrom={setAvailableFrom}
                                                        groupSaleGoalQuantity={groupSaleGoalQuantity}
                                                        setGroupSaleGoalQuantity={setGroupSaleGoalQuantity}
                                                        groupSaleDeadline={groupSaleDeadline}
                                                        setGroupSaleDeadline={setGroupSaleDeadline}
                                                        requiresLocationInventory={requiresLocationInventory}
                                                        selectedFulfillmentMode={selectedFulfillmentMode}
                                                    />
                                                )}
                                                {renderPhysicalPackageEditor({ className: 'sm:col-span-2' })}
                                                {renderWholesaleEditor({ className: 'sm:col-span-2' })}
                                                <div className="sm:col-span-2">
                                                    {renderProductDetailSectionsEditor()}
                                                </div>
                                                {step === 'physical' && !hasVariants && requiresLocationInventory && (
                                                    <PhysicalStockEditor
                                                        physicalLocations={physicalLocations}
                                                        stockStep={stockStep}
                                                        stockUnitLabel={stockUnitLabel}
                                                        locationInventories={locationInventories}
                                                        setLocationInventories={setLocationInventories}
                                                        merchantUsername={merchantUsername}
                                                    />
                                                )}
                                            </div>
                                            <PhysicalPublishPanel
                                                shippingProfiles={shippingProfiles}
                                                selectedShippingProfileId={selectedShippingProfileId}
                                                setSelectedShippingProfileId={setSelectedShippingProfileId}
                                                deliveryPromiseOverride={renderDeliveryPromiseOverride()}
                                                faqEditor={renderProductFaqEditor()}
                                                onPublish={publishProduct}
                                                disabledReason={physicalPublishDisabledReason}
                                            >
                                                {retailPriceEnabled ? (
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-brand-600 uppercase tracking-wider">Bei ya Reja Reja (TZS)</label>
                                                            <Input type="number" placeholder="Mf. 35000" className="h-12 text-lg font-black bg-brand-50 border-brand-200" value={price} onChange={e => setPrice(e.target.value)} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs font-semibold leading-5 text-emerald-900">
                                                        Wholesale-only product. Bei ya mteja itatoka kwenye pricing tiers na proforma ya Takeer SafePay.
                                                    </div>
                                                )}
                                                {step === 'physical' && (
                                                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                                        <div>
                                                            <p className="text-xs font-black uppercase tracking-wider text-slate-700">Return policy</p>
                                                            <p className="text-xs text-slate-500">Hii itaonekana kwenye Product Details ili mteja ajue kabla ya kununua.</p>
                                                        </div>
                                                        {returnPolicies.length > 0 && (
                                                            <label className="space-y-1.5">
                                                                <span className="text-[11px] font-semibold text-slate-600">Saved policy</span>
                                                                <select
                                                                    className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
                                                                    value={selectedReturnPolicyId}
                                                                    disabled={useCustomReturnPolicy}
                                                                    onChange={(e) => setSelectedReturnPolicyId(e.target.value)}
                                                                >
                                                                    <option value="">Use merchant default</option>
                                                                    {returnPolicies.map((policy) => (
                                                                        <option key={policy.id} value={policy.id}>
                                                                            {policy.name}{policy.is_default ? ' (Default)' : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                        )}
                                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                            <input
                                                                type="checkbox"
                                                                checked={useCustomReturnPolicy}
                                                                onChange={(e) => setUseCustomReturnPolicy(e.target.checked)}
                                                            />
                                                            Custom policy for this product
                                                        </label>
                                                        {useCustomReturnPolicy ? (
                                                            <div className="grid gap-2 sm:grid-cols-3">
                                                                {[
                                                                    { key: 'standard', label: 'Return accepted', hint: 'Kwa bidhaa zinazoweza kurudishwa.' },
                                                                    { key: 'strict', label: 'Replacement only', hint: 'Damaged, wrong, or quality issue.' },
                                                                    { key: 'final_sale', label: 'Final sale', hint: 'Perishable/custom, isipokuwa kosa kubwa.' },
                                                                ].map((option) => (
                                                                    <button
                                                                        key={option.key}
                                                                        type="button"
                                                                        onClick={() => setRefundPolicy(option.key)}
                                                                        className={`rounded-xl border px-3 py-2 text-left ${refundPolicy === option.key ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 bg-white'}`}
                                                                    >
                                                                        <span className="block text-xs font-black text-slate-900">{option.label}</span>
                                                                        <span className="mt-1 block text-[10px] font-semibold leading-snug text-slate-500">{option.hint}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : selectedReturnPolicy ? (
                                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                                                                <span className="font-black">{selectedReturnPolicy.name}</span>: {selectedReturnPolicy.note || selectedReturnPolicy.policy}
                                                            </div>
                                                        ) : null}
                                                        {useCustomReturnPolicy && refundPolicy !== 'final_sale' && (
                                                            <label className="space-y-1.5">
                                                                <span className="text-[11px] font-semibold text-slate-600">Window days</span>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max="30"
                                                                    className="h-11 bg-white"
                                                                    value={refundWindowDays}
                                                                    onChange={(e) => setRefundWindowDays(e.target.value)}
                                                                    placeholder="Mf. 3"
                                                                />
                                                            </label>
                                                        )}
                                                        {useCustomReturnPolicy && (
                                                            <Textarea
                                                                className="min-h-20 rounded-xl bg-white mt-2"
                                                                value={refundPolicyNote}
                                                                onChange={(e) => setRefundPolicyNote(e.target.value)}
                                                                placeholder="Mf. Replacement ndani ya saa 72 kama bidhaa ni damaged, wrong, au sealed haijafunguliwa."
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </PhysicalPublishPanel>
                                        </CardContent>
                                    </Card>
                                )}

                                {step === 'physical' && physicalFlowStep >= 3 && hasVariants && (
                                    <Card className="border-brand-100 shadow-sm overflow-hidden rounded-[2rem]">
                                        <div className="bg-brand-50 p-4 border-b flex items-center gap-2 text-brand-800">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <h3 className="font-bold uppercase tracking-widest text-xs">Shipping & Variant Details</h3>
                                        </div>
                                        <CardContent className="p-5 space-y-3">
                                            {renderPhysicalPackageEditor({ compact: true })}
                                            {renderWholesaleEditor()}
                                            {renderProductDetailSectionsEditor()}
                                            {requiresLocationInventory && physicalLocations.length === 0 && (
                                                <MissingStockLocationNotice merchantUsername={merchantUsername} />
                                            )}
                                            <PhysicalPublishPanel
                                                boxed={false}
                                                summary={(
                                                    <p className="text-sm text-slate-600">
                                                        Configured variants: <span className="font-bold">{configuredPhysicalVariants.length}</span>
                                                        {requiresLocationInventory ? (
                                                            <> · Total stock: <span className="font-bold">{configuredVariantStockTotal}</span></>
                                                        ) : (
                                                            <> · Source mode: <span className="font-bold">{selectedFulfillmentMode.label}</span></>
                                                        )}
                                                    </p>
                                                )}
                                                shippingProfiles={shippingProfiles}
                                                selectedShippingProfileId={selectedShippingProfileId}
                                                setSelectedShippingProfileId={setSelectedShippingProfileId}
                                                deliveryPromiseOverride={renderDeliveryPromiseOverride()}
                                                faqEditor={renderProductFaqEditor()}
                                                onPublish={publishProduct}
                                                disabledReason={physicalPublishDisabledReason}
                                            />
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </>
                )}

                {(step === 'digital' || step === 'service') && (
                    <Card className="animate-in fade-in slide-in-from-bottom-8 overflow-hidden rounded-3xl border shadow-lg">
                        {/* Header */}
                        <div className={`p-4 sm:p-5 flex items-center gap-3 ${step === 'digital' ? 'bg-blue-600' : 'bg-purple-600'} text-white`}>
                            <div className="h-11 w-11 bg-white/20 rounded-2xl flex items-center justify-center">
                                {step === 'digital' ? <Globe className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-black">Taarifa za {step === 'digital' ? 'Digital' : 'Huduma'}</h2>
                                <p className="text-xs sm:text-sm opacity-80">Jaza maelezo kisha weka sokoni.</p>
                            </div>
                        </div>

                        <CardContent className="p-4 sm:p-5 space-y-5">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jina la {step === 'digital' ? 'Bidhaa' : 'Huduma'}</label>
                                <Input
                                    placeholder={step === 'digital' ? 'Mf. E-book ya Kupika' : 'Mf. Ushauri wa Biashara'}
                                    value={manualTitle} // Using manualTitle for consistency, could be a separate state if needed
                                    onChange={e => setManualTitle(e.target.value)}
                                    className="h-12 font-semibold text-base"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Maelezo Kamili</label>
                                <Textarea
                                    placeholder={step === 'digital' ? "Elezea kuhusu hii bidhaa, nini mteja atapata au kuna thamani gani mteja atafaidi..." : "Elezea huduma unayotoa, faida na maandalizi yoyote yenye thamani kwa mteja..."}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-[88px] rounded-2xl bg-white border-border"
                                    required
                                />
                            </div>


                            {/* ─── DIGITAL: product kind and delivery ─── */}
                            {step === 'digital' && (
                                <div className="space-y-3">
                                    <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Palette className="h-4 w-4 text-blue-700" />
                                                <div>
                                                    <label className="text-xs font-black text-blue-700 uppercase tracking-wider">
                                                        1. Unauza nini?
                                                    </label>
                                                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                                                        Chagua aina inayofanana zaidi. Takeer itaweka namna rahisi ya kumpa mteja bidhaa hii.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {digitalContentTypes.map((item) => {
                                                const ContentIcon = item.icon;
                                                const selected = digitalContentType === item.key;

                                                return (
                                                    <button
                                                        key={item.key}
                                                        type="button"
                                                        onClick={() => selectDigitalContentType(item)}
                                                        className={`min-h-[78px] rounded-2xl border px-3 py-3 text-left transition-all ${selected
                                                            ? 'border-blue-500 bg-white text-blue-700 shadow-sm ring-2 ring-blue-100'
                                                            : 'border-blue-100 bg-white/80 text-slate-600 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <ContentIcon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-slate-500'}`} />
                                                            <span className="text-xs font-black leading-tight">{item.label}</span>
                                                        </div>
                                                        <p className="mt-1.5 text-[10px] font-semibold leading-4 text-slate-500">
                                                            {item.description}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="rounded-2xl border border-blue-100 bg-white p-3">
                                            <div className="flex items-start gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                                    {React.createElement(selectedDigitalContentType.icon, { className: 'h-4 w-4' })}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">Picha / preview ya kuuza bidhaa</p>
                                                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                                                        {selectedDigitalContentType.previewHint}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {(digitalContentType === 'template_asset' || digitalContentType === 'creative_asset') && (
                                            <div className="grid sm:grid-cols-1 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ruhusa ya matumizi</label>
                                                    <select
                                                        value={digitalUsageLicense}
                                                        onChange={(e) => setDigitalUsageLicense(e.target.value)}
                                                        className="h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-bold"
                                                    >
                                                        {digitalLicenseOptions.map(option => (
                                                            <option key={option.key} value={option.key}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Maelekezo kwa mnunuzi</label>
                                                    <Textarea
                                                        value={digitalAccessInstructions}
                                                        onChange={(e) => setDigitalAccessInstructions(e.target.value)}
                                                        placeholder="Mf. unzip, duplicate template, install fonts first, then fungua faili la maelekezo..."
                                                        className="min-h-[96px] rounded-xl bg-white"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Mteja atapokea vipi?</label>
                                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                                                Tumechagua njia inayofaa kwa {selectedDigitalContentType.label}. Unaweza kubadilisha kama unahitaji.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => selectDigitalDeliveryMode('upload')}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'upload'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-border text-muted-foreground hover:border-blue-200'
                                                    }`}
                                            >
                                                <FileUp className="h-5 w-5" />
                                                <span className="text-[11px] font-bold">Pakia faili sasa</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectDigitalDeliveryMode('video_stream')}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'video_stream'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-border text-muted-foreground hover:border-blue-200'
                                                    }`}
                                            >
                                                <PlayCircle className="h-5 w-5" />
                                                <span className="text-[11px] font-bold">Video ndani ya Takeer</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectDigitalDeliveryMode('link')}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'link'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-border text-muted-foreground hover:border-blue-200'
                                                    }`}
                                            >
                                                <ExternalLink className="h-5 w-5" />
                                                <span className="text-[11px] font-bold">Nina link tayari</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectDigitalDeliveryMode('audio_stream')}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'audio_stream'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-border text-muted-foreground hover:border-blue-200'
                                                    }`}
                                            >
                                                <Music className="h-5 w-5" />
                                                <span className="text-[11px] font-bold">Audio ndani ya Takeer</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectDigitalDeliveryMode('gallery_pack')}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'gallery_pack'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-border text-muted-foreground hover:border-blue-200'
                                                    }`}
                                            >
                                                <Images className="h-5 w-5" />
                                                <span className="text-[11px] font-bold">Pack ya picha</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    selectDigitalDeliveryMode('custom_delivery');
                                                }}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'custom_delivery'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-border text-muted-foreground hover:border-blue-200'
                                                    }`}
                                            >
                                                <PenLine className="h-5 w-5" />
                                                <span className="text-[11px] font-bold">Nitamalizia baadae</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Direct file upload (Single) */}
                                    {digitalDeliveryMode === 'upload' && (
                                        <div className="animate-in fade-in">
                                            {!digitalFile ? (
                                                <button
                                                    onClick={() => digitalFileRef.current?.click()}
                                                    className="w-full py-6 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors text-blue-700"
                                                >
                                                    <File className="h-8 w-8" />
                                                    <span className="font-bold">Bonyeza kupakia faili</span>
                                                    <span className="text-xs opacity-70">{selectedDigitalContentType.uploadHint}</span>
                                                    <input
                                                        type="file"
                                                        accept={selectedDigitalContentType.accept}
                                                        className="hidden"
                                                        ref={digitalFileRef}
                                                        onChange={handleDigitalFileSelect}
                                                    />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                                                    <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                                        <File className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm truncate text-blue-900">{digitalFile.name}</p>
                                                        <p className="text-xs text-blue-700 opacity-70">{formatFileSizeMb(digitalFile.size)}</p>
                                                    </div>
                                                    <button onClick={() => setDigitalFile(null)} className="h-8 w-8 bg-blue-100 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
                                                        <X className="h-4 w-4 text-blue-700 hover:text-red-600" />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                Faili litahifadhiwa <b>salama</b> na Takeer. Preview inayouza bidhaa iwekwe kwenye Media za Bidhaa.
                                            </p>
                                        </div>
                                    )}

                                    {/* Premium video stream */}
                                    {digitalDeliveryMode === 'video_stream' && (
                                        <div className="animate-in fade-in space-y-3">
                                            {!paidVideoFile ? (
                                                <button
                                                    type="button"
                                                    onClick={() => digitalFileRef.current?.click()}
                                                    className="w-full py-6 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors text-blue-700"
                                                >
                                                    <PlayCircle className="h-9 w-9" />
                                                    <span className="font-bold">Pakia full premium video</span>
                                                    <span className="text-xs opacity-70">MP4, MOV, WEBM. Trailer kama ipo iweke kwenye Media za Bidhaa hapo juu.</span>
                                                    <input
                                                        type="file"
                                                        accept="video/mp4,video/quicktime,video/webm"
                                                        className="hidden"
                                                        ref={digitalFileRef}
                                                        onChange={handlePaidVideoSelect}
                                                    />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                                                    <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                                        <PlayCircle className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm truncate text-blue-900">{paidVideoFile.name}</p>
                                                        <p className="text-xs text-blue-700 opacity-70">
                                                            {formatFileSizeMb(paidVideoFile.size)} {paidVideoFile.isUploading ? ` · ${paidVideoFile.progress || 0}%` : ''}
                                                        </p>
                                                    </div>
                                                    <button type="button" onClick={() => setPaidVideoFile(null)} className="h-8 w-8 bg-blue-100 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
                                                        <X className="h-4 w-4 text-blue-700 hover:text-red-600" />
                                                    </button>
                                                </div>
                                            )}
                                            <label className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
                                                <span>
                                                    <span className="block text-sm font-black text-foreground">Allow buyer download</span>
                                                    <span className="block text-[11px] text-muted-foreground">Off by default. Buyers can watch inside Takeer.</span>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={allowDigitalDownload}
                                                    onChange={(e) => setAllowDigitalDownload(e.target.checked)}
                                                    className="h-5 w-5"
                                                />
                                            </label>
                                        </div>
                                    )}

                                    {/* Premium audio stream */}
                                    {digitalDeliveryMode === 'audio_stream' && (
                                        <div className="animate-in fade-in space-y-3">
                                            {!paidAudioFile ? (
                                                <button
                                                    type="button"
                                                    onClick={() => digitalFileRef.current?.click()}
                                                    className="w-full py-6 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors text-blue-700"
                                                >
                                                    <Music className="h-9 w-9" />
                                                    <span className="font-bold">Pakia premium audio</span>
                                                    <span className="text-xs opacity-70">MP3, WAV, M4A, AAC, OGG. Preview ibaki kwenye Media za Bidhaa hapo juu.</span>
                                                    <input
                                                        type="file"
                                                        accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
                                                        className="hidden"
                                                        ref={digitalFileRef}
                                                        onChange={handlePaidAudioSelect}
                                                    />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                                                    <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                                        <Music className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm truncate text-blue-900">{paidAudioFile.name}</p>
                                                        <p className="text-xs text-blue-700 opacity-70">
                                                            {formatFileSizeMb(paidAudioFile.size)} {paidAudioFile.isUploading ? ` · ${paidAudioFile.progress || 0}%` : ''}
                                                        </p>
                                                    </div>
                                                    <button type="button" onClick={() => setPaidAudioFile(null)} className="h-8 w-8 bg-blue-100 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
                                                        <X className="h-4 w-4 text-blue-700 hover:text-red-600" />
                                                    </button>
                                                </div>
                                            )}
                                            <label className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
                                                <span>
                                                    <span className="block text-sm font-black text-foreground">Allow buyer download</span>
                                                    <span className="block text-[11px] text-muted-foreground">Off by default. Buyers can listen inside Takeer.</span>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={allowDigitalDownload}
                                                    onChange={(e) => setAllowDigitalDownload(e.target.checked)}
                                                    className="h-5 w-5"
                                                />
                                            </label>
                                        </div>
                                    )}

                                    {digitalDeliveryMode === 'gallery_pack' && (
                                        <div className="animate-in fade-in space-y-3">
                                            <button
                                                type="button"
                                                onClick={() => digitalFileRef.current?.click()}
                                                className="w-full py-6 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors text-blue-700"
                                            >
                                                <Images className="h-9 w-9" />
                                                <span className="font-bold">Pakia original gallery images</span>
                                                <span className="text-xs opacity-70">JPG, PNG, WEBP. Takeer itatengeneza previews zenye watermark.</span>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    multiple
                                                    className="hidden"
                                                    ref={digitalFileRef}
                                                    onChange={handlePaidGallerySelect}
                                                />
                                            </button>
                                            {paidGalleryItems.length > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {paidGalleryItems.map((item, index) => (
                                                        <div key={item.localId || item.url || index} className="rounded-xl border border-blue-100 bg-blue-50 p-3 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <Images className="h-4 w-4 text-blue-600 shrink-0" />
                                                                <p className="text-xs font-bold text-blue-900 truncate">{item.name || `Image ${index + 1}`}</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPaidGalleryItems(prev => prev.filter((_, i) => i !== index))}
                                                                    className="ml-auto text-blue-700 hover:text-red-600"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                            <p className="mt-1 text-[10px] text-blue-700/70">
                                                                {formatFileSizeMb(item.size)} {item.isUploading ? ` · ${item.progress || 0}%` : item.error ? ' · failed' : ''}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <label className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
                                                <span>
                                                    <span className="block text-sm font-black text-foreground">Allow buyer download</span>
                                                    <span className="block text-[11px] text-muted-foreground">Off by default. Buyers view protected previews inside Takeer.</span>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={allowDigitalDownload}
                                                    onChange={(e) => setAllowDigitalDownload(e.target.checked)}
                                                    className="h-5 w-5"
                                                />
                                            </label>
                                        </div>
                                    )}

                                    {digitalDeliveryMode === 'live_event' && (
                                        <div className="animate-in fade-in space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Starts at</label>
                                                    <Input
                                                        type="datetime-local"
                                                        value={liveEventStartsAt}
                                                        onChange={(e) => setLiveEventStartsAt(e.target.value)}
                                                        className="h-11 bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Duration minutes</label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={liveEventDurationMinutes}
                                                        onChange={(e) => setLiveEventDurationMinutes(e.target.value)}
                                                        className="h-11 bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Timezone</label>
                                                    <select
                                                        value={liveEventTimezone}
                                                        onChange={(e) => setLiveEventTimezone(e.target.value)}
                                                        className="h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-bold"
                                                    >
                                                        {liveEventTimezoneOptions.map((timezone) => (
                                                            <option key={timezone} value={timezone}>{timezone}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Capacity (Attendee Limit)</label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={liveEventCapacity}
                                                        onChange={(e) => setLiveEventCapacity(e.target.value)}
                                                        placeholder="Optional"
                                                        className="h-11 bg-white"
                                                    />
                                                </div>
                                            </div>
                                            <Input
                                                value={liveEventAccessUrl}
                                                onChange={(e) => setLiveEventAccessUrl(e.target.value)}
                                                placeholder="Private Zoom/Google Meet/stream link"
                                                className="h-11 bg-white"
                                            />
                                            <Input
                                                value={liveEventVenue}
                                                onChange={(e) => setLiveEventVenue(e.target.value)}
                                                placeholder="Venue or physical location, optional"
                                                className="h-11 bg-white"
                                            />
                                            <Input
                                                value={liveEventReplayUrl}
                                                onChange={(e) => setLiveEventReplayUrl(e.target.value)}
                                                placeholder="Replay link after the event, optional"
                                                className="h-11 bg-white"
                                            />
                                            <Textarea
                                                value={liveEventInstructions}
                                                onChange={(e) => setLiveEventInstructions(e.target.value)}
                                                placeholder="Buyer instructions: agenda, preparation, workbook link, arrival notes..."
                                                className="min-h-[96px] rounded-xl bg-white"
                                            />
                                        </div>
                                    )}

                                    {digitalDeliveryMode === 'custom_delivery' && (
                                        <div className="animate-in fade-in space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                                    <PenLine className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-blue-900">Order-specific final delivery</p>
                                                    <p className="mt-1 text-xs font-semibold leading-5 text-blue-700/80">
                                                        Customer buys now. You upload the finished file later from the merchant order page.
                                                    </p>
                                                </div>
                                            </div>
                                            <label className="block space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900/70">Delivery deadline after payment</span>
                                                <Input type="number" min="1" className="h-11 bg-white" value={availabilityLeadTimeDays} onChange={(e) => setAvailabilityLeadTimeDays(e.target.value)} placeholder="Mf. 3" />
                                                <span className="block text-[10px] font-semibold text-blue-700/80">Takeer will calculate each order deadline from the payment time.</span>
                                            </label>
                                            <Textarea
                                                value={digitalAccessInstructions}
                                                onChange={(e) => setDigitalAccessInstructions(e.target.value)}
                                                placeholder="Explain what the buyer should send in chat, turnaround time, revision policy, and delivery expectations..."
                                                className="min-h-[110px] rounded-xl bg-white"
                                            />
                                        </div>
                                    )}

                                    {/* External link */}
                                    {digitalDeliveryMode === 'link' && (
                                        <div className="animate-in fade-in space-y-1.5">
                                            <Input
                                                placeholder="https://drive.google.com/..."
                                                value={url}
                                                onChange={e => setUrl(e.target.value)}
                                                className="h-12 font-mono text-sm"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Hakikisha link imewekwa <b>huru kushirikiwa</b> na kila mtu anayeipata.
                                            </p>
                                        </div>
                                    )}

                                    {digitalContentType === 'software' && (
                                        <div className="rounded-2xl border border-blue-100 bg-white p-4 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">Software releases</p>
                                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                        Add versioned ZIP/code releases after this software product has been saved.
                                                    </p>
                                                </div>
                                                {!productId && (
                                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                                                        Save first
                                                    </span>
                                                )}
                                            </div>

                                            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                                                <label className="flex items-center justify-between gap-3">
                                                    <span>
                                                        <span className="block text-sm font-black text-foreground">Issue license key after purchase</span>
                                                        <span className="block text-[11px] text-muted-foreground">Buyer gets a unique activation/license key with this software.</span>
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={licenseKeyEnabled}
                                                        onChange={(e) => setLicenseKeyEnabled(e.target.checked)}
                                                        className="h-5 w-5"
                                                    />
                                                </label>
                                                {licenseKeyEnabled && (
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        <Input
                                                            value={licenseKeyPrefix}
                                                            onChange={(e) => setLicenseKeyPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                                                            placeholder="Key prefix, e.g. PLUGIN"
                                                            className="h-11 bg-white"
                                                        />
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="50"
                                                            value={licenseActivationLimit}
                                                            onChange={(e) => setLicenseActivationLimit(String(Math.max(1, Math.min(50, Number(e.target.value || 1)))))}
                                                            placeholder="Devices per key"
                                                            className="h-11 bg-white"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {licenseKeyEnabled && productId && (
                                                <div className="rounded-2xl border border-blue-100 bg-white p-3 space-y-3">
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-wider text-slate-700">App validation setup</p>
                                                                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Use this in your plugin, app, or installer to check buyer license keys.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(`${window.location.origin}/api/software/licenses/validate`, 'Validation URL copied.')}
                                                                className="h-9 w-9 rounded-lg bg-white text-slate-700 flex items-center justify-center border border-slate-200"
                                                                title="Copy validation URL"
                                                            >
                                                                <Copy className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <div className="rounded-xl bg-white p-3 border border-slate-200">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Endpoint</p>
                                                                <code className="mt-1 block break-all text-xs font-black text-slate-900">POST /api/software/licenses/validate</code>
                                                            </div>
                                                            <div className="rounded-xl bg-white p-3 border border-slate-200">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Product slug</p>
                                                                <code className="mt-1 block break-all text-xs font-black text-slate-900">{softwareProductSlug || `product_id: ${productId}`}</code>
                                                            </div>
                                                        </div>
                                                        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                                                            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Example payload</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyToClipboard(JSON.stringify({
                                                                        license_key: `${licenseKeyPrefix || 'TAKEER'}-ABCDE-FGHIJ-KLMNO-PQRST`,
                                                                        ...(softwareProductSlug ? { product_slug: softwareProductSlug } : { product_id: Number(productId) }),
                                                                        device_id: 'customer-device-id',
                                                                        app_version: '1.0.0',
                                                                        site_url: 'https://example.com',
                                                                    }, null, 2), 'Example payload copied.')}
                                                                    className="h-8 w-8 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center"
                                                                    title="Copy example payload"
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            <pre className="max-h-52 overflow-auto p-3 text-xs font-semibold text-slate-800">
                                                                {JSON.stringify({
                                                                    license_key: `${licenseKeyPrefix || 'TAKEER'}-ABCDE-FGHIJ-KLMNO-PQRST`,
                                                                    ...(softwareProductSlug ? { product_slug: softwareProductSlug } : { product_id: Number(productId) }),
                                                                    device_id: 'customer-device-id',
                                                                    app_version: '1.0.0',
                                                                    site_url: 'https://example.com',
                                                                }, null, 2)}
                                                            </pre>
                                                        </div>
                                                        <p className="text-[11px] font-semibold text-slate-500">
                                                            Each key allows {licenseActivationLimit || 1} active device{Number(licenseActivationLimit || 1) === 1 ? '' : 's'}. The validation response also includes a signed offline license payload.
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <KeyRound className="h-4 w-4 text-blue-700" />
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-wider text-blue-700">Issued license keys</p>
                                                                <p className="text-[11px] font-semibold text-muted-foreground">View, revoke, or rotate buyer keys for support.</p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => fetchSoftwareLicenseKeys(productId)}
                                                            className="h-9 rounded-xl text-xs font-black"
                                                        >
                                                            Refresh
                                                        </Button>
                                                    </div>

                                                    {softwareLicenseAnalytics && (
                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                            {[
                                                                ['Keys', softwareLicenseAnalytics.total_keys || 0],
                                                                ['Active', softwareLicenseAnalytics.active_keys || 0],
                                                                ['Devices', softwareLicenseAnalytics.active_devices || 0],
                                                                ['Validations', softwareLicenseAnalytics.total_validations || 0],
                                                            ].map(([label, value]) => (
                                                                <div key={label} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">{label}</p>
                                                                    <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {softwareLicenseKeys.length === 0 ? (
                                                        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-center">
                                                            <p className="text-sm font-black text-slate-900">No keys issued yet</p>
                                                            <p className="mt-1 text-xs text-muted-foreground">Keys will appear here after buyers purchase this software.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-blue-100 rounded-xl border border-blue-100 overflow-hidden">
                                                            {softwareLicenseKeys.map((license) => {
                                                                const buyerName = license.buyer?.name || license.buyer?.username || license.buyer?.email || 'Buyer';
                                                                const issuedAt = license.issued_at
                                                                    ? new Date(license.issued_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                                                    : 'Not issued';
                                                                const lastActivatedAt = license.last_activated_at
                                                                    ? new Date(license.last_activated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                                                    : null;
                                                                const isRevoked = license.status === 'revoked';
                                                                return (
                                                                    <div key={license.id} className="p-3 space-y-3">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-black text-slate-900 truncate">{buyerName}</p>
                                                                                <p className="text-[11px] font-semibold text-muted-foreground">
                                                                                    {license.order?.public_id ? `Order ${license.order.public_id}` : 'Order'} · {issuedAt}
                                                                                </p>
                                                                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                                                    {license.activation_count || 0} validations · {license.active_device_count || 0} devices{lastActivatedAt ? ` · last ${lastActivatedAt}` : ''}
                                                                                </p>
                                                                            </div>
                                                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${isRevoked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                                {license.status}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs font-black text-slate-800">
                                                                                {license.key}
                                                                            </code>
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => copyLicenseKey(license.key)}
                                                                                    className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center"
                                                                                    title="Copy license key"
                                                                                >
                                                                                    <Copy className="h-4 w-4" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateLicenseKeyStatus(license.id, 'regenerate')}
                                                                                    disabled={licenseKeyBusy === `regenerate-${license.id}`}
                                                                                    className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center disabled:opacity-50"
                                                                                    title="Regenerate license key"
                                                                                >
                                                                                    {licenseKeyBusy === `regenerate-${license.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                                                                </button>
                                                                                {!isRevoked && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => updateLicenseKeyStatus(license.id, 'revoke')}
                                                                                        disabled={licenseKeyBusy === `revoke-${license.id}`}
                                                                                        className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center disabled:opacity-50"
                                                                                        title="Revoke license key"
                                                                                    >
                                                                                        {licenseKeyBusy === `revoke-${license.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {Array.isArray(license.activations) && license.activations.length > 0 && (
                                                                            <div className="rounded-xl bg-slate-50 p-2 space-y-1">
                                                                                {license.activations.slice(0, 3).map((activation) => (
                                                                                    <p key={activation.id} className="truncate text-[11px] font-semibold text-slate-600">
                                                                                        {activation.device_id || 'Device'}{activation.app_version ? ` · v${activation.app_version}` : ''}{activation.site_url ? ` · ${activation.site_url}` : ''}
                                                                                    </p>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {productId && (
                                                <>
                                                    <div className="grid sm:grid-cols-2 gap-3">
                                                        <Input
                                                            value={releaseForm.version}
                                                            onChange={(e) => setReleaseForm(prev => ({ ...prev, version: e.target.value }))}
                                                            placeholder="Version, e.g. 1.0.0"
                                                            className="h-11 bg-white"
                                                        />
                                                        <Input
                                                            value={releaseForm.title}
                                                            onChange={(e) => setReleaseForm(prev => ({ ...prev, title: e.target.value }))}
                                                            placeholder="Release title"
                                                            className="h-11 bg-white"
                                                        />
                                                    </div>
                                                    <Textarea
                                                        value={releaseForm.changelog}
                                                        onChange={(e) => setReleaseForm(prev => ({ ...prev, changelog: e.target.value }))}
                                                        placeholder="Changelog: fixed bugs, added features, compatibility notes..."
                                                        className="min-h-[92px] rounded-xl bg-white"
                                                    />
                                                    <div className="flex flex-col sm:flex-row gap-3">
                                                        <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/60 px-4 py-3 text-center text-sm font-black text-blue-700">
                                                            {releaseForm.file?.name ? releaseForm.file.name : 'Upload release file'}
                                                            <input
                                                                type="file"
                                                                accept=".zip,.rar,.7z,.pdf,.txt,.doc,.docx"
                                                                className="hidden"
                                                                onChange={handleReleaseFileSelect}
                                                            />
                                                        </label>
                                                        <Button
                                                            type="button"
                                                            onClick={saveSoftwareRelease}
                                                            disabled={releaseUploading || releaseSaving}
                                                            className="h-12 rounded-xl font-black"
                                                        >
                                                            {releaseSaving ? 'Saving...' : 'Add Release'}
                                                        </Button>
                                                    </div>
                                                    {releaseForm.file?.isUploading && (
                                                        <p className="text-xs font-bold text-blue-700">Uploading {releaseForm.file.progress || 0}%</p>
                                                    )}
                                                </>
                                            )}

                                            {softwareReleases.length > 0 && (
                                                <div className="divide-y divide-blue-100 rounded-xl border border-blue-100 overflow-hidden">
                                                    {softwareReleases.map((release) => (
                                                        <div key={release.id} className="p-3 flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-slate-900">
                                                                    v{release.version} {release.is_latest ? <span className="text-[10px] text-emerald-700 uppercase tracking-wider">Latest</span> : null}
                                                                </p>
                                                                {release.title && <p className="text-xs font-bold text-slate-600 mt-0.5">{release.title}</p>}
                                                                {release.changelog && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{release.changelog}</p>}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteSoftwareRelease(release.id)}
                                                                className="shrink-0 rounded-lg bg-red-50 p-2 text-red-600"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── DIGITAL: Access group assignment ─── */}
                            {step === 'digital' && (
                                <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-blue-700" />
                                        <label className="text-xs font-black text-blue-700 uppercase tracking-wider">
                                            Kikundi cha Ruhusa (Si lazima)
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-blue-900/80">
                                        Unganisha bidhaa hii na subscription au bundle ili wateja wenye ruhusa tu waipate. Bado unaweza kuweka bei ya kununua peke yake kama unataka.
                                    </p>

                                    <div className="flex p-1 bg-white rounded-xl border border-blue-100">
                                        {['plan', 'bundle'].map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setDigitalAccessTab(tab)}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${digitalAccessTab === tab
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-blue-700/70 hover:text-blue-700'
                                                    }`}
                                            >
                                                {tab === 'plan' ? 'Subscriptions' : 'Bundles'}
                                            </button>
                                        ))}
                                    </div>

                                    {assignedAccessGroup && (
                                        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                    {assignedAccessGroup.type === 'plan' ? 'Subscription' : 'Bundle'}
                                                </p>
                                                <p className="text-sm font-bold text-foreground truncate">{assignedAccessGroup.title}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAssignedAccessGroup(null)}
                                                className="h-8 w-8 rounded-full bg-blue-50 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid gap-2 max-h-44 overflow-y-auto pr-1">
                                        {promotablesLoading ? (
                                            <p className="text-xs text-blue-700/70 py-2">Inapakia vikundi vya ruhusa...</p>
                                        ) : (digitalAccessTab === 'plan' ? promotables.plans : promotables.bundles).length === 0 ? (
                                            <p className="text-xs text-blue-700/70 py-2 italic">
                                                {digitalAccessTab === 'plan' ? 'Hujatengeneza Subscriptions.' : 'Hujatengeneza Bundles.'}
                                            </p>
                                        ) : (
                                            (digitalAccessTab === 'plan' ? promotables.plans : promotables.bundles).map((group) => (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    onClick={() => setAssignedAccessGroup({
                                                        id: group.id,
                                                        type: digitalAccessTab,
                                                        title: group.name || group.title,
                                                    })}
                                                    className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${assignedAccessGroup?.id === group.id && assignedAccessGroup?.type === digitalAccessTab
                                                        ? 'border-blue-500 bg-blue-100/60'
                                                        : 'border-blue-100 bg-white hover:border-blue-300'
                                                        }`}
                                                >
                                                    <p className="font-bold text-sm truncate text-foreground">{group.name || group.title}</p>
                                                    <p className="text-[11px] text-blue-700">
                                                        TZS {Number(group.price || 0).toLocaleString()}
                                                    </p>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ─── SERVICE: unified listing mode ─── */}
                            {step === 'service' && (
                                <div className="space-y-4">
                                    {useFocusedModuleServiceForm ? (
                                        <>
                                            <ServiceModuleCreateFields
                                                moduleKey={uploadModule}
                                                roomDetails={roomDetails}
                                                setRoomDetails={setRoomDetails}
                                                serviceDetails={serviceDetails}
                                                updateServiceDetail={updateServiceDetail}
                                                serviceDurationValue={serviceDurationValue}
                                                setServiceDurationValue={setServiceDurationValue}
                                                serviceDurationUnit={serviceDurationUnit}
                                                setServiceDurationUnit={setServiceDurationUnit}
                                                roomTypeOptions={roomTypeOptions}
                                                bedTypeOptions={bedTypeOptions}
                                                roomAmenityOptions={roomAmenityOptions}
                                                roomAvailabilityOptions={roomAvailabilityOptions}
                                                roomBookingPolicyOptions={roomBookingPolicyOptions}
                                            />
                                            {renderServingLocationSelector()}
                                        </>
                                    ) : (
                                        <>
                                            <div className="rounded-2xl border bg-white p-3 sm:p-4 space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                                                    <div>
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service category</label>
                                                        <p className="text-xs text-muted-foreground mt-1">Optional, but helps organize services and improve discovery later.</p>
                                                    </div>
                                                    {(serviceCategory || serviceSubcategory) && (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 rounded-full px-3 py-1 w-max">
                                                            {serviceSubcategory || serviceCategory}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category</span>
                                                        <select
                                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                            value={serviceCategory}
                                                            onChange={(e) => {
                                                                const nextCategory = e.target.value;
                                                                const nextOption = serviceCategoryOptions.find((option) => option.label === nextCategory);
                                                                const nextTemplateKey = defaultTemplateForConfig(nextOption);
                                                                const nextTemplate = (nextOption?.allowed_templates || []).find((template) => template.key === nextTemplateKey)
                                                                    || nextOption?.service_template;
                                                                setServiceCategory(nextCategory);
                                                                setServiceTemplateKey(nextTemplateKey);
                                                                setServiceSubcategory((current) => (
                                                                    nextOption?.subcategories?.includes(current) ? current : ''
                                                                ));
                                                                if (!nextOption?.subcategories?.length) {
                                                                    applyServiceTemplateDefaults(nextTemplate);
                                                                }
                                                            }}
                                                        >
                                                            <option value="">No category</option>
                                                            {serviceCategoryOptions.map((option) => (
                                                                <option key={option.label} value={option.label}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subcategory</span>
                                                        <select
                                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold disabled:opacity-60"
                                                            value={serviceSubcategory}
                                                            onChange={(e) => {
                                                                const nextSubcategory = e.target.value;
                                                                const nextConfig = selectedServiceCategory?.subcategoryConfigs?.find((option) => option.label === nextSubcategory);
                                                                const nextTemplateKey = defaultTemplateForConfig(nextConfig) || defaultTemplateForConfig(selectedServiceCategory);
                                                                const nextTemplate = (nextConfig?.allowed_templates || selectedServiceCategory?.allowed_templates || [])
                                                                    .find((template) => template.key === nextTemplateKey)
                                                                    || nextConfig?.service_template
                                                                    || selectedServiceCategory?.service_template;
                                                                setServiceSubcategory(nextSubcategory);
                                                                setServiceTemplateKey(nextTemplateKey);
                                                                applyServiceTemplateDefaults(nextTemplate);
                                                            }}
                                                            disabled={!serviceCategory}
                                                        >
                                                            <option value="">No subcategory</option>
                                                            {(selectedServiceCategory?.subcategories || []).map((subcategory) => (
                                                                <option key={subcategory} value={subcategory}>{subcategory}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                {selectedServiceTemplateOptions.length > 1 && (
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Listing workflow</span>
                                                        <select
                                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                            value={selectedServiceTemplateKey}
                                                            onChange={(e) => {
                                                                const nextTemplate = selectedServiceTemplateOptions.find((template) => template.key === e.target.value);
                                                                setServiceTemplateKey(e.target.value);
                                                                applyServiceTemplateDefaults(nextTemplate);
                                                            }}
                                                        >
                                                            {selectedServiceTemplateOptions.map((template) => (
                                                                <option key={template.key} value={template.key}>
                                                                    {template.label || template.key.replace(/_/g, ' ')}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-muted-foreground">
                                                            Category controls discovery. Workflow controls the form, booking rules, availability, and verification.
                                                        </p>
                                                    </div>
                                                )}
                                                {selectedServiceSubtypeOptions.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Workflow subtype</span>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {selectedServiceSubtypeOptions.map((subtype) => {
                                                                const selected = selectedServiceSubtypeKey === subtype.key;

                                                                return (
                                                                    <button
                                                                        key={subtype.key}
                                                                        type="button"
                                                                        onClick={() => updateServiceSubtype(subtype.key)}
                                                                        className={`rounded-xl border px-3 py-2 text-left transition-all ${selected
                                                                            ? 'border-brand-500 bg-brand-50 text-brand-900'
                                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                                            }`}
                                                                    >
                                                                        <span className="block text-xs font-black">{subtype.label || subtype.key.replace(/_/g, ' ')}</span>
                                                                        {subtype.description && (
                                                                            <span className="mt-1 block text-[11px] font-semibold opacity-80">{subtype.description}</span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedServiceTrustPolicy && (
                                                    <div className={`rounded-xl border px-3 py-2 text-xs ${selectedServiceTrustPolicy.risk_level === 'standard'
                                                        ? 'border-blue-100 bg-blue-50 text-blue-800'
                                                        : 'border-amber-200 bg-amber-50 text-amber-900'
                                                        }`}>
                                                        <p className="font-black uppercase tracking-wider">
                                                            {selectedServiceTrustPolicy.risk_level === 'standard' ? 'Uhakiki wa kawaida' : 'Huduma yenye uhakiki maalum'}
                                                        </p>
                                                        <p className="mt-1 leading-relaxed">
                                                            {selectedServiceTrustPolicy.risk_level === 'standard'
                                                                ? 'Huduma zote zinahitaji KYC iliyothibitishwa kabla ya kuchapishwa.'
                                                                : `Category hii inahitaji ${selectedServiceRequiredDocuments.join(', ') || 'nyaraka za uhakiki'}${selectedServiceTrustPolicy.requires_manual_review ? ' na review ya Takeer' : ''} kabla ya kuchapishwa.`}
                                                        </p>
                                                        {selectedServiceTrustPolicy.payout_hold_days > 3 && (
                                                            <p className="mt-1 font-semibold">
                                                                SafePay itashikilia malipo kwa siku {selectedServiceTrustPolicy.payout_hold_days} kabla ya payout.
                                                            </p>
                                                        )}
                                                        {selectedServiceTrustPolicy.max_first_quote_amount && (
                                                            <p className="mt-1 font-semibold">
                                                                Kikomo cha quote ya kwanza: TZS {Number(selectedServiceTrustPolicy.max_first_quote_amount).toLocaleString()}.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {showRoomDetailsForm && (
                                                <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 space-y-4">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-wider text-sky-900">Room / stay details</p>
                                                        <p className="text-xs text-sky-800 mt-1">These fields shape how this room appears for hotels, motels, lodges, guest houses, and apartments.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Room type</span>
                                                            <select
                                                                className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                                                value={roomDetails.room_type}
                                                                onChange={(e) => updateRoomDetail('room_type', e.target.value)}
                                                            >
                                                                {roomTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                                                            </select>
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Bed type</span>
                                                            <select
                                                                className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                                                value={roomDetails.bed_type}
                                                                onChange={(e) => updateRoomDetail('bed_type', e.target.value)}
                                                            >
                                                                {bedTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                                                            </select>
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Guests</span>
                                                            <Input type="number" min="1" className="h-11 bg-white" value={roomDetails.max_guests} onChange={(e) => updateRoomDetail('max_guests', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Rooms</span>
                                                            <Input type="number" min="1" className="h-11 bg-white" value={roomDetails.room_count} onChange={(e) => updateRoomDetail('room_count', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Bathrooms</span>
                                                            <Input type="number" min="0" step="0.5" className="h-11 bg-white" value={roomDetails.bathrooms} onChange={(e) => updateRoomDetail('bathrooms', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Check-in</span>
                                                            <Input type="time" className="h-11 bg-white" value={roomDetails.checkin_time} onChange={(e) => updateRoomDetail('checkin_time', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Check-out</span>
                                                            <Input type="time" className="h-11 bg-white" value={roomDetails.checkout_time} onChange={(e) => updateRoomDetail('checkout_time', e.target.value)} />
                                                        </label>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <p className="text-[11px] font-semibold text-slate-700">Availability status</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {roomAvailabilityOptions.map(option => (
                                                                <button
                                                                    key={option.key}
                                                                    type="button"
                                                                    onClick={() => updateRoomDetail('availability', [option.key])}
                                                                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${roomDetails.availability.includes(option.key) ? 'border-sky-500 bg-white text-sky-700' : 'border-slate-200 bg-white/70 text-slate-500'}`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <p className="text-[11px] font-semibold text-slate-700">Amenities</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {roomAmenityOptions.map(option => (
                                                                <button
                                                                    key={option.key}
                                                                    type="button"
                                                                    onClick={() => toggleRoomArrayValue('amenities', option.key)}
                                                                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${roomDetails.amenities.includes(option.key) ? 'border-emerald-500 bg-white text-emerald-700' : 'border-slate-200 bg-white/70 text-slate-500'}`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {showReservationDetailsForm && (
                                                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 space-y-4">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-wider text-rose-900">Reservation details</p>
                                                        <p className="text-xs text-rose-800 mt-1">Use this for table bookings, venue visits, event spaces, lounges, activity slots, and reservation-first businesses.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Reservation type</span>
                                                            <select className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={serviceDetails.reservation_type || 'table'} onChange={(e) => updateServiceDetail('reservation_type', e.target.value)}>
                                                                <option value="table">Table</option>
                                                                <option value="venue">Venue</option>
                                                                <option value="visit">Visit</option>
                                                                <option value="event_space">Event space</option>
                                                                <option value="activity">Activity</option>
                                                            </select>
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Seating / space</span>
                                                            <Input className="h-11 bg-white" placeholder="Indoor, terrace, VIP..." value={serviceDetails.seating_type || ''} onChange={(e) => updateServiceDetail('seating_type', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Party size limit</span>
                                                            <Input type="number" min="1" className="h-11 bg-white" placeholder="8" value={serviceDetails.party_size_limit || ''} onChange={(e) => updateServiceDetail('party_size_limit', e.target.value)} />
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3">
                                                        <Textarea className="min-h-20 rounded-xl bg-white" placeholder="Reservation notes: late arrival, hold time, dress code, walk-in policy..." value={serviceDetails.reservation_notes || ''} onChange={(e) => updateServiceDetail('reservation_notes', e.target.value)} />
                                                    </div>
                                                </div>
                                            )}

                                            {showRentalDetailsForm && (
                                                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 space-y-4">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-wider text-amber-900">Rental / hire details</p>
                                                        <p className="text-xs text-amber-800 mt-1">Use this for equipment, vehicles, event gear, spaces, costumes, and other rentable items.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Rental type</span>
                                                            <select className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={serviceDetails.rental_type || serviceDetails.service_subtype || 'tools_equipment'} onChange={(e) => {
                                                                updateServiceDetail('rental_type', e.target.value);
                                                                updateServiceDetail('service_subtype', e.target.value);
                                                            }}>
                                                                <option value="tools_equipment">Tools / equipment</option>
                                                                <option value="equipment">Equipment</option>
                                                                <option value="vehicle">Vehicle</option>
                                                                <option value="space">Space</option>
                                                                <option value="event_equipment">Event equipment</option>
                                                                <option value="event_gear">Event gear</option>
                                                                <option value="costume">Costume / props</option>
                                                                <option value="other">Other</option>
                                                            </select>
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Price unit</span>
                                                            <select className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={serviceDetails.rental_unit || 'day'} onChange={(e) => {
                                                                updateServiceDetail('rental_unit', e.target.value);
                                                                setServicePriceDisplay(e.target.value === 'hour' ? 'hourly' : e.target.value === 'week' ? 'weekly' : e.target.value === 'month' ? 'monthly' : 'daily');
                                                            }}>
                                                                <option value="hour">Per hour</option>
                                                                <option value="day">Per day</option>
                                                                <option value="night">Per night</option>
                                                                <option value="week">Per week</option>
                                                                <option value="month">Per month</option>
                                                                <option value="trip">Per trip</option>
                                                                <option value="event">Per event</option>
                                                            </select>
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Available units</span>
                                                            <Input type="number" min="1" className="h-11 bg-white" placeholder="1" value={serviceDetails.available_units ?? ''} onChange={(e) => updateServiceDetail('available_units', e.target.value)} />
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Refundable security deposit</span>
                                                            <Input type="number" min="0" className="h-11 bg-white" placeholder="Optional refundable amount" value={serviceDetails.security_deposit ?? ''} onChange={(e) => updateServiceDetail('security_deposit', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Included items</span>
                                                            <Input
                                                                className="h-11 bg-white"
                                                                placeholder="Helmet, charger, stand..."
                                                                value={Array.isArray(serviceDetails.included_items) ? serviceDetails.included_items.join(', ') : ''}
                                                                onChange={(e) => updateServiceDetail('included_items', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                                                            />
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <Textarea className="min-h-20 rounded-xl bg-white" placeholder="Pickup and return notes: pickup point, return time, inspection, late return..." value={serviceDetails.pickup_return_notes || ''} onChange={(e) => updateServiceDetail('pickup_return_notes', e.target.value)} />
                                                        <Textarea className="min-h-20 rounded-xl bg-white" placeholder="Rental requirements: ID, license, deposit, operator, damage policy..." value={serviceDetails.rental_requirements || ''} onChange={(e) => updateServiceDetail('rental_requirements', e.target.value)} />
                                                    </div>
                                                </div>
                                            )}

                                            {showWorkshopDetailsForm && (
                                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-wider text-indigo-900">Workshop / session details</p>
                                                        <p className="text-xs text-indigo-800 mt-1">Use this for short courses, bootcamps, webinars, seminars, and live training sessions.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Format</span>
                                                            <select className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={serviceDetails.workshop_format || 'live_session'} onChange={(e) => updateServiceDetail('workshop_format', e.target.value)}>
                                                                <option value="live_session">Live session</option>
                                                                <option value="bootcamp">Bootcamp</option>
                                                                <option value="seminar">Seminar</option>
                                                                <option value="webinar">Webinar</option>
                                                                <option value="cohort">Cohort</option>
                                                                <option value="private_group">Private group</option>
                                                            </select>
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Sessions</span>
                                                            <Input type="number" min="1" className="h-11 bg-white" placeholder="1" value={serviceDetails.session_count ?? ''} onChange={(e) => updateServiceDetail('session_count', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Capacity</span>
                                                            <Input type="number" min="1" className="h-11 bg-white" placeholder="Optional" value={serviceDetails.workshop_capacity ?? ''} onChange={(e) => updateServiceDetail('workshop_capacity', e.target.value)} />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Level</span>
                                                            <Input className="h-11 bg-white" placeholder="Beginner, advanced..." value={serviceDetails.workshop_level || ''} onChange={(e) => updateServiceDetail('workshop_level', e.target.value)} />
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[11px] font-semibold text-slate-700">Start note</span>
                                                            <Input className="h-11 bg-white" placeholder="Starts June, every Saturday..." value={serviceDetails.workshop_start_note || ''} onChange={(e) => updateServiceDetail('workshop_start_note', e.target.value)} />
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        <RepeatableTextList label="Learning outcomes" value={serviceDetails.learning_outcomes || serviceDetails.outcomes} onChange={(value) => {
                                                            updateServiceDetail('learning_outcomes', value);
                                                            updateServiceDetail('outcomes', value);
                                                        }} addLabel="Add outcome" placeholder="Describe one learning outcome..." />
                                                        <RepeatableTextList label="Requirements" value={serviceDetails.workshop_requirements || serviceDetails.requirements} onChange={(value) => {
                                                            updateServiceDetail('workshop_requirements', value);
                                                            updateServiceDetail('requirements', value);
                                                        }} addLabel="Add requirement" placeholder="Describe one requirement..." />
                                                        <RepeatableTextList label="Materials included" value={serviceDetails.materials_included} onChange={(value) => updateServiceDetail('materials_included', value)} addLabel="Add material" placeholder="Describe one material or resource..." />
                                                    </div>
                                                </div>
                                            )}

                                            {renderServingLocationSelector()}

                                            <div className="rounded-2xl border bg-slate-50/60 p-3 sm:p-4 space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                                                    <div>
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aina ya Huduma</label>
                                                        <p className="text-xs text-muted-foreground mt-1">Chagua namna kuu ya kuuza au kupokea maombi ya service hii.</p>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 rounded-full px-3 py-1 w-max">
                                                        {serviceModeOptions.find((option) => option.key === serviceMode)?.label || 'Service'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {serviceModeOptions.map(({ key, label, hint, icon: Icon }) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => {
                                                                setServiceMode(key);
                                                                setServiceIsShowcase(key === 'showcase_only');
                                                                if (key === 'showcase_only') setServicePriceDisplay('hidden');
                                                                if (key === 'request_quote') setServicePriceDisplay('quote_only');
                                                            }}
                                                            className={`min-h-[88px] rounded-xl border px-3 py-3 text-left transition-all ${serviceMode === key
                                                                ? 'border-purple-600 bg-white text-purple-800 shadow-sm ring-1 ring-purple-200'
                                                                : 'border-border bg-white text-muted-foreground hover:border-purple-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <Icon className="h-5 w-5 shrink-0" />
                                                                <div className="min-w-0">
                                                                    <span className="block text-sm font-black leading-tight">{label}</span>
                                                                    <span className="block text-[11px] leading-snug mt-1">{hint}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Scheduling style</label>
                                                    <p className="text-xs text-muted-foreground mt-1">Choose how this specific service accepts dates and bookings.</p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {[
                                                        { key: 'none', label: 'No scheduling', hint: 'Use requests, quote, or manual follow-up.' },
                                                        { key: 'recurring', label: 'Recurring appointments', hint: 'Weekly availability, slots, buffer, and capacity.' },
                                                        { key: 'fixed_sessions', label: 'Fixed sessions/events', hint: 'Training, workshop, webinar, cohort, or event dates.' },
                                                        { key: 'external', label: 'External booking', hint: 'Use Calendly, Google Form, or another booking page.' },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.key}
                                                            type="button"
                                                            onClick={() => {
                                                                setServiceSchedulingType(option.key);
                                                                if (['recurring', 'fixed_sessions'].includes(option.key)) {
                                                                    setServiceBookingMode('takeer');
                                                                    if (serviceBookingProvider === 'external') setServiceBookingProvider('manual');
                                                                }
                                                                if (option.key === 'external') {
                                                                    setServiceBookingMode('external');
                                                                    setServiceBookingProvider('external');
                                                                }
                                                                if (option.key === 'none' && serviceBookingMode === 'external') {
                                                                    setServiceBookingMode('takeer');
                                                                    setServiceBookingProvider('manual');
                                                                }
                                                            }}
                                                            className={`min-h-[76px] rounded-xl border px-3 py-3 text-left transition-all ${serviceSchedulingType === option.key
                                                                ? 'border-purple-600 bg-purple-50 text-purple-800 shadow-sm ring-1 ring-purple-200'
                                                                : 'border-border bg-background text-muted-foreground hover:border-purple-300'
                                                                }`}
                                                        >
                                                            <span className="block text-sm font-black leading-tight">{option.label}</span>
                                                            <span className="block text-[11px] leading-snug mt-1">{option.hint}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid w-full grid-cols-1 gap-4">
                                                <div className="col-span-full w-full rounded-2xl border p-3 sm:p-4 space-y-3">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bei ionekane vipi?</label>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        {servicePriceOptions.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                onClick={() => setServicePriceDisplay(option.key)}
                                                                className={`min-h-11 px-3 rounded-xl text-xs font-bold border transition-all ${servicePriceDisplay === option.key
                                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                                    : 'bg-background text-muted-foreground border-border hover:border-purple-300'
                                                                    }`}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {servicePriceDisplay === 'hourly' && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rate / Saa (TZS)</label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Mf. 50000"
                                                                    value={serviceHourlyRate}
                                                                    onChange={(e) => setServiceHourlyRate(e.target.value)}
                                                                    className="h-11 font-bold"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Minimum Saa</label>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    placeholder="1"
                                                                    value={serviceMinHours}
                                                                    onChange={(e) => setServiceMinHours(e.target.value)}
                                                                    className="h-11 font-bold"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="rounded-xl border bg-slate-50/60 p-3 space-y-3">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                            <div>
                                                                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Additional charges</p>
                                                                <p className="text-[11px] text-muted-foreground mt-0.5">Optional fees like cleaning, security, lab, extra guest, or refundable deposit.</p>
                                                            </div>
                                                            <Button type="button" variant="outline" className="h-10 rounded-xl sm:w-32" onClick={addServiceCharge}>
                                                                <Plus className="h-4 w-4 mr-1" /> Add
                                                            </Button>
                                                        </div>
                                                        {serviceCharges.length > 0 && (
                                                            <div className="space-y-2">
                                                                {serviceCharges.map((charge, index) => (
                                                                    <div key={charge.id || index} className="rounded-xl border bg-white p-3 sm:p-4 space-y-3">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Charge {index + 1}</p>
                                                                                <p className="text-[11px] text-muted-foreground">Fee, deposit, tax, or required add-on.</p>
                                                                            </div>
                                                                            <Button type="button" variant="outline" size="sm" className="h-9 w-9 rounded-xl p-0 shrink-0" onClick={() => removeServiceCharge(index)}>
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                                                                            <label className="space-y-1 lg:col-span-5">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Name</span>
                                                                                <Input
                                                                                    placeholder="Cleaning fee"
                                                                                    value={charge.name || ''}
                                                                                    onChange={(e) => updateServiceCharge(index, { name: e.target.value })}
                                                                                    className="h-11"
                                                                                />
                                                                            </label>
                                                                            <label className="space-y-1 lg:col-span-2">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Amount</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    placeholder="0"
                                                                                    value={charge.amount ?? ''}
                                                                                    onChange={(e) => updateServiceCharge(index, { amount: e.target.value })}
                                                                                    className="h-11"
                                                                                />
                                                                            </label>
                                                                            <label className="space-y-1 lg:col-span-3">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">How it applies</span>
                                                                                <select
                                                                                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                                                    value={charge.unit || 'fixed'}
                                                                                    onChange={(e) => updateServiceCharge(index, { unit: e.target.value })}
                                                                                >
                                                                                    {serviceChargeUnitOptions.map((option) => (
                                                                                        <option key={option.key} value={option.key}>{option.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </label>
                                                                            <div className="flex flex-row gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateServiceCharge(index, { required: !Boolean(charge.required) })}
                                                                                    className={`h-11 rounded-xl border px-3 text-xs font-black flex items-center justify-center gap-2 transition-colors ${charge.required
                                                                                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                                                                                        : 'border-input bg-background text-muted-foreground'
                                                                                        }`}
                                                                                >
                                                                                    <CheckCircle2 className={`h-4 w-4 ${charge.required ? 'fill-purple-600 text-white' : ''}`} />
                                                                                    Required
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateServiceCharge(index, { included_in_checkout: !Boolean(charge.included_in_checkout) })}
                                                                                    className={`h-11 rounded-xl border px-3 text-xs font-black flex items-center justify-center gap-2 transition-colors ${charge.included_in_checkout
                                                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                                                        : 'border-input bg-background text-muted-foreground'
                                                                                        }`}
                                                                                >
                                                                                    <CheckCircle2 className={`h-4 w-4 ${charge.included_in_checkout ? 'fill-emerald-600 text-white' : ''}`} />
                                                                                    Checkout
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        {charge.included_in_checkout && (
                                                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800">
                                                                                Checkout will ask for people, dates, hours, or quantity when this charge needs them.
                                                                            </div>
                                                                        )}
                                                                        <label className="space-y-1 block">
                                                                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Note</span>
                                                                            <Input
                                                                                placeholder="Refundable after checkout inspection"
                                                                                value={charge.description || ''}
                                                                                onChange={(e) => updateServiceCharge(index, { description: e.target.value })}
                                                                                className="h-11 text-sm"
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {!showingSpecializedServiceForm && (
                                                    <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                            <div>
                                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service options / units</label>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {serviceOptionTemplate?.description || 'Room types, packages, vehicles, halls, classes, consultation types, or equipment units.'}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-10 rounded-xl sm:w-36 disabled:opacity-50"
                                                                onClick={addServiceOption}
                                                                disabled={!serviceOptionCategoryReady}
                                                            >
                                                                <Plus className="h-4 w-4 mr-1" /> Add option
                                                            </Button>
                                                        </div>
                                                        {!serviceOptionCategoryReady ? (
                                                            <div className="rounded-xl border border-dashed bg-amber-50/70 px-4 py-3 text-xs text-amber-800 flex gap-2">
                                                                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="font-bold">Choose a category first.</p>
                                                                    <p className="mt-0.5">
                                                                        Service options use the selected subcategory template
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : serviceOptions.length === 0 ? (
                                                            <div className="rounded-xl border border-dashed bg-slate-50/60 px-4 py-3 text-xs text-muted-foreground">
                                                                Optional. Use this when one service has multiple bookable choices, e.g. {(serviceOptionTemplate?.examples || ['Standard Room', 'Deluxe Room', 'Private Session', 'Group Class', 'Boat A', 'Hall B']).join(', ')}.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {serviceOptions.map((option, index) => (
                                                                    <div key={option.id || index} className="rounded-xl border bg-white p-3 sm:p-4 space-y-4">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Option {index + 1}</p>
                                                                                <p className="text-[11px] text-muted-foreground">{serviceOptionTemplate?.label || 'Service option'}</p>
                                                                            </div>
                                                                            <Button type="button" variant="outline" size="sm" className="h-9 w-9 rounded-xl p-0 shrink-0" onClick={() => removeServiceOption(index)}>
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                                                                            <label className="space-y-1 lg:col-span-5">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{serviceOptionTemplate?.label || 'Option name'}</span>
                                                                                <Input
                                                                                    placeholder={serviceOptionTemplate?.placeholder || serviceOptionTemplate?.examples?.[0] || 'Standard Package'}
                                                                                    value={option.name || ''}
                                                                                    onChange={(e) => updateServiceOption(index, { name: e.target.value })}
                                                                                    className="h-11"
                                                                                />
                                                                            </label>
                                                                            <label className="space-y-1 lg:col-span-2">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Price</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    placeholder="0"
                                                                                    value={option.price ?? ''}
                                                                                    onChange={(e) => updateServiceOption(index, { price: e.target.value })}
                                                                                    className="h-11"
                                                                                />
                                                                            </label>
                                                                            <label className="space-y-1 lg:col-span-3">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Price unit</span>
                                                                                <select
                                                                                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                                                    value={option.price_display || 'fixed'}
                                                                                    onChange={(e) => updateServiceOption(index, { price_display: e.target.value })}
                                                                                >
                                                                                    {servicePriceOptions.filter((item) => !['hidden', 'quote_only'].includes(item.key)).map((item) => (
                                                                                        <option key={item.key} value={item.key}>{item.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </label>
                                                                            {serviceOptionFieldEnabled('capacity_type') && (
                                                                                <label className="space-y-1 lg:col-span-2">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Limit</span>
                                                                                    <select
                                                                                        className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                                                        value={option.capacity_type || 'limited'}
                                                                                        onChange={(e) => updateServiceOption(index, { capacity_type: e.target.value })}
                                                                                    >
                                                                                        <option value="limited">Limited</option>
                                                                                        <option value="unlimited">Unlimited</option>
                                                                                    </select>
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                            {serviceOptionFieldEnabled('capacity') && (
                                                                                <label className="space-y-1">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Units / rooms</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        placeholder="1"
                                                                                        value={option.capacity ?? ''}
                                                                                        disabled={(option.capacity_type || 'limited') === 'unlimited'}
                                                                                        onChange={(e) => updateServiceOption(index, { capacity: e.target.value })}
                                                                                        className="h-11 text-sm"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                            {serviceOptionFieldEnabled('max_guests') && (
                                                                                <label className="space-y-1">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Max guests</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        placeholder="2"
                                                                                        value={option.max_guests ?? ''}
                                                                                        onChange={(e) => updateServiceOption(index, { max_guests: e.target.value })}
                                                                                        className="h-11 text-sm"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                            {serviceOptionFieldEnabled('duration_minutes') && (
                                                                                <label className="space-y-1">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Duration</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        placeholder="Minutes"
                                                                                        value={option.duration_minutes ?? ''}
                                                                                        onChange={(e) => updateServiceOption(index, { duration_minutes: e.target.value })}
                                                                                        className="h-11 text-sm"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                            {serviceOptionFieldEnabled('checkin_time') && (
                                                                                <label className="space-y-1">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Check-in</span>
                                                                                    <Input
                                                                                        type="time"
                                                                                        value={option.checkin_time || ''}
                                                                                        onChange={(e) => updateServiceOption(index, { checkin_time: e.target.value })}
                                                                                        className="h-11 text-sm"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                            {serviceOptionFieldEnabled('checkout_time') && (
                                                                                <label className="space-y-1">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Checkout</span>
                                                                                    <Input
                                                                                        type="time"
                                                                                        value={option.checkout_time || ''}
                                                                                        onChange={(e) => updateServiceOption(index, { checkout_time: e.target.value })}
                                                                                        className="h-11 text-sm"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                        <label className="space-y-1 block">
                                                                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description</span>
                                                                            <Input
                                                                                placeholder={serviceOptionTemplate?.description_placeholder || 'What is included in this option'}
                                                                                value={option.description || ''}
                                                                                onChange={(e) => updateServiceOption(index, { description: e.target.value })}
                                                                                className="h-11 text-sm"
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {selectedServiceTemplateKey && selectedServiceTemplateSections.length > 0 && !showingSpecializedServiceForm && hasConcreteServiceSubtype && (
                                                    <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
                                                        <div>
                                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Template details</label>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                These fields shape the public post and the merchant management view for {selectedServiceTemplate?.label || 'this service'}.
                                                            </p>
                                                        </div>

                                                        {selectedServiceTemplateKey === 'tour' && (
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <Input placeholder="Destination, e.g. Serengeti + Ngorongoro" value={serviceDetails.destination || ''} onChange={(e) => updateServiceDetail('destination', e.target.value)} className="h-11" />
                                                                    <Input placeholder="Duration, e.g. 3 days / 2 nights" value={serviceDetails.duration_label || ''} onChange={(e) => updateServiceDetail('duration_label', e.target.value)} className="h-11" />
                                                                    <Input placeholder="Pickup point" value={serviceDetails.pickup_point || ''} onChange={(e) => updateServiceDetail('pickup_point', e.target.value)} className="h-11" />
                                                                    <Input placeholder="Drop-off point" value={serviceDetails.dropoff_point || ''} onChange={(e) => updateServiceDetail('dropoff_point', e.target.value)} className="h-11" />
                                                                    <Input type="number" min="1" placeholder="Group size / seats" value={serviceDetails.group_size || ''} onChange={(e) => updateServiceDetail('group_size', e.target.value)} className="h-11" />
                                                                    <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={serviceDetails.departure_type || 'scheduled'} onChange={(e) => updateServiceDetail('departure_type', e.target.value)}>
                                                                        <option value="scheduled">Scheduled departures</option>
                                                                        <option value="private">Private trips</option>
                                                                        <option value="custom">Custom dates</option>
                                                                    </select>
                                                                </div>
                                                                <div className="rounded-xl border bg-slate-50/60 p-3 space-y-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Itinerary</p>
                                                                        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => updateServiceDetail('itinerary', [...(serviceDetails.itinerary || []), { day: (serviceDetails.itinerary || []).length + 1, title: '', description: '' }])}>
                                                                            <Plus className="h-4 w-4 mr-1" /> Day
                                                                        </Button>
                                                                    </div>
                                                                    {(serviceDetails.itinerary || []).map((day, index) => (
                                                                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                                                            <Input className="md:col-span-2 h-11" type="number" min="1" value={day.day || index + 1} onChange={(e) => updateServiceDetail('itinerary', (serviceDetails.itinerary || []).map((item, itemIndex) => itemIndex === index ? { ...item, day: e.target.value } : item))} />
                                                                            <Input className="md:col-span-4 h-11" placeholder="Day title" value={day.title || ''} onChange={(e) => updateServiceDetail('itinerary', (serviceDetails.itinerary || []).map((item, itemIndex) => itemIndex === index ? { ...item, title: e.target.value } : item))} />
                                                                            <Input className="md:col-span-5 h-11" placeholder="Stops, meals, activities..." value={day.description || ''} onChange={(e) => updateServiceDetail('itinerary', (serviceDetails.itinerary || []).map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} />
                                                                            <button type="button" className="md:col-span-1 h-11 rounded-xl border bg-white text-muted-foreground hover:text-red-600" onClick={() => updateServiceDetail('itinerary', (serviceDetails.itinerary || []).filter((_, itemIndex) => itemIndex !== index))}>
                                                                                <Trash2 className="h-4 w-4 mx-auto" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <RepeatableTextList label="Included items" value={serviceDetails.included} onChange={(value) => updateServiceDetail('included', value)} addLabel="Add included item" placeholder="Describe one included item..." />
                                                                <RepeatableTextList label="Excluded items" value={serviceDetails.excluded} onChange={(value) => updateServiceDetail('excluded', value)} addLabel="Add excluded item" placeholder="Describe one excluded item..." />
                                                                <Textarea placeholder="Traveler requirements, weather notes, documents, fitness level..." value={serviceDetails.requirements || ''} onChange={(e) => updateServiceDetail('requirements', e.target.value)} className="min-h-20" />
                                                            </div>
                                                        )}

                                                        {selectedServiceTemplateKey === 'stay' && (
                                                            <div className="space-y-3">
                                                                <RepeatableTextList label="Amenities" value={serviceDetails.amenities} onChange={(value) => updateServiceDetail('amenities', value)} addLabel="Add amenity" placeholder="Describe one amenity..." />
                                                                <Textarea placeholder="House rules, check-in policy, guest rules..." value={serviceDetails.house_rules || ''} onChange={(e) => updateServiceDetail('house_rules', e.target.value)} className="min-h-24" />
                                                                <Textarea placeholder="Cancellation policy" value={serviceDetails.cancellation_policy || ''} onChange={(e) => updateServiceDetail('cancellation_policy', e.target.value)} className="min-h-20" />
                                                            </div>
                                                        )}

                                                        {selectedServiceTemplateKey === 'learning' && (
                                                            <div className="space-y-3">
                                                                <RepeatableTextList label="Learning outcomes" value={serviceDetails.outcomes} onChange={(value) => updateServiceDetail('outcomes', value)} addLabel="Add outcome" placeholder="Describe one learning outcome..." />
                                                                <RepeatableTextList label="Student requirements" value={serviceDetails.requirements} onChange={(value) => updateServiceDetail('requirements', value)} addLabel="Add requirement" placeholder="Describe one requirement..." />
                                                                <Input placeholder="Certificate, e.g. Certificate of completion included" value={serviceDetails.certificate || ''} onChange={(e) => updateServiceDetail('certificate', e.target.value)} className="h-11" />
                                                            </div>
                                                        )}

                                                        {selectedServiceTemplateKey === 'orderable_service' && (
                                                            <div className="space-y-3">
                                                                <Textarea placeholder="Customization details customers can choose: size, flavor, message, file upload, color..." value={serviceDetails.customization_notes || ''} onChange={(e) => updateServiceDetail('customization_notes', e.target.value)} className="min-h-24" />
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                    <Input className="h-11 md:col-span-1" placeholder="Lead time, e.g. 24 hours notice" value={serviceDetails.lead_time || ''} onChange={(e) => updateServiceDetail('lead_time', e.target.value)} />
                                                                    <Input className="h-11 md:col-span-1" type="number" min="1" placeholder="Minimum order quantity" value={serviceDetails.minimum_order || ''} onChange={(e) => updateServiceDetail('minimum_order', e.target.value)} />
                                                                    <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={serviceDetails.quote_policy || 'quote_after_request'} onChange={(e) => updateServiceDetail('quote_policy', e.target.value)}>
                                                                        <option value="quote_after_request">Quote after request</option>
                                                                        <option value="deposit_before_work">Deposit before work</option>
                                                                        <option value="full_payment_after_quote">Full payment after quote</option>
                                                                    </select>
                                                                </div>
                                                                <Textarea placeholder="Pickup or delivery notes" value={serviceDetails.pickup_delivery_notes || ''} onChange={(e) => updateServiceDetail('pickup_delivery_notes', e.target.value)} className="min-h-20" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <ServiceRelatedProductsEditor
                                                    isLoadingProducts={isLoadingProducts}
                                                    physicalMerchantProducts={physicalMerchantProducts}
                                                    filteredPhysicalMerchantProducts={filteredPhysicalMerchantProducts}
                                                    visiblePhysicalMerchantProducts={visiblePhysicalMerchantProducts}
                                                    serviceProductSearch={serviceProductSearch}
                                                    setServiceProductSearch={setServiceProductSearch}
                                                    serviceRelatedProductIds={serviceRelatedProductIds}
                                                    toggleServiceRelatedProduct={toggleServiceRelatedProduct}
                                                />

                                                <ServiceBookingPolicyEditor
                                                    serviceDurationValue={serviceDurationValue}
                                                    setServiceDurationValue={setServiceDurationValue}
                                                    serviceDurationUnit={serviceDurationUnit}
                                                    setServiceDurationUnit={setServiceDurationUnit}
                                                    serviceDurationPresets={serviceDurationPresets}
                                                    serviceDurationMinutes={serviceDurationMinutes}
                                                    serviceBookingType={serviceBookingType}
                                                    setServiceBookingType={setServiceBookingType}
                                                    serviceDepositAmount={serviceDepositAmount}
                                                    setServiceDepositAmount={setServiceDepositAmount}
                                                    showServiceDepositInfo={showServiceDepositInfo}
                                                    setShowServiceDepositInfo={setShowServiceDepositInfo}
                                                    serviceDetails={serviceDetails}
                                                    updateServiceDetail={updateServiceDetail}
                                                />
                                            </div>

                                            <ServiceLocationAreasEditor
                                                serviceLocationOptions={serviceLocationOptions}
                                                serviceLocationType={serviceLocationType}
                                                setServiceLocationType={setServiceLocationType}
                                                serviceProviderLocation={serviceProviderLocation}
                                                setServiceProviderLocation={setServiceProviderLocation}
                                                setServiceProviderLocationPickerOpen={setServiceProviderLocationPickerOpen}
                                                serviceAreaList={serviceAreaList}
                                                serviceAreasHelperText={serviceAreasHelperText}
                                                serviceAreaDraft={serviceAreaDraft}
                                                setServiceAreaDraft={setServiceAreaDraft}
                                                addServiceArea={addServiceArea}
                                                removeServiceArea={removeServiceArea}
                                            />

                                            <ServiceIntakeFormEditor
                                                serviceClientRequirements={serviceClientRequirements}
                                                setServiceClientRequirements={setServiceClientRequirements}
                                                automaticCustomerLocationField={automaticCustomerLocationField}
                                                serviceIntakeForm={serviceIntakeForm}
                                                intakeFieldTypes={intakeFieldTypes}
                                                addServiceIntakeField={addServiceIntakeField}
                                                updateServiceIntakeField={updateServiceIntakeField}
                                                removeServiceIntakeField={removeServiceIntakeField}
                                            />

                                            <ServiceBookingChannelEditor
                                                serviceBookingMode={serviceBookingMode}
                                                setServiceBookingMode={setServiceBookingMode}
                                                serviceBookingProvider={serviceBookingProvider}
                                                setServiceBookingProvider={setServiceBookingProvider}
                                                serviceContactType={serviceContactType}
                                                setServiceContactType={setServiceContactType}
                                                serviceContactValue={serviceContactValue}
                                                setServiceContactValue={setServiceContactValue}
                                                url={url}
                                                setUrl={setUrl}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Price row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {retailPriceEnabled && (step !== 'service' || serviceNeedsCatalogPrice) ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                {step === 'service' ? 'Bei Kamili Mteja Atalipa (TZS)' : 'Bei ya Reja Reja (TZS)'}
                                            </label>
                                            <Input
                                                type="number"
                                                placeholder="Mf. 10000"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                                className={`h-14 text-xl font-black ${step === 'digital' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}
                                            />
                                            {step === 'service' && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    Bei hii inafuata namna huduma inavyouzwa: kwa booking, rental unit, session, au package.
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    {step === 'service' ? 'Bei ya kulinganisha' : 'Bei ya awali'}
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (showComparePrice) {
                                                            setComparePrice('');
                                                        }
                                                        setShowComparePrice((value) => !value);
                                                    }}
                                                    className="text-[11px] font-black text-brand-700 hover:text-brand-800"
                                                >
                                                    {showComparePrice ? 'Ondoa' : 'Ongeza'}
                                                </button>
                                            </div>
                                            {showComparePrice ? (
                                                <>
                                                    <Input
                                                        type="number"
                                                        placeholder="Mf. 15000"
                                                        value={comparePrice}
                                                        onChange={e => setComparePrice(e.target.value)}
                                                        className="h-14 text-xl font-black border-dashed"
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Optional. Tumia tu kama unataka kuonyesha punguzo, bei ya kawaida, au reference kwa mteja.
                                                    </p>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowComparePrice(true)}
                                                    className="h-14 w-full rounded-xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-500 hover:border-brand-200 hover:text-brand-700"
                                                >
                                                    Hakuna bei ya kulinganisha
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : wholesaleOnly ? (
                                    <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 font-medium">
                                        Wholesale-only product. Bei ya mteja itatoka kwenye pricing tiers na proforma ya Takeer SafePay.
                                    </div>
                                ) : (
                                    <div className="sm:col-span-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 font-medium">
                                        Service hii ni ya <span className="font-black uppercase">{serviceMode === 'request_quote' ? 'Request/Quote' : serviceMode === 'showcase_only' ? 'Showcase' : 'Contact/Booking'}</span>. Hakuna bei ya checkout inayohitajika.
                                    </div>
                                )}
                            </div>

                            {step === 'physical' && (
                                <ProductCertificatesEditor
                                    productCertificates={productCertificates}
                                    selectedProductCertificateIds={selectedProductCertificateIds}
                                    toggleProductCertificate={toggleProductCertificate}
                                    certificateTypeLabel={certificateTypeLabel}
                                    certificateForm={certificateForm}
                                    setCertificateForm={setCertificateForm}
                                    certificateOwnershipOptions={CERTIFICATE_OWNERSHIP_OPTIONS}
                                    certificateAuthorityOptions={CERTIFICATE_AUTHORITY_OPTIONS}
                                    saveProductCertificate={saveProductCertificate}
                                    isSavingCertificate={isSavingCertificate}
                                />
                            )}

                            <AutoPostTargetsPanel value={autoPostTargets} onChange={setAutoPostTargets} />

                            <Button
                                onClick={publishProduct}
                                disabled={images.some(img => img.isUploading) || isUploadingProductDetailSectionImage || (digitalDeliveryMode === 'upload' && digitalFile?.isUploading) || (digitalDeliveryMode === 'video_stream' && paidVideoFile?.isUploading) || (digitalDeliveryMode === 'audio_stream' && paidAudioFile?.isUploading) || (digitalDeliveryMode === 'gallery_pack' && paidGalleryItems.some(item => item.isUploading))}
                                className={`w-full h-14 text-lg font-bold text-white rounded-2xl shadow-xl transition-all transform active:scale-95 ${step === 'digital' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'}`}
                            >
                                Weka Sokoni Sasa <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* ── Refined Hotspot Modal: Full Power Edition ── */}
                {showHotspotModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                        <div className="w-full max-w-4xl h-[90vh] bg-background rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in zoom-in-95">
                            {/* Left Side: Interactive Image */}
                            <div className="flex-1 bg-accent/20 relative overflow-hidden flex items-center justify-center p-4 border-r border-border/50">
                                <div
                                    className="relative aspect-[4/5] max-h-full rounded-2xl overflow-hidden shadow-2xl cursor-crosshair group touch-none"
                                    ref={imageContainerRef}
                                    onClick={handleImageClick}
                                >
                                    <img
                                        src={images[currentImageIndex]?.localUrl}
                                        alt="Editor"
                                        className="w-full h-full object-cover select-none pointer-events-none"
                                    />

                                    {(hotspots[currentImageIndex] || []).map((spot, idx) => (
                                        <div
                                            key={spot.id}
                                            className="absolute -translate-x-1/2 -translate-y-1/2"
                                            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                                        >
                                            <div className="relative group/spot">
                                                <div className="absolute inset-0 bg-brand-500/40 rounded-full animate-ping group-hover:bg-red-500/40" />
                                                <div className="h-8 w-8 bg-black/80 backdrop-blur-md rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors z-10 relative">
                                                    {spot.type === 'product' && <MapPin className="h-4 w-4 text-white" />}
                                                    {spot.type === 'link' && <LinkIcon className="h-4 w-4 text-white" />}
                                                    {spot.type === 'text' && <Edit3 className="h-4 w-4 text-white" />}
                                                </div>

                                                {/* Tooltip on hover */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover/spot:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-xl">
                                                    Bofya kulia/vuta kuondoa
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Temporary placement indicator */}
                                    {pendingHotspot && (
                                        <div
                                            className="absolute -translate-x-1/2 -translate-y-1/2 h-8 w-8 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center animate-pulse shadow-lg"
                                            style={{ left: `${pendingHotspot.x}%`, top: `${pendingHotspot.y}%` }}
                                        >
                                            <Plus className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em] pointer-events-none">
                                    Bofya pichani kuweka alama
                                </div>
                            </div>

                            {/* Right Side: Controls */}
                            <div className="w-full md:w-80 flex flex-col bg-background">
                                <div className="p-6 border-b flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-xl">Hotspots</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Image {currentImageIndex + 1}</p>
                                    </div>
                                    <button onClick={() => setShowHotspotModal(false)} className="h-10 w-10 bg-accent rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {!pendingHotspot ? (
                                        <div className="space-y-4">
                                            {(hotspots[currentImageIndex] || []).length === 0 ? (
                                                <div className="py-12 text-center space-y-3">
                                                    <div className="h-16 w-16 bg-accent rounded-3xl flex items-center justify-center mx-auto opacity-40">
                                                        <MapPin className="h-8 w-8" />
                                                    </div>
                                                    <p className="text-sm text-muted-foreground font-medium">Bofya picha iliyo kushoto kuongeza hotspot ya kwanza.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Alama Zilizowekwa</label>
                                                    {(hotspots[currentImageIndex] || []).map((spot, idx) => (
                                                        <div key={idx} className="group flex items-center gap-3 p-3 bg-accent/30 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100 overflow-hidden">
                                                            <div className="h-8 w-8 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                                                {spot.type === 'product' && <ShoppingBag className="h-4 w-4" />}
                                                                {spot.type === 'link' && <LinkIcon className="h-4 w-4" />}
                                                                {spot.type === 'text' && <Info className="h-4 w-4" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-black uppercase text-foreground truncate">{spot.type}</p>
                                                                <p className="text-[10px] text-muted-foreground truncate font-medium">{spot.data}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => removeHotspot(idx)}
                                                                className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-6 animate-in slide-in-from-right-4">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest">1. Chagua Aina ya Alama</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { id: 'product', icon: ShoppingBag, label: 'Bidhaa' },
                                                        { id: 'link', icon: LinkIcon, label: 'Link' },
                                                        { id: 'text', icon: Info, label: 'Maelezo' },
                                                    ].map(t => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => { setHotspotType(t.id); setHotspotData(''); }}
                                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${hotspotType === t.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border text-muted-foreground hover:border-brand-200'}`}
                                                        >
                                                            <t.icon className="h-5 w-5" />
                                                            <span className="text-[9px] font-black uppercase tracking-tighter">{t.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-2 border-t border-dashed border-border">
                                                <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest">2. Taarifa za Alama</label>

                                                {hotspotType === 'product' ? (
                                                    <div className="space-y-3">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="Tafuta bidhaa zako..."
                                                                className="pl-10 h-11 text-xs border-brand-100 focus:ring-brand-500"
                                                                value={searchQuery}
                                                                onChange={e => setSearchQuery(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                                            {merchantProducts
                                                                .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
                                                                .map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        onClick={() => setHotspotData(p.id.toString())}
                                                                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${hotspotData === p.id.toString() ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-accent'}`}
                                                                    >
                                                                        <div className="h-8 w-8 bg-background rounded-lg overflow-hidden shrink-0 border border-white/20">
                                                                            <img src={p.images?.[0]?.image_url || '/placeholder.png'} className="w-full h-full object-cover" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[10px] font-bold truncate leading-tight">{p.title}</p>
                                                                            <p className={`text-[9px] ${hotspotData === p.id.toString() ? 'text-white/70' : 'text-muted-foreground'}`}>TZS {parseFloat(p.price).toLocaleString()}</p>
                                                                        </div>
                                                                        {hotspotData === p.id.toString() && <CheckCircle className="h-4 w-4" />}
                                                                    </button>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {hotspotType === 'link' ? (
                                                            <Input
                                                                placeholder="https://mfano.co.tz/bidhaa"
                                                                className="h-11 text-xs"
                                                                value={hotspotData}
                                                                onChange={e => setHotspotData(e.target.value)}
                                                            />
                                                        ) : (
                                                            <Textarea
                                                                placeholder="Hii ni bidhaa bora kabisa..."
                                                                className="min-h-[80px] text-xs"
                                                                value={hotspotData}
                                                                onChange={e => setHotspotData(e.target.value)}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    className="flex-1 h-12 text-xs font-bold rounded-xl"
                                                    onClick={() => { setPendingHotspot(null); }}
                                                >
                                                    Ghairi
                                                </Button>
                                                <Button
                                                    className="flex-[2] h-12 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20"
                                                    onClick={saveHotspot}
                                                    disabled={!hotspotData}
                                                >
                                                    Hifadhi Alama
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 border-t bg-accent/10">
                                    <Button
                                        onClick={() => setShowHotspotModal(false)}
                                        className="w-full h-12 font-black tracking-widest uppercase text-xs rounded-2xl"
                                    >
                                        Imekamilika
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Dialog
                    open={swatchModalOpen}
                    onOpenChange={(open) => {
                        setSwatchModalOpen(open);
                        if (!open) {
                            setSwatchFile(null);
                            setSwatchVariantIndex(null);
                            setSwatchDragOver(false);
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Swatch Image</DialogTitle>
                            <DialogDescription>
                                Swatch ni picha ndogo ya variant (mfano rangi au texture) inayoonekana kwa mteja wakati wa kuchagua bidhaa.
                                Inashauriwa kutumia picha ya square, hasa 100x100 px.
                            </DialogDescription>
                        </DialogHeader>

                        <div
                            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${swatchDragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50'}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setSwatchDragOver(true);
                            }}
                            onDragLeave={() => setSwatchDragOver(false)}
                            onDrop={onSwatchDrop}
                        >
                            <p className="text-sm font-semibold text-slate-700">Buruta picha hapa</p>
                            <p className="text-xs text-slate-500 mt-1">au tumia Chagua picha / Piga picha.</p>
                            {swatchFile && (
                                <p className="text-xs font-bold text-brand-700 mt-2">Selected: {swatchFile.name}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" onClick={() => swatchFileInputRef.current?.click()}>
                                Chagua picha
                            </Button>
                            <Button type="button" variant="outline" onClick={() => swatchCameraInputRef.current?.click()}>
                                Piga picha
                            </Button>
                        </div>

                        <input
                            ref={swatchFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setSwatchFile(file);
                            }}
                        />
                        <input
                            ref={swatchCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setSwatchFile(file);
                            }}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setSwatchModalOpen(false)}>Ghairi</Button>
                            <Button type="button" className="bg-brand-600 hover:bg-brand-700 text-white" onClick={submitSwatchModal}>
                                Pakia Swatch
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <AddressPickerModal
                    isOpen={serviceProviderLocationPickerOpen}
                    onOpenChange={setServiceProviderLocationPickerOpen}
                    initialLat={serviceProviderLocation?.lat}
                    initialLng={serviceProviderLocation?.lng}
                    initialAddress={serviceProviderLocation?.address}
                    initialExtraDetails={serviceProviderLocation?.extraDetails}
                    onSave={(location) => setServiceProviderLocation({
                        ...location,
                        name: serviceProviderLocation?.name || '',
                    })}
                />

                <PolicyNotice />
            </div>
        </AppLayout>
    );
}
