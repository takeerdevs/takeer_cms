import React, { useMemo, useState, useRef, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, ShoppingBag, BookOpenText, Lock, Crown, Package, History, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import LongFormBlockEditor from '@/Components/LongFormBlockEditor';
import PolicyNotice from '@/Components/PolicyNotice';
import axios from 'axios';
import { toast } from 'sonner';
import { hasMerchantPermission } from '@/lib/merchantPermissions';
import { useLocale } from '@/lib/i18n';

const BG_OPTIONS = [
    { key: null, label: 'Normal', preview: '' },
    { key: 'gradient_sunset', label: '🌅 Sunset', preview: 'linear-gradient(135deg,#f97316,#ec4899)' },
    { key: 'gradient_ocean', label: '🌊 Ocean', preview: 'linear-gradient(135deg,#06b6d4,#6366f1)' },
    { key: 'gradient_forest', label: '🌿 Forest', preview: 'linear-gradient(135deg,#22c55e,#14b8a6)' },
    { key: 'gradient_midnight', label: '🌌 Midnight', preview: 'linear-gradient(135deg,#1e1b4b,#4c1d95)' },
    { key: 'gradient_fire', label: '🔥 Fire', preview: 'linear-gradient(135deg,#ef4444,#f97316)' },
    { key: 'solid_black', label: '⬛ Black', preview: '#000' },
    { key: 'solid_brand', label: '🔵 Brand', preview: '#0284c7' },
];
const BG_OPTION_TRANSLATIONS = {
    Normal: 'Kawaida',
    '🌅 Sunset': '🌅 Machweo',
    '🌊 Ocean': '🌊 Bahari',
    '🌿 Forest': '🌿 Msitu',
    '🌌 Midnight': '🌌 Usiku wa manane',
    '🔥 Fire': '🔥 Moto',
    '⬛ Black': '⬛ Nyeusi',
    '🔵 Brand': '🔵 Chapa',
};
const SHORT_LOCKED_INTERNAL_TITLE = '__short_locked__';

function lexicalDocumentHasContent(body) {
    if (!body) return false;
    try {
        const document = JSON.parse(body);
        const hasContent = (node) => {
            if (!node || typeof node !== 'object') return false;
            if (node.type === 'takeer_card') return true;
            if (node.type === 'text' && String(node.text || '').trim()) return true;
            return Array.isArray(node.children) && node.children.some(hasContent);
        };
        return hasContent(document?.root);
    } catch {
        return String(body).trim().length > 0;
    }
}

function AccessGateIcon({ type, className = '' }) {
    const Icon = type === 'bundle' ? Package : Crown;

    return <Icon className={cn('h-5 w-5 text-brand-600', className)} />;
}

function MediaGrid({ files, onRemove }) {
    const [viewerOpen, setViewerOpen] = useState(false);

    if (!files || files.length === 0) return null;

    const count = files.length;
    const padding = "gap-[2px]"; // tight gap like facebook

    const renderItem = (file, index, customClass = "", isSingle = false) => {
        const isVid = file.type?.startsWith('video') || file.preview?.endsWith?.('.mp4');
        const src = file.url ?? file.preview ?? URL.createObjectURL(file);
        const isLastItem = index === 3;
        const extraCount = count - 4;

        const mediaClass = isSingle ? "w-full max-h-[600px] object-contain" : "w-full h-full object-cover";

        return (
            <div
                key={index}
                onClick={() => setViewerOpen(true)}
                //className={`relative overflow-hidden bg-muted/30 group min-h-0 min-w-0 cursor-pointer flex items-center justify-center ${customClass}`}
                className={`relative overflow-hidden bg-muted/30 group min-h-0 min-w-0 cursor-pointer flex items-center justify-center ${customClass}`}
            >
                {isVid ? (
                    <video src={src} className={mediaClass} muted playsInline autoPlay loop />
                ) : (
                    <img src={src} alt="" className={mediaClass} />
                )}

                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(index); }}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
                >
                    <X className="h-4 w-4 text-white" />
                </button>

                {isVid && (isSingle || count === 1) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-14 h-14 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 shadow-xl">
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                    </div>
                )}

                {isLastItem && extraCount > 0 && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none cursor-pointer">
                        <span className="text-white font-bold text-3xl">+{extraCount}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {count === 1 && (
                <div className="w-full max-h-[600px] min-h-[200px] rounded-2xl overflow-hidden shadow-sm relative flex items-center justify-center">
                    {renderItem(files[0], 0, "w-full h-full flex justify-center items-center", true)}
                </div>
            )}

            {count === 2 && (
                <div className={`grid grid-cols-2 ${padding} w-full h-[300px] sm:h-[400px] rounded-2xl overflow-hidden`}>
                    {renderItem(files[0], 0, "w-full h-full")}
                    {renderItem(files[1], 1, "w-full h-full")}
                </div>
            )}

            {count === 3 && (
                <div className={`grid grid-cols-2 ${padding} w-full h-[350px] sm:h-[450px] rounded-2xl overflow-hidden`}>
                    {renderItem(files[0], 0, "w-full h-full")}
                    <div className={`grid grid-rows-2 ${padding} min-h-0 min-w-0`}>
                        {renderItem(files[1], 1, "w-full h-full")}
                        {renderItem(files[2], 2, "w-full h-full")}
                    </div>
                </div>
            )}

            {count >= 4 && (
                <div className={`grid grid-cols-2 grid-rows-2 ${padding} w-full h-[350px] sm:h-[450px] rounded-2xl overflow-hidden`}>
                    {renderItem(files[0], 0, "w-full h-full")}
                    {renderItem(files[1], 1, "w-full h-full")}
                    {renderItem(files[2], 2, "w-full h-full")}
                    {renderItem(files[3], 3, "w-full h-full")}
                </div>
            )}

            <AnimatePresence>
                {viewerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl overflow-y-auto flex flex-col items-center"
                    >
                        <div className="sticky top-0 w-full p-4 flex justify-end z-[210] bg-gradient-to-b from-black/80 to-transparent">
                            <button onClick={() => setViewerOpen(false)} className="h-10 w-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="w-full max-w-2xl px-2 pb-24 flex flex-col items-center gap-6 mt-4">
                            {files.map((file, i) => {
                                const isVid = file.type?.startsWith('video') || file.preview?.endsWith?.('.mp4');
                                const src = file.url ?? file.preview ?? URL.createObjectURL(file);
                                return (
                                    <div key={i} className="w-full rounded-2xl overflow-hidden border border-white/10 bg-black/50 relative flex items-center justify-center p-2">
                                        {isVid ? (
                                            <video src={src} className="w-full max-h-[80vh] object-contain rounded-xl" controls autoPlay={i === 0} playsInline />
                                        ) : (
                                            <img src={src} className="w-full max-h-[80vh] object-contain rounded-xl" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default function PostComposer({ isOpen, onClose, prefillProduct = null, prefillMedia = [], prefillFiles = [], initialMode = 'short', initialMerchantUsername = null, prefillText = '', forwarderRoutes = [] }) {
    const { copy } = useLocale();
    const { auth } = usePage().props;
    const merchantProfiles = auth.user?.merchant_profiles || [];
    const postableProfiles = useMemo(() => (
        merchantProfiles.filter((profile) => {
            const permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
            return hasMerchantPermission(permissions, 'posts.create')
                || hasMerchantPermission(permissions, 'posts.publish');
        })
    ), [merchantProfiles]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [text, setText] = useState('');
    const [bg, setBg] = useState(null);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [selectedPromotables, setSelectedPromotables] = useState([]); // Multiple Access Gates (Bundles/Subscriptions)
    const [promotedProduct, setPromotedProduct] = useState(null); // Standalone Promotion
    const [isRestricted, setIsRestricted] = useState(false);
    const [promotables, setPromotables] = useState({ products: [], bundles: [], plans: [] });
    const [promotablesLoading, setPromotablesLoading] = useState(false);
    const [activePromotionTab, setActivePromotionTab] = useState('plan'); // product, bundle, plan

    const [showBg, setShowBg] = useState(false);
    const [showProducts, setShowProducts] = useState(false); // We'll rename this logic to showPromotions
    const [submitting, setSubmitting] = useState(false);
    const [composerMode, setComposerMode] = useState('short');
    const [forwarderRouteId, setForwarderRouteId] = useState('');

    // Support for legacy/compatibility
    const [product, setProduct] = useState(null);

    // Unified content states
    const [longForm, setLongForm] = useState({
        id: null,
        title: '',
        excerpt: '',
        body: '',
        price: '',
    });
    const [lastLongAutosaveSignature, setLastLongAutosaveSignature] = useState(null);
    const [longAutosaveStatus, setLongAutosaveStatus] = useState('');
    const [longEditorKey, setLongEditorKey] = useState(0);
    const [longDrafts, setLongDrafts] = useState([]);
    const [longDraftsLoading, setLongDraftsLoading] = useState(false);
    const [showLongDrafts, setShowLongDrafts] = useState(false);
    const [longVersions, setLongVersions] = useState([]);
    const [shortPrice, setShortPrice] = useState('');

    // Support for legacy/old product selection if still needed by some logic
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsLoaded, setProductsLoaded] = useState(false);

    // Visibility and legacy short content states
    const [shortVisibility, setShortVisibility] = useState('published');
    const [shortTitle, setShortTitle] = useState('');
    const [shortPublishAs, setShortPublishAs] = useState('post');

    const fileRef = useRef(null);
    const textRef = useRef(null);
    const longDraftMerchantRef = useRef(null);
    const merchantApiBase = selectedProfile?.username ? `/merchant/${selectedProfile.username}` : '/merchant';
    const merchantPayload = selectedProfile?.id ? { merchant_id: selectedProfile.id } : {};
    const canCreateProduct = selectedProfile
        ? ['products.create', 'digital_products.create', 'services.create'].some((permission) => (
            hasMerchantPermission(selectedProfile.permissions || [], permission)
        ))
        : false;

    const openProductUpload = () => {
        if (!selectedProfile?.username) {
            toast.error(copy('Choose an account before adding a product.', 'Chagua akaunti kabla ya kuongeza bidhaa.'));
            return;
        }

        if (!canCreateProduct) {
            toast.error(copy('This account does not have access to add products.', 'Akaunti hii haina ruhusa ya kuongeza bidhaa.'));
            return;
        }

        router.visit(`/merchant/${encodeURIComponent(selectedProfile.username)}/upload`);
    };

    const parsePriceValue = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        const normalized = String(value).replace(/,/g, '').trim();
        if (!normalized) return null;
        const numeric = Number(normalized);
        return Number.isNaN(numeric) ? null : numeric;
    };

    const parsedShortPrice = parsePriceValue(shortPrice);
    const hasSingleUnlockPrice = parsedShortPrice !== null && !Number.isNaN(parsedShortPrice);
    const isPaidShortUnlock = hasSingleUnlockPrice && parsedShortPrice > 0;
    const shouldShowShortTitleInput = composerMode === 'short' && isPaidShortUnlock;
    const shouldRequireShortTitle = shouldShowShortTitleInput;
    const selectedProfileKycComplete = ['verified', 'approved'].includes(String(selectedProfile?.kyc_status || '').toLowerCase())
        || Boolean(selectedProfile?.is_verified);

    // Default to is_default profile
    useEffect(() => {
        if (postableProfiles.length > 0 && !selectedProfile) {
            const def = postableProfiles.find(p => p.username === initialMerchantUsername)
                || postableProfiles.find(p => p.is_default)
                || postableProfiles[0];
            setSelectedProfile(def);
        }
    }, [postableProfiles, selectedProfile, initialMerchantUsername]);

    useEffect(() => {
        if (!isOpen || !initialMerchantUsername) return;
        const requested = postableProfiles.find(p => p.username === initialMerchantUsername);
        if (requested) setSelectedProfile(requested);
    }, [isOpen, initialMerchantUsername, postableProfiles]);

    useEffect(() => {
        if (!isOpen || !prefillText) return;
        setText((current) => current || prefillText);
    }, [isOpen, prefillText]);

    useEffect(() => {
        if (!forwarderRouteId) return;
        if (forwarderRoutes.some((route) => String(route.id) === String(forwarderRouteId))) return;
        setForwarderRouteId('');
    }, [forwarderRoutes, forwarderRouteId]);

    useEffect(() => {
        if (!selectedProfile) return;
        if (postableProfiles.some((profile) => profile.id === selectedProfile.id)) return;

        setSelectedProfile(postableProfiles.find(p => p.is_default) || postableProfiles[0] || null);
    }, [postableProfiles, selectedProfile]);

    useEffect(() => {
        if (!selectedProfile || selectedProfileKycComplete) return;

        setIsRestricted(false);
        setSelectedPromotables([]);
        setShortPrice('');
        setShortTitle('');
    }, [selectedProfile, selectedProfileKycComplete]);

    useEffect(() => {
        if (!isOpen || composerMode !== 'long' || !selectedProfile?.id) return;
        if (longDraftMerchantRef.current && longDraftMerchantRef.current !== selectedProfile.id) {
            setLongForm({id: null, title: '', excerpt: '', body: '', price: ''});
            setLongVersions([]);
            setLastLongAutosaveSignature(null);
            setLongAutosaveStatus('Draft not saved yet');
            setLongEditorKey((current) => current + 1);
        }
        longDraftMerchantRef.current = selectedProfile.id;
    }, [composerMode, isOpen, selectedProfile?.id]);

    // Prefill when opened from a product page
    useEffect(() => {
        if (isOpen) {
            setComposerMode(initialMode === 'long' ? 'long' : 'short');
            if (prefillProduct) setPromotedProduct(prefillProduct);
            if (prefillMedia.length) {
                setMediaFiles(prefillMedia.map(url => ({
                    url, preview: url, type: 'image/jpeg', name: 'product_image'
                })));
            }
            if (prefillFiles.length) {
                setMediaFiles(prefillFiles.map(file => ({
                    file,
                    type: file.type,
                    name: file.name,
                    preview: URL.createObjectURL(file),
                })).slice(0, 10));
            }
            setTimeout(() => textRef.current?.focus(), 350);
        }
    }, [initialMode, isOpen, prefillFiles.length, prefillMedia.length]);

    useEffect(() => {
        if (!isOpen) return;
        if (composerMode !== 'long') return;
        if (submitting) return;

        const normalizedTitle = (longForm.title || '').trim();
        const normalizedBody = (longForm.body || '').trim();
        if (!normalizedTitle && !(longForm.excerpt || '').trim() && !lexicalDocumentHasContent(normalizedBody)) return;

        const signature = JSON.stringify({
            id: longForm.id ?? null,
            title: normalizedTitle,
            excerpt: longForm.excerpt || '',
            body: normalizedBody,
            price: longForm.price,
        });

        if (signature === lastLongAutosaveSignature) return;

        const timer = setTimeout(async () => {
            try {
                setLongAutosaveStatus('Saving draft...');
                const priceVal = longForm.price === '' ? null : Number(longForm.price);
                const payload = {
                    ...merchantPayload,
                    title: normalizedTitle || 'Untitled draft',
                    excerpt: longForm.excerpt || null,
                    body: normalizedBody,
                    format: 'lexical',
                    visibility: 'draft',
                    price: priceVal,
                };
                let savedId = longForm.id;

                if (longForm.id) {
                    await axios.put(`${merchantApiBase}/content-items/${longForm.id}/api`, payload);
                } else {
                    const res = await axios.post(`${merchantApiBase}/content-items/api`, payload);
                    const saved = res.data?.content_item;
                    if (saved?.id) {
                        savedId = saved.id;
                        setLongForm((current) => ({ ...current, id: saved.id }));
                    }
                }

                setLastLongAutosaveSignature(signature);
                setLongAutosaveStatus('Draft auto-saved');
                try {
                    const requests = [axios.get(`${merchantApiBase}/content-items/api?visibility=draft&per_page=50`)];
                    if (savedId) requests.push(axios.get(`${merchantApiBase}/content-items/${savedId}/versions/api`));
                    const [draftsResponse, versionsResponse] = await Promise.all(requests);
                    setLongDrafts(Array.isArray(draftsResponse.data?.data) ? draftsResponse.data.data : []);
                    if (versionsResponse) setLongVersions(Array.isArray(versionsResponse.data?.versions) ? versionsResponse.data.versions : []);
                } catch {
                    // The draft itself is safely stored even if refreshing the list fails.
                }
            } catch (error) {
                setLongAutosaveStatus('Draft autosave failed');
            }
        }, 1800);

        return () => clearTimeout(timer);
    }, [composerMode, isOpen, lastLongAutosaveSignature, longForm, submitting]);

    useEffect(() => {
        if (!isOpen || composerMode !== 'long' || !selectedProfile) return;
        let cancelled = false;
        setLongDraftsLoading(true);
        axios.get(`${merchantApiBase}/content-items/api?visibility=draft&per_page=50`)
            .then((response) => {
                if (!cancelled) setLongDrafts(Array.isArray(response.data?.data) ? response.data.data : []);
            })
            .catch(() => {
                if (!cancelled) setLongDrafts([]);
            })
            .finally(() => {
                if (!cancelled) setLongDraftsLoading(false);
            });
        return () => { cancelled = true; };
    }, [composerMode, isOpen, merchantApiBase, selectedProfile]);

    const loadDraftVersions = async (draftId) => {
        if (!draftId) {
            setLongVersions([]);
            return;
        }
        const response = await axios.get(`${merchantApiBase}/content-items/${draftId}/versions/api`);
        setLongVersions(Array.isArray(response.data?.versions) ? response.data.versions : []);
    };

    const loadLongDraft = async (draftId) => {
        try {
            const response = await axios.get(`${merchantApiBase}/content-items/${draftId}/api`);
            const draft = response.data?.content_item;
            if (!draft) return;
            setLongForm({id: draft.id, title: draft.title === 'Untitled draft' ? '' : (draft.title || ''), excerpt: draft.excerpt || '', body: draft.body || '', price: draft.price || ''});
            setLastLongAutosaveSignature(null);
            setLongEditorKey((current) => current + 1);
            setLongAutosaveStatus('Draft loaded');
            await loadDraftVersions(draft.id);
            setShowLongDrafts(false);
        } catch (error) {
            toast.error(copy('Could not load this draft.', 'Imeshindikana kufungua draft hii.'));
        }
    };

    const restoreLongVersion = async (versionId) => {
        if (!longForm.id) return;
        try {
            const response = await axios.post(`${merchantApiBase}/content-items/${longForm.id}/versions/${versionId}/restore/api`);
            const draft = response.data?.content_item;
            if (!draft) return;
            setLongForm({id: draft.id, title: draft.title === 'Untitled draft' ? '' : (draft.title || ''), excerpt: draft.excerpt || '', body: draft.body || '', price: draft.price || ''});
            setLastLongAutosaveSignature(null);
            setLongEditorKey((current) => current + 1);
            setLongAutosaveStatus('Earlier version restored');
            await loadDraftVersions(draft.id);
        } catch (error) {
            toast.error(copy('Could not restore this version.', 'Imeshindikana kurejesha version hii.'));
        }
    };

    const fetchPromotables = async () => {
        if (!selectedProfile) return;
        setPromotablesLoading(true);
        try {
            const query = selectedProfile.username ? '' : `?merchant_id=${selectedProfile.id}`;
            const [pRes, bRes, sRes] = await Promise.all([
                axios.get(`${merchantApiBase}/products/api${query}`),
                axios.get(`${merchantApiBase}/bundles/api${query}`),
                axios.get(`${merchantApiBase}/subscription-plans/api${query}`)
            ]);
            setPromotables({
                products: pRes.data?.products || [],
                bundles: bRes.data?.bundles || [],
                plans: sRes.data?.plans || []
            });
        } catch (e) {
            console.error("Failed to fetch promotables", e);
        } finally {
            setPromotablesLoading(false);
        }
    };

    useEffect(() => {
        if (showProducts || isRestricted) {
            fetchPromotables();
        }
    }, [showProducts, isRestricted, selectedProfile]);

    // Handle body scroll locking
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleFileChange = (e) => {
        const picked = Array.from(e.target.files).map(file => ({
            file,
            type: file.type,
            name: file.name,
            preview: URL.createObjectURL(file),
        }));
        setMediaFiles(prev => [...prev, ...picked].slice(0, 10)); // max 10
        e.target.value = '';
    };

    const removeMedia = (i) => setMediaFiles(prev => prev.filter((_, ix) => ix !== i));

    const reset = () => {
        setText(''); setBg(null); setMediaFiles([]);
        setSelectedPromotables([]); setPromotedProduct(null); setIsRestricted(false);
        setShortPrice(''); setShortTitle(''); setActivePromotionTab('plan');
        setShowBg(false); setShowProducts(false);
        setComposerMode('short');
        setLongForm({
            id: null,
            title: '',
            excerpt: '',
            body: '',
            price: '',
            visibility: 'published',
        });
        setLongEditorKey((current) => current + 1);
        setLongAutosaveStatus('Draft not saved yet');
        setLastLongAutosaveSignature('');
        setLongVersions([]);
        setShowLongDrafts(false);
        setForwarderRouteId('');
    };

    const handleClose = () => { reset(); onClose(); };

    const handlePost = async () => {
        if (merchantProfiles.length > 0 && !selectedProfile) {
            toast.error(copy('You do not have permission to post as any business account.', 'Huna ruhusa ya kuchapisha kwa akaunti yoyote ya biashara.'));
            return;
        }
        if (composerMode === 'short' && !text.trim() && mediaFiles.length === 0) return;
        if (composerMode === 'long' && (!longForm.title.trim() || !longForm.body.trim())) return;
        if (shouldRequireShortTitle && !shortTitle.trim()) {
            toast.error(copy('Paid short content must have a clear title.', 'Content fupi ya kulipia lazima iwe na kichwa wazi.'));
            return;
        }
        if (hasSingleUnlockPrice && parsedShortPrice !== null && parsedShortPrice < 0) {
            toast.error(copy('Unlock price cannot be negative.', 'Bei ya kufungua content haiwezi kuwa hasi.'));
            return;
        }

        setSubmitting(true);
        try {
            // 1. Handle Media Uploads if any
            let mediaType = 'text';
            let mediaUrl = null;
            let images = null;

            if (composerMode === 'short' && mediaFiles.length > 0) {
                const uploads = await Promise.all(mediaFiles.map(async (item) => {
                    if (item.url && !item.file) {
                        return { url: item.url, type: item.type?.startsWith('video') ? 'video' : 'image' };
                    }
                    const file = item.file || item;
                    const isVideo = file.type?.startsWith('video');
                    const form = new FormData();
                    form.append('file', file);
                    form.append('type', 'public');
                    form.append('folder', 'posts');
                    if (selectedProfile?.id) {
                        form.append('merchant_id', selectedProfile.id);
                    }
                    const res = await axios.post(`${merchantApiBase}/upload/media`, form, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    return { url: res.data.url, type: isVideo ? 'video' : 'image' };
                }));

                const videoItem = uploads.find(u => u.type === 'video');
                const imageUrls = uploads.filter(u => u.type === 'image').map(u => u.url);

                if (videoItem) {
                    mediaType = 'video';
                    mediaUrl = videoItem.url;
                } else if (imageUrls.length > 1) {
                    mediaType = 'carousel';
                    mediaUrl = imageUrls[0];
                    images = imageUrls;
                } else if (imageUrls.length === 1) {
                    mediaType = 'image';
                    mediaUrl = imageUrls[0];
                    images = imageUrls;
                }
            }

            // 2. Prepare Unified Payload
            const shouldLockPost = isRestricted || selectedPromotables.length > 0 || hasSingleUnlockPrice;

            const payload = {
                ...merchantPayload,
                // Common fields
                caption: composerMode === 'short' ? text.trim() : (longForm.excerpt || null),
                title: composerMode === 'long'
                    ? longForm.title.trim()
                    : (shouldRequireShortTitle ? shortTitle.trim() : null),
                excerpt: composerMode === 'long' ? longForm.excerpt : null,
                body: composerMode === 'long' ? longForm.body : null,
                draft_content_item_id: composerMode === 'long' ? longForm.id : null,
                bg_style: (composerMode === 'short' && text.length < 180 && mediaFiles.length === 0) ? bg : null,

                // Media
                media_type: mediaType,
                media_url: mediaUrl,
                images: images,

                // Promotion & Restriction
                is_restricted: shouldLockPost,
                promotables: selectedPromotables.map(p => ({ id: p.id, type: p.type })),
                product_id: promotedProduct?.id || null,
                restricted_price: shouldLockPost ? parsedShortPrice : null,
                forwarder_route_id: forwarderRouteId || null,
            };

            // 3. Submit to Unified Post API
            await axios.post(`${merchantApiBase}/posts`, payload);

            setSubmitting(false);
            handleClose();

            // Redirect to feed or profile
            router.visit('/feed');
            toast.success(copy('Post published successfully!', 'Post imechapishwa kikamilifu!'));

        } catch (error) {
            console.error('Publishing failed:', error);
            toast.error(error.response?.data?.message || copy('Failed to publish post. Please try again.', 'Imeshindikana kuchapisha post. Jaribu tena.'));
            setSubmitting(false);
        }
    };

    const isTextLong = text.trim().length >= 80;
    const hasMedia = mediaFiles.length > 0;
    const disableStyles = isTextLong || hasMedia;

    const effectiveBg = disableStyles ? null : bg;
    const hasBg = effectiveBg !== null;
    const bgStyle = hasBg ? BG_OPTIONS.find(o => o.key === effectiveBg)?.preview : '';

    let textAreaClass = "";
    if (disableStyles) {
        textAreaClass = "text-foreground placeholder-muted-foreground text-base sm:text-lg font-normal text-left";
    } else {
        if (hasBg) {
            textAreaClass = "text-center text-white placeholder-white/70 font-bold text-3xl sm:text-4xl leading-[1.5] drop-shadow-md";
        } else {
            textAreaClass = "text-foreground placeholder-muted-foreground text-xl sm:text-2xl font-medium text-left";
        }
    }

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-2xl flex flex-col"
                >
                    {/* Top Bar */}
                    <div className="flex items-center justify-between p-4 shrink-0 max-w-4xl w-full mx-auto">
                        <button
                            onClick={handleClose}
                            className="h-10 w-10 bg-accent/50 hover:bg-accent rounded-full flex items-center justify-center transition-colors shadow-sm border border-border/50 backdrop-blur-md"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h2 className="font-black text-lg text-foreground tracking-tight drop-shadow-sm">{copy('New post', 'Chapisho jipya')}</h2>
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={handlePost}
                            disabled={
                                submitting
                                || (merchantProfiles.length > 0 && !selectedProfile)
                                || (composerMode === 'short' ? (!text.trim() && mediaFiles.length === 0) : (!longForm.title.trim() || !longForm.body.trim()))
                                || (shouldRequireShortTitle && !shortTitle.trim())
                            }
                            className="h-10 px-6 rounded-full bg-brand-600 text-white text-sm font-bold disabled:opacity-40 transition-all hover:bg-brand-700 shadow-lg shadow-brand-500/20 drop-shadow-sm active:scale-95"
                        >
                            {submitting ? copy('Sending...', 'Inatuma...') : copy('Publish', 'Chapisha')}
                        </motion.button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 relative overflow-hidden pb-24">
                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-20 pt-2">
                            {/* Instagram-style Account Picker */}
                            {merchantProfiles.length > 0 && (
                                <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl p-4 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1 text-center sm:text-left">{copy('Post as...', 'Tuma kama...')}</p>
                                    {postableProfiles.length === 0 ? (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                                            {copy('You do not have permission to create posts for any business account.', 'Huna ruhusa ya kuunda posts kwa akaunti yoyote ya biashara.')}
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 justify-center sm:justify-start">
                                            {postableProfiles.map((profile) => {
                                                const active = selectedProfile?.id === profile.id;
                                                return (
                                                    <button
                                                        key={profile.id}
                                                        onClick={() => setSelectedProfile(profile)}
                                                        className="flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95 p-2"
                                                    >
                                                        <div className={cn(
                                                            "h-16 w-16 rounded-full p-0.5 transition-all shadow-sm",
                                                            active ? "bg-gradient-to-tr from-brand-500 to-brand-700 scale-105" : "bg-transparent grayscale-[0.5] opacity-60"
                                                        )}>
                                                            <div className="h-full w-full rounded-full border-[3px] border-background bg-card flex items-center justify-center overflow-hidden">
                                                                {profile.avatar_url ? (
                                                                    <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" />
                                                                ) : (
                                                                    <span className="font-black text-brand-600 text-xl">{profile.display_name[0].toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className={cn(
                                                            "text-[10px] font-bold tracking-tight max-w-[70px] truncate transition-colors",
                                                            active ? "text-brand-600" : "text-muted-foreground"
                                                        )}>
                                                            @{profile.username}
                                                        </span>
                                                        <span className="text-[8px] uppercase tracking-tighter font-black opacity-60">
                                                            {profile.type === 'personal' ? copy('Personal', 'Binafsi') : copy('Business', 'Biashara')}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {forwarderRoutes.length > 0 && (
                                <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-3xl p-4 shadow-sm">
                                    <label className="block space-y-2">
                                        <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">{copy('Attach freight route', 'Ambatanisha route ya freight')}</span>
                                        <select
                                            value={forwarderRouteId}
                                            onChange={(event) => setForwarderRouteId(event.target.value)}
                                            className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-bold text-foreground"
                                        >
                                            <option value="">{copy('General freight update', 'Taarifa ya jumla ya freight')}</option>
                                            {forwarderRoutes.map((route) => (
                                                <option key={route.id} value={route.id}>
                                                    {route.label}{route.estimate ? ` · ${route.estimate}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">
                                        {copy('Pick a route only when this update applies to a specific shipping lane.', 'Chagua route tu kama taarifa hii inahusu njia maalum ya usafirishaji.')}
                                    </p>
                                </div>
                            )}

                            {/* Composer Editor Area */}
                            <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-3xl p-2 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setComposerMode('short')}
                                    className={cn(
                                        'rounded-2xl px-3 py-2 text-sm font-black transition-colors',
                                        composerMode === 'short' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {copy('Short form', 'Post fupi')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setComposerMode('long')}
                                    className={cn(
                                        'rounded-2xl px-3 py-2 text-sm font-black transition-colors inline-flex items-center justify-center gap-2',
                                        composerMode === 'long' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <BookOpenText className="h-4 w-4" />
                                    {copy('Long form', 'Post ndefu')}
                                </button>
                            </div>

                            {composerMode === 'short' ? (
                                <div className={cn(
                                    "flex flex-col transition-all rounded-3xl overflow-hidden shadow-sm border border-border/50 backdrop-blur-sm",
                                    hasBg ? "min-h-[300px]" : "bg-card/60 min-h-[200px]"
                                )} style={hasBg ? { background: bgStyle } : {}}>

                                    {/* Author Info Overlay (if not handled by picker) */}
                                    {!merchantProfiles.length && (
                                        <div className="flex items-center gap-3 p-4 backdrop-blur-sm">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-inner">
                                                {(selectedProfile?.display_name || auth.user?.name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={cn("font-bold text-sm drop-shadow-sm", hasBg ? "text-white" : "text-foreground")}>
                                                    {selectedProfile?.display_name || auth.user?.name || 'Wewe'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Text Area */}
                                    <div className="flex-1 p-5 flex flex-col justify-center">
                                        <textarea
                                            ref={textRef}
                                            value={text}
                                            onChange={e => setText(e.target.value)}
                                            placeholder={copy("What's on your mind?", 'Unafikiria nini?')}
                                            className={cn(
                                                "w-full bg-transparent resize-none outline-none transition-all placeholder-opacity-70",
                                                textAreaClass
                                            )}
                                            rows={hasBg ? 3 : 5}
                                        />

                                        {/* Attachments Section */}
                                        <div className="space-y-4">
                                            {/* Media Grid */}
                                            {mediaFiles.length > 0 && (
                                                <div className="pb-2">
                                                    <MediaGrid files={mediaFiles} onRemove={removeMedia} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-3xl p-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                                        <div>
                                            <p className="text-sm font-black text-foreground">{longForm.id ? copy('Editing saved draft', 'Unahariri draft iliyohifadhiwa') : copy('New long-form draft', 'Draft mpya ya post ndefu')}</p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">{copy('Changes are saved automatically and revisions are retained.', 'Mabadiliko yanahifadhiwa moja kwa moja na versions zinatunzwa.')}</p>
                                        </div>
                                        <button type="button" onClick={() => setShowLongDrafts((current) => !current)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground hover:bg-muted">
                                            <History className="size-4" />
                                            {copy(`Drafts (${longDrafts.length})`, `Drafts (${longDrafts.length})`)}
                                        </button>
                                    </div>

                                    {showLongDrafts ? (
                                        <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
                                            <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{copy('Saved drafts', 'Drafts zilizohifadhiwa')}</p>
                                            <div className="max-h-64 space-y-1 overflow-y-auto">
                                                {longDraftsLoading ? <p className="px-2 py-4 text-xs text-muted-foreground">{copy('Loading drafts...', 'Inafungua drafts...')}</p> : null}
                                                {!longDraftsLoading && longDrafts.length === 0 ? <p className="px-2 py-4 text-xs text-muted-foreground">{copy('No saved long-form drafts yet.', 'Bado hakuna draft ya post ndefu.')}</p> : null}
                                                {longDrafts.map((draft) => (
                                                    <button key={draft.id} type="button" onClick={() => loadLongDraft(draft.id)} className={cn('flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted', longForm.id === draft.id && 'bg-brand-50 text-brand-900')}>
                                                        <span className="min-w-0"><span className="block truncate text-sm font-bold">{draft.title || copy('Untitled draft', 'Draft isiyo na kichwa')}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{draft.excerpt || copy('No excerpt yet', 'Bado hakuna muhtasari')}</span></span>
                                                        <span className="shrink-0 text-[10px] text-muted-foreground">v{draft.versions_count || 1}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {longForm.id && longVersions.length > 1 ? (
                                        <details className="rounded-2xl border border-border bg-muted/20 px-3 py-2">
                                            <summary className="cursor-pointer text-xs font-bold text-muted-foreground">{copy(`Revision history (${longVersions.length})`, `Historia ya versions (${longVersions.length})`)}</summary>
                                            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                                                {longVersions.map((version, index) => (
                                                    <div key={version.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
                                                        <span className="min-w-0"><span className="block truncate text-xs font-semibold">Version {version.version}{index === 0 ? ` · ${copy('latest', 'ya sasa')}` : ''}</span><span className="block text-[10px] text-muted-foreground">{new Date(version.created_at).toLocaleString()}</span></span>
                                                        {index > 0 ? <button type="button" onClick={() => restoreLongVersion(version.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold hover:bg-muted"><RotateCcw className="size-3" />{copy('Restore', 'Rejesha')}</button> : null}
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    ) : null}

                                    <div className="grid gap-4 md:grid-cols-1">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Title', 'Kichwa')}</label>
                                            <input
                                                type="text"
                                                value={longForm.title}
                                                onChange={(e) => setLongForm((current) => ({ ...current, title: e.target.value }))}
                                                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                                placeholder={copy('Enter article title...', 'Weka kichwa cha makala...')}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Excerpt', 'Muhtasari')}</label>
                                        <textarea
                                            value={longForm.excerpt}
                                            onChange={(e) => setLongForm((current) => ({ ...current, excerpt: e.target.value }))}
                                            rows={3}
                                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                            placeholder={copy('Short summary shown before opening the content.', 'Muhtasari mfupi unaoonekana kabla ya kufungua content.')}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Body', 'Mwili wa makala')}</label>
                                        <LongFormBlockEditor
                                            key={`composer-long-editor-${longEditorKey}`}
                                            value={longForm.body}
                                            onChange={(nextBody) => setLongForm((current) => ({ ...current, body: nextBody }))}
                                            placeholder={copy('Write your article, add headings, links, images, and embeds...', 'Andika makala yako, ongeza vichwa, links, picha na embeds...')}
                                            uploadUrl={`${merchantApiBase}/content/upload/media`}
                                            uploadFields={merchantPayload}
                                            bookmarkSearchUrl={`${merchantApiBase}/posts/api`}
                                        />
                                    </div>

                                    <div className="inline-flex items-center rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                        {longAutosaveStatus}
                                    </div>
                                </div>
                            )}

                            {/* Global Promotion & Restriction UI (Visible to both modes) */}
                            <div className="space-y-4">
                                {/* Selected Promotables Preview */}
                                {selectedPromotables.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-4 mt-2">
                                        {selectedPromotables.map((item, idx) => (
                                            <div key={idx} className="relative group border border-brand-200/50 bg-gradient-to-r from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 rounded-2xl p-3 flex items-center gap-4 shadow-sm backdrop-blur-md">
                                                <div className="h-10 w-10 rounded-xl shrink-0 shadow-sm border border-white/20 bg-background flex items-center justify-center">
                                                    <AccessGateIcon type={item.type} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-600/80 px-1.5 py-0.5 bg-brand-500/10 rounded-md">
                                                            {item.type === 'bundle' ? copy('Bundle', 'Bundle') : copy('Subscription', 'Subscription')}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-[14px] truncate text-foreground leading-tight mt-0.5">{item.title}</p>
                                                    <p className="text-brand-600 font-black text-[11px]">
                                                        {item.price > 0 ? `TZS ${Number(item.price).toLocaleString()}` : copy('Free', 'Bure')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedPromotables(prev => prev.filter(p => !(p.id === item.id && p.type === item.type)))}
                                                    className="h-8 w-8 rounded-full bg-background/80 hover:bg-background border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shadow-sm"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>

                                                {isRestricted && (
                                                    <div className="absolute -top-2 -right-2 bg-brand-600 text-white p-1 rounded-full shadow-lg border-2 border-background">
                                                        <Lock className="h-3 w-3" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Restriction & Access Control Section */}
                                <div className="space-y-4">
                                    {/* Restriction Toggle */}
                                    <div className={cn(
                                        "bg-card/60 backdrop-blur-md border border-border/50 rounded-sm p-4 flex items-center justify-between shadow-sm",
                                        !selectedProfileKycComplete && "opacity-75"
                                    )}>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <Lock className={cn("h-4 w-4", isRestricted ? "text-brand-600" : "text-muted-foreground")} />
                                                <span className="text-xs font-black uppercase tracking-widest text-foreground">{copy('Restrict content', 'Zuia content')}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {selectedProfileKycComplete
                                                    ? copy('Toggle to lock this content behind a paywall', 'Washa ili kufunga content nyuma ya malipo')
                                                    : copy('Complete KYC before locking content for payment', 'Kamilisha KYC kabla ya kufunga content kwa malipo')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!selectedProfileKycComplete) {
                                                    toast.error(copy('Complete KYC before locking content for payment.', 'Kamilisha KYC kabla ya kufunga content kwa malipo.'));
                                                    return;
                                                }

                                                const next = !isRestricted;
                                                setIsRestricted(next);
                                                if (!next) {
                                                    setSelectedPromotables([]);
                                                    setShortPrice('');
                                                    setShortTitle('');
                                                }
                                            }}
                                            disabled={!selectedProfileKycComplete}
                                            className={cn(
                                                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                                selectedProfileKycComplete ? "cursor-pointer" : "cursor-not-allowed",
                                                isRestricted ? "bg-brand-600" : "bg-muted"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                    isRestricted ? "translate-x-5" : "translate-x-0"
                                                )}
                                            />
                                        </button>
                                    </div>

                                    {/* Expanded Restriction Settings */}
                                    <AnimatePresence>
                                        {isRestricted && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                className="bg-card/60 backdrop-blur-md border border-border/50 rounded-3xl p-4 space-y-4 overflow-hidden"
                                            >
                                                {/* Unlock Price Entry */}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">{copy('Unlock price (single price)', 'Bei ya kufungua (bei moja)')}</label>
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex-1">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">TZS</span>
                                                            <input
                                                                type="number"
                                                                value={shortPrice}
                                                                onChange={(e) => setShortPrice(e.target.value)}
                                                                className="h-11 w-full pl-10 pr-3 rounded-xl border border-input bg-background text-sm font-bold"
                                                                placeholder={copy('Example: 5,000', 'Mfano: 5,000')}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground italic leading-tight">{copy('Optional: leave blank if this should unlock only via subscription or bundle', 'Si lazima: acha wazi kama ifunguke kupitia subscription au bundle pekee')}</p>
                                                    </div>
                                                </div>

                                                {shouldShowShortTitleInput && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                                            {copy('Premium short title', 'Kichwa kifupi cha premium')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={shortTitle}
                                                            onChange={(e) => setShortTitle(e.target.value)}
                                                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                            placeholder={copy('What customers will unlock', 'Kile ambacho wateja watafungua')}
                                                            required
                                                        />
                                                        <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                            {copy('Required so customers know what they will unlock.', 'Inahitajika ili wateja wajue watakachofungua.')}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="h-px bg-border/50" />

                                                {/* Access Group Selection (Bundles / Subscriptions) */}
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">{copy('Assign to access group', 'Weka kwenye kundi la Subscribers')}</label>

                                                    <div className="flex p-1 bg-background/50 rounded-2xl border border-border/50">
                                                        {['plan', 'bundle'].map((tab) => (
                                                            <button
                                                                key={tab}
                                                                onClick={() => setActivePromotionTab(tab)}
                                                                className={cn(
                                                                    "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                                                    activePromotionTab === tab ? "bg-background text-brand-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                                )}
                                                            >
                                                                {tab === 'plan' ? copy('Subscriptions', 'Subscriptions') : copy('Bundles', 'Bundles')}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar pt-1">
                                                        {promotablesLoading ? (
                                                            <div className="flex items-center justify-center py-8"><p className="text-xs text-muted-foreground italic">{copy('Loading groups...', 'Inapakia makundi...')}</p></div>
                                                        ) : promotables[activePromotionTab === 'plan' ? 'plans' : 'bundles'].length === 0 ? (
                                                            <p className="text-[11px] text-muted-foreground text-center py-6 italic">{activePromotionTab === 'plan' ? copy('No subscriptions available for selection.', 'Hakuna subscription ya kuchagua.') : copy('No bundles available for selection.', 'Hakuna bundles za kuchagua.')}</p>
                                                        ) : (
                                                            promotables[activePromotionTab === 'plan' ? 'plans' : 'bundles'].map(item => {
                                                                const mappedType = activePromotionTab === 'plan' ? 'subscription_plan' : activePromotionTab;
                                                                const isSelected = selectedPromotables.some(p => p.id === item.id && p.type === mappedType);

                                                                return (
                                                                    <button
                                                                        key={item.id}
                                                                        onClick={() => {
                                                                            if (isSelected) {
                                                                                setSelectedPromotables(prev => prev.filter(p => !(p.id === item.id && p.type === mappedType)));
                                                                            } else {
                                                                                setSelectedPromotables(prev => [...prev, { id: item.id, type: mappedType, title: item.title || item.name, price: item.price }]);
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left group border",
                                                                            isSelected ? "bg-brand-50/50 border-brand-200" : "bg-background/20 border-transparent hover:bg-background/40 hover:border-border/50"
                                                                        )}
                                                                    >
                                                                        <div className="h-10 w-10 rounded-lg bg-background shadow-sm shrink-0 flex items-center justify-center border border-border/50">
                                                                            <AccessGateIcon type={mappedType === 'bundle' ? 'bundle' : 'subscription_plan'} />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="font-bold text-[13px] truncate text-foreground leading-tight">{item.title || item.name}</p>
                                                                            <p className="text-muted-foreground text-[10px] leading-tight font-medium mt-0.5">
                                                                                {item.price > 0 ? `TZS ${Number(item.price).toLocaleString()}` : copy('Free', 'Bure')}
                                                                            </p>
                                                                        </div>
                                                                        {isSelected && <div className="h-2 w-2 rounded-full bg-brand-600 shadow-none ring-2 ring-brand-100" />}
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <PolicyNotice />

                            <div className="flex flex-col items-center gap-3 py-2">
                                <span className="text-sm font-black uppercase tracking-[0.35em] text-brand-600">{copy('OR', 'AU')}</span>
                                <button
                                    type="button"
                                    onClick={openProductUpload}
                                    disabled={!selectedProfile}
                                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl shadow-sm border border-border/50 backdrop-blur-sm bg-card/60 px-5 text-sm font-black text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ShoppingBag className="h-5 w-5" />
                                    {copy('Post new product', 'Post bidhaa mpya')}
                                </button>
                            </div>
                        </div>

                        {/* Promotion Previews (Only for standalone product) */}
                        <AnimatePresence>
                            {promotedProduct && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative group border border-brand-200/50 bg-gradient-to-r from-brand-50 to-brand-100/50 dark:from-brand-900/10 dark:to-brand-800/5 rounded-2xl p-3 flex items-center gap-4 shadow-sm backdrop-blur-md mb-4 mt-2"
                                >
                                    <div className="h-14 w-14 overflow-hidden shrink-0 shadow-sm border border-white/20">
                                        <img src={promotedProduct.image_url} className="h-full w-full object-cover" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-600/80 px-1.5 py-0.5 bg-brand-500/10 rounded-md">{copy('Promoted product', 'Bidhaa iliyokuzwa')}</span>
                                        </div>
                                        <p className="font-bold text-[14px] truncate text-foreground">{promotedProduct.title}</p>
                                        <p className="text-brand-600 font-black text-[12px]">TZS {Number(promotedProduct.price).toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => setPromotedProduct(null)} className="h-8 w-8 rounded-full bg-background/80 hover:bg-background border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shadow-sm">
                                        <X className="h-4 w-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Standalone Product Picker (Toolbar Triggered) */}
                        <AnimatePresence>
                            {showProducts && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-card/60 backdrop-blur-md border border-border/50 p-4 rounded-3xl shadow-lg mb-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">{copy('Select product to promote', 'Chagua bidhaa ya kuambatanisha')}</label>
                                        <button onClick={() => setShowProducts(false)} className="text-[10px] text-muted-foreground font-bold hover:text-foreground">{copy('Done', 'Funga')}</button>
                                    </div>
                                    <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar pt-1">
                                        {promotablesLoading ? (
                                            <p className="text-xs text-muted-foreground italic py-4">{copy('Checking catalog...', 'Inakagua katalogi...')}</p>
                                        ) : promotables.products.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground py-6 text-center">{copy('No products found to promote.', 'Huna bidhaa ya kuambatisha kwenye post.')}</p>
                                        ) : (
                                            promotables.products.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => { setPromotedProduct({ id: item.id, title: item.title, price: item.price, image_url: item.image_url }); setShowProducts(false); }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left bg-background/30 hover:bg-background/80 border border-transparent hover:border-border/50 group"
                                                    )}
                                                >
                                                    <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-background shadow-sm border border-border/50">
                                                        <img src={item.image_url} className="h-full w-full object-cover" alt="" onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + item.title + '&background=random'; }} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] truncate">{item.title}</p>
                                                        <p className="text-brand-600 font-black text-[11px]">TZS {Number(item.price).toLocaleString()}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Background Style Picker (Toolbar Triggered) */}
                        <AnimatePresence>
                            {showBg && composerMode === 'short' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-card/80 backdrop-blur-xl border border-border/50 p-3 rounded-3xl shadow-lg mb-4"
                                >
                                    {disableStyles ? (
                                        <p className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground">
                                            {copy('Background styles are available for short text posts without media.', 'Mitindo ya mandharinyuma inapatikana kwa post fupi za maandishi bila media.')}
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                                            {BG_OPTIONS.map((option) => {
                                                const active = bg === option.key;

                                                return (
                                                    <button
                                                        key={option.key || 'normal'}
                                                        type="button"
                                                        onClick={() => setBg(option.key)}
                                                        className={cn(
                                                            'group flex flex-col items-center gap-1 rounded-2xl border p-2 transition-all',
                                                            active
                                                                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                                                                : 'border-border/50 bg-background/50 text-muted-foreground hover:border-brand-200 hover:text-foreground'
                                                        )}
                                                        aria-label={`${copy(option.label, BG_OPTION_TRANSLATIONS[option.label] || option.label)} ${copy('background', 'mandharinyuma')}`}
                                                        title={copy(option.label, BG_OPTION_TRANSLATIONS[option.label] || option.label)}
                                                    >
                                                        <span
                                                            className={cn(
                                                                'h-8 w-8 rounded-full border shadow-inner',
                                                                option.key === null && 'bg-background'
                                                            )}
                                                            style={option.preview ? { background: option.preview } : {}}
                                                        />
                                                        <span className="max-w-full truncate text-[10px] font-black">
                                                            {copy(option.label, BG_OPTION_TRANSLATIONS[option.label] || option.label).replace(/^\S+\s/, '')}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Floating Toolbox (Bottom - Short Mode Only) */}
                        {composerMode === 'short' && (
                            <div className="absolute bottom-6 left-0 right-0 px-4 flex justify-center w-full max-w-2xl mx-auto pointer-events-none">
                                <div className="pointer-events-auto flex items-center justify-center gap-1.5 w-max bg-accent/80 backdrop-blur-xl p-2 rounded-full border border-border/50 shadow-xl">
                                    {/* Media picker */}
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => fileRef.current?.click()}
                                        className="h-12 w-12 rounded-full flex items-center justify-center hover:bg-background transition-colors text-brand-600 shadow-sm"
                                        title={copy('Photo/Video', 'Picha/Video')}
                                    >
                                        <Image className="h-[22px] w-[22px]" />
                                    </motion.button>
                                    <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />

                                    {/* Style picker */}
                                    <div className="w-px h-6 bg-border/50 mx-1" />
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => { setShowBg(s => !s); setShowProducts(false); }}
                                        className={cn(
                                            "h-12 w-12 rounded-full flex items-center justify-center shadow-sm transition-all",
                                            showBg ? "bg-background scale-105" : "hover:bg-background text-foreground"
                                        )}
                                        title={copy('Background style', 'Mtindo wa mandharinyuma')}
                                    >
                                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand-400 via-purple-500 to-pink-500 shadow-inner" />
                                    </motion.button>

                                    {/* Standalone Product promote */}
                                    <div className="w-px h-6 bg-border/50 mx-1" />
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => { setShowProducts(s => !s); setShowBg(false); }}
                                        className={cn(
                                            "h-12 w-12 rounded-full flex items-center justify-center shadow-sm transition-all",
                                            showProducts ? "bg-background scale-105 text-brand-600" : "hover:bg-background text-foreground"
                                        )}
                                        title={copy('Promote a product', 'Promote bidhaa')}
                                    >
                                        <ShoppingBag className="h-[22px] w-[22px]" />
                                    </motion.button>
                                </div>
                            </div>
                        )}

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
