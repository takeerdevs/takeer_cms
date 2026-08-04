import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { AlertTriangle, Boxes, FileUp, Filter, Image, Info, Loader2, Plus, Save, Trash2, Pencil, Package, CalendarClock, BookOpenText, Clock3 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import AutoPostTargetsPanel, { defaultAutoPostTargets } from '@/Components/Merchant/AutoPostTargetsPanel';
import { useLocale } from '@/lib/i18n';

const initialBundleForm = {
    id: null,
    title: '',
    description: '',
    price: '',
    shipping_profile_id: '',
    delivery_promise_override_enabled: false,
    delivery_handling_min_days: '',
    delivery_handling_max_days: '',
    delivery_transit_min_days: '',
    delivery_transit_max_days: '',
    delivery_cutoff_time: '',
    delivery_business_days_only: true,
    delivery_promise_label: '',
    delivery_promise_note: '',
    delivery_requires_confirmation: false,
    is_individual_sale: true,
    is_course: false,
    course_format: 'self_paced',
    course_outcomes_text: '',
    course_requirements_text: '',
    course_cover_image_url: '',
    cohorts: [],
    status: 'draft',
    publish_targets: defaultAutoPostTargets,
    items: [],
};
const DELIVERY_PROMISE_PRESETS = [
    { key: 'same_day', label: 'Leo leo', hint: 'Bundle inaweza kufika siku hiyo hiyo.', handling: [0, 0], transit: [0, 0], buyerLabel: 'Same day delivery' },
    { key: 'one_two', label: 'Siku 1-2', hint: 'Kwa bundle rahisi ndani ya mji.', handling: [0, 1], transit: [1, 2], buyerLabel: 'Delivery in 1-2 days' },
    { key: 'two_five', label: 'Siku 2-5', hint: 'Kwa bundle yenye vitu vingi.', handling: [1, 2], transit: [2, 5], buyerLabel: 'Bundle delivery in 2-5 days' },
    { key: 'made_order', label: 'Kuandaliwa', hint: 'Bundle inahitaji kukusanywa au kutengenezwa.', handling: [2, 5], transit: [1, 2], buyerLabel: 'Prepared bundle: delivery in 3-7 days' },
    { key: 'confirm', label: 'Tutathibitisha', hint: 'Kwa bundles nzito au inter-city.', handling: ['', ''], transit: ['', ''], buyerLabel: 'Delivery time will be confirmed in chat', confirm: true },
];

const initialFormForScope = (moduleScope = null) => ({
    ...initialBundleForm,
    is_course: moduleScope === 'courses',
    course_format: moduleScope === 'courses' ? 'cohort' : 'self_paced',
});

export default function MerchantBundles({ merchantUsername = '', itemPickerDefaultLimit = 5, moduleScope = null }) {
    const { copy } = useLocale();
    const courseModuleMode = moduleScope === 'courses';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState([]);
    const [contentItems, setContentItems] = useState([]);
    const [posts, setPosts] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [shippingProfiles, setShippingProfiles] = useState([]);
    const [bundleForm, setBundleForm] = useState(() => initialFormForScope(moduleScope));
    const [bundleItemSearch, setBundleItemSearch] = useState('');
    const [bundleItemTypeFilter, setBundleItemTypeFilter] = useState('all');
    const [courseModules, setCourseModules] = useState([]);
    const [courseAttachSelection, setCourseAttachSelection] = useState({});
    const [courseLessonUploads, setCourseLessonUploads] = useState({});
    const [supportingMaterialUploads, setSupportingMaterialUploads] = useState({});
    const [courseCoverUpload, setCourseCoverUpload] = useState({ uploading: false, progress: 0, name: '' });
    const [courseOutcomeDraft, setCourseOutcomeDraft] = useState('');
    const [courseRequirementDraft, setCourseRequirementDraft] = useState('');
    const [commerceSummary, setCommerceSummary] = useState(null);
    const selectableItemsLimit = Math.min(20, Math.max(1, Number(itemPickerDefaultLimit) || 5));
    const pageCopy = courseModuleMode ? {
        head: copy('Courses & workshops', 'Kozi na warsha'),
        loading: copy('Loading courses...', 'Inapakia kozi...'),
        summaryTitle: copy('Learning summary', 'Muhtasari wa kujifunza'),
        summaryDescription: copy('Useful performance snapshot for courses, workshops, cohorts, and enrollments.', 'Muhtasari wa utendaji wa kozi, warsha, makundi na usajili.'),
        createTitle: bundleForm.id ? copy('Edit course / workshop', 'Hariri kozi / warsha') : copy('Create course / workshop', 'Unda kozi / warsha'),
        createDescription: copy('Build a course, short course, cohort, workshop, or training package with enrollment-ready details.', 'Unda kozi, kozi fupi, kundi, warsha au kifurushi cha mafunzo chenye taarifa tayari kwa usajili.'),
        nameLabel: copy('Course / workshop name', 'Jina la kozi / warsha'),
        namePlaceholder: copy('E.g. Practical accounting short course', 'Mfano: Kozi fupi ya uhasibu wa vitendo'),
        descriptionPlaceholder: copy('Explain outcomes, target students, schedule, materials, and how enrollment works.', 'Eleza matokeo, wanafunzi walengwa, ratiba, vifaa na jinsi usajili unavyofanya kazi.'),
        catalogTitle: copy('Learning catalog', 'Katalogi ya kujifunza'),
        catalogDescription: copy('All courses and workshops in your merchant catalog.', 'Kozi na warsha zote kwenye katalogi yako.'),
        emptyTitle: copy('No courses yet', 'Hakuna kozi bado'),
        emptyBody: copy('Create a course or workshop with lessons, cohorts, pricing, and enrollment rules.', 'Unda kozi au warsha yenye masomo, makundi, bei na kanuni za usajili.'),
        saveLabel: bundleForm.id ? copy('Update course', 'Sasisha kozi') : copy('Save course', 'Hifadhi kozi'),
        newLabel: copy('New course', 'Kozi mpya'),
    } : {
        head: copy('Bundles', 'Vifurushi'),
        loading: copy('Loading bundles...', 'Inapakia vifurushi...'),
        summaryTitle: copy('Bundles summary', 'Muhtasari wa vifurushi'),
        summaryDescription: commerceSummary?.date ? `${copy('Daily metrics for', 'Vipimo vya kila siku vya')} ${commerceSummary.date}` : copy('Useful performance snapshot for bundles.', 'Muhtasari wa utendaji wa vifurushi.'),
        createTitle: bundleForm.id ? copy('Edit bundle', 'Hariri kifurushi') : copy('Create bundle', 'Unda kifurushi'),
        createDescription: copy('Group products and post content into one sellable offer.', 'Unganisha bidhaa na maudhui ya chapisho kuwa ofa moja ya kuuzwa.'),
        nameLabel: copy('Bundle name', 'Jina la kifurushi'),
        namePlaceholder: copy('E.g. Retail starter pack', 'Mfano: Kifurushi cha kuanzia rejareja'),
        descriptionPlaceholder: copy('Explain what the buyer gets inside this bundle.', 'Eleza mnunuzi anachopata ndani ya kifurushi hiki.'),
        catalogTitle: copy('Bundle catalog', 'Katalogi ya vifurushi'),
        catalogDescription: copy('All bundles in your merchant catalog.', 'Vifurushi vyote kwenye katalogi yako.'),
        emptyTitle: copy('No bundles yet', 'Hakuna vifurushi bado'),
        emptyBody: copy('Start by combining products and content into one offer.', 'Anza kwa kuunganisha bidhaa na maudhui kuwa ofa moja.'),
        saveLabel: bundleForm.id ? copy('Update bundle', 'Sasisha kifurushi') : copy('Save bundle', 'Hifadhi kifurushi'),
        newLabel: copy('New bundle', 'Kifurushi kipya'),
    };

    const bundleTypeFilters = [
        { key: 'all', label: copy('All', 'Zote') },
        { key: 'physical', label: copy('Physical', 'Kushikika') },
        { key: 'digital', label: copy('Digital', 'Kidijitali') },
        { key: 'service', label: copy('Service', 'Huduma') },
        { key: 'content', label: copy('Content', 'Maudhui') },
    ];

    useEffect(() => {
        loadPage();
        if (courseModuleMode) ensureCourseModuleExists();
    }, []);

    const productOptions = useMemo(() => (
        products.map((product) => ({
            key: `product-${product.id}`,
            item_type: 'product',
            item_id: product.id,
            label: product.title,
            meta: product.type,
            image_url: product.image_url || null,
            product_type: product.type || null,
            service_mode: product.service_mode || null,
            service_booking_type: product.service_booking_type || null,
            service_scheduling_type: product.service_scheduling_type || null,
            service_price_display: product.service_price_display || null,
            service_booking_provider: product.service_booking_provider || null,
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
            product_type: 'content',
        }))
    ), [contentItems]);

    const postOptions = useMemo(() => (
        posts.map((post) => ({
            key: `post-${post.id}`,
            item_type: 'post',
            item_id: post.id,
            label: post.title || post.caption || `Post #${post.id}`,
            meta: post.post_type === 'long' ? 'Long post' : 'Post',
            image_url: post.cover_image || null,
            product_type: 'content',
            public_id: post.public_id || null,
        }))
    ), [posts]);

    const courseLessonProductOptions = useMemo(() => (
        productOptions.filter((option) => option.product_type === 'digital')
    ), [productOptions]);
    const bundleSelectableItems = useMemo(() => [...productOptions, ...contentOptions], [productOptions, contentOptions]);
    const courseLessonSelectableItems = useMemo(() => [...courseLessonProductOptions, ...contentOptions, ...postOptions], [courseLessonProductOptions, contentOptions, postOptions]);
    const sortOptionsByLatest = (options) => (
        [...options].sort((a, b) => Number(b.item_id || 0) - Number(a.item_id || 0))
    );

    const optionFulfillmentType = (option) => {
        if (option.item_type === 'content_item') return 'content';
        return option.product_type || 'physical';
    };

    const typeLabel = (option) => {
        const type = optionFulfillmentType(option);
        if (option.item_type === 'post') return copy('Post', 'Chapisho');
        if (type === 'content') return copy('Content', 'Maudhui');
        if (type === 'digital') return copy('Digital', 'Kidijitali');
        if (type === 'service') return copy('Service', 'Huduma');
        return copy('Physical', 'Kushikika');
    };

    const typeBadgeClass = (option) => {
        const type = optionFulfillmentType(option);
        if (type === 'service') return 'border-amber-200 bg-amber-50 text-amber-800';
        if (type === 'digital') return 'border-violet-200 bg-violet-50 text-violet-800';
        if (type === 'content') return 'border-sky-200 bg-sky-50 text-sky-800';
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    };

    const filterSelectableItems = (options, term, typeFilter = 'all') => {
        const normalizedTerm = term.trim().toLowerCase();
        const filteredByType = typeFilter === 'all'
            ? options
            : options.filter((option) => optionFulfillmentType(option) === typeFilter);
        const sorted = sortOptionsByLatest(filteredByType);
        if (!normalizedTerm) return sorted;
        return sorted.filter((option) => {
            const haystack = `${option.label || ''} ${option.meta || ''} ${option.item_type || ''} ${typeLabel(option)}`.toLowerCase();
            return haystack.includes(normalizedTerm);
        });
    };

    const bundleVisibleItems = useMemo(() => {
        const sorted = sortOptionsByLatest(bundleSelectableItems);
        const filtered = filterSelectableItems(bundleSelectableItems, bundleItemSearch, bundleItemTypeFilter);
        const selectedKeys = new Set(bundleForm.items.map((item) => `${item.item_type}-${item.item_id}`));
        const limited = filtered.slice(0, selectableItemsLimit);
        const includedKeys = new Set(limited.map((option) => `${option.item_type}-${option.item_id}`));

        const selectedOutsideLimit = sorted.filter((option) => {
            const key = `${option.item_type}-${option.item_id}`;
            return selectedKeys.has(key) && !includedKeys.has(key);
        });

        return [...limited, ...selectedOutsideLimit];
    }, [bundleForm.items, bundleItemSearch, bundleItemTypeFilter, bundleSelectableItems]);

    const selectedBundleOptions = useMemo(() => (
        bundleForm.items
            .map((item) => bundleSelectableItems.find((option) => option.item_type === item.item_type && option.item_id === item.item_id))
            .filter(Boolean)
    ), [bundleForm.items, bundleSelectableItems]);

    const availableCourseLessonOptions = useMemo(() => {
        const selectedKeys = new Set(bundleForm.items.map((item) => `${item.item_type}-${item.item_id}`));
        return sortOptionsByLatest(courseLessonSelectableItems).filter((option) => !selectedKeys.has(`${option.item_type}-${option.item_id}`));
    }, [bundleForm.items, courseLessonSelectableItems]);

    const bundleExperienceWarnings = useMemo(() => {
        const types = new Set(selectedBundleOptions.map(optionFulfillmentType));
        const hasPhysical = types.has('physical');
        const hasDigital = types.has('digital');
        const hasService = types.has('service');
        const hasContent = types.has('content');
        const mixedTypes = types.size > 1;
        const serviceNeedsManualCare = selectedBundleOptions.some((option) => (
            optionFulfillmentType(option) === 'service'
            && (
                ['request', 'request_quote', 'showcase', 'external'].includes(String(option.service_mode || '').toLowerCase())
                || ['external', 'none'].includes(String(option.service_scheduling_type || '').toLowerCase())
                || ['quote', 'quote_only'].includes(String(option.service_price_display || '').toLowerCase())
                || String(option.service_booking_provider || '').toLowerCase() === 'external'
            )
        ));

        const warnings = [];

        if (mixedTypes) {
            warnings.push({
                key: 'mixed',
                tone: 'info',
                title: 'Mixed fulfillment',
                body: 'This bundle combines different delivery experiences. Explain clearly what is delivered, unlocked, or booked after payment.',
            });
        }

        if (hasPhysical && (hasDigital || hasContent)) {
            warnings.push({
                key: 'physical-digital',
                tone: 'info',
                title: 'Delivery plus access',
                body: 'Buyer may receive physical delivery and instant digital/content access in the same order.',
            });
        }

        if (hasService) {
            warnings.push({
                key: 'service',
                tone: 'warning',
                title: 'Service item included',
                body: 'Make sure the description says whether the customer books a slot, waits for confirmation, or receives follow-up after purchase.',
            });
        }

        if (serviceNeedsManualCare) {
            warnings.push({
                key: 'manual-service',
                tone: 'warning',
                title: 'Manual service flow',
                body: 'One service may be quote-only, showcase, external, or unscheduled. Keep the bundle in draft until the customer journey is clear.',
                confirmOnPublish: true,
            });
        }

        return warnings;
    }, [selectedBundleOptions]);

    const isImageLikeUrl = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(value.trim());
    };

    const summaryCards = useMemo(() => {
        const data = commerceSummary?.sections?.bundles || {};
        return [
            { label: courseModuleMode ? copy('Courses', 'Kozi') : copy('Bundles', 'Vifurushi'), value: data.total_items ?? bundles.length },
            { label: copy('Published', 'Imechapishwa'), value: data.published_items ?? 0 },
            { label: copy('Orders today', 'Oda za leo'), value: data.today_orders ?? 0 },
            { label: copy('Sales today', 'Mauzo ya leo'), value: `TZS ${Number(data.today_sales ?? 0).toLocaleString()}` },
        ];
    }, [bundles.length, commerceSummary, courseModuleMode]);
    const visibleBundles = useMemo(() => (
        courseModuleMode ? bundles.filter((item) => item.is_course) : bundles
    ), [bundles, courseModuleMode]);

    async function loadPage() {
        setLoading(true);
        try {
            const [productsRes, contentRes, postsRes, bundleRes, shippingProfilesRes, summaryRes] = await Promise.all([
                axios.get(`/merchant/${merchantUsername}/products/api`),
                axios.get(`/merchant/${merchantUsername}/content-items/api`),
                axios.get(`/merchant/${merchantUsername}/posts/api`, { params: { source: 'authored' } }),
                axios.get(`/merchant/${merchantUsername}/bundles/api`),
                axios.get('/api/merchant/shipping-profiles').catch(() => ({ data: { data: [] } })),
                axios.get(`/merchant/${merchantUsername}/orders/api/commerce-summary`).catch(() => ({ data: null })),
            ]);

            setProducts(productsRes.data?.data || []);
            setContentItems(contentRes.data?.data || []);
            setPosts(postsRes.data?.data || []);
            setBundles(bundleRes.data?.data || bundleRes.data?.bundles || []);
            setShippingProfiles(shippingProfilesRes.data?.data || []);
            setCommerceSummary(summaryRes.data || null);
        } catch (error) {
            toast.error(copy('Failed to load bundles page.', 'Imeshindikana kupakia ukurasa wa vifurushi.'));
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setBundleForm(initialFormForScope(moduleScope));
        setBundleItemSearch('');
        setBundleItemTypeFilter('all');
        setCourseModules([]);
        setCourseAttachSelection({});
        setCourseLessonUploads({});
        setSupportingMaterialUploads({});
        setCourseCoverUpload({ uploading: false, progress: 0, name: '' });
        setCourseOutcomeDraft('');
        setCourseRequirementDraft('');
    }

    function startEditBundle(item) {
        setBundleItemSearch('');
        setBundleItemTypeFilter('all');
        setBundleForm({
            id: item.id,
            title: item.title || '',
            description: item.description || '',
            price: item.price ?? '',
            shipping_profile_id: item.shipping_profile_id ? String(item.shipping_profile_id) : '',
            delivery_promise_override_enabled: Boolean(item.delivery_promise_override_enabled),
            delivery_handling_min_days: item.delivery_handling_min_days ?? '',
            delivery_handling_max_days: item.delivery_handling_max_days ?? '',
            delivery_transit_min_days: item.delivery_transit_min_days ?? '',
            delivery_transit_max_days: item.delivery_transit_max_days ?? '',
            delivery_cutoff_time: item.delivery_cutoff_time ? String(item.delivery_cutoff_time).slice(0, 5) : '',
            delivery_business_days_only: item.delivery_business_days_only ?? true,
            delivery_promise_label: item.delivery_promise_label || '',
            delivery_promise_note: item.delivery_promise_note || '',
            delivery_requires_confirmation: item.delivery_requires_confirmation ?? false,
            is_individual_sale: item.is_individual_sale ?? true,
            is_course: item.is_course ?? false,
            course_format: item.course_format || 'self_paced',
            course_outcomes_text: Array.isArray(item.course_outcomes) ? item.course_outcomes.join('\n') : '',
            course_requirements_text: Array.isArray(item.course_requirements) ? item.course_requirements.join('\n') : '',
            course_cover_image_url: item.course_cover_image_url || '',
            cohorts: Array.isArray(item.cohorts) ? item.cohorts : [],
            status: item.status || 'draft',
            publish_targets: defaultAutoPostTargets,
            items: (item.items || []).map((entry) => ({
                item_type: entry.item_type,
                item_id: entry.item_id,
                selected_variant_id: entry.selected_variant_id ?? null,
                section_title: entry.section_title || '',
                lesson_title: entry.lesson_title || '',
                lesson_summary: entry.lesson_summary || '',
                supporting_materials: Array.isArray(entry.supporting_materials) ? entry.supporting_materials : [],
                lesson_duration_minutes: entry.lesson_duration_minutes ?? '',
                unlock_after_days: entry.unlock_after_days ?? 0,
                is_preview: Boolean(entry.is_preview),
                sort_order: entry.sort_order ?? 0,
            })),
        });
        setCourseModules(buildCourseModulesFromBundle(item));
        setCourseAttachSelection({});
        setCourseLessonUploads({});
        setSupportingMaterialUploads({});
        setCourseCoverUpload({ uploading: false, progress: 0, name: '' });
        setCourseOutcomeDraft('');
        setCourseRequirementDraft('');
    }

    function hasBundlePromiseDayValue(value) {
        return value !== null && value !== undefined && value !== '';
    }

    function isSameDayBundlePromise(form) {
        const label = String(form.delivery_promise_label || '').toLowerCase();
        const hasExplicitDays = [
            form.delivery_handling_min_days,
            form.delivery_handling_max_days,
            form.delivery_transit_min_days,
            form.delivery_transit_max_days,
        ].some(hasBundlePromiseDayValue);

        return label.includes('same day')
            || label.includes('leo leo')
            || (hasExplicitDays && Number(form.delivery_handling_max_days || 0) <= 0 && Number(form.delivery_transit_max_days || 0) <= 0);
    }

    const showBundleDeliveryDays = !bundleForm.delivery_requires_confirmation;
    const showBundleDeliveryCutoff = showBundleDeliveryDays && isSameDayBundlePromise(bundleForm);

    function applyBundleDeliveryPreset(preset) {
        setBundleForm((current) => ({
            ...current,
            delivery_handling_min_days: preset.handling[0],
            delivery_handling_max_days: preset.handling[1],
            delivery_transit_min_days: preset.transit[0],
            delivery_transit_max_days: preset.transit[1],
            delivery_promise_label: preset.buyerLabel,
            delivery_requires_confirmation: Boolean(preset.confirm),
            delivery_cutoff_time: preset.key === 'same_day' ? current.delivery_cutoff_time : '',
        }));
    }

    function splitCourseList(value) {
        return String(value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
    }

    function setCourseList(field, values) {
        setBundleForm((current) => ({
            ...current,
            [field]: values.map((value) => String(value || '').trim()).filter(Boolean).join('\n'),
        }));
    }

    function addCourseListItem(field, value, clearDraft, emptyMessage) {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) {
            toast.error(emptyMessage);
            return;
        }

        setCourseList(field, [...splitCourseList(bundleForm[field]), cleanValue]);
        clearDraft('');
    }

    function updateCourseListItem(field, index, value) {
        const values = splitCourseList(bundleForm[field]);
        values[index] = value;
        setCourseList(field, values);
    }

    function removeCourseListItem(field, index) {
        setCourseList(field, splitCourseList(bundleForm[field]).filter((_, itemIndex) => itemIndex !== index));
    }

    function makeCourseLesson(module, index = 0, patch = {}) {
        return {
            id: patch.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: patch.title || `Somo la ${index + 1}`,
            summary: patch.summary || '',
            duration_minutes: patch.duration_minutes ?? '',
            unlock_after_days: patch.unlock_after_days ?? 0,
            is_preview: Boolean(patch.is_preview),
            assets: Array.isArray(patch.assets) ? patch.assets : [],
            live_session: patch.live_session || {
                starts_at: '',
                duration_minutes: '',
                timezone: 'Africa/Dar_es_Salaam',
                meeting_url: '',
                venue: '',
                capacity: '',
                notes: '',
            },
            sort_order: patch.sort_order ?? index,
        };
    }

    function buildCourseModulesFromBundle(bundle) {
        if (Array.isArray(bundle?.course_modules) && bundle.course_modules.length > 0) {
            return bundle.course_modules.map((module, moduleIndex) => ({
                id: module.id || `${Date.now()}-${moduleIndex}`,
                title: module.title || `Sehemu ya ${moduleIndex + 1}`,
                sort_order: module.sort_order ?? moduleIndex,
                lessons: (module.lessons || []).map((lesson, lessonIndex) => makeCourseLesson(module, lessonIndex, {
                    id: lesson.id,
                    title: lesson.title,
                    summary: lesson.summary,
                    duration_minutes: lesson.duration_minutes ?? '',
                    unlock_after_days: lesson.unlock_after_days ?? 0,
                    is_preview: lesson.is_preview,
                    sort_order: lesson.sort_order ?? lessonIndex,
                    assets: (lesson.assets || []).map((asset, assetIndex) => ({
                        role: asset.role || (assetIndex === 0 ? 'primary' : 'supporting'),
                        asset_type: asset.asset_type || 'file',
                        asset_id: asset.asset_id ?? null,
                        selected_variant_id: asset.selected_variant_id ?? null,
                        selected_variant_snapshot: asset.selected_variant_snapshot ?? null,
                        name: asset.name || '',
                        url: asset.url || '',
                        mime: asset.mime || null,
                        size: asset.size ?? null,
                        sort_order: asset.sort_order ?? assetIndex,
                    })),
                    live_session: lesson.live_session || null,
                })),
            }));
        }

        const grouped = new Map();
        const defaultModuleTitle = copy('Section 1', 'Sehemu ya 1');
        (bundle?.items || []).forEach((item, itemIndex) => {
            const title = item.section_title || defaultModuleTitle;
            if (!grouped.has(title)) {
                grouped.set(title, {
                    id: `${Date.now()}-${grouped.size}-${title}`,
                    title,
                    sort_order: grouped.size,
                    lessons: [],
                });
            }

            grouped.get(title).lessons.push(makeCourseLesson(null, grouped.get(title).lessons.length, {
                title: item.lesson_title || item.title || `Somo la ${itemIndex + 1}`,
                summary: item.lesson_summary || '',
                duration_minutes: item.lesson_duration_minutes ?? '',
                unlock_after_days: item.unlock_after_days ?? 0,
                is_preview: item.is_preview,
                assets: [
                    {
                        role: 'primary',
                        asset_type: item.item_type,
                        asset_id: item.item_id,
                        selected_variant_id: item.selected_variant_id ?? null,
                        selected_variant_snapshot: item.selected_variant_snapshot ?? null,
                        name: item.title || item.lesson_title || '',
                        url: '',
                        mime: null,
                        size: null,
                        sort_order: 0,
                    },
                    ...(Array.isArray(item.supporting_materials) ? item.supporting_materials.map((material, materialIndex) => ({
                        role: 'supporting',
                        asset_type: 'file',
                        asset_id: null,
                        name: material.name || copy('Material', 'Materiali'),
                        url: material.url || '',
                        mime: material.mime || null,
                        size: material.size ?? null,
                        sort_order: materialIndex + 1,
                    })) : []),
                ],
            }));
        });

        if (grouped.size === 0) {
            grouped.set(defaultModuleTitle, { id: `${Date.now()}-module`, title: defaultModuleTitle, sort_order: 0, lessons: [] });
        }

        return Array.from(grouped.values());
    }

    function ensureCourseModuleExists() {
        if (courseModules.length > 0) return;
        setCourseModules([{ id: `${Date.now()}-module`, title: copy('Section 1', 'Sehemu ya 1'), sort_order: 0, lessons: [] }]);
    }

    async function saveBundle() {
        const needsPublishConfirmation = bundleForm.status === 'published'
            && bundleExperienceWarnings.some((warning) => warning.confirmOnPublish);
        if (needsPublishConfirmation && !window.confirm(copy('This bundle includes a service that needs additional details or confirmation. Publish it now?', 'Bundle hii ina service inayohitaji maelezo/uthibitisho wa ziada. Una uhakika unataka kuipublish sasa?'))) {
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...bundleForm,
                price: bundleForm.price === '' ? null : Number(bundleForm.price),
                shipping_profile_id: bundleForm.shipping_profile_id ? Number(bundleForm.shipping_profile_id) : null,
                delivery_handling_min_days: bundleForm.delivery_promise_override_enabled ? (bundleForm.delivery_handling_min_days || null) : null,
                delivery_handling_max_days: bundleForm.delivery_promise_override_enabled ? (bundleForm.delivery_handling_max_days || null) : null,
                delivery_transit_min_days: bundleForm.delivery_promise_override_enabled ? (bundleForm.delivery_transit_min_days || null) : null,
                delivery_transit_max_days: bundleForm.delivery_promise_override_enabled ? (bundleForm.delivery_transit_max_days || null) : null,
                delivery_cutoff_time: bundleForm.delivery_promise_override_enabled && showBundleDeliveryCutoff ? (bundleForm.delivery_cutoff_time || null) : null,
                delivery_promise_label: bundleForm.delivery_promise_override_enabled ? (bundleForm.delivery_promise_label || null) : null,
                delivery_promise_note: bundleForm.delivery_promise_override_enabled ? (bundleForm.delivery_promise_note || null) : null,
                course_outcomes: splitCourseList(bundleForm.course_outcomes_text),
                course_requirements: splitCourseList(bundleForm.course_requirements_text),
                course_modules: bundleForm.is_course ? courseModules.map((module, moduleIndex) => ({
                    title: module.title || `Sehemu ya ${moduleIndex + 1}`,
                    sort_order: moduleIndex,
                    lessons: (module.lessons || []).map((lesson, lessonIndex) => ({
                        title: lesson.title || `Somo la ${lessonIndex + 1}`,
                        summary: lesson.summary || null,
                        duration_minutes: lesson.duration_minutes === '' ? null : Number(lesson.duration_minutes),
                        unlock_after_days: Number(lesson.unlock_after_days || 0),
                        is_preview: Boolean(lesson.is_preview),
                        sort_order: lessonIndex,
                        assets: (lesson.assets || []).map((asset, assetIndex) => ({
                            ...asset,
                            asset_id: asset.asset_id ? Number(asset.asset_id) : null,
                            selected_variant_id: asset.selected_variant_id ? Number(asset.selected_variant_id) : null,
                            size: asset.size ? Number(asset.size) : null,
                            sort_order: assetIndex,
                        })),
                        live_session: lesson.live_session || null,
                    })),
                })) : [],
                cohorts: bundleForm.is_course && bundleForm.course_format === 'cohort' ? (bundleForm.cohorts || []) : [],
                publish_targets: bundleForm.publish_targets || defaultAutoPostTargets,
                items: bundleForm.is_course ? [] : bundleForm.items.map((item, index) => ({
                    ...item,
                    selected_variant_id: item.selected_variant_id ? Number(item.selected_variant_id) : null,
                    lesson_duration_minutes: item.lesson_duration_minutes === '' ? null : Number(item.lesson_duration_minutes),
                    unlock_after_days: Number(item.unlock_after_days || 0),
                    sort_order: index,
                })),
            };

            if (bundleForm.id) {
                await axios.put(`/merchant/${merchantUsername}/bundles/${bundleForm.id}/api`, payload);
                toast.success(copy('Bundle updated.', 'Bundle imesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/bundles/api`, payload);
                toast.success(copy('Bundle created.', 'Bundle imeundwa.'));
            }

            resetForm();
            await loadPage();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not save the bundle.', 'Imeshindwa kuhifadhi bundle.'));
        } finally {
            setSaving(false);
        }
    }

    async function destroyBundle(id) {
        if (!window.confirm(copy('Are you sure you want to delete this bundle?', 'Una uhakika unataka kufuta bundle hii?'))) return;

        try {
            await axios.delete(`/merchant/${merchantUsername}/bundles/${id}/api`);
            toast.success(copy('Bundle deleted.', 'Bundle imefutwa.'));
            if (bundleForm.id === id) resetForm();
            await loadPage();
        } catch (error) {
            toast.error(copy('Could not delete bundle.', 'Imeshindwa kufuta bundle.'));
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
                        section_title: '',
                        lesson_title: option.label || '',
                        lesson_summary: '',
                        supporting_materials: [],
                        lesson_duration_minutes: '',
                        unlock_after_days: 0,
                        is_preview: false,
                        sort_order: current.items.length,
                    }],
            };
        });
    }

    function updateSelectedCourseItem(option, patch) {
        setBundleForm((current) => ({
            ...current,
            items: current.items.map((item) => (
                item.item_type === option.item_type && item.item_id === option.item_id
                    ? { ...item, ...patch }
                    : item
            )),
        }));
    }

    function updateBundleItemAtIndex(index, patch) {
        setBundleForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => (
                itemIndex === index ? { ...item, ...patch } : item
            )),
        }));
    }

    function removeBundleItemAtIndex(index) {
        setBundleForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    }

    function addCourseModule() {
        setCourseModules((current) => ([
            ...current,
            { id: `${Date.now()}-${current.length + 1}`, title: `Sehemu ya ${current.length + 1}`, sort_order: current.length, lessons: [] },
        ]));
    }

    function updateCourseCohort(index, patch) {
        setBundleForm((current) => ({
            ...current,
            cohorts: (current.cohorts || []).map((cohort, cohortIndex) => (
                cohortIndex === index ? { ...cohort, ...patch } : cohort
            )),
        }));
    }

    function addCourseCohort() {
        setBundleForm((current) => ({
            ...current,
            cohorts: [
                ...(current.cohorts || []),
                {
                    name: `Cohort ${(current.cohorts || []).length + 1}`,
                    starts_at: '',
                    enrollment_deadline: '',
                    capacity: '',
                    access_rule: 'all_on_start',
                    status: 'upcoming',
                },
            ],
        }));
    }

    function renameCourseModule(moduleId, title) {
        const nextTitle = title || '';
        setCourseModules((current) => current.map((module) => (
            module.id === moduleId ? { ...module, title: nextTitle } : module
        )));
    }

    function removeCourseModule(moduleId) {
        const module = courseModules.find((entry) => entry.id === moduleId);
        if (!module) return;
        const moduleLessons = module.lessons || [];
        if (moduleLessons.length > 0 && !window.confirm(copy('This module has lessons. Deleting it will remove its lessons from the course. Continue?', 'Sehemu hii ina masomo. Ukifuta sehemu, masomo yake yataondolewa kwenye course. Endelea?'))) return;

        setCourseModules((current) => current.filter((entry) => entry.id !== moduleId));
        setCourseAttachSelection((current) => {
            const next = { ...current };
            delete next[moduleId];
            return next;
        });
    }

    function addEmptyCourseLesson(module) {
        setCourseModules((current) => current.map((entry) => (
            entry.id === module.id
                ? {
                    ...entry,
                    lessons: [
                        ...(entry.lessons || []),
                        makeCourseLesson(entry, (entry.lessons || []).length),
                    ],
                }
                : entry
        )));
    }

    function addCourseLesson(module) {
        const optionKey = courseAttachSelection[module.id];
        const option = availableCourseLessonOptions.find((entry) => entry.key === optionKey);
        if (!option) {
            toast.error(copy('Choose a post, digital download, or content to attach to the lesson.', 'Chagua post, digital download, au content ya kuunganisha na somo.'));
            return;
        }

        const asset = courseAssetFromOption(option);

        setCourseModules((current) => current.map((entry) => (
            entry.id === module.id
                ? {
                    ...entry,
                    lessons: [
                        ...(entry.lessons || []),
                        makeCourseLesson(entry, (entry.lessons || []).length, {
                            title: option.label || `Somo la ${(entry.lessons || []).length + 1}`,
                            assets: [asset],
                        }),
                    ],
                }
                : entry
        )));

        setCourseAttachSelection((current) => ({ ...current, [module.id]: '' }));
    }

    function courseLessonAttachKey(moduleId, lessonId) {
        return `${moduleId}-${lessonId}`;
    }

    function courseAssetFromOption(option) {
        return {
            role: 'primary',
            asset_type: option.item_type,
            asset_id: option.item_id,
            selected_variant_id: option.item_type === 'product' && option.has_variants
                ? (option.variants?.[0]?.id ?? null)
                : null,
            selected_variant_snapshot: null,
            name: option.label || '',
            url: '',
            mime: null,
            size: null,
            sort_order: 0,
        };
    }

    function attachCourseContentToLesson(module, lesson) {
        const attachKey = courseLessonAttachKey(module.id, lesson.id);
        const optionKey = courseAttachSelection[attachKey];
        const option = availableCourseLessonOptions.find((entry) => entry.key === optionKey);
        if (!option) {
            toast.error(copy('Choose content to use as lesson content.', 'Chagua content ya kuweka kama lesson content.'));
            return;
        }

        const primaryAsset = courseAssetFromOption(option);
        setCourseModules((current) => current.map((entry) => (
            entry.id === module.id
                ? {
                    ...entry,
                    lessons: (entry.lessons || []).map((entryLesson) => (
                        entryLesson.id === lesson.id
                            ? {
                                ...entryLesson,
                                title: entryLesson.title || option.label || 'Somo',
                                assets: [
                                    primaryAsset,
                                    ...(entryLesson.assets || []).filter((asset) => asset.role !== 'primary'),
                                ].map((asset, index) => ({ ...asset, sort_order: index })),
                            }
                            : entryLesson
                    )),
                }
                : entry
        )));

        setCourseAttachSelection((current) => ({ ...current, [attachKey]: '' }));
    }

    function updateCourseLesson(moduleId, lessonId, patch) {
        setCourseModules((current) => current.map((module) => (
            module.id === moduleId
                ? {
                    ...module,
                    lessons: (module.lessons || []).map((lesson) => (
                        lesson.id === lessonId ? { ...lesson, ...patch } : lesson
                    )),
                }
                : module
        )));
    }

    function updateCourseLessonAsset(moduleId, lessonId, assetIndex, patch) {
        setCourseModules((current) => current.map((module) => (
            module.id === moduleId
                ? {
                    ...module,
                    lessons: (module.lessons || []).map((lesson) => (
                        lesson.id === lessonId
                            ? {
                                ...lesson,
                                assets: (lesson.assets || []).map((asset, index) => (
                                    index === assetIndex ? { ...asset, ...patch } : asset
                                )),
                            }
                            : lesson
                    )),
                }
                : module
        )));
    }

    function removeCourseLesson(moduleId, lessonId) {
        setCourseModules((current) => current.map((module) => (
            module.id === moduleId
                ? { ...module, lessons: (module.lessons || []).filter((lesson) => lesson.id !== lessonId) }
                : module
        )));
    }

    async function uploadCourseCover(file) {
        if (!file) return;

        setCourseCoverUpload({ uploading: true, progress: 0, name: file.name });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'course-covers');

        try {
            const uploadRes = await axios.post(`/merchant/${merchantUsername}/upload/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || file.size || 1;
                    const progress = Math.round((progressEvent.loaded * 100) / total);
                    setCourseCoverUpload({ uploading: true, progress, name: file.name });
                },
            });

            if (!uploadRes.data?.url) {
                throw new Error('Cover upload did not return a URL.');
            }

            setBundleForm((current) => ({
                ...current,
                course_cover_image_url: uploadRes.data.url,
            }));
            toast.success(copy('Course cover uploaded.', 'Course cover imepakiwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not upload the course cover.', 'Imeshindwa kupakia course cover.'));
        } finally {
            setCourseCoverUpload({ uploading: false, progress: 0, name: '' });
        }
    }

    async function uploadCourseLessonAsset(module, file) {
        if (!file) return;

        const uploadKey = module.id;
        setCourseLessonUploads((current) => ({
            ...current,
            [uploadKey]: { uploading: true, progress: 0, name: file.name },
        }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'private');
        formData.append('folder', 'course-lessons');

        try {
            const uploadRes = await axios.post(`/merchant/${merchantUsername}/upload/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || file.size || 1;
                    const progress = Math.round((progressEvent.loaded * 100) / total);
                    setCourseLessonUploads((current) => ({
                        ...current,
                        [uploadKey]: { ...(current[uploadKey] || {}), uploading: true, progress, name: file.name },
                    }));
                },
            });

            const uploadedUrl = uploadRes.data?.url;
            const title = file.name.replace(/\.[^.]+$/, '').trim() || copy('Course lesson', 'Somo la kozi');
            const contentRes = await axios.post(`/merchant/${merchantUsername}/content-items/api`, {
                title,
                excerpt: 'Lesson asset uploaded from course builder.',
                body: `Lesson file: ${uploadedUrl}`,
                format: 'plain_text',
                visibility: 'draft',
                price: null,
            });

            const contentItem = contentRes.data?.content_item;
            if (!contentItem?.id) {
                throw new Error('Content item was not created.');
            }

            const option = {
                key: `content_item-${contentItem.id}`,
                item_type: 'content_item',
                item_id: contentItem.id,
                label: contentItem.title || title,
                meta: 'Free',
                image_url: null,
                product_type: 'content',
            };

            setContentItems((current) => [contentItem, ...current.filter((item) => item.id !== contentItem.id)]);
            setCourseModules((current) => current.map((entry) => (
                entry.id === module.id
                    ? {
                        ...entry,
                        lessons: [
                            ...(entry.lessons || []),
                            makeCourseLesson(entry, (entry.lessons || []).length, {
                                title,
                                assets: [{
                                    role: 'primary',
                                    asset_type: option.item_type,
                                    asset_id: option.item_id,
                                    selected_variant_id: null,
                                    selected_variant_snapshot: null,
                                    name: option.label || title,
                                    url: uploadedUrl || '',
                                    mime: uploadRes.data?.mime || file.type || null,
                                    size: uploadRes.data?.size || file.size || null,
                                    sort_order: 0,
                                }],
                            }),
                        ],
                    }
                    : entry
            )));

            toast.success(copy('Lesson uploaded and added to the course.', 'Somo limepakiwa na kuongezwa kwenye course.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not upload the lesson.', 'Imeshindwa kupakia somo.'));
        } finally {
            setCourseLessonUploads((current) => ({
                ...current,
                [uploadKey]: { uploading: false, progress: 0, name: '' },
            }));
        }
    }

    async function uploadSupportingMaterial(moduleId, lessonId, file) {
        if (!file) return;

        const uploadKey = `supporting-${lessonId}`;
        setSupportingMaterialUploads((current) => ({
            ...current,
            [uploadKey]: { uploading: true, progress: 0, name: file.name },
        }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'private');
        formData.append('folder', 'course-materials');

        try {
            const uploadRes = await axios.post(`/merchant/${merchantUsername}/upload/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || file.size || 1;
                    const progress = Math.round((progressEvent.loaded * 100) / total);
                    setSupportingMaterialUploads((current) => ({
                        ...current,
                        [uploadKey]: { ...(current[uploadKey] || {}), uploading: true, progress, name: file.name },
                    }));
                },
            });

            const material = {
                role: 'supporting',
                asset_type: 'file',
                asset_id: null,
                selected_variant_id: null,
                selected_variant_snapshot: null,
                name: uploadRes.data?.name || file.name,
                url: uploadRes.data?.url,
                mime: uploadRes.data?.mime || file.type || null,
                size: uploadRes.data?.size || file.size || null,
                sort_order: 0,
            };

            setCourseModules((current) => current.map((module) => (
                module.id === moduleId
                    ? {
                        ...module,
                        lessons: (module.lessons || []).map((lesson) => (
                            lesson.id === lessonId
                                ? {
                                    ...lesson,
                                    assets: [...(lesson.assets || []), material].filter((asset) => asset.asset_type !== 'file' || asset.url),
                                }
                                : lesson
                        )),
                    }
                    : module
            )));

            toast.success(copy('Supporting material added.', 'Supporting material imeongezwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not upload the supporting material.', 'Imeshindwa kupakia supporting material.'));
        } finally {
            setSupportingMaterialUploads((current) => ({
                ...current,
                [uploadKey]: { uploading: false, progress: 0, name: '' },
            }));
        }
    }

    if (loading) {
        return (
            <AppLayout>
                <Head title={`${pageCopy.head} | Takeer`} />
                <div className="max-w-5xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">{pageCopy.loading}</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${pageCopy.head} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <Card className="rounded-[24px] border-brand-200/70">
                    <CardHeader>
                        <CardTitle className="text-lg font-black">{pageCopy.summaryTitle}</CardTitle>
                        <CardDescription>{pageCopy.summaryDescription}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {summaryCards.map((item) => (
                            <div key={item.label} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                                <p className="mt-2 text-xl font-black text-foreground">{item.value}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="grid gap-6">
                    <Card className="rounded-[24px] border-sky-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl font-black">
                                {courseModuleMode ? <BookOpenText className="h-5 w-5 text-indigo-600" /> : <Boxes className="h-5 w-5 text-sky-600" />}
                                {pageCopy.createTitle}
                            </CardTitle>
                            <CardDescription>{pageCopy.createDescription}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{pageCopy.nameLabel}</label>
                                    <Input value={bundleForm.title} onChange={(e) => setBundleForm({ ...bundleForm, title: e.target.value })} placeholder={pageCopy.namePlaceholder} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Price (TZS)', 'Bei (TZS)')}</label>
                                    <Input type="number" min="0" value={bundleForm.price} onChange={(e) => setBundleForm({ ...bundleForm, price: e.target.value })} placeholder="25000" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Description', 'Maelezo')}</label>
                                <Textarea rows={4} value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} placeholder={pageCopy.descriptionPlaceholder} />
                            </div>

                            <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                        <Clock3 className="mt-0.5 h-4 w-4 text-emerald-700" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-emerald-900">{copy('Bundle delivery timing', 'Muda wa bundle kufika')}</p>
                                            <p className="text-xs text-emerald-800/80">{copy('For bundles with physical products, choose a template or set a custom time.', 'Kwa bundle yenye bidhaa za kushikika, chagua template au weka muda maalum.')}</p>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setBundleForm({ ...bundleForm, delivery_promise_override_enabled: !bundleForm.delivery_promise_override_enabled })} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${bundleForm.delivery_promise_override_enabled ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}>
                                        {bundleForm.delivery_promise_override_enabled ? copy('Custom timing', 'Muda maalum') : copy('Use template', 'Tumia template')}
                                    </button>
                                </div>
                                <select className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm font-bold text-emerald-800" value={bundleForm.shipping_profile_id} onChange={(e) => setBundleForm({ ...bundleForm, shipping_profile_id: e.target.value })}>
                                    <option value="">{copy('Use first physical item/default profile', 'Tumia item ya kwanza ya kushikika/profile ya kawaida')}</option>
                                    {shippingProfiles.map(profile => (
                                        <option key={profile.id} value={profile.id}>{profile.name}{profile.is_default ? ` (${copy('Default', 'Chaguo-msingi')})` : ''}</option>
                                    ))}
                                </select>
                                {bundleForm.delivery_promise_override_enabled && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                            {DELIVERY_PROMISE_PRESETS.map((preset) => (
                                                <button key={preset.key} type="button" onClick={() => applyBundleDeliveryPreset(preset)} className={`rounded-2xl border bg-white px-3 py-2 text-left transition hover:border-emerald-300 ${bundleForm.delivery_promise_label === preset.buyerLabel ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-emerald-100'}`}>
                                                    <span className="block text-xs font-black text-emerald-900">{preset.label}</span>
                                                    <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-emerald-700/75">{preset.hint}</span>
                                                </button>
                                            ))}
                                        </div>
                                        {showBundleDeliveryDays ? (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                    <Input type="number" min="0" placeholder={copy('Handling from', 'Kuandaa kuanzia')} value={bundleForm.delivery_handling_min_days} onChange={(e) => setBundleForm({ ...bundleForm, delivery_handling_min_days: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                                    <Input type="number" min="0" placeholder={copy('Handling to', 'Kuandaa mpaka')} value={bundleForm.delivery_handling_max_days} onChange={(e) => setBundleForm({ ...bundleForm, delivery_handling_max_days: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                                    <Input type="number" min="0" placeholder={copy('Transit from', 'Safari kuanzia')} value={bundleForm.delivery_transit_min_days} onChange={(e) => setBundleForm({ ...bundleForm, delivery_transit_min_days: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                                    <Input type="number" min="0" placeholder={copy('Transit to', 'Safari mpaka')} value={bundleForm.delivery_transit_max_days} onChange={(e) => setBundleForm({ ...bundleForm, delivery_transit_max_days: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                                </div>
                                                {showBundleDeliveryCutoff && (
                                                    <Input type="time" value={bundleForm.delivery_cutoff_time} onChange={(e) => setBundleForm({ ...bundleForm, delivery_cutoff_time: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
                                                {copy('Days and deadline are hidden because timing will be confirmed in chat.', 'Siku na deadline zimefichwa kwa sababu muda utathibitishwa kwenye chat.')}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-2">
                                            <Input placeholder={copy('Customer-facing wording, e.g. Bundle delivery: 2–5 days', 'Maneno ya mteja, mf. Bundle delivery: siku 2-5')} value={bundleForm.delivery_promise_label} onChange={(e) => setBundleForm({ ...bundleForm, delivery_promise_label: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => setBundleForm({ ...bundleForm, delivery_business_days_only: !bundleForm.delivery_business_days_only })} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${bundleForm.delivery_business_days_only ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}>
                                                {bundleForm.delivery_business_days_only ? copy('Business days', 'Siku za kazi') : copy('Every day', 'Kila siku')}
                                            </button>
                                            <button type="button" onClick={() => setBundleForm({ ...bundleForm, delivery_requires_confirmation: !bundleForm.delivery_requires_confirmation, delivery_cutoff_time: bundleForm.delivery_requires_confirmation ? bundleForm.delivery_cutoff_time : '' })} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${bundleForm.delivery_requires_confirmation ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}>
                                                {bundleForm.delivery_requires_confirmation ? copy('Confirm in chat', 'Tuta-confirm kwa chat') : copy('Show customer the estimate', 'Mteja aone estimate')}
                                            </button>
                                        </div>
                                        <Input placeholder={copy('Extra note, e.g. a heavy bundle may require cargo', 'Ujumbe wa ziada, mf. Bundle nzito inaweza kuhitaji cargo')} value={bundleForm.delivery_promise_note} onChange={(e) => setBundleForm({ ...bundleForm, delivery_promise_note: e.target.value })} className="h-10 bg-white text-xs font-bold" />
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="min-h-[86px] rounded-2xl border border-slate-200 bg-white px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
                                    <div>
                                        <p className="text-base font-black">{copy('Sell individually', 'Uza moja kwa moja')}</p>
                                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{copy('Buyer can purchase this bundle directly.', 'Mteja anaweza kununua bundle hii moja kwa moja.')}</p>
                                    </div>
                                    <input type="checkbox" className="h-4 w-4" checked={bundleForm.is_individual_sale} onChange={(e) => setBundleForm({ ...bundleForm, is_individual_sale: e.target.checked })} />
                                </label>
                                <label className="min-h-[86px] rounded-2xl border border-slate-200 bg-sky-50/50 px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
                                    <div>
                                        <p className="text-base font-black">{courseModuleMode ? 'Learning Mode' : 'Course/Training Mode'}</p>
                                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{courseModuleMode ? 'Courses and workshops use lessons, cohorts, materials, and enrollments.' : 'Treat this bundle as a course package.'}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={bundleForm.is_course}
                                        disabled={courseModuleMode}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setBundleForm({ ...bundleForm, is_course: checked });
                                            if (checked) ensureCourseModuleExists();
                                        }}
                                    />
                                </label>
                            </div>

                            {bundleForm.is_course && (
                                <div className="border-t border-indigo-100 pt-6 space-y-5">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-indigo-700">{copy('Course builder', 'Mjenzi wa kozi')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Set how students access this course, then build the curriculum below.', 'Weka jinsi wanafunzi watakavyofikia kozi hii, kisha tengeneza mtaala hapa chini.')}</p>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('How will students learn?', 'Wanafunzi watajifunza vipi?')}</label>
                                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bundleForm.course_format} onChange={(e) => setBundleForm({ ...bundleForm, course_format: e.target.value })}>
                                                <option value="self_paced">{copy('Learn anytime', 'Jifunze wakati wowote')}</option>
                                                <option value="cohort">{copy('Join a class group', 'Jiunge na kundi la darasa')}</option>
                                                <option value="live">{copy('Attend live classes', 'Hudhuria madarasa mubashara')}</option>
                                            </select>
                                            <p className="text-[11px] text-muted-foreground">{copy('This controls which extra setup fields appear below.', 'Hii inadhibiti sehemu za ziada za usanidi zinazoonekana hapa chini.')}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Course cover', 'Jalada la kozi')}</label>
                                            <div className="rounded-2xl border border-input bg-white p-3">
                                                {bundleForm.course_cover_image_url ? (
                                                    <div className="mb-3 overflow-hidden rounded-xl border border-input bg-muted">
                                                        <img src={bundleForm.course_cover_image_url} alt={copy('Course cover preview', 'Mwonekano wa jalada la kozi')} className="h-32 w-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/50 text-blue-700">
                                                        <Image className="mr-2 h-5 w-5" />
                                                        <span className="text-sm font-bold">{copy('Upload course cover', 'Pakia jalada la kozi')}</span>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50">
                                                        <FileUp className="mr-2 h-4 w-4" />
                                                        {bundleForm.course_cover_image_url ? 'Change Cover' : 'Upload Cover'}
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                                            onChange={(event) => {
                                                                uploadCourseCover(event.target.files?.[0]);
                                                                event.target.value = '';
                                                            }}
                                                        />
                                                    </label>
                                                    {bundleForm.course_cover_image_url && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="rounded-xl"
                                                            onClick={() => setBundleForm({ ...bundleForm, course_cover_image_url: '' })}
                                                        >
                                                            {copy('Remove', 'Ondoa')}
                                                        </Button>
                                                    )}
                                                </div>
                                                {courseCoverUpload.uploading && (
                                                    <div className="mt-3 space-y-1">
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <span className="truncate">{courseCoverUpload.name || copy('Uploading...', 'Inapakia...')}</span>
                                                            <span>{courseCoverUpload.progress || 0}%</span>
                                                        </div>
                                                        <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                                                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${courseCoverUpload.progress || 0}%` }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {['cohort', 'live'].includes(bundleForm.course_format) && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-amber-800">{copy('Class groups', 'Makundi ya darasa')}</p>
                                                    <p className="text-xs text-amber-900/75">{copy('Create the batch students will join, with start date, enrollment deadline, and capacity.', 'Unda batch ambayo wanafunzi watajiunga, ikiwa na tarehe ya kuanza, deadline ya usajili, na uwezo.')}</p>
                                                </div>
                                                <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={addCourseCohort}>
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    {copy('Add class group', 'Ongeza kundi la darasa')}
                                                </Button>
                                            </div>
                                            {(bundleForm.cohorts || []).length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-amber-200 bg-white/70 px-4 py-4 text-sm text-amber-900">
                                                    {copy('No class group yet. Add one before publishing a cohort course.', 'Hakuna kundi la darasa bado. Ongeza moja kabla ya kuchapisha kozi ya cohort.')}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {(bundleForm.cohorts || []).map((cohort, index) => (
                                                        <div key={`cohort-${index}`} className="rounded-xl border border-amber-100 bg-white p-3 space-y-3">
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Group name', 'Jina la kundi')}</label>
                                                                    <Input value={cohort.name || ''} onChange={(e) => updateCourseCohort(index, { name: e.target.value })} placeholder={copy('E.g. May 2026 batch', 'Mf. May 2026 Batch')} />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Max students', 'Wanafunzi wa juu')}</label>
                                                                    <Input type="number" min="1" value={cohort.capacity ?? ''} onChange={(e) => updateCourseCohort(index, { capacity: e.target.value })} placeholder={copy('Optional', 'Si lazima')} />
                                                                </div>
                                                            </div>
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Start date', 'Tarehe ya kuanza')}</label>
                                                                    <Input type="datetime-local" value={cohort.starts_at || ''} onChange={(e) => updateCourseCohort(index, { starts_at: e.target.value })} />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Enrollment deadline', 'Deadline ya usajili')}</label>
                                                                    <Input type="datetime-local" value={cohort.enrollment_deadline || ''} onChange={(e) => updateCourseCohort(index, { enrollment_deadline: e.target.value })} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Learning outcomes', 'Matokeo ya kujifunza')}</label>
                                            <div className="rounded-2xl border border-input bg-white p-3 space-y-3">
                                                {splitCourseList(bundleForm.course_outcomes_text).length > 0 ? (
                                                    <div className="space-y-2">
                                                        {splitCourseList(bundleForm.course_outcomes_text).map((outcome, index) => (
                                                            <div key={`outcome-${index}`} className="flex gap-2">
                                                                <Input
                                                                    value={outcome}
                                                                    onChange={(event) => updateCourseListItem('course_outcomes_text', index, event.target.value)}
                                                                    placeholder={copy('What will the buyer learn?', 'Mnunuzi atajifunza nini?')}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0 rounded-xl text-muted-foreground hover:text-red-600"
                                                                    onClick={() => removeCourseListItem('course_outcomes_text', index)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{copy('No outcomes added yet.', 'Hakuna matokeo yaliyoongezwa bado.')}</p>
                                                )}
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Input
                                                        value={courseOutcomeDraft}
                                                        onChange={(event) => setCourseOutcomeDraft(event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault();
                                                                addCourseListItem('course_outcomes_text', courseOutcomeDraft, setCourseOutcomeDraft, copy('Add a learning outcome first.', 'Andika learning outcome kwanza.'));
                                                            }
                                                        }}
                                                        placeholder={copy('E.g. Build a professional plumbing quote', 'Mf. Tengeneza nukuu ya kitaalamu ya plumbing')}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="shrink-0 rounded-xl border-indigo-200 text-indigo-700"
                                                        onClick={() => addCourseListItem('course_outcomes_text', courseOutcomeDraft, setCourseOutcomeDraft, copy('Add a learning outcome first.', 'Andika learning outcome kwanza.'))}
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        {copy('Add outcome', 'Ongeza matokeo')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Requirements', 'Mahitaji')}</label>
                                            <div className="rounded-2xl border border-input bg-white p-3 space-y-3">
                                                {splitCourseList(bundleForm.course_requirements_text).length > 0 ? (
                                                    <div className="space-y-2">
                                                        {splitCourseList(bundleForm.course_requirements_text).map((requirement, index) => (
                                                            <div key={`requirement-${index}`} className="flex gap-2">
                                                                <Input
                                                                    value={requirement}
                                                                    onChange={(event) => updateCourseListItem('course_requirements_text', index, event.target.value)}
                                                                    placeholder={copy('What should the buyer have?', 'Mnunuzi awe na nini?')}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0 rounded-xl text-muted-foreground hover:text-red-600"
                                                                    onClick={() => removeCourseListItem('course_requirements_text', index)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{copy('No requirements added yet.', 'Hakuna mahitaji yaliyoongezwa bado.')}</p>
                                                )}
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Input
                                                        value={courseRequirementDraft}
                                                        onChange={(event) => setCourseRequirementDraft(event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault();
                                                                addCourseListItem('course_requirements_text', courseRequirementDraft, setCourseRequirementDraft, copy('Add a requirement first.', 'Andika requirement kwanza.'));
                                                            }
                                                        }}
                                                        placeholder={copy('E.g. Basic smartphone skills', 'Mf. Ujuzi wa msingi wa simu janja')}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="shrink-0 rounded-xl border-indigo-200 text-indigo-700"
                                                        onClick={() => addCourseListItem('course_requirements_text', courseRequirementDraft, setCourseRequirementDraft, copy('Add a requirement first.', 'Andika requirement kwanza.'))}
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        {copy('Add requirement', 'Ongeza hitaji')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {bundleForm.is_course ? (
                                <div className="border-t border-blue-100 pt-6 space-y-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-blue-700">{copy('Course curriculum', 'Mpangilio wa kozi')}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{copy('Create sections, add lessons, then attach products, downloads, services, or content to each lesson.', 'Tengeneza sehemu, ongeza masomo, kisha ambatanisha bidhaa, downloads, huduma, au content kwenye kila somo.')}</p>
                                        </div>
                                        <Button variant="outline" className="rounded-xl border-blue-200 bg-white text-blue-700" onClick={addCourseModule}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            {copy('Add section', 'Ongeza sehemu')}
                                        </Button>
                                    </div>

                                    {bundleExperienceWarnings.length > 0 && (
                                        <div className="space-y-2">
                                            {bundleExperienceWarnings.map((warning) => {
                                                const Icon = warning.tone === 'warning' ? AlertTriangle : Info;
                                                const classes = warning.tone === 'warning'
                                                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                    : 'border-sky-200 bg-sky-50 text-sky-900';

                                                return (
                                                    <div key={warning.key} className={`rounded-2xl border px-4 py-3 ${classes}`}>
                                                        <div className="flex items-start gap-2">
                                                            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                                            <div>
                                                                <p className="text-sm font-black">{warning.title}</p>
                                                                <p className="mt-1 text-xs leading-5 opacity-85">{warning.body}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {courseModules.map((module, moduleIndex) => {
                                            const moduleTitle = module.title || `Sehemu ya ${moduleIndex + 1}`;
                                            const moduleLessons = module.lessons || [];

                                            return (
                                                <div key={module.id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                                                            {moduleIndex + 1}
                                                        </span>
                                                        <Input
                                                            className="h-9 border-0 bg-transparent p-0 text-base font-black focus-visible:ring-0"
                                                            value={module.title}
                                                            onChange={(e) => renameCourseModule(module.id, e.target.value)}
                                                            placeholder={`Sehemu ya ${moduleIndex + 1}`}
                                                        />
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600" onClick={() => removeCourseModule(module.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2 sm:ml-9">
                                                        <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => addEmptyCourseLesson(module)}>
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            {copy('Add blank lesson', 'Ongeza somo tupu')}
                                                        </Button>
                                                    </div>

                                                    <div className="mt-4 ml-0 space-y-3 sm:ml-9">
                                                        {moduleLessons.length === 0 && (
                                                            <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-5 text-center">
                                                                <p className="text-sm font-bold text-blue-900">{copy(`No lessons in ${moduleTitle} yet.`, `Hakuna somo kwenye ${moduleTitle} bado.`)}</p>
                                                                <p className="text-xs text-blue-700/80 mt-1">{copy('Add a lesson first, then attach content or materials if needed.', 'Ongeza somo kwanza, kisha ambatisha content au materials kama zinahitajika.')}</p>
                                                            </div>
                                                        )}

                                                        {moduleLessons.map((lesson, lessonIndex) => {
                                                            const primaryAsset = (lesson.assets || []).find((asset) => asset.role === 'primary');
                                                            const supportingAssets = (lesson.assets || []).filter((asset) => asset.role !== 'primary');
                                                            const option = primaryAsset
                                                                ? courseLessonSelectableItems.find((entry) => entry.item_type === primaryAsset.asset_type && entry.item_id === primaryAsset.asset_id)
                                                                : null;

                                                            return (
                                                                <div key={lesson.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0 flex-1">
                                                                            <Input
                                                                                className="h-8 border-0 bg-transparent p-0 text-sm font-bold focus-visible:ring-0"
                                                                                value={lesson.title || ''}
                                                                                onChange={(e) => updateCourseLesson(module.id, lesson.id, { title: e.target.value })}
                                                                                placeholder={`Somo la ${lessonIndex + 1}`}
                                                                            />
                                                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                                {option && (
                                                                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${typeBadgeClass(option)}`}>
                                                                                        {typeLabel(option)}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[11px] text-muted-foreground truncate">
                                                                                    {primaryAsset ? `${copy('Attached:', 'Imeambatanishwa:')} ${option?.label || primaryAsset.name || `${primaryAsset.asset_type} #${primaryAsset.asset_id || ''}`}` : copy('No primary content attached', 'Hakuna maudhui makuu yaliyoambatanishwa')}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{copy('Preview?', 'Onyesha mwanzo?')}</span>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="sr-only peer"
                                                                                    checked={Boolean(lesson.is_preview)}
                                                                                    onChange={(e) => updateCourseLesson(module.id, lesson.id, { is_preview: e.target.checked })}
                                                                                />
                                                                                <span className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-amber-400 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
                                                                            </label>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600" onClick={() => removeCourseLesson(module.id, lesson.id)}>
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>

                                                                    {option?.item_type === 'product' && option.has_variants && primaryAsset && (
                                                                        <div className="space-y-1">
                                                                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Product variant', 'Variant ya bidhaa')}</label>
                                                                            <select
                                                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                                value={primaryAsset.selected_variant_id ?? ''}
                                                                                onChange={(e) => updateCourseLessonAsset(module.id, lesson.id, (lesson.assets || []).indexOf(primaryAsset), { selected_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                                            >
                                                                                <option value="">{copy('Select variant', 'Chagua variant')}</option>
                                                                                {(option.variants || []).map((variant) => (
                                                                                    <option key={variant.id} value={variant.id}>
                                                                                        {variant.name}{variant.price !== null ? ` · TZS ${Number(variant.price).toLocaleString()}` : ''}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    )}

                                                                    <div className="rounded-xl border border-blue-100 bg-white p-3">
                                                                        <label className="text-[11px] font-black uppercase tracking-wider text-blue-700">{copy('Primary lesson content', 'Maudhui makuu ya somo')}</label>
                                                                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                                                            <select
                                                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                                value={courseAttachSelection[courseLessonAttachKey(module.id, lesson.id)] || ''}
                                                                                onChange={(e) => setCourseAttachSelection((current) => ({
                                                                                    ...current,
                                                                                    [courseLessonAttachKey(module.id, lesson.id)]: e.target.value,
                                                                                }))}
                                                                            >
                                                                                <option value="">{primaryAsset ? 'Choose replacement content...' : 'Choose content for this lesson...'}</option>
                                                                                {availableCourseLessonOptions.map((option) => (
                                                                                    <option key={option.key} value={option.key}>
                                                                                        {typeLabel(option)} · {option.label}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                            <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => attachCourseContentToLesson(module, lesson)}>
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                {primaryAsset ? 'Replace Content' : 'Attach Content'}
                                                                            </Button>
                                                                        </div>
                                                                        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                                                                            {copy('This is the main item students open for this lesson. Supporting materials below are optional extras.', 'Hii ni item kuu ambayo wanafunzi watafungua kwa somo hili. Materials hapa chini ni za ziada na ni hiari.')}
                                                                        </p>
                                                                    </div>

                                                                    <div className="space-y-1.5">
                                                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Lesson summary', 'Muhtasari wa somo')}</label>
                                                                        <Textarea
                                                                            rows={2}
                                                                            value={lesson.summary || ''}
                                                                            onChange={(e) => updateCourseLesson(module.id, lesson.id, { summary: e.target.value })}
                                                                            placeholder={copy('Short description for this lesson', 'Maelezo mafupi ya somo hili')}
                                                                        />
                                                                    </div>
                                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Duration (minutes)', 'Muda (dakika)')}</label>
                                                                            <Input
                                                                                type="number"
                                                                                min="1"
                                                                                value={lesson.duration_minutes ?? ''}
                                                                                onChange={(e) => updateCourseLesson(module.id, lesson.id, { duration_minutes: e.target.value })}
                                                                                placeholder={copy('E.g. 20', 'Mf. 20')}
                                                                            />
                                                                            <p className="text-[10px] text-muted-foreground">{copy('Approximate time the student needs for this lesson.', 'Muda wa kukadiria ambao mwanafunzi anahitaji kwa somo hili.')}</p>
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Unlock after (days)', 'Fungua baada ya (siku)')}</label>
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                value={lesson.unlock_after_days ?? 0}
                                                                                onChange={(e) => updateCourseLesson(module.id, lesson.id, { unlock_after_days: e.target.value })}
                                                                                placeholder="0"
                                                                            />
                                                                            <p className="text-[10px] text-muted-foreground">{copy('Use 0 to unlock immediately after purchase.', 'Tumia 0 kufungua mara moja baada ya ununuzi.')}</p>
                                                                        </div>
                                                                    </div>
                                                                    {['cohort', 'live'].includes(bundleForm.course_format) && (
                                                                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                                                                            <div>
                                                                                <p className="text-xs font-black uppercase tracking-widest text-amber-800">{copy('Class session', 'Kikao cha darasa')}</p>
                                                                                <p className="mt-1 text-[11px] text-amber-900/75">{copy('Use a meeting link for online classes, a venue for offline classes, or both for hybrid.', 'Tumia meeting link kwa madarasa ya mtandaoni, venue kwa madarasa ya ana kwa ana, au vyote kwa hybrid.')}</p>
                                                                            </div>
                                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                                <div className="space-y-1.5">
                                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Session date & time', 'Tarehe na muda wa kikao')}</label>
                                                                                    <Input
                                                                                        type="datetime-local"
                                                                                        value={lesson.live_session?.starts_at || ''}
                                                                                        onChange={(e) => updateCourseLesson(module.id, lesson.id, {
                                                                                            live_session: { ...(lesson.live_session || {}), starts_at: e.target.value },
                                                                                        })}
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-1.5">
                                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Capacity', 'Uwezo')}</label>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        value={lesson.live_session?.capacity ?? ''}
                                                                                        onChange={(e) => updateCourseLesson(module.id, lesson.id, {
                                                                                            live_session: { ...(lesson.live_session || {}), capacity: e.target.value },
                                                                                        })}
                                                                                        placeholder={copy('Optional', 'Si lazima')}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                                <div className="space-y-1.5">
                                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Online meeting link', 'Meeting link ya mtandaoni')}</label>
                                                                                    <Input
                                                                                        value={lesson.live_session?.meeting_url || ''}
                                                                                        onChange={(e) => updateCourseLesson(module.id, lesson.id, {
                                                                                            live_session: { ...(lesson.live_session || {}), meeting_url: e.target.value },
                                                                                        })}
                                                                                        placeholder={copy('Zoom, Google Meet, Teams...', 'Zoom, Google Meet, Teams...')}
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-1.5">
                                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Offline venue', 'Venue ya ana kwa ana')}</label>
                                                                                    <Input
                                                                                        value={lesson.live_session?.venue || ''}
                                                                                        onChange={(e) => updateCourseLesson(module.id, lesson.id, {
                                                                                            live_session: { ...(lesson.live_session || {}), venue: e.target.value },
                                                                                        })}
                                                                                        placeholder={copy('Physical location if in person', 'Eneo halisi ikiwa ana kwa ana')}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                            <div>
                                                                                <p className="text-xs font-black text-slate-900">{copy('Supporting materials', 'Materials za ziada')}</p>
                                                                                <p className="text-[11px] text-muted-foreground">{copy('Optional files such as photos, worksheets, Excel files, slides, or reference PDFs.', 'Faili za hiari kama picha, worksheets, Excel, slides, au PDF za marejeo.')}</p>
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                className="rounded-xl"
                                                                                disabled={Boolean(supportingMaterialUploads[`supporting-${lesson.id}`]?.uploading)}
                                                                                onClick={() => {
                                                                                    const input = document.createElement('input');
                                                                                    input.type = 'file';
                                                                                    input.accept = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.mp3,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip';
                                                                                    input.onchange = (event) => uploadSupportingMaterial(module.id, lesson.id, event.target.files?.[0]);
                                                                                    input.click();
                                                                                }}
                                                                            >
                                                                                {supportingMaterialUploads[`supporting-${lesson.id}`]?.uploading ? (
                                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <FileUp className="mr-2 h-4 w-4" />
                                                                                )}
                                                                                {copy('Add material', 'Ongeza material')}
                                                                            </Button>
                                                                        </div>
                                                                        {supportingMaterialUploads[`supporting-${lesson.id}`]?.uploading && (
                                                                            <div className="mt-3 space-y-1">
                                                                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                                                    <span className="truncate">{supportingMaterialUploads[`supporting-${lesson.id}`]?.name || copy('Uploading...', 'Inapakia...')}</span>
                                                                                    <span>{supportingMaterialUploads[`supporting-${lesson.id}`]?.progress || 0}%</span>
                                                                                </div>
                                                                                <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                                                                                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${supportingMaterialUploads[`supporting-${lesson.id}`]?.progress || 0}%` }} />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {supportingAssets.length > 0 && (
                                                                            <div className="mt-3 grid gap-2">
                                                                                {supportingAssets.map((material, materialIndex) => {
                                                                                    const assetIndex = (lesson.assets || []).indexOf(material);
                                                                                    return (
                                                                                        <div key={`${material.url || material.asset_id}-${materialIndex}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                                                            <div className="min-w-0">
                                                                                                <p className="truncate text-xs font-bold text-slate-900">{material.name || copy('Material', 'Materiali')}</p>
                                                                                                <p className="text-[10px] text-muted-foreground">{material.mime || 'file'}{material.size ? ` · ${(Number(material.size) / 1024 / 1024).toFixed(1)} MB` : ''}</p>
                                                                                            </div>
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-red-600"
                                                                                                onClick={() => updateCourseLesson(module.id, lesson.id, {
                                                                                                    assets: (lesson.assets || []).filter((_, index) => index !== assetIndex),
                                                                                                })}
                                                                                            >
                                                                                                <Trash2 className="h-4 w-4" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-3">
                                                            <label className="text-[11px] font-black uppercase tracking-wider text-blue-700">{copy('Create lesson from content', 'Unda somo kutoka kwenye content')}</label>
                                                            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                                                <select
                                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                    value={courseAttachSelection[module.id] || ''}
                                                                    onChange={(e) => setCourseAttachSelection((current) => ({ ...current, [module.id]: e.target.value }))}
                                                                >
                                                                    <option value="">{copy('Choose post, digital download, or content...', 'Chagua post, digital download, au content...')}</option>
                                                                    {availableCourseLessonOptions.map((option) => (
                                                                        <option key={option.key} value={option.key}>
                                                                            {typeLabel(option)} · {option.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => addCourseLesson(module)}>
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    {copy('Add lesson', 'Ongeza somo')}
                                                                </Button>
                                                            </div>
                                                            <p className="mt-2 text-[11px] leading-5 text-blue-800/75">{copy('Use this to create a new lesson from an authored post, digital download, or content item. Physical products and services stay out of lessons so the course remains clear for students.', 'Tumia hii kuunda somo kutoka kwenye post, digital download, au content item. Bidhaa za kushikika na huduma hazitawekwa kwenye masomo ili kozi ibaki wazi kwa wanafunzi.')}</p>
                                                            <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3">
                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div>
                                                                        <p className="text-xs font-black text-blue-900">{copy('Upload new lesson file', 'Pakia faili mpya ya somo')}</p>
                                                                        <p className="text-[11px] text-blue-800/75">{copy('Video, PDF, document, audio, or presentation. It will be saved as draft content and attached here.', 'Video, PDF, hati, audio, au presentation. Itahifadhiwa kama content ya draft na kuambatanishwa hapa.')}</p>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="rounded-xl border-blue-200 bg-blue-50 text-blue-700"
                                                                        disabled={Boolean(courseLessonUploads[module.id]?.uploading)}
                                                                        onClick={() => {
                                                                            const input = document.createElement('input');
                                                                            input.type = 'file';
                                                                            input.accept = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.mp3,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt';
                                                                            input.onchange = (event) => uploadCourseLessonAsset(module, event.target.files?.[0]);
                                                                            input.click();
                                                                        }}
                                                                    >
                                                                        {courseLessonUploads[module.id]?.uploading ? (
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <FileUp className="mr-2 h-4 w-4" />
                                                                        )}
                                                                        {copy('Upload lesson', 'Pakia somo')}
                                                                    </Button>
                                                                </div>
                                                                {courseLessonUploads[module.id]?.uploading && (
                                                                    <div className="mt-3 space-y-1">
                                                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                                            <span className="truncate">{courseLessonUploads[module.id]?.name || copy('Uploading...', 'Inapakia...')}</span>
                                                                            <span>{courseLessonUploads[module.id]?.progress || 0}%</span>
                                                                        </div>
                                                                        <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                                                                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${courseLessonUploads[module.id]?.progress || 0}%` }} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="border-t border-slate-200 pt-6 space-y-5">
                                    <div className="space-y-1">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Select bundle items', 'Chagua items za bundle')}</p>
                                        <p className="text-sm leading-6 text-muted-foreground">{copy('Pick products, services, downloads, or content. The buyer experience should be clear before publishing.', 'Chagua bidhaa, huduma, downloads, au content. Uzoefu wa mteja uwe wazi kabla ya kuchapisha.')}</p>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Search items', 'Tafuta items')}</label>
                                        <Input
                                            value={bundleItemSearch}
                                            onChange={(e) => setBundleItemSearch(e.target.value)}
                                            placeholder={copy('Search products, services, downloads, or content...', 'Tafuta bidhaa, huduma, downloads, au content...')}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                            <Filter className="h-3.5 w-3.5" />
                                            {copy('Type', 'Aina')}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {bundleTypeFilters.map((filter) => (
                                                <button
                                                    key={filter.key}
                                                    type="button"
                                                    onClick={() => setBundleItemTypeFilter(filter.key)}
                                                    className={`rounded-full border px-4 py-2 text-sm font-black transition ${bundleItemTypeFilter === filter.key
                                                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                                                        : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                                                        }`}
                                                >
                                                    {filter.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {bundleForm.items.length > 0 && (
                                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Selected items', 'Items zilizochaguliwa')}</p>
                                                <span className="text-xs font-black text-foreground">{bundleForm.items.length}</span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {selectedBundleOptions.map((option) => (
                                                    <span key={`selected-${option.key}`} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${typeBadgeClass(option)}`}>
                                                        {typeLabel(option)}
                                                        <span className="max-w-[170px] truncate font-bold normal-case tracking-normal">{option.label}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {bundleExperienceWarnings.length > 0 && (
                                        <div className="space-y-2">
                                            {bundleExperienceWarnings.map((warning) => {
                                                const Icon = warning.tone === 'warning' ? AlertTriangle : Info;
                                                const classes = warning.tone === 'warning'
                                                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                    : 'border-sky-200 bg-sky-50 text-sky-900';

                                                return (
                                                    <div key={warning.key} className={`rounded-2xl border px-4 py-3 ${classes}`}>
                                                        <div className="flex items-start gap-2">
                                                            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                                            <div>
                                                                <p className="text-sm font-black">{warning.title}</p>
                                                                <p className="mt-1 text-xs leading-5 opacity-85">{warning.body}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <p className="text-sm text-muted-foreground">Showing latest {selectableItemsLimit} matching items by default. Search to find older ones.</p>

                                    <div className="grid gap-3">
                                        {bundleVisibleItems.map((option) => {
                                            const selected = bundleForm.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                            const selectedItem = bundleForm.items.find((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                            return (
                                                <div key={option.key} className={`rounded-2xl border px-4 py-3 text-left transition-all ${selected ? 'border-sky-300 bg-sky-50' : 'border-border bg-background hover:bg-muted/40'}`}>
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
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="text-sm font-bold truncate">{option.label}</p>
                                                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${typeBadgeClass(option)}`}>
                                                                            {typeLabel(option)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                        {option.item_type.replace('_', ' ')} · {option.meta}
                                                                        {option.product_type === 'service' && option.service_scheduling_type ? ` · ${String(option.service_scheduling_type).replace('_', ' ')}` : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-xs font-black uppercase tracking-wider ${selected ? 'text-sky-700' : 'text-muted-foreground'}`}>
                                                                {selected ? 'Selected' : 'Add'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                    {bundleForm.is_course && selected && (
                                                        <div className="mt-3 pt-3 border-t border-sky-200/70 space-y-2">
                                                            {option.item_type === 'product' && option.has_variants && (
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Product variant', 'Variant ya bidhaa')}</label>
                                                                    <select
                                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                        value={selectedItem?.selected_variant_id ?? ''}
                                                                        onChange={(e) => updateSelectedCourseItem(option, { selected_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                                    >
                                                                        <option value="">{copy('Select variant', 'Chagua variant')}</option>
                                                                        {(option.variants || []).map((variant) => (
                                                                            <option key={variant.id} value={variant.id}>
                                                                                {variant.name}{variant.price !== null ? ` · TZS ${Number(variant.price).toLocaleString()}` : ''}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                            <div className="grid md:grid-cols-2 gap-2">
                                                                <Input
                                                                    value={selectedItem?.section_title || ''}
                                                                    onChange={(e) => updateSelectedCourseItem(option, { section_title: e.target.value })}
                                                                    placeholder={copy('Section name (e.g. Introduction)', 'Jina la sehemu (mf. Utangulizi)')}
                                                                />
                                                                <Input
                                                                    value={selectedItem?.lesson_title || ''}
                                                                    onChange={(e) => updateSelectedCourseItem(option, { lesson_title: e.target.value })}
                                                                    placeholder={copy('Lesson title', 'Kichwa cha somo')}
                                                                />
                                                            </div>
                                                            <Textarea
                                                                rows={2}
                                                                value={selectedItem?.lesson_summary || ''}
                                                                onChange={(e) => updateSelectedCourseItem(option, { lesson_summary: e.target.value })}
                                                                placeholder={copy('Lesson summary', 'Muhtasari wa somo')}
                                                            />
                                                            <div className="grid md:grid-cols-3 gap-2">
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    value={selectedItem?.lesson_duration_minutes ?? ''}
                                                                    onChange={(e) => updateSelectedCourseItem(option, { lesson_duration_minutes: e.target.value })}
                                                                    placeholder={copy('Duration (min)', 'Muda (dak)')}
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    value={selectedItem?.unlock_after_days ?? 0}
                                                                    onChange={(e) => updateSelectedCourseItem(option, { unlock_after_days: e.target.value })}
                                                                    placeholder={copy('Unlock after days', 'Fungua baada ya siku')}
                                                                />
                                                                <label className="rounded-xl border border-input bg-background px-3 py-2 flex items-center justify-between gap-2">
                                                                    <span className="text-xs font-bold text-muted-foreground">{copy('Preview lesson', 'Hakiki somo')}</span>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4"
                                                                        checked={Boolean(selectedItem?.is_preview)}
                                                                        onChange={(e) => updateSelectedCourseItem(option, { is_preview: e.target.checked })}
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!bundleForm.is_course && selected && option.item_type === 'product' && option.has_variants && (
                                                        <div className="mt-3 pt-3 border-t border-sky-200/70 space-y-1">
                                                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{copy('Product variant', 'Variant ya bidhaa')}</label>
                                                            <select
                                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                value={selectedItem?.selected_variant_id ?? ''}
                                                                onChange={(e) => updateSelectedCourseItem(option, { selected_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                            >
                                                                <option value="">{copy('Select variant', 'Chagua variant')}</option>
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
                                                {copy('No items found for your search.', 'Hakuna items zilizopatikana kwa utafutaji wako.')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-end gap-3">
                                <div className="w-full">
                                    <AutoPostTargetsPanel
                                        value={bundleForm.publish_targets}
                                        onChange={(targets) => setBundleForm((current) => ({ ...current, publish_targets: targets }))}
                                        description="Choose where this bundle or course is posted when it is published."
                                    />
                                </div>
                                <div className="w-full sm:w-[220px] space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Status', 'Hali')}</label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bundleForm.status} onChange={(e) => setBundleForm({ ...bundleForm, status: e.target.value })}>
                                        <option value="draft">{copy('Draft', 'Draft')}</option>
                                        <option value="published">{copy('Published', 'Imechapishwa')}</option>
                                        <option value="archived">{copy('Archived', 'Imewekwa archive')}</option>
                                    </select>
                                </div>
                                <Button className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl" onClick={saveBundle} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {pageCopy.saveLabel}
                                </Button>
                                <Button variant="outline" className="rounded-xl" onClick={resetForm}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {pageCopy.newLabel}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[24px]">
                        <CardHeader>
                            <CardTitle className="text-lg font-black">{pageCopy.catalogTitle}</CardTitle>
                            <CardDescription>{pageCopy.catalogDescription}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {visibleBundles.length === 0 ? (
                                <EmptyState icon={courseModuleMode ? BookOpenText : Boxes} title={pageCopy.emptyTitle} body={pageCopy.emptyBody} />
                            ) : visibleBundles.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-border/70 bg-background px-4 py-4 flex items-start gap-3">
                                    <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                                        {item.is_course ? <BookOpenText className="h-5 w-5 text-indigo-600" /> : <Boxes className="h-5 w-5 text-brand-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-foreground">{item.title}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{copy(item.status, item.status)} · {item.items?.length || 0} {copy('items', 'bidhaa')} {item.is_course ? `· ${copy('Course', 'Kozi')}` : ''}</p>
                                        <p className="text-xs font-bold uppercase tracking-widest text-brand-700 mt-2">{item.price ? `TZS ${Number(item.price).toLocaleString()}` : copy('No price', 'Hakuna bei')}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {item.is_course && (
                                            <Link
                                                href={`/merchant/${merchantUsername}/bundles/${item.id}/course`}
                                                className="inline-flex h-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 hover:bg-sky-100"
                                            >
                                                {copy('Manage', 'Simamia')}
                                            </Link>
                                        )}
                                        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => startEditBundle(item)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-red-600 hover:text-red-700" onClick={() => destroyBundle(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
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
