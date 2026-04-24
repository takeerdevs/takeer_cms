import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import LongFormBlockEditor from '@/Components/LongFormBlockEditor';
import {
    BookOpenText,
    Boxes,
    BriefcaseBusiness,
    Crown,
    Download,
    Loader2,
    Link as LinkIcon,
    CalendarClock,
    PackageCheck,
    Package,
    Plus,
    Save,
    Search,
    Trash2,
    Pencil,
    Sparkles,
    ShieldCheck,
    ShoppingBag,
    Layers3,
    Clock3,
    MessageCircle,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const validSectionKeys = ['products', 'content', 'bundles', 'plans'];

const initialContentForm = {
    id: null,
    title: '',
    excerpt: '',
    body: '',
    format: 'editorjs',
    visibility: 'draft',
    price: '',
};

const initialBundleForm = {
    id: null,
    title: '',
    description: '',
    price: '',
    is_individual_sale: true,
    status: 'draft',
    items: [],
};

const initialPlanForm = {
    id: null,
    name: '',
    description: '',
    price: '',
    billing_interval: 'monthly',
    interval_count: 1,
    weekly_days: [],
    monthly_day: '',
    trial_days: '',
    tier: 1,
    status: 'draft',
    items: [],
};

const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function MerchantContentStudio({
    merchantUsername = '',
    initialTab = 'content',
    pageMode = 'hub',
    sectionKey = null,
    initialProductTypeFilter = 'all',
    itemPickerDefaultLimit = 5,
}) {
    const resolvedInitialTab = initialTab === 'posts' ? 'content' : initialTab;
    const resolvedSectionTab = validSectionKeys.includes(sectionKey || resolvedInitialTab)
        ? (sectionKey || resolvedInitialTab)
        : 'products';
    const initialActiveTab = pageMode === 'section'
        ? resolvedSectionTab
        : 'hub';
    const [activeTab, setActiveTab] = useState(initialActiveTab);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [products, setProducts] = useState([]);
    const [contentItems, setContentItems] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [plans, setPlans] = useState([]);
    const [posts, setPosts] = useState([]);
    const [savingPostInteraction, setSavingPostInteraction] = useState(null);
    const [contentReports, setContentReports] = useState([]);
    const [resolvingReportId, setResolvingReportId] = useState(null);
    const [commerceSummary, setCommerceSummary] = useState(null);
    const [productSearch, setProductSearch] = useState('');
    const [productStatusFilter, setProductStatusFilter] = useState('all');
    const [productTypeFilter, setProductTypeFilter] = useState(initialProductTypeFilter || 'all');
    const [postSearch, setPostSearch] = useState('');
    const [postTypeFilter, setPostTypeFilter] = useState('all');

    const [contentForm, setContentForm] = useState(initialContentForm);
    const [bundleForm, setBundleForm] = useState(initialBundleForm);
    const [planForm, setPlanForm] = useState(initialPlanForm);
    const [bundleItemSearch, setBundleItemSearch] = useState('');
    const [planItemSearch, setPlanItemSearch] = useState('');
    const [contentEditorKey, setContentEditorKey] = useState(0);
    const [contentAutosaveStatus, setContentAutosaveStatus] = useState('Draft not saved yet');
    const [lastContentAutosaveSignature, setLastContentAutosaveSignature] = useState('');

    useEffect(() => {
        loadStudio();
    }, []);

    useEffect(() => {
        if (pageMode === 'section') {
            const nextSection = sectionKey || (initialTab === 'posts' ? 'content' : initialTab);
            if (validSectionKeys.includes(nextSection)) {
                setActiveTab(nextSection);
            }
            if (initialProductTypeFilter) {
                setProductTypeFilter(initialProductTypeFilter);
            }
            return;
        }
        setActiveTab('hub');
    }, [initialTab, pageMode, sectionKey, initialProductTypeFilter]);

    const currentViewKey = pageMode === 'section' ? resolvedSectionTab : activeTab;
    const selectableItemsLimit = Math.min(20, Math.max(1, Number(itemPickerDefaultLimit) || 5));

    useEffect(() => {
        if (currentViewKey !== 'content') return;
        if (saving) return;
        if (contentForm.visibility !== 'draft') return;

        const normalizedTitle = (contentForm.title || '').trim();
        const normalizedBody = (contentForm.body || '').trim();
        if (!normalizedTitle || !normalizedBody) return;

        const signature = JSON.stringify({
            id: contentForm.id ?? null,
            title: normalizedTitle,
            excerpt: contentForm.excerpt || '',
            body: normalizedBody,
            price: contentForm.price,
        });

        if (signature === lastContentAutosaveSignature) return;

        const timer = setTimeout(async () => {
            try {
                setContentAutosaveStatus('Saving draft...');
                const payload = {
                    ...contentForm,
                    format: 'editorjs',
                    visibility: 'draft',
                    price: contentForm.price === '' ? null : Number(contentForm.price),
                };

                if (contentForm.id) {
                    await axios.put(`/merchant/content-items/${contentForm.id}/api`, payload);
                } else {
                    const res = await axios.post('/merchant/content-items/api', payload);
                    const saved = res.data?.content_item;
                    if (saved?.id) {
                        setContentForm((current) => ({ ...current, id: saved.id }));
                        setContentItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
                    }
                }

                setLastContentAutosaveSignature(signature);
                setContentAutosaveStatus('Draft auto-saved');
            } catch (error) {
                setContentAutosaveStatus('Draft autosave failed');
            }
        }, 1800);

        return () => clearTimeout(timer);
    }, [currentViewKey, contentForm, lastContentAutosaveSignature, saving]);

    const productOptions = useMemo(() => (
        products.map((product) => ({
            key: `product-${product.id}`,
            item_type: 'product',
            item_id: product.id,
            label: product.title,
            meta: product.type,
            image_url: product.image_url || null,
            product_type: product.type || null,
            has_variants: Boolean(product.has_variants),
            variants: Array.isArray(product.variants)
                ? product.variants.filter((variant) => Boolean(variant?.is_active))
                : [],
        }))
    ), [products]);

    const contentOptions = useMemo(() => (
        contentItems.map((item) => ({
            key: `content_item-${item.id}`,
            item_type: 'content_item',
            item_id: item.id,
            label: item.title,
            meta: item.price === null ? 'Free' : `TZS ${Number(item.price).toLocaleString()}`,
            image_url: item.cover_image || item.image_url || null,
            product_type: null,
        }))
    ), [contentItems]);

    const bundleOptions = useMemo(() => (
        bundles.map((bundle) => ({
            key: `bundle-${bundle.id}`,
            item_type: 'bundle',
            item_id: bundle.id,
            label: bundle.title,
            meta: `${bundle.items?.length || 0} items`,
        }))
    ), [bundles]);

    const bundleSelectableItems = useMemo(() => [...productOptions, ...contentOptions], [productOptions, contentOptions]);
    const planSelectableItems = useMemo(() => [...productOptions, ...contentOptions, ...bundleOptions], [productOptions, contentOptions, bundleOptions]);

    const sortOptionsByLatest = (options) => (
        [...options].sort((a, b) => Number(b.item_id || 0) - Number(a.item_id || 0))
    );

    const filterSelectableItems = (options, term) => {
        const normalizedTerm = term.trim().toLowerCase();
        const sorted = sortOptionsByLatest(options);
        if (!normalizedTerm) return sorted;

        return sorted.filter((option) => {
            const haystack = `${option.label || ''} ${option.meta || ''} ${option.item_type || ''}`.toLowerCase();
            return haystack.includes(normalizedTerm);
        });
    };

    const bundleVisibleItems = useMemo(() => {
        const sorted = sortOptionsByLatest(bundleSelectableItems);
        const filtered = filterSelectableItems(bundleSelectableItems, bundleItemSearch);
        const selectedKeys = new Set(bundleForm.items.map((item) => `${item.item_type}-${item.item_id}`));
        const limited = filtered.slice(0, selectableItemsLimit);
        const includedKeys = new Set(limited.map((option) => `${option.item_type}-${option.item_id}`));

        const selectedOutsideLimit = sorted.filter((option) => {
            const key = `${option.item_type}-${option.item_id}`;
            return selectedKeys.has(key) && !includedKeys.has(key);
        });

        return [...limited, ...selectedOutsideLimit];
    }, [bundleForm.items, bundleItemSearch, bundleSelectableItems]);

    const planVisibleItems = useMemo(() => {
        const sorted = sortOptionsByLatest(planSelectableItems);
        const filtered = filterSelectableItems(planSelectableItems, planItemSearch);
        const selectedKeys = new Set(planForm.items.map((item) => `${item.item_type}-${item.item_id}`));
        const limited = filtered.slice(0, selectableItemsLimit);
        const includedKeys = new Set(limited.map((option) => `${option.item_type}-${option.item_id}`));

        const selectedOutsideLimit = sorted.filter((option) => {
            const key = `${option.item_type}-${option.item_id}`;
            return selectedKeys.has(key) && !includedKeys.has(key);
        });

        return [...limited, ...selectedOutsideLimit];
    }, [planForm.items, planItemSearch, planSelectableItems]);

    const getServiceConfigState = (item) => {
        const rawUrl = String(item?.url || item?.download_link || '').trim();
        if (!rawUrl) {
            return { configured: false, label: 'Needs Setup', tone: 'bg-red-100 text-red-700' };
        }
        if (rawUrl.startsWith('http')) {
            return { configured: true, label: 'Configured', tone: 'bg-emerald-100 text-emerald-700' };
        }
        const [channelRaw, ...rest] = rawUrl.split(':');
        const channel = (channelRaw || '').toLowerCase();
        const value = rest.join(':').trim();
        if ((channel === 'whatsapp' || channel === 'phone') && value) {
            return { configured: true, label: 'Configured', tone: 'bg-emerald-100 text-emerald-700' };
        }
        return { configured: false, label: 'Needs Setup', tone: 'bg-red-100 text-red-700' };
    };

    const filteredProducts = useMemo(() => {
        const filtered = products
            .map((product, index) => ({ product, index }))
            .filter(({ product }) => {
                const matchesSearch = (product.title || '').toLowerCase().includes(productSearch.toLowerCase());
                const matchesStatus = productStatusFilter === 'all' || product.status === productStatusFilter;
                const matchesType = productTypeFilter === 'all' || product.type === productTypeFilter;
                return matchesSearch && matchesStatus && matchesType;
            });

        filtered.sort((a, b) => {
            const aIsService = a.product.type === 'service';
            const bIsService = b.product.type === 'service';
            if (aIsService && bIsService) {
                const aOk = getServiceConfigState(a.product).configured;
                const bOk = getServiceConfigState(b.product).configured;
                if (aOk !== bOk) return aOk ? 1 : -1; // Needs setup first
            }
            return a.index - b.index;
        });

        return filtered.map(({ product }) => product);
    }, [products, productSearch, productStatusFilter, productTypeFilter]);

    const filteredPosts = useMemo(() => {
        return posts.filter((entry) => {
            const hay = `${entry.title || ''} ${entry.caption || ''}`.toLowerCase();
            const matchesSearch = hay.includes(postSearch.toLowerCase());
            const matchesType = postTypeFilter === 'all' || entry.post_type === postTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [posts, postSearch, postTypeFilter]);

    const summaryCounts = useMemo(() => {
        const physical = products.filter((p) => p.type === 'physical').length;
        const digital = products.filter((p) => p.type === 'digital').length;
        const service = products.filter((p) => p.type === 'service').length;
        const longPosts = posts.filter((p) => p.post_type === 'long').length;
        const shortPosts = posts.filter((p) => p.post_type !== 'long').length;
        return { physical, digital, service, longPosts, shortPosts };
    }, [products, posts]);

    const formatTzs = (value) => `TZS ${Number(value || 0).toLocaleString()}`;

    const isImageLikeUrl = (value) => {
        const raw = String(value || '').toLowerCase();
        if (!raw || raw.startsWith('private://')) return false;
        return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/.test(raw) || raw.includes('/storage/');
    };

    const parseFileMetaFromUrl = (rawInput, sizeBytes = null) => {
        const raw = String(rawInput || '').trim();
        if (!raw) {
            return {
                fileName: 'No file attached',
                extension: 'FILE',
                displaySize: 'Size unknown',
                isUploadedFile: false,
            };
        }

        const isExternal = /^https?:\/\//i.test(raw);
        const normalized = raw.replace(/^private:\/\//, '');
        const path = (() => {
            try {
                return decodeURIComponent(new URL(normalized, window.location.origin).pathname || normalized);
            } catch {
                return decodeURIComponent(normalized);
            }
        })();

        const fileName = (path.split('/').filter(Boolean).pop() || 'Attached file').trim();
        const extRaw = fileName.includes('.') ? fileName.split('.').pop() : '';
        const extension = extRaw ? extRaw.toUpperCase() : 'FILE';

        return {
            fileName,
            extension,
            displaySize: Number.isFinite(Number(sizeBytes)) && Number(sizeBytes) > 0
                ? `${(Number(sizeBytes) / 1024 / 1024).toFixed(2)} MB`
                : 'Size unknown',
            isUploadedFile: !isExternal,
        };
    };

    const sectionSummaryCards = useMemo(() => {
        const sectionData = commerceSummary?.sections || {};
        const productsSummary = sectionData.products || {};
        const downloadsSummary = sectionData.downloads || {};
        const servicesSummary = sectionData.services || {};
        const postsSummary = sectionData.posts || {};
        const bundlesSummary = sectionData.bundles || {};
        const subscriptionsSummary = sectionData.subscriptions || {};

        if (currentViewKey === 'products') {
            if (productTypeFilter === 'digital') {
                return [
                    { label: 'Digital Files', value: downloadsSummary.total_items ?? summaryCounts.digital },
                    { label: 'Orders Today', value: downloadsSummary.today_orders ?? 0 },
                    { label: 'Sales Today', value: formatTzs(downloadsSummary.today_sales ?? 0) },
                    { label: 'Uploaded Files', value: downloadsSummary.uploaded_files ?? 0 },
                ];
            }

            if (productTypeFilter === 'service') {
                return [
                    { label: 'Services', value: servicesSummary.total_items ?? summaryCounts.service },
                    { label: 'Bookings Today', value: servicesSummary.today_orders ?? 0 },
                    { label: 'Sales Today', value: formatTzs(servicesSummary.today_sales ?? 0) },
                    { label: 'Configured', value: servicesSummary.configured_items ?? 0 },
                ];
            }

            return [
                { label: 'Physical Products', value: productsSummary.total_items ?? summaryCounts.physical },
                { label: 'Orders Today', value: productsSummary.today_orders ?? 0 },
                { label: 'Sales Today', value: formatTzs(productsSummary.today_sales ?? 0) },
                { label: 'In Stock', value: productsSummary.in_stock_items ?? 0 },
            ];
        }

        if (currentViewKey === 'content') {
            return [
                { label: 'All Posts', value: postsSummary.total_items ?? posts.length },
                { label: 'Long Form', value: postsSummary.long_form ?? summaryCounts.longPosts },
                { label: 'Total Views', value: Number(postsSummary.total_views ?? 0).toLocaleString() },
                { label: 'Sales Today', value: formatTzs(postsSummary.today_sales ?? 0) },
            ];
        }

        if (currentViewKey === 'bundles') {
            return [
                { label: 'Bundles', value: bundlesSummary.total_items ?? bundles.length },
                { label: 'Published', value: bundlesSummary.published_items ?? 0 },
                { label: 'Orders Today', value: bundlesSummary.today_orders ?? 0 },
                { label: 'Sales Today', value: formatTzs(bundlesSummary.today_sales ?? 0) },
            ];
        }

        if (currentViewKey === 'plans') {
            return [
                { label: 'Subscription Tiers', value: subscriptionsSummary.total_items ?? plans.length },
                { label: 'Active Tiers', value: subscriptionsSummary.active_tiers ?? 0 },
                { label: 'Active Members', value: subscriptionsSummary.active_members ?? 0 },
                { label: 'Sales Today', value: formatTzs(subscriptionsSummary.today_sales ?? 0) },
            ];
        }

        return [];
    }, [currentViewKey, bundles.length, commerceSummary, plans.length, posts.length, productTypeFilter, summaryCounts]);

    const productModeMeta = (item) => {
        const rawUrl = String(item?.url || item?.download_link || '');
        if (item.type === 'digital') {
            if (!rawUrl) return 'No delivery method set';
            if (rawUrl.startsWith('http')) return 'Digital via external link';
            return 'Digital file uploaded to Takeer';
        }
        if (item.type === 'service') {
            if (!rawUrl) return 'Service setup missing';
            if (rawUrl.startsWith('http')) return 'Appointment via booking link';
            const [channel] = rawUrl.split(':');
            if (channel === 'whatsapp') return 'Service via WhatsApp contact';
            if (channel === 'phone') return 'Service via phone contact';
            return 'Service via direct contact';
        }
        return `Stock: ${Number(item.inventory_count || 0).toLocaleString()}`;
    };

    const getServiceContactMeta = (item) => {
        const rawUrl = String(item?.url || item?.download_link || '').trim();
        if (!rawUrl) return { label: 'Setup missing', value: 'No booking/contact configured', href: null, cta: null };
        if (rawUrl.startsWith('http')) {
            return { label: 'Booking Link', value: rawUrl, href: rawUrl, cta: 'Test Booking Link' };
        }

        const [channelRaw, ...rest] = rawUrl.split(':');
        const value = rest.join(':').trim();
        const channel = (channelRaw || '').toLowerCase();
        const digits = value.replace(/\D/g, '');

        if (channel === 'whatsapp' && digits) {
            return {
                label: 'WhatsApp Contact',
                value: value,
                href: `https://wa.me/${digits}`,
                cta: 'Test WhatsApp',
            };
        }

        if (channel === 'phone' && value) {
            return {
                label: 'Phone Contact',
                value: value,
                href: `tel:${value}`,
                cta: 'Test Phone',
            };
        }

        return { label: 'Direct Contact', value: value || rawUrl, href: null, cta: null };
    };

    const openServiceTest = (href) => {
        if (!href) return;
        if (href.startsWith('tel:')) {
            window.location.href = href;
            return;
        }
        window.open(href, '_blank', 'noopener,noreferrer');
    };

    async function loadStudio() {
        setLoading(true);
        try {
            const [productsRes, contentRes, bundleRes, planRes, postsRes, reportsRes, commerceSummaryRes] = await Promise.all([
                axios.get('/merchant/products/api'),
                axios.get('/merchant/content-items/api'),
                axios.get('/merchant/bundles/api'),
                axios.get('/merchant/subscription-plans/api'),
                axios.get('/merchant/posts/api'),
                axios.get('/merchant/content-reports/api'),
                axios.get(`/merchant/${merchantUsername}/orders/api/commerce-summary`).catch(() => ({ data: null })),
            ]);

            setProducts(productsRes.data?.data || []);
            setContentItems(contentRes.data?.data || []);
            setBundles(bundleRes.data?.data || []);
            setPlans(planRes.data?.data || []);
            setPosts(postsRes.data?.data || []);
            setContentReports(reportsRes.data?.data || []);
            setCommerceSummary(commerceSummaryRes.data || null);
        } catch (error) {
            toast.error('Imeshindwa kupakia studio ya bidhaa za kidigitali.');
        } finally {
            setLoading(false);
        }
    }

    function resetForm(type) {
        if (type === 'content') {
            setContentForm(initialContentForm);
            setContentEditorKey((current) => current + 1);
            setContentAutosaveStatus('Draft not saved yet');
            setLastContentAutosaveSignature('');
        }
        if (type === 'bundles') setBundleForm(initialBundleForm);
        if (type === 'bundles') setBundleItemSearch('');
        if (type === 'plans') setPlanForm(initialPlanForm);
        if (type === 'plans') setPlanItemSearch('');
    }

    function startEditContent(item) {
        setActiveTab('content');
        setContentForm({
            id: item.id,
            title: item.title || '',
            excerpt: item.excerpt || '',
            body: item.body || '',
            format: item.format || 'editorjs',
            visibility: item.visibility || 'draft',
            price: item.price ?? '',
        });
        setContentEditorKey((current) => current + 1);
        setContentAutosaveStatus('Draft loaded');
        setLastContentAutosaveSignature('');
    }

    function startEditBundle(item) {
        setActiveTab('bundles');
        setBundleItemSearch('');
        setBundleForm({
            id: item.id,
            title: item.title || '',
            description: item.description || '',
            price: item.price ?? '',
            is_individual_sale: item.is_individual_sale ?? true,
            status: item.status || 'draft',
            items: (item.items || []).map((entry) => ({
                item_type: entry.item_type,
                item_id: entry.item_id,
                selected_variant_id: entry.selected_variant_id ?? null,
                sort_order: entry.sort_order ?? 0,
            })),
        });
    }

    function startEditPlan(item) {
        setActiveTab('plans');
        setPlanItemSearch('');
        setPlanForm({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            price: item.price ?? '',
            billing_interval: item.billing_interval || 'monthly',
            interval_count: item.interval_count || 1,
            weekly_days: item.weekly_days || [],
            monthly_day: item.monthly_day ?? '',
            trial_days: item.trial_days ?? '',
            tier: item.tier || 1,
            status: item.status || 'draft',
            items: (item.items || []).map((entry) => ({
                item_type: entry.item_type,
                item_id: entry.item_id,
                unlock_after_days: entry.unlock_after_days ?? 0,
            })),
        });
    }

    async function saveContent() {
        setSaving(true);
        try {
            const payload = {
                ...contentForm,
                format: 'editorjs',
                price: contentForm.price === '' ? null : Number(contentForm.price),
            };

            if (contentForm.id) {
                await axios.put(`/merchant/content-items/${contentForm.id}/api`, payload);
                toast.success('Long-form content imesasishwa.');
            } else {
                await axios.post('/merchant/content-items/api', payload);
                toast.success('Long-form content imehifadhiwa.');
            }

            resetForm('content');
            await loadStudio();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi content.');
        } finally {
            setSaving(false);
        }
    }

    async function saveBundle() {
        setSaving(true);
        try {
            const payload = {
                ...bundleForm,
                price: bundleForm.price === '' ? null : Number(bundleForm.price),
                items: bundleForm.items.map((item, index) => ({
                    ...item,
                    selected_variant_id: item.selected_variant_id ? Number(item.selected_variant_id) : null,
                    sort_order: index,
                })),
            };

            if (bundleForm.id) {
                await axios.put(`/merchant/bundles/${bundleForm.id}/api`, payload);
                toast.success('Bundle imesasishwa.');
            } else {
                await axios.post('/merchant/bundles/api', payload);
                toast.success('Bundle imeundwa.');
            }

            resetForm('bundles');
            await loadStudio();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi bundle.');
        } finally {
            setSaving(false);
        }
    }

    async function savePlan() {
        setSaving(true);
        try {
            const payload = {
                ...planForm,
                price: Number(planForm.price),
                interval_count: Number(planForm.interval_count || 1),
                monthly_day: planForm.monthly_day === '' ? null : Number(planForm.monthly_day),
                trial_days: planForm.trial_days === '' ? null : Number(planForm.trial_days),
                tier: Number(planForm.tier || 1),
                items: planForm.items.map((item) => ({
                    ...item,
                    unlock_after_days: Number(item.unlock_after_days || 0),
                })),
            };

            if (planForm.id) {
                await axios.put(`/merchant/subscription-plans/${planForm.id}/api`, payload);
                toast.success('Subscription plan imesasishwa.');
            } else {
                await axios.post('/merchant/subscription-plans/api', payload);
                toast.success('Subscription plan imeundwa.');
            }

            resetForm('plans');
            await loadStudio();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi subscription plan.');
        } finally {
            setSaving(false);
        }
    }

    async function destroyItem(type, id) {
        const map = {
            products: `/merchant/products/${id}`,
            content: `/merchant/content-items/${id}/api`,
            bundles: `/merchant/bundles/${id}/api`,
            plans: `/merchant/subscription-plans/${id}/api`,
        };

        if (!window.confirm('Una uhakika unataka kufuta kipengele hiki?')) return;

        try {
            await axios.delete(map[type]);
            toast.success('Kimefutwa kikamilifu.');
            if (type === 'content' && contentForm.id === id) resetForm('content');
            if (type === 'bundles' && bundleForm.id === id) resetForm('bundles');
            if (type === 'plans' && planForm.id === id) resetForm('plans');
            await loadStudio();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kufuta kipengele.');
        }
    }

    async function updatePostInteractionOverride(postId, field, value) {
        const key = `${postId}:${field}`;
        setSavingPostInteraction(key);
        try {
            const payload = { [field]: value };
            await axios.patch(`/merchant/posts/${postId}/interaction/api`, payload);
            setPosts((current) => current.map((entry) => {
                if (entry.id !== postId) return entry;

                const next = { ...entry, [field]: value };
                const commentsGlobal = Boolean(next.global_comments_enabled ?? true);
                const reactionsGlobal = Boolean(next.global_reactions_enabled ?? true);

                next.comments_enabled = next.comments_enabled_override !== null
                    ? Boolean(next.comments_enabled_override)
                    : commentsGlobal;
                next.reactions_enabled = next.reactions_enabled_override !== null
                    ? Boolean(next.reactions_enabled_override)
                    : reactionsGlobal;

                return next;
            }));
            toast.success('Post override imesasishwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kusasisha override ya post.');
        } finally {
            setSavingPostInteraction(null);
        }
    }

    async function resolveContentReport(reportId, status, actionTaken = 'none') {
        setResolvingReportId(reportId);
        try {
            await axios.patch(`/merchant/content-reports/${reportId}/resolve/api`, {
                status,
                action_taken: actionTaken,
            });
            setContentReports((current) => current.map((entry) => (
                entry.id === reportId
                    ? { ...entry, status, action_taken: actionTaken, resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null }
                    : entry
            )));
            toast.success('Report imesasishwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kusasisha report.');
        } finally {
            setResolvingReportId(null);
        }
    }

    function toggleBundleItem(option) {
        setBundleForm((current) => {
            const exists = current.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
            return {
                ...current,
                items: exists
                    ? current.items.filter((item) => !(item.item_type === option.item_type && item.item_id === option.item_id))
                    : [...current.items, {
                        item_type: option.item_type,
                        item_id: option.item_id,
                        selected_variant_id: option.item_type === 'product' && option.has_variants
                            ? (option.variants?.[0]?.id ?? null)
                            : null,
                        sort_order: current.items.length,
                    }],
            };
        });
    }

    function updateBundleItem(itemType, itemId, patch) {
        setBundleForm((current) => ({
            ...current,
            items: current.items.map((item) => (
                item.item_type === itemType && item.item_id === itemId
                    ? { ...item, ...patch }
                    : item
            )),
        }));
    }

    function togglePlanItem(option) {
        setPlanForm((current) => {
            const exists = current.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
            return {
                ...current,
                items: exists
                    ? current.items.filter((item) => !(item.item_type === option.item_type && item.item_id === option.item_id))
                    : [...current.items, { item_type: option.item_type, item_id: option.item_id, unlock_after_days: 0 }],
            };
        });
    }

    function updatePlanItemDelay(itemType, itemId, value) {
        setPlanForm((current) => ({
            ...current,
            items: current.items.map((item) => (
                item.item_type === itemType && item.item_id === itemId
                    ? { ...item, unlock_after_days: value }
                    : item
            )),
        }));
    }

    const stats = [
        {
            label: 'Paid Articles',
            value: contentItems.length,
            tone: 'from-amber-500/15 to-orange-500/10 text-amber-700',
            icon: BookOpenText,
        },
        {
            label: 'Bundles',
            value: bundles.length,
            tone: 'from-sky-500/15 to-cyan-500/10 text-sky-700',
            icon: Layers3,
        },
        {
            label: 'Tiers',
            value: plans.length,
            tone: 'from-emerald-500/15 to-teal-500/10 text-emerald-700',
            icon: Crown,
        },
    ];

    if (loading) {
        return (
            <AppLayout>
                <Head title="Commerce Studio | Takeer" />
                <div className="max-w-6xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Inapakia commerce studio...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Commerce Studio | Takeer" />

            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <section className="relative overflow-hidden rounded-[28px] border border-brand-200/60 bg-gradient-to-br from-[#fff7e8] via-[#fffdf8] to-[#eef8ff] shadow-sm">
                    <div className="absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_60%)]" />
                    <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-end gap-6">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-brand-700 shadow-sm">
                                <Sparkles className="h-3.5 w-3.5" />
                                Commerce Studio
                            </div>
                            <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                                Build paid knowledge products, bundles, and subscription tiers.
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-600 leading-7">
                                Geuza ujuzi wako kuwa bidhaa zinazouzwa. Andika maarifa ya biashara, panga bidhaa kwenye bundles,
                                kisha tengeneza subscription tiers zinazofungua content au bidhaa maalum kwa wateja wako kwa kipindi maalum.
                            </p>
                        </div>
                    </div>
                </section>
                <div className={`grid gap-6 ${currentViewKey === 'products' ? '' : 'lg:grid-cols-[1.15fr_0.85fr]'}`}>
                    {currentViewKey === 'hub' && (
                        <Card className="rounded-[24px] lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-xl font-black">Commerce Hub</CardTitle>
                                <CardDescription>
                                    Central place ya kusimamia bidhaa, posts, digital downloads, services/appointments, bundles, na subscriptions.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                                {[
                                    { key: 'physical', title: 'Physical Products', count: summaryCounts.physical, icon: PackageCheck, action: () => router.visit(`/merchant/${merchantUsername}/products`) },
                                    { key: 'digital', title: 'Digital Downloads', count: summaryCounts.digital, icon: Download, action: () => router.visit(`/merchant/${merchantUsername}/downloads`) },
                                    { key: 'service', title: 'Services/Booking', count: summaryCounts.service, icon: BriefcaseBusiness, action: () => router.visit(`/merchant/${merchantUsername}/services`) },
                                    { key: 'posts', title: 'Posts', count: posts.length, icon: BookOpenText, action: () => router.visit(`/merchant/${merchantUsername}/posts`) },
                                    { key: 'bundles', title: 'Bundles', count: bundles.length, icon: Boxes, action: () => router.visit(`/merchant/${merchantUsername}/bundles`) },
                                    { key: 'plans', title: 'Subscriptions', count: plans.length, icon: Crown, action: () => router.visit(`/merchant/${merchantUsername}/subscriptions`) },
                                ].map((block) => (
                                    <button
                                        key={block.key}
                                        type="button"
                                        onClick={block.action}
                                        className="rounded-2xl border border-border/70 bg-background text-left p-4 hover:border-brand-300 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <block.icon className="h-5 w-5 text-brand-600" />
                                            <span className="text-2xl font-black">{block.count}</span>
                                        </div>
                                        <p className="mt-3 text-sm font-black">{block.title}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Tap to manage</p>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {currentViewKey === 'products' && (
                        <>
                            <Card className="rounded-[24px] border-brand-200/70 lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-xl font-black">
                                        <Package className="h-5 w-5 text-brand-600" />
                                        Sellables Manager
                                    </CardTitle>
                                    <CardDescription>
                                        Simamia physical products, digital downloads, na services/appointments sehemu moja.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <Button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" onClick={() => router.visit(`/merchant/${merchantUsername}/upload?type=physical`)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Physical
                                        </Button>
                                        <Button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" onClick={() => router.visit(`/merchant/${merchantUsername}/upload?type=digital`)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Digital
                                        </Button>
                                        <Button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" onClick={() => router.visit(`/merchant/${merchantUsername}/upload?type=service`)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Service
                                        </Button>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr]">
                                        <select
                                            value={productTypeFilter}
                                            onChange={(e) => setProductTypeFilter(e.target.value)}
                                            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                        >
                                            <option value="all">All types</option>
                                            <option value="physical">Physical Product</option>
                                            <option value="digital">Digital Download</option>
                                            <option value="service">Service/Appointment</option>
                                        </select>
                                        <select
                                            value={productStatusFilter}
                                            onChange={(e) => setProductStatusFilter(e.target.value)}
                                            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                        >
                                            <option value="all">All statuses</option>
                                            <option value="published">Published</option>
                                            <option value="draft">Draft</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                placeholder="Search products..."
                                                className="h-11 pl-10 rounded-xl"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[24px] lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg font-black">Unified Catalog</CardTitle>
                                    <CardDescription>Full-width sellable list with details, media preview, and quick manage actions.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {filteredProducts.length === 0 ? (
                                        <EmptyState icon={Package} title="Hakuna products bado" body="Ongeza bidhaa yako ya kwanza (physical, digital, au service)." />
                                    ) : filteredProducts.map((item) => (
                                        <div key={item.id} className="rounded-2xl border border-border/70 bg-background p-4 space-y-4">
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="h-16 w-16 rounded-2xl border border-border/70 bg-muted overflow-hidden flex items-center justify-center shrink-0">
                                                        {isImageLikeUrl(item.image_url) ? (
                                                            <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                                                        ) : item.type === 'digital' ? (
                                                            <Download className="h-6 w-6 text-brand-600" />
                                                        ) : item.type === 'service' ? (
                                                            <CalendarClock className="h-6 w-6 text-brand-600" />
                                                        ) : (
                                                            <Package className="h-6 w-6 text-brand-600" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-base font-black truncate">{item.title}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${item.type === 'service'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : item.type === 'digital'
                                                                    ? 'bg-indigo-100 text-indigo-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {item.type === 'service' ? 'Service/Appointment' : item.type === 'digital' ? 'Digital Download' : 'Physical Product'}
                                                            </span>
                                                            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                {item.status || 'published'}
                                                            </span>
                                                            {item.type === 'service' && (
                                                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getServiceConfigState(item).tone}`}>
                                                                    {getServiceConfigState(item).label}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-2">{productModeMeta(item)}</p>
                                                        {item.type === 'digital' && (() => {
                                                            const fileMeta = parseFileMetaFromUrl(item.download_link || item.url, item.file_size || item.digital_file_size);
                                                            return (
                                                                <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                                                                        {fileMeta.isUploadedFile ? 'Uploaded File' : 'External Link'}
                                                                    </p>
                                                                    <p className="mt-1 text-xs font-semibold text-indigo-900 truncate">{fileMeta.fileName}</p>
                                                                    <p className="text-[11px] text-indigo-800/80 mt-1">{fileMeta.extension} · {fileMeta.displaySize}</p>
                                                                </div>
                                                            );
                                                        })()}
                                                        {item.type === 'service' && (() => {
                                                            const serviceMeta = getServiceContactMeta(item);
                                                            return (
                                                                <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                                                        {serviceMeta.label}
                                                                    </p>
                                                                    <p className="text-xs text-emerald-800 truncate mt-1">{serviceMeta.value}</p>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <p className="text-lg font-black text-brand-700 shrink-0">{formatTzs(item.price || 0)}</p>
                                            </div>
                                            <div className={`grid gap-2 ${item.type === 'service' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                                                <Button variant="outline" className="rounded-xl" onClick={() => router.visit(`/merchant/${merchantUsername}/upload?edit=${item.id}`)}>
                                                    {item.type === 'service' ? <CalendarClock className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                                                    {item.type === 'service' ? 'Manage Booking' : item.type === 'digital' ? 'Manage Download' : 'Manage Product'}
                                                </Button>
                                                {item.type === 'service' && (() => {
                                                    const serviceMeta = getServiceContactMeta(item);
                                                    if (!serviceMeta.href) {
                                                        return (
                                                            <Button key={`test-${item.id}`} variant="outline" className="rounded-xl" disabled>
                                                                <LinkIcon className="mr-2 h-4 w-4" />
                                                                No Test Link
                                                            </Button>
                                                        );
                                                    }
                                                    return (
                                                        <Button
                                                            key={`test-${item.id}`}
                                                            variant="outline"
                                                            className="rounded-xl"
                                                            onClick={() => openServiceTest(serviceMeta.href)}
                                                        >
                                                            {serviceMeta.label === 'WhatsApp Contact' ? <MessageCircle className="mr-2 h-4 w-4" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                                                            {serviceMeta.cta}
                                                        </Button>
                                                    );
                                                })()}
                                                <Button variant="outline" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => destroyItem('products', item.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {currentViewKey === 'content' && (
                        <>
                            <Card className="rounded-[24px] lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg font-black">All Posts (Short + Long)</CardTitle>
                                    <CardDescription>
                                        Sehemu hii ndiyo manager mkuu wa posts zako zote. Tumia filter, tafuta post, kisha simamia overrides hapo hapo.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={postSearch}
                                                    onChange={(e) => setPostSearch(e.target.value)}
                                                    placeholder="Search posts..."
                                                    className="h-11 pl-10 rounded-xl"
                                                />
                                            </div>
                                            <select
                                                value={postTypeFilter}
                                                onChange={(e) => setPostTypeFilter(e.target.value)}
                                                className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                            >
                                                <option value="all">All types</option>
                                                <option value="short">Short Form</option>
                                                <option value="long">Long Form</option>
                                            </select>
                                        </div>
                                        <Button
                                            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl"
                                            onClick={() => window.__openComposer?.()}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Post
                                        </Button>
                                    </div>

                                    {filteredPosts.length === 0 ? (
                                        <EmptyState icon={MessageCircle} title="Hakuna posts bado" body="Ukichapisha post, utaweza kuweka overrides zake hapa." />
                                    ) : filteredPosts.map((entry) => (
                                        <div key={entry.id} className="rounded-2xl border border-border/70 px-4 py-4 space-y-3 overflow-hidden">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="h-12 w-12 rounded-xl border border-border/70 bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                                                        {isImageLikeUrl(entry.cover_image) ? (
                                                            <img src={entry.cover_image} alt={entry.title || entry.caption || 'Post'} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <BookOpenText className="h-5 w-5 text-brand-600" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black truncate">{entry.title || entry.caption || `Post #${entry.id}`}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${entry.post_type === 'long' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                                                                {entry.post_type === 'long' ? 'Long Form' : 'Short Form'}
                                                            </span>
                                                            {entry.content_visibility && (
                                                                <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                    {entry.content_visibility}
                                                                </span>
                                                            )}
                                                            {entry.created_at && (
                                                                <span className="text-[11px] text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground mt-1">
                                                            Effective: Comments {entry.comments_enabled ? 'ON' : 'OFF'} · Reactions {entry.reactions_enabled ? 'ON' : 'OFF'}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-1">
                                                            Views {Number(entry.views_count || 0).toLocaleString()} · Likes {Number(entry.likes_count || 0).toLocaleString()} · Comments {Number(entry.comment_count || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className="space-y-1 min-w-0">
                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Comments Override</label>
                                                    <select
                                                        className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                                                        value={entry.comments_enabled_override === null ? 'inherit' : (entry.comments_enabled_override ? 'on' : 'off')}
                                                        onChange={(e) => {
                                                            const next = e.target.value === 'inherit' ? null : e.target.value === 'on';
                                                            updatePostInteractionOverride(entry.id, 'comments_enabled_override', next);
                                                        }}
                                                        disabled={savingPostInteraction === `${entry.id}:comments_enabled_override`}
                                                    >
                                                        <option value="inherit">Inherit ({entry.global_comments_enabled ? 'ON' : 'OFF'})</option>
                                                        <option value="on">Force ON</option>
                                                        <option value="off">Force OFF</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1 min-w-0">
                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Reactions Override</label>
                                                    <select
                                                        className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                                                        value={entry.reactions_enabled_override === null ? 'inherit' : (entry.reactions_enabled_override ? 'on' : 'off')}
                                                        onChange={(e) => {
                                                            const next = e.target.value === 'inherit' ? null : e.target.value === 'on';
                                                            updatePostInteractionOverride(entry.id, 'reactions_enabled_override', next);
                                                        }}
                                                        disabled={savingPostInteraction === `${entry.id}:reactions_enabled_override`}
                                                    >
                                                        <option value="inherit">Inherit ({entry.global_reactions_enabled ? 'ON' : 'OFF'})</option>
                                                        <option value="on">Force ON</option>
                                                        <option value="off">Force OFF</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="rounded-[24px] border-amber-200/70 lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg font-black">Content Reports Queue</CardTitle>
                                    <CardDescription>
                                        Wateja wakiripoti content inayokiuka sera, ichunguze hapa na uiweke kama <span className="font-bold">under review</span>, <span className="font-bold">resolved</span> au <span className="font-bold">dismissed</span>.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {contentReports.length === 0 ? (
                                        <EmptyState icon={ShieldCheck} title="Hakuna reports kwa sasa" body="Ripoti mpya za sera zikija zitaonekana hapa moja kwa moja." />
                                    ) : contentReports.map((report) => (
                                        <div key={report.id} className="rounded-2xl border border-border/70 px-4 py-4 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-black">Report #{report.id} · {report.item_type} #{report.item_id}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Reason: {report.reason} · Status: <span className="font-bold uppercase">{report.status}</span></p>
                                                </div>
                                            </div>

                                            {report.notes && (
                                                <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">{report.notes}</p>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl"
                                                    disabled={resolvingReportId === report.id}
                                                    onClick={() => resolveContentReport(report.id, 'under_review', 'none')}
                                                >
                                                    Under Review
                                                </Button>
                                                <Button
                                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    disabled={resolvingReportId === report.id}
                                                    onClick={() => resolveContentReport(report.id, 'resolved', 'warn_content')}
                                                >
                                                    Resolve + Warn
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl"
                                                    disabled={resolvingReportId === report.id}
                                                    onClick={() => resolveContentReport(report.id, 'dismissed', 'none')}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {currentViewKey === 'bundles' && (
                        <>
                            <Card className="rounded-[24px] border-sky-200/70">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-xl font-black">
                                        <Boxes className="h-5 w-5 text-sky-600" />
                                        {bundleForm.id ? 'Edit Bundle' : 'Create Bundle'}
                                    </CardTitle>
                                    <CardDescription>
                                        Changanya products na long-form content kwenye offer moja. Bundle inaweza kuuzwa moja kwa moja au kuunganishwa na tier ya subscription.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Bundle Name</label>
                                            <Input value={bundleForm.title} onChange={(e) => setBundleForm({ ...bundleForm, title: e.target.value })} placeholder="Mf. Retail Starter Pack" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Price (TZS)</label>
                                            <Input type="number" min="0" value={bundleForm.price} onChange={(e) => setBundleForm({ ...bundleForm, price: e.target.value })} placeholder="25000" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
                                        <Textarea rows={4} value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} placeholder="Explain what the buyer gets inside this bundle." />
                                    </div>

                                    <div>
                                        <label className="rounded-2xl border border-input bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold">Sell individually</p>
                                                <p className="text-xs text-muted-foreground">Buyer can purchase this bundle directly.</p>
                                            </div>
                                            <input type="checkbox" className="h-4 w-4" checked={bundleForm.is_individual_sale} onChange={(e) => setBundleForm({ ...bundleForm, is_individual_sale: e.target.checked })} />
                                        </label>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Bundle Items</p>
                                            <p className="text-xs text-muted-foreground mt-1">Showing latest {selectableItemsLimit} items by default. Search to find older ones.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Search Items</label>
                                            <Input
                                                value={bundleItemSearch}
                                                onChange={(e) => setBundleItemSearch(e.target.value)}
                                                placeholder="Search products or content..."
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            {bundleVisibleItems.map((option) => {
                                                const selected = bundleForm.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                                const selectedItem = bundleForm.items.find((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                                return (
                                                    <div
                                                        key={option.key}
                                                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${selected ? 'border-sky-300 bg-sky-50' : 'border-border bg-background hover:bg-muted/40'}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleBundleItem(option)}
                                                            className="w-full text-left"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="h-10 w-10 rounded-xl border border-border/70 bg-muted overflow-hidden flex items-center justify-center shrink-0">
                                                                        {isImageLikeUrl(option.image_url) ? (
                                                                            <img src={option.image_url} alt={option.label} className="h-full w-full object-cover" />
                                                                        ) : option.item_type === 'content_item' ? (
                                                                            <BookOpenText className="h-4 w-4 text-muted-foreground" />
                                                                        ) : option.product_type === 'service' ? (
                                                                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                                                        ) : (
                                                                            <Package className="h-4 w-4 text-muted-foreground" />
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-bold truncate">{option.label}</p>
                                                                        <p className="text-xs text-muted-foreground truncate">{option.item_type} · {option.meta}</p>
                                                                    </div>
                                                                </div>
                                                                <span className={`text-xs font-black uppercase tracking-wider ${selected ? 'text-sky-700' : 'text-muted-foreground'}`}>
                                                                    {selected ? 'Selected' : 'Add'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                        {selected && option.item_type === 'product' && option.has_variants && (
                                                            <div className="mt-3 pt-3 border-t border-sky-200/70 space-y-1">
                                                                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Product Variant</label>
                                                                <select
                                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                    value={selectedItem?.selected_variant_id ?? ''}
                                                                    onChange={(e) => updateBundleItem(option.item_type, option.item_id, { selected_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                                >
                                                                    <option value="">Select variant</option>
                                                                    {(option.variants || []).map((variant) => (
                                                                        <option key={variant.id} value={variant.id}>
                                                                            {variant.name}{variant.price !== null ? ` · TZS ${Number(variant.price).toLocaleString()}` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {bundleVisibleItems.length === 0 && (
                                                <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border px-3 py-2">
                                                    No items found for your search.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-end gap-3">
                                        <div className="w-full sm:w-[220px] space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</label>
                                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bundleForm.status} onChange={(e) => setBundleForm({ ...bundleForm, status: e.target.value })}>
                                                <option value="draft">Draft</option>
                                                <option value="published">Published</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                        </div>
                                        <Button className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl" onClick={saveBundle} disabled={saving}>
                                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            {bundleForm.id ? 'Update Bundle' : 'Save Bundle'}
                                        </Button>
                                        <Button variant="outline" className="rounded-xl" onClick={() => resetForm('bundles')}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Bundle
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[24px]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-black">Bundle Catalog</CardTitle>
                                    <CardDescription>Sellable grouped offers for your audience.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {bundles.length === 0 ? (
                                        <EmptyState icon={Boxes} title="Hakuna bundles bado" body="Anza kwa kuunganisha products na articles kwenye offer moja." />
                                    ) : bundles.map((item) => (
                                        <StudioRow
                                            key={item.id}
                                            icon={Boxes}
                                            title={item.title}
                                            subtitle={`${item.status} · ${item.items?.length || 0} items`}
                                            meta={item.price ? `TZS ${Number(item.price).toLocaleString()}` : 'No price'}
                                            onEdit={() => startEditBundle(item)}
                                            onDelete={() => destroyItem('bundles', item.id)}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {currentViewKey === 'plans' && (
                        <>
                            <Card className="rounded-[24px] border-emerald-200/70">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-xl font-black">
                                        <Crown className="h-5 w-5 text-emerald-600" />
                                        {planForm.id ? 'Edit Subscription Tier' : 'Create Subscription Tier'}
                                    </CardTitle>
                                    <CardDescription>
                                        Build recurring access plans with pricing cadence, unlock timing, and included products, bundles, or long-form content.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tier Name</label>
                                            <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Mf. Gold Business Circle" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Price (TZS)</label>
                                            <Input type="number" min="0" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} placeholder="10000" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
                                        <Textarea rows={4} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Describe the promise of this tier and what members unlock." />
                                    </div>

                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Billing Interval</label>
                                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={planForm.billing_interval} onChange={(e) => setPlanForm({ ...planForm, billing_interval: e.target.value })}>
                                                <option value="hourly">Hourly</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Every</label>
                                            <Input type="number" min="1" value={planForm.interval_count} onChange={(e) => setPlanForm({ ...planForm, interval_count: e.target.value })} placeholder="1" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tier Rank</label>
                                            <Input type="number" min="1" value={planForm.tier} onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })} placeholder="1" />
                                        </div>
                                    </div>

                                    {planForm.billing_interval === 'weekly' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Weekly Days</label>
                                            <div className="flex flex-wrap gap-2">
                                                {weekDays.map((day) => {
                                                    const selected = planForm.weekly_days.includes(day);
                                                    return (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => {
                                                                setPlanForm((current) => ({
                                                                    ...current,
                                                                    weekly_days: selected
                                                                        ? current.weekly_days.filter((entry) => entry !== day)
                                                                        : [...current.weekly_days, day],
                                                                }));
                                                            }}
                                                            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground'}`}
                                                        >
                                                            {day.slice(0, 3)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {planForm.billing_interval === 'monthly' && (
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Billing Day</label>
                                                <Input type="number" min="1" max="28" value={planForm.monthly_day} onChange={(e) => setPlanForm({ ...planForm, monthly_day: e.target.value })} placeholder="1" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Trial Days</label>
                                                <Input type="number" min="0" max="60" value={planForm.trial_days} onChange={(e) => setPlanForm({ ...planForm, trial_days: e.target.value })} placeholder="0" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Included Access</p>
                                            <p className="text-xs text-muted-foreground mt-1">Showing latest {selectableItemsLimit} items by default. Search to find older ones.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Search Items</label>
                                            <Input
                                                value={planItemSearch}
                                                onChange={(e) => setPlanItemSearch(e.target.value)}
                                                placeholder="Search products, content, or bundles..."
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            {planVisibleItems.map((option) => {
                                                const selectedItem = planForm.items.find((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                                const selected = Boolean(selectedItem);
                                                return (
                                                    <div key={option.key} className={`rounded-2xl border px-4 py-3 ${selected ? 'border-emerald-300 bg-emerald-50/60' : 'border-border bg-background'}`}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <button type="button" onClick={() => togglePlanItem(option)} className="text-left flex-1">
                                                                <p className="text-sm font-bold">{option.label}</p>
                                                                <p className="text-xs text-muted-foreground">{option.item_type} · {option.meta}</p>
                                                            </button>
                                                            <span className={`text-xs font-black uppercase tracking-wider ${selected ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                                                                {selected ? 'Included' : 'Add'}
                                                            </span>
                                                        </div>
                                                        {selected && (
                                                            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2 border border-emerald-100">
                                                                <Clock3 className="h-4 w-4 text-emerald-600" />
                                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unlock after days</span>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="h-9 max-w-[120px]"
                                                                    value={selectedItem.unlock_after_days}
                                                                    onChange={(e) => updatePlanItemDelay(option.item_type, option.item_id, e.target.value)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {planVisibleItems.length === 0 && (
                                                <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border px-3 py-2">
                                                    No items found for your search.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-end gap-3">
                                        <div className="w-full sm:w-[220px] space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</label>
                                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={planForm.status} onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}>
                                                <option value="draft">Draft</option>
                                                <option value="active">Active</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                        </div>
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" onClick={savePlan} disabled={saving}>
                                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            {planForm.id ? 'Update Tier' : 'Save Tier'}
                                        </Button>
                                        <Button variant="outline" className="rounded-xl" onClick={() => resetForm('plans')}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Tier
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[24px]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-black">Subscription Ladder</CardTitle>
                                    <CardDescription>Your membership and recurring access offers.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {plans.length === 0 ? (
                                        <EmptyState icon={Crown} title="Hakuna tiers bado" body="Create your first subscription level for recurring revenue." />
                                    ) : plans.map((item) => (
                                        <StudioRow
                                            key={item.id}
                                            icon={Crown}
                                            title={item.name}
                                            subtitle={`${item.status} · ${item.billing_interval} every ${item.interval_count}`}
                                            meta={`TZS ${Number(item.price || 0).toLocaleString()}`}
                                            onEdit={() => startEditPlan(item)}
                                            onDelete={() => destroyItem('plans', item.id)}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function StudioRow({ icon: Icon, title, subtitle, meta, onEdit, onDelete }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-4 flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-700 mt-2">{meta}</p>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-red-600 hover:text-red-700" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function EmptyState({ icon: Icon, title, body }) {
    return (
        <div className="rounded-3xl border border-dashed border-border px-5 py-10 text-center">
            <div className="mx-auto h-14 w-14 bg-muted flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-black">{title}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-6">{body}</p>
        </div>
    );
}
