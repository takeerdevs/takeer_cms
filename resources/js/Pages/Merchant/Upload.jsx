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
    Plus, Search, Trash2, Info, Store, Boxes, Crown, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import PolicyNotice from '@/Components/PolicyNotice';

const CATEGORIES = ['Nguo', 'Viatu', 'Simu na Vifaa', 'Chakula', 'Nyumba na Bustani', 'Michezo', 'Watoto', 'Afya & Uzuri', 'Nyingine'];

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

export default function Upload({ merchantUsername }) {
    const fileInputRef = useRef(null);
    const imageContainerRef = useRef(null);
    const digitalFileRef = useRef(null);
    const coverImageRef = useRef(null);
    const { auth } = usePage().props;
    const currentMerchant = auth?.user?.merchant_profiles?.find(m => m.username === merchantUsername)
        || auth?.user?.merchant_profiles?.[0] || {};

    // Flow state: 'select', 'physical', 'digital', 'service'
    const [step, setStep] = useState('select');

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

    // Digital dual-mode: 'upload' (direct file) or 'link' (external URL)
    const [digitalDeliveryMode, setDigitalDeliveryMode] = useState('upload');
    const [digitalFile, setDigitalFile] = useState(null); // { name, url, size, type, isUploading }

    // Service dual-mode: 'internal' (WhatsApp/phone) or 'external' (Calendly/booking link)
    const [serviceBookingMode, setServiceBookingMode] = useState('internal');
    const [serviceContactType, setServiceContactType] = useState('whatsapp'); // 'whatsapp' | 'phone' | 'inperson'
    const [serviceContactValue, setServiceContactValue] = useState(''); // phone number for whatsapp/phone
    const [servicePricingModel, setServicePricingModel] = useState('fixed_price');
    const [serviceBookingType, setServiceBookingType] = useState('instant');
    const [serviceHourlyRate, setServiceHourlyRate] = useState('');
    const [serviceMinHours, setServiceMinHours] = useState('1');
    const [serviceDepositAmount, setServiceDepositAmount] = useState('');
    const [serviceIsShowcase, setServiceIsShowcase] = useState(false);

    const [price, setPrice] = useState('');
    const [comparePrice, setComparePrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [locationInventories, setLocationInventories] = useState({}); // { location_id: quantity }
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
    const [digitalAccessTab, setDigitalAccessTab] = useState('plan');
    const [assignedAccessGroup, setAssignedAccessGroup] = useState(null); // { id, type, title }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        const typeParam = params.get('type');
        if (editId) {
            setProductId(editId);
            loadProductForEdit(editId);
        } else if (['physical', 'digital', 'service'].includes(typeParam)) {
            setProductType(typeParam);
            setStep(typeParam);
            if (typeParam === 'physical') setShowManualForm(true);
        }
        fetchCatalogRoot();
        fetchMerchantProducts();
        fetchPromotables();
        fetchShippingProfiles();
    }, []);

    const fetchCatalogRoot = async () => {
        try {
            const res = await axios.get('/merchant/catalog/schema');
            setCatalogCategories(res.data?.categories || []);
        } catch (error) {
            console.error('Failed to fetch catalog root schema', error);
        }
    };

    const fetchCatalogForCategory = async (categoryId) => {
        if (!categoryId) {
            setSelectedCatalogSchema(null);
            return;
        }
        try {
            const res = await axios.get('/merchant/catalog/schema', { params: { category_id: categoryId } });
            setSelectedCatalogSchema(res.data?.selected || null);
        } catch (error) {
            console.error('Failed to fetch category schema', error);
        }
    };

    const fetchMerchantProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const res = await axios.get('/merchant/products/api');
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
                axios.get('/merchant/bundles/api'),
                axios.get('/merchant/subscription-plans/api'),
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
    const openHotspotEditor = (index) => {
        setCurrentImageIndex(index);
        setShowHotspotModal(true);
    };

    const loadProductForEdit = async (id) => {
        setIsLoadingEdit(true);
        try {
            const res = await axios.get(`/merchant/products/${id}/api`);
            const p = res.data.data || res.data;

            setProductType(p.type);
            setStep(p.type);
            setManualTitle(p.title);
            setPrice(p.price);
            setComparePrice(p.compare_at_price || '');
            setQuantity(p.inventory_count);
            setSelectedShippingProfileId(p.shipping_profile_id ? String(p.shipping_profile_id) : '');
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
                        value_text: value.value_text ?? '',
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
                quantity: variant.inventory_count ?? 0,
                location_inventories: (variant.location_inventories || []).reduce((acc, inv) => {
                    acc[inv.merchant_location_id] = inv.quantity;
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
                    acc[inv.merchant_location_id] = inv.quantity;
                    return acc;
                }, {}));
            }

            const schemaCategoryId = p.attributes?.sub_category_id || p.attributes?.category_id;
            if (schemaCategoryId) {
                await fetchCatalogForCategory(schemaCategoryId);
            }

            // Load images for all product types
            if (p.images && p.images.length > 0) {
                const mappedImages = (p.images || []).map(img => ({
                    url: img.image_url,
                    localUrl: img.image_url,
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
                // Logic: if it contains 'digital-products' or doesn't start with http, it's likely an upload
                if (p.url && (p.url.includes('digital-products') || !p.url.startsWith('http'))) {
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
                setServicePricingModel(p.service_pricing_model || 'fixed_price');
                setServiceBookingType(p.service_booking_type || 'instant');
                setServiceHourlyRate(p.service_hourly_rate ?? '');
                setServiceMinHours(p.service_min_hours ?? '1');
                setServiceDepositAmount(p.service_deposit_amount ?? '');
                setServiceIsShowcase(!!p.service_is_showcase);
                if (p.url && p.url.includes(':') && !p.url.startsWith('http')) {
                    setServiceBookingMode('internal');
                    const [t, v] = p.url.split(':');
                    setServiceContactType(t);
                    setServiceContactValue(v);
                } else {
                    setServiceBookingMode('external');
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
    const serviceNeedsCatalogPrice = !serviceIsShowcase && (
        servicePricingModel === 'fixed_price'
        || servicePricingModel === 'hourly_rate'
        || servicePricingModel === 'deposit_required'
    );
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
            const current = normalizeText(category?.name);
            return current === target || current.includes(target) || target.includes(current);
        }) || null;
    };
    const findSubCategoryByLabel = (children, label) => {
        const target = normalizeText(label);
        if (!target) return null;
        return (children || []).find((child) => {
            const current = normalizeText(child?.name);
            return current === target || current.includes(target) || target.includes(current);
        }) || null;
    };

    const onSelectRootCategory = async (value) => {
        setSelectedCategoryId(value);
        setSelectedSubCategoryId('');
        setSelectedBrandId('');
        setSelectedModelId('');
        setDynamicAttributeValues({});
        setHasVariants(false);
        setVariantDecision(null);
        setPhysicalFlowStep(1);
        setManualStepCompleted(false);
        setVariants([]);
        if (value) {
            await fetchCatalogForCategory(value);
            const name = findCategoryName(Number(value));
            if (name) setManualCategory(name);
        } else {
            setSelectedCatalogSchema(null);
        }
    };

    const onSelectSubCategory = async (value) => {
        setSelectedSubCategoryId(value);
        setSelectedBrandId('');
        setSelectedModelId('');
        setDynamicAttributeValues({});
        setHasVariants(false);
        setVariantDecision(null);
        setPhysicalFlowStep(1);
        setManualStepCompleted(false);
        setVariants([]);
        if (value) {
            await fetchCatalogForCategory(value);
            const name = findCategoryName(Number(value));
            if (name) setManualCategory(name);
        } else if (selectedCategoryId) {
            await fetchCatalogForCategory(selectedCategoryId);
            const name = findCategoryName(Number(selectedCategoryId));
            if (name) setManualCategory(name);
        }
    };

    const handleTypeSelect = (type) => {
        setProductType(type);
        setStep(type);
        if (type === 'physical') {
            setShowManualForm(true);
            setManualStepCompleted(false);
            setPhysicalFlowStep(1);
        }
    };

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const startIndex = images.length;
        const newImages = files.map((file, idx) => ({
            file,
            localUrl: URL.createObjectURL(file),
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
            const res = await axios.post('/merchant/upload/media', formData, {
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
            toast.error('Imeshindwa kupakia picha.');
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
            const res = await axios.post('/merchant/upload/media', formData, {
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
    const isVariantConfigured = (variant) => {
        const name = (variant?.name || '').trim();
        const rawPrice = variant?.price;
        const rawQuantity = variant?.quantity;
        const hasPrice = rawPrice !== '' && rawPrice !== null && !Number.isNaN(Number(rawPrice));
        const hasQuantity = rawQuantity !== '' && rawQuantity !== null && !Number.isNaN(Number(rawQuantity));
        return !!name && hasPrice && hasQuantity;
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
            const name = variantAxisAttributes
                .map((axis) => attributeValues[axis.key])
                .filter(Boolean)
                .join(' / ');

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

    const analyzeImageWithAI = async (imageUrl) => {
        setIsAnalyzing(true);
        toast.loading('AI inaangalia picha yako...', { id: 'ai-analyze' });

        try {
            const res = await axios.post('/merchant/upload/draft', {
                image_url: imageUrl
            });

            const draft = res.data.ai_draft || {};
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

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'private'); // Important: secure digital files behind S3 bucket
        formData.append('folder', 'digital-products');

        try {
            const res = await axios.post('/merchant/upload/media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setDigitalFile(prev => ({ ...prev, progress: percentCompleted }));
                }
            });
            setDigitalFile(prev => ({ ...prev, isUploading: false, progress: 100, url: res.data.url }));
        } catch (err) {
            toast.error('Imeshindwa kupakia faili lako la digitali.');
            setDigitalFile(prev => ({ ...prev, isUploading: false, error: true }));
        }
    };

    const publishProduct = async () => {
        const serviceNeedsCatalogPrice = step === 'service' && !serviceIsShowcase && (
            servicePricingModel === 'fixed_price'
            || servicePricingModel === 'hourly_rate'
            || servicePricingModel === 'deposit_required'
        );
        if (
            !price
            && !(step === 'digital' && assignedAccessGroup)
            && !(step === 'physical' && hasVariants)
            && !(
                step === 'service' && (
                    servicePricingModel === 'contract_quote'
                    || servicePricingModel === 'showcase_only'
                    || serviceIsShowcase
                    || servicePricingModel === 'deposit_required'
                    || servicePricingModel === 'hourly_rate'
                )
            )
        ) {
            toast.error('Tafadhali weka bei ya bidhaa au assign access group.');
            return;
        }
        if (step === 'physical' && !hasVariants) {
            const hasStock = Object.values(locationInventories).some(v => Number(v) > 0);
            if (!hasStock) {
                // If no specific location stock set, we might fallback to primary in backend, 
                // but let's warn if even the legacy quantity is missing.
                if (!quantity) {
                    toast.error('Tafadhali weka idadi ya bidhaa iliyopo (Stock).');
                    return;
                }
            }
        }
        if (step === 'physical' && images.length === 0) {
            toast.error('Tafadhali ongeza angalau picha moja ya bidhaa.');
            return;
        }
        if (step === 'physical' && !selectedCategoryId) {
            toast.error('Tafadhali chagua category ya bidhaa.');
            return;
        }
        if (step === 'physical' && physicalFlowStep < 3) {
            toast.error('Kamilisha hatua za juu kwanza.');
            return;
        }
        if (step === 'physical' && variantAxisAttributes.length > 0 && variantDecision === null) {
            toast.error('Chagua kama bidhaa ina variants au la.');
            return;
        }
        if (step === 'physical' && hasVariants) {
            const configuredVariants = variants.filter(isVariantConfigured);
            if (configuredVariants.length === 0) {
                toast.error('Jaza angalau variant moja yenye bei.');
                return;
            }
            const invalidVariantQuantity = configuredVariants.find((variant) => Number(variant.quantity) < 0 || Number.isNaN(Number(variant.quantity)));
            if (invalidVariantQuantity) {
                toast.error('Quantity ya variant lazima iwe 0 au zaidi.');
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
            return !(current.value_text || '').toString().trim();
        });
        if (step === 'physical' && missingRequiredAttribute) {
            toast.error(`Tafadhali jaza ${missingRequiredAttribute.label}.`);
            return;
        }
        if (step === 'digital') {
            if (digitalDeliveryMode === 'upload' && !digitalFile) {
                toast.error('Tafadhali pakia faili la bidhaa yako.');
                return;
            }
            if (digitalDeliveryMode === 'link' && !url) {
                toast.error('Tafadhali weka link ya kupakua.');
                return;
            }
        }
        if (step === 'service') {
            if (servicePricingModel === 'hourly_rate' && !serviceHourlyRate) {
                toast.error('Tafadhali weka bei kwa saa.');
                return;
            }
            if (servicePricingModel === 'deposit_required' && !serviceDepositAmount) {
                toast.error('Tafadhali weka kiasi cha deposit.');
                return;
            }
            if (serviceBookingMode === 'internal' && !serviceContactValue) {
                toast.error('Tafadhali weka namba ya simu au WhatsApp.');
                return;
            }
            if (serviceBookingMode === 'external' && !url) {
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
        if (images.some(img => img.isUploading)) {
            toast.error('Tafadhali subiri picha zimalize kupanda.');
            return;
        }

        if (step === 'digital' && digitalDeliveryMode === 'upload' && digitalFile?.isUploading) {
            toast.error('Tafadhali subiri faili la digitali limalize kupanda.');
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
            const res = await axios.post('/merchant/upload/publish', {
                image_urls: images.map(img => img.url).filter(Boolean),
                hotspots: hotspots,
                type: productType,
                // Digital product: either the uploaded file or external link
                digital_file_url: (step === 'digital' && digitalDeliveryMode === 'upload') ? digitalFile?.url : null,
                url: step === 'digital'
                    ? (digitalDeliveryMode === 'link' ? url : null)
                    : step === 'service'
                        ? (serviceBookingMode === 'external' ? url : `${serviceContactType}:${serviceContactValue}`)
                        : null,
                price: step === 'service'
                    ? (
                        servicePricingModel === 'hourly_rate'
                            ? (serviceHourlyRate === '' ? 0 : parseFloat(serviceHourlyRate))
                            : servicePricingModel === 'deposit_required'
                                ? (serviceDepositAmount === '' ? 0 : parseFloat(serviceDepositAmount))
                                : (serviceIsShowcase || servicePricingModel === 'contract_quote' || servicePricingModel === 'showcase_only')
                                    ? 0
                                    : (price === '' ? 0 : parseFloat(price))
                    )
                    : (price === '' ? 0 : parseFloat(price)),
                compare_price: comparePrice ? parseFloat(comparePrice) : null,
                service_pricing_model: step === 'service' ? servicePricingModel : 'fixed_price',
                service_booking_type: step === 'service' ? serviceBookingType : 'instant',
                service_hourly_rate: step === 'service' && servicePricingModel === 'hourly_rate'
                    ? Number(serviceHourlyRate || 0)
                    : null,
                service_min_hours: step === 'service' && servicePricingModel === 'hourly_rate'
                    ? Number(serviceMinHours || 1)
                    : null,
                service_deposit_amount: step === 'service' && servicePricingModel === 'deposit_required'
                    ? Number(serviceDepositAmount || 0)
                    : null,
                service_is_showcase: step === 'service' ? serviceIsShowcase : false,
                quantity: step === 'physical' && !hasVariants ? parseInt(quantity) : 99999,
                has_variants: step === 'physical' ? hasVariants : false,
                variants: publishVariants.map((variant, index) => ({
                    name: variant.name,
                    sku: variant.sku || null,
                    price: variant.price !== '' ? Number(variant.price) : null,
                    compare_price: variant.compare_price !== '' ? Number(variant.compare_price) : null,
                    quantity: Number(variant.quantity || 0),
                    attributes: variant.attributes || {},
                    swatch_image_url: variant.swatch_image_url || null,
                    is_active: true,
                    sort_order: index,
                    location_inventories: variant.location_inventories || {},
                })),
                location_inventories: locationInventories,
                shipping_profile_id: selectedShippingProfileId,
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
                        value_text: attr.input_type === 'text' ? (current.value_text || '') : null,
                        value_number: attr.input_type === 'number' && current.value_number !== '' ? Number(current.value_number) : null,
                        value_boolean: attr.input_type === 'boolean' ? !!current.value_boolean : null,
                        value_json: attr.input_type === 'select'
                            ? ((current.value_text || '').trim() ? [current.value_text] : [])
                            : attr.input_type === 'number' && attr.ui_hint === 'number_with_unit'
                                ? { unit: defaultUnitForAttribute(attr, current) || null }
                                : (Array.isArray(current.value_json) ? current.value_json : []),
                    };
                }),
                description: description, // Include description in the payload
                product_id: productId,
                shipping_profile_id: selectedShippingProfileId ? Number(selectedShippingProfileId) : null,
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
        if (variantAxisAttributes.length > 0 && variantDecision === null) {
            toast.error('Chagua kama bidhaa ina variants au la.');
            return;
        }
        toast.loading('Inaunda bidhaa...', { id: 'manual-draft' });
        try {
            const res = await axios.post('/merchant/upload/manual', {
                title: manualTitle,
                category: manualCategory,
                category_id: selectedCategoryId ? Number(selectedCategoryId) : null,
                sub_category_id: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
            });
            const data = res.data;
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
        setDigitalDeliveryMode('upload');
        setServiceBookingMode('internal');
        setServiceContactType('whatsapp');
        setServiceContactValue('');
        setServicePricingModel('fixed_price');
        setServiceBookingType('instant');
        setServiceHourlyRate('');
        setServiceMinHours('1');
        setServiceDepositAmount('');
        setServiceIsShowcase(false);
        setPrice('');
        setComparePrice('');
        setQuantity('');
        setDescription(''); // Reset description
        setErrorDetail(null);
        setShowManualForm(false);
        setManualStepCompleted(false);
        setManualTitle('');
        setManualCategory(CATEGORIES[0]);
        setProductId(null);
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
            await axios.post(`/merchant/products/${productId}/hotspots`, {
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

    if (step === 'select') {
        return (
            <AppLayout>
                <Head title="Chagua Aina ya Bidhaa | Takeer" />
                <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 pb-24">
                    <div className="flex flex-col items-center justify-center space-y-6">
                        {/* ── Merchant Identity ── */}
                        <div className="flex flex-col items-center gap-2 mt-4">
                            {currentMerchant.avatar_url ? (
                                <img
                                    src={currentMerchant.avatar_url}
                                    alt={currentMerchant.display_name}
                                    className="h-20 w-20 rounded-full object-cover ring-4 ring-brand-100 shadow-md"
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
                                Unataka kuuza nini leo? <Sparkles className="h-6 w-6 text-brand-600" />
                            </h1>
                            <p className="text-muted-foreground">Chagua aina ya bidhaa ili tuanze kuikuza.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => handleTypeSelect('physical')}
                            className="group relative flex items-center gap-6 p-6 bg-white border border-border rounded-[2rem] hover:border-brand-500 hover:ring-4 hover:ring-brand-500/10 transition-all text-left shadow-sm"
                        >
                            <div className="h-16 w-16 bg-brand-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <ShoppingBag className="h-8 w-8 text-brand-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Bidhaa za Kushikika</h3>
                                <p className="text-sm text-muted-foreground mt-1">Nguo, viatu, simu, n.k. (Inatumia AI na Hotspots)</p>
                            </div>
                            <ChevronRight className="h-6 w-6 ml-auto text-muted-foreground opacity-50 text-brand-600" />
                        </button>

                        <button
                            onClick={() => handleTypeSelect('digital')}
                            className="group relative flex items-center gap-6 p-6 bg-white border border-border rounded-[2rem] hover:border-blue-500 hover:ring-4 hover:ring-blue-500/10 transition-all text-left shadow-sm"
                        >
                            <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Globe className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Digital / File</h3>
                                <p className="text-sm text-muted-foreground mt-1">E-books, kozi, picha, au link ya kupakua.</p>
                            </div>
                            <ChevronRight className="h-6 w-6 ml-auto text-muted-foreground opacity-50 group-hover:text-blue-600" />
                        </button>

                        <button
                            onClick={() => handleTypeSelect('service')}
                            className="group relative flex items-center gap-6 p-6 bg-white border border-border rounded-[2rem] hover:border-purple-500 hover:ring-4 hover:ring-purple-500/10 transition-all text-left shadow-sm"
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
            <Head title="Weka Bidhaa Mpya | Takeer" />

            <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => resetForm()}
                        className="h-10 w-10 bg-accent rounded-full flex items-center justify-center hover:bg-accent/80 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2">
                            {step === 'physical' ? 'Bidhaa Mpya' : step === 'digital' ? 'Bidhaa ya Digital' : 'Huduma Mpya'}
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
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Picha za Bidhaa</label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                className="group relative aspect-[4/5] bg-accent rounded-[1.5rem] overflow-hidden border-2 border-transparent hover:border-brand-500 transition-all cursor-pointer shadow-sm"
                                onClick={() => openHotspotEditor(idx)}
                            >
                                <img src={img.localUrl} alt={`Picha ${idx + 1}`} className="w-full h-full object-cover" />

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
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Gusa kuweka Hotspot</span>
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
                                <span className="text-[11px] font-black text-brand-900 block uppercase tracking-wider">Ongeza Picha</span>
                                <span className="text-[9px] text-brand-600 font-bold opacity-60">Slot {images.length + 1}</span>
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageSelect}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic font-medium px-1">Tip: Click an image to add interactive hotspots like "Buy Now" tags or external links.</p>
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
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jina la Bidhaa</label>
                                        <Input
                                            placeholder="Mf. Viatu vya Ngozi Nyekundu"
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
                                            onChange={async (e) => onSelectRootCategory(e.target.value)}
                                        >
                                            <option value="">Chagua kategoria</option>
                                            {(catalogCategories || []).map((category) => (
                                                <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedSubCategories.length > 0 && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subcategory</label>
                                            <select
                                                className="w-full h-12 rounded-xl border border-input bg-background px-3 text-sm"
                                                value={selectedSubCategoryId}
                                                onChange={async (e) => onSelectSubCategory(e.target.value)}
                                            >
                                                <option value="">Hakuna subcategory maalum</option>
                                                {selectedSubCategories.map((child) => (
                                                    <option key={child.id} value={child.id}>{child.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {step === 'physical' && variantAxisAttributes.length > 0 && (
                                        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Variants Setup</p>
                                                <p className="text-sm text-slate-700">
                                                    Je, una {manualTitle || 'hii bidhaa'} zaidi ya moja zenye tofauti ya {variantAxisAttributes.map((axis) => axis.label).join(' / ')}?
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
                                                    Hapana, ni bidhaa moja tu
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
                                                    Ndio, zina variants
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
                                        <h3 className="font-bold uppercase tracking-widest text-xs">Facets & Specifications</h3>
                                    </div>
                                    <CardContent className="p-5 space-y-4">
                                        {selectedSchemaBrands.length > 0 && (
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

                                        {facetAttributesForForm.length > 0 && (
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

                                        {hasVariants && variantAxisAttributes.length > 0 && (
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

                                        {step === 'physical' && physicalFlowStep >= 3 && (
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

                                        {step === 'physical' && physicalFlowStep >= 3 && hasVariants && (
                                            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                                <div className="space-y-3">
                                                    <div className="space-y-2">
                                                        {variants.map((variant, index) => (
                                                            <div key={variant.id || index} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="font-semibold text-slate-900">{variant.name}</p>
                                                                </div>

                                                                <div className="flex flex-wrap gap-2">
                                                                    {variantAxisAttributes.length > 0
                                                                        ? variantAxisAttributes.map((axis) => (
                                                                            <span key={`${variant.id || index}-${axis.key}`} className="inline-flex items-center rounded-full border border-slate-300 px-2 py-1 text-xs">
                                                                                {axis.label}: {variant.attributes?.[axis.key] || '-'}
                                                                            </span>
                                                                        ))
                                                                        : Object.entries(variant.attributes || {}).map(([key, value]) => (
                                                                            <span key={`${variant.id || index}-${key}`} className="inline-flex items-center rounded-full border border-slate-300 px-2 py-1 text-xs">
                                                                                {key}: {String(value)}
                                                                            </span>
                                                                        ))
                                                                    }
                                                                </div>

                                                                <div className="grid sm:grid-cols-4 gap-2">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[11px] font-semibold text-slate-600">SKU (optional)</label>
                                                                        <Input
                                                                            className="h-10"
                                                                            placeholder="SKU"
                                                                            value={variant.sku || ''}
                                                                            onChange={(e) => setVariants((prev) => prev.map((row, idx) => idx === index ? { ...row, sku: e.target.value } : row))}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[11px] font-semibold text-slate-600">Bei (Tsh)</label>
                                                                        <Input
                                                                            type="number"
                                                                            className="h-10"
                                                                            placeholder="Bei"
                                                                            value={variant.price ?? ''}
                                                                            onChange={(e) => setVariants((prev) => prev.map((row, idx) => idx === index ? { ...row, price: e.target.value } : row))}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 sm:col-span-2">
                                                                        <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                                                                            <Store className="w-2.5 h-2.5" /> Stock kwa Maeneo
                                                                        </label>
                                                                        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                                                            {(currentMerchant?.locations || []).map((loc) => (
                                                                                <div key={loc.id} className="space-y-1">
                                                                                    <label className="text-[10px] text-slate-500 truncate block font-bold">{loc.name}</label>
                                                                                    <Input
                                                                                        type="number"
                                                                                        className="h-8 text-xs font-black bg-white"
                                                                                        placeholder="0"
                                                                                        value={variant.location_inventories?.[loc.id] || ''}
                                                                                        onChange={(e) => {
                                                                                            const val = e.target.value;
                                                                                            setVariants((prev) => prev.map((row, idx) => 
                                                                                                idx === index ? { 
                                                                                                    ...row, 
                                                                                                    location_inventories: {
                                                                                                        ...(row.location_inventories || {}),
                                                                                                        [loc.id]: val
                                                                                                    }
                                                                                                } : row
                                                                                            ));
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[11px] font-semibold text-slate-600">Picha (Mwonekano)</label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            className="h-10 w-full"
                                                                            onClick={() => openSwatchModal(index)}
                                                                        >
                                                                            {variant.isUploadingSwatch ? 'Uploading...' : 'Swatch'}
                                                                        </Button>
                                                                    </div>
                                                                </div>

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

                                {(step !== 'physical' || physicalFlowStep >= 3) && !(step === 'physical' && hasVariants) && (
                                    <Card className="border-brand-100 shadow-sm overflow-hidden rounded-[2rem]">
                                        <div className="bg-brand-50 p-4 border-b flex items-center gap-2 text-brand-800">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <h3 className="font-bold uppercase tracking-widest text-xs">Bei & Usafirishaji</h3>
                                        </div>
                                        <CardContent className="p-5 space-y-4">
                                            {step === 'physical' && (
                                                <div className="space-y-1.5 mb-2">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shipping Profile (Template)</label>
                                                    <select
                                                        className="w-full h-12 rounded-xl border border-input bg-white px-3 text-sm font-bold text-brand-700"
                                                        value={selectedShippingProfileId}
                                                        onChange={(e) => setSelectedShippingProfileId(e.target.value)}
                                                    >
                                                        <option value="">Chagua profile ya usafirishaji...</option>
                                                        {shippingProfiles.map(profile => (
                                                            <option key={profile.id} value={profile.id}>
                                                                {profile.name} {profile.is_default ? '(Default)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-muted-foreground italic">Templates hizi zimewekwa kwenye Settings {'>'} Shipping Profiles.</p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-brand-600 uppercase tracking-wider">Bei ya Sasa (TZS)</label>
                                                    <Input type="number" placeholder="Mf. 35000" className="h-12 text-lg font-black bg-brand-50 border-brand-200" value={price} onChange={e => setPrice(e.target.value)} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bei ya Awali (Strike-through)</label>
                                                    <Input type="number" placeholder="Mf. 45000" className="h-12 text-lg font-black border-dashed" value={comparePrice} onChange={e => setComparePrice(e.target.value)} />
                                                </div>
                                                {step === 'physical' && !hasVariants && (
                                                    <div className="space-y-4 sm:col-span-2">
                                                        <h3 className="font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                                                            <Store className="w-3 h-3" /> Hifadhi & Upatikanaji (Stock)
                                                        </h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {(currentMerchant?.locations || []).map((loc) => (
                                                                <div key={loc.id} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <label className="text-xs font-bold text-slate-700 truncate">{loc.name}</label>
                                                                        {loc.is_primary && (
                                                                            <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-bold border border-brand-100 uppercase">Primary</span>
                                                                        )}
                                                                    </div>
                                                                    <Input 
                                                                        type="number" 
                                                                        placeholder="0" 
                                                                        className="h-10 text-lg font-black bg-white" 
                                                                        value={locationInventories[loc.id] || ''} 
                                                                        onChange={e => setLocationInventories(prev => ({ ...prev, [loc.id]: e.target.value }))} 
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {(currentMerchant?.locations || []).length === 0 && (
                                                            <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 flex items-start gap-3">
                                                                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-bold text-orange-800">Hujajaza maeneo ya biashara</p>
                                                                    <p className="text-xs text-orange-700 leading-relaxed">
                                                                        Ili kuuza bidhaa za kimwili, unapaswa kuwa na angalau eneo moja la duka/stoo kwenye Mipangilio.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                className="w-full h-14 text-lg font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-600/20"
                                                onClick={publishProduct}
                                                disabled={images.some(img => img.isUploading)}
                                            >
                                                Weka Sokoni <ChevronRight className="ml-2 h-5 w-5" />
                                            </Button>
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
                                            <div className="space-y-1.5 mb-4">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shipping Profile (Template)</label>
                                                <select
                                                    className="w-full h-12 rounded-xl border border-input bg-white px-3 text-sm font-bold text-brand-700"
                                                    value={selectedShippingProfileId}
                                                    onChange={(e) => setSelectedShippingProfileId(e.target.value)}
                                                >
                                                    <option value="">Chagua profile ya usafirishaji...</option>
                                                    {shippingProfiles.map(profile => (
                                                        <option key={profile.id} value={profile.id}>
                                                            {profile.name} {profile.is_default ? '(Default)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                Configured variants: <span className="font-bold">{variants.filter(isVariantConfigured).length}</span> · Total stock: <span className="font-bold">{variants.filter(isVariantConfigured).reduce((sum, variant) => sum + Number(variant.quantity || 0), 0)}</span>
                                            </p>
                                            <Button
                                                className="w-full h-14 text-lg font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-600/20"
                                                onClick={publishProduct}
                                                disabled={images.some(img => img.isUploading)}
                                            >
                                                Weka Sokoni <ChevronRight className="ml-2 h-5 w-5" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </>
                )}

                {(step === 'digital' || step === 'service') && (
                    <Card className="animate-in fade-in slide-in-from-bottom-8 overflow-hidden rounded-[2rem] border-none shadow-xl">
                        {/* Header */}
                        <div className={`p-6 flex items-center gap-4 ${step === 'digital' ? 'bg-blue-600' : 'bg-purple-600'} text-white`}>
                            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                {step === 'digital' ? <Globe className="h-6 w-6" /> : <Calendar className="h-6 w-6" />}
                            </div>
                            <div>
                                <h2 className="text-xl font-black">Taarifa za {step === 'digital' ? 'Digital' : 'Huduma'}</h2>
                                <p className="text-sm opacity-80">Jaza maelezo kisha weka sokoni.</p>
                            </div>
                        </div>

                        <CardContent className="p-6 space-y-6">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jina la {step === 'digital' ? 'Bidhaa' : 'Huduma'}</label>
                                <Input
                                    placeholder={step === 'digital' ? 'Mf. E-book ya Kupika' : 'Mf. Ushauri wa Biashara'}
                                    value={manualTitle} // Using manualTitle for consistency, could be a separate state if needed
                                    onChange={e => setManualTitle(e.target.value)}
                                    className="h-14 font-semibold text-lg"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Maelezo Kamili</label>
                                <Textarea
                                    placeholder={step === 'digital' ? "Elezea kuhusu hii bidhaa, nini mteja atapata au kuna thamani gani mteja atafaidi..." : "Elezea huduma unayotoa, faida na maandalizi yoyote yenye thamani kwa mteja..."}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-[100px] rounded-2xl bg-white border-border"
                                    required
                                />
                            </div>

                            {/* ─── DIGITAL: delivery mode toggle ─── */}
                            {step === 'digital' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jinsi ya Kupeleka Bidhaa kwa Mteja</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setDigitalDeliveryMode('upload')}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'upload'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-border text-muted-foreground hover:border-blue-200'
                                                }`}
                                        >
                                            <FileUp className="h-6 w-6" />
                                            <span className="text-sm font-bold">Pakia Faili</span>
                                            <span className="text-[10px] text-center opacity-70">PDF, MP4, ZIP, n.k.</span>
                                            {digitalDeliveryMode === 'upload' && <CheckCircle className="h-4 w-4 text-blue-600" />}
                                        </button>
                                        <button
                                            onClick={() => setDigitalDeliveryMode('link')}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${digitalDeliveryMode === 'link'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-border text-muted-foreground hover:border-blue-200'
                                                }`}
                                        >
                                            <ExternalLink className="h-6 w-6" />
                                            <span className="text-sm font-bold">Link ya Nje</span>
                                            <span className="text-[10px] text-center opacity-70">Google Drive, Dropbox</span>
                                            {digitalDeliveryMode === 'link' && <CheckCircle className="h-4 w-4 text-blue-600" />}
                                        </button>
                                    </div>

                                    {/* Direct file upload */}
                                    {digitalDeliveryMode === 'upload' && (
                                        <div className="animate-in fade-in">
                                            {!digitalFile ? (
                                                <button
                                                    onClick={() => digitalFileRef.current?.click()}
                                                    className="w-full py-6 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors text-blue-700"
                                                >
                                                    <File className="h-8 w-8" />
                                                    <span className="font-bold">Bonyeza kupakia faili</span>
                                                    <span className="text-xs opacity-70">PDF, MP4, ZIP, EPUB hadi 500MB</span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.epub,.zip,.mp4,.mp3,.docx,.pptx"
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
                                            {digitalFile?.isUploading && (
                                                <div className="flex flex-col gap-2 p-4 bg-blue-50/50 border border-blue-200/50 rounded-2xl">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-bold text-blue-700 animate-pulse">Inapakia faili...</span>
                                                        <span className="text-sm font-bold text-blue-700">{digitalFile.progress}%</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                                                            style={{ width: `${digitalFile.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                Faili litahifadhiwa <b>salama</b> na Takeer. Mteja atapata link ya kupakua <b>mara baada ya kulipa</b>.
                                            </p>
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
                                </div>
                            )}

                            {/* ─── DIGITAL: Access group assignment ─── */}
                            {step === 'digital' && (
                                <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-blue-700" />
                                        <label className="text-xs font-black text-blue-700 uppercase tracking-wider">
                                            Access Group (Optional)
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-blue-900/80">
                                        Assign this download to a subscription or bundle so only entitled users can access it. You can still keep standalone price if you want.
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
                                            <p className="text-xs text-blue-700/70 py-2">Loading access groups...</p>
                                        ) : (digitalAccessTab === 'plan' ? promotables.plans : promotables.bundles).length === 0 ? (
                                            <p className="text-xs text-blue-700/70 py-2 italic">No {digitalAccessTab === 'plan' ? 'subscriptions' : 'bundles'} found.</p>
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

                            {/* ─── SERVICE: booking mode toggle ─── */}
                            {step === 'service' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aina ya Bei ya Service</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {[
                                            { key: 'fixed_price', label: 'Bei Kamili' },
                                            { key: 'hourly_rate', label: 'Kwa Saa' },
                                            { key: 'contract_quote', label: 'Nukuu/Contract' },
                                            { key: 'deposit_required', label: 'Deposit Kwanza' },
                                            { key: 'showcase_only', label: 'Onyesha Tu' },
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => setServicePricingModel(option.key)}
                                                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${servicePricingModel === option.key
                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                    : 'bg-background text-muted-foreground border-border hover:border-purple-300'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <label className="rounded-xl border border-input bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-3">
                                            <span className="text-sm font-bold">Showcase tu (hakuna checkout)</span>
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={serviceIsShowcase}
                                                onChange={(e) => setServiceIsShowcase(e.target.checked)}
                                            />
                                        </label>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Booking Flow</label>
                                            <select
                                                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                value={serviceBookingType}
                                                onChange={(e) => setServiceBookingType(e.target.value)}
                                            >
                                                <option value="instant">Instant</option>
                                                <option value="request">Request First</option>
                                                <option value="manual_confirm">Manual Confirm</option>
                                            </select>
                                        </div>
                                    </div>

                                    {servicePricingModel === 'hourly_rate' && (
                                        <div className="grid grid-cols-2 gap-3 animate-in fade-in">
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

                                    {servicePricingModel === 'deposit_required' && (
                                        <div className="space-y-1.5 animate-in fade-in">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deposit (TZS)</label>
                                            <Input
                                                type="number"
                                                placeholder="Mf. 30000"
                                                value={serviceDepositAmount}
                                                onChange={(e) => setServiceDepositAmount(e.target.value)}
                                                className="h-11 font-bold"
                                            />
                                        </div>
                                    )}

                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Namna ya Kushughulika na Wateja</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setServiceBookingMode('internal')}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${serviceBookingMode === 'internal'
                                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                : 'border-border text-muted-foreground hover:border-purple-200'
                                                }`}
                                        >
                                            <Phone className="h-6 w-6" />
                                            <span className="text-sm font-bold">Kwa Simu/WhatsApp</span>
                                            <span className="text-[10px] text-center opacity-70">Wasiliana nawe moja kwa moja baada ya malipo</span>
                                            {serviceBookingMode === 'internal' && <CheckCircle className="h-4 w-4 text-purple-600" />}
                                        </button>
                                        <button
                                            onClick={() => setServiceBookingMode('external')}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${serviceBookingMode === 'external'
                                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                : 'border-border text-muted-foreground hover:border-purple-200'
                                                }`}
                                        >
                                            <ExternalLink className="h-6 w-6" />
                                            <span className="text-sm font-bold">Link ya Booking</span>
                                            <span className="text-[10px] text-center opacity-70">Calendly, Google Forms, Whatsapp Link etc.</span>
                                            {serviceBookingMode === 'external' && <CheckCircle className="h-4 w-4 text-purple-600" />}
                                        </button>
                                    </div>

                                    {/* Internal — pick contact type */}
                                    {serviceBookingMode === 'internal' && (
                                        <div className="animate-in fade-in space-y-3">
                                            <div className="flex gap-2">
                                                {[
                                                    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                                                    { key: 'phone', label: 'Simu', icon: Phone },
                                                ].map(({ key, label, icon: Icon }) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => setServiceContactType(key)}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all ${serviceContactType === key
                                                            ? 'bg-purple-600 text-white border-purple-600'
                                                            : 'bg-background text-muted-foreground border-border hover:border-purple-300'
                                                            }`}
                                                    >
                                                        <Icon className="h-4 w-4" />{label}
                                                    </button>
                                                ))}
                                            </div>
                                            <Input
                                                type="tel"
                                                placeholder="+255 7XX XXX XXX"
                                                value={serviceContactValue}
                                                onChange={e => setServiceContactValue(e.target.value)}
                                                className="h-12 text-lg font-mono"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Baada ya mteja kulipa, Takeer itamwonyesha namba yako ya {serviceContactType === 'whatsapp' ? 'WhatsApp' : 'simu'} ili apange miadi nawe.
                                            </p>
                                        </div>
                                    )}

                                    {/* External booking link */}
                                    {serviceBookingMode === 'external' && (
                                        <div className="animate-in fade-in space-y-1.5">
                                            <Input
                                                placeholder="https://calendly.com/jina-lako"
                                                value={url}
                                                onChange={e => setUrl(e.target.value)}
                                                className="h-12 font-mono text-sm"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Baada ya kulipa, mteja atapelekwa directly kwenye ukurasa wako wa booking au link.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Price row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {(step !== 'service' || serviceNeedsCatalogPrice) ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bei ya Sasa (TZS)</label>
                                            <Input
                                                type="number"
                                                placeholder="Mf. 10000"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                                className={`h-14 text-xl font-black ${step === 'digital' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bei ya Awali (TZS)</label>
                                            <Input
                                                type="number"
                                                placeholder="Mf. 15000"
                                                value={comparePrice}
                                                onChange={e => setComparePrice(e.target.value)}
                                                className="h-14 text-xl font-black border-dashed"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="sm:col-span-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 font-medium">
                                        Service hii ni ya <span className="font-black uppercase">{servicePricingModel === 'contract_quote' ? 'Nukuu/Contract' : 'Showcase Tu'}</span>. Hakuna bei ya checkout inayohitajika.
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={publishProduct}
                                disabled={images.some(img => img.isUploading) || (digitalDeliveryMode === 'upload' && digitalFile?.isUploading)}
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

                <PolicyNotice />
            </div>
        </AppLayout>
    );
}
