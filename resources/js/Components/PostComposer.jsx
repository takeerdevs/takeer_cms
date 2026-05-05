import React, { useState, useRef, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, ShoppingBag, BookOpenText, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import LongFormBlockEditor from '@/Components/LongFormBlockEditor';
import PolicyNotice from '@/Components/PolicyNotice';
import axios from 'axios';
import { toast } from 'sonner';

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
const SHORT_LOCKED_INTERNAL_TITLE = '__short_locked__';

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

export default function PostComposer({ isOpen, onClose, prefillProduct = null, prefillMedia = [], initialMode = 'short' }) {
    const { auth } = usePage().props;
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
    const merchantApiBase = selectedProfile?.username ? `/merchant/${selectedProfile.username}` : '/merchant';
    const merchantPayload = selectedProfile?.id ? { merchant_id: selectedProfile.id } : {};

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
    const shouldShowShortTitleInput = composerMode === 'short' && isRestricted;
    const shouldRequireShortTitle = shouldShowShortTitleInput;
    const selectedProfileKycComplete = ['verified', 'approved'].includes(String(selectedProfile?.kyc_status || '').toLowerCase())
        || Boolean(selectedProfile?.is_verified);

    // Default to is_default profile
    useEffect(() => {
        if (auth.user?.merchant_profiles?.length > 0 && !selectedProfile) {
            const def = auth.user.merchant_profiles.find(p => p.is_default) || auth.user.merchant_profiles[0];
            setSelectedProfile(def);
        }
    }, [auth.user, selectedProfile]);

    useEffect(() => {
        if (!selectedProfile || selectedProfileKycComplete) return;

        setIsRestricted(false);
        setSelectedPromotables([]);
        setShortPrice('');
        setShortTitle('');
    }, [selectedProfile, selectedProfileKycComplete]);

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
            setTimeout(() => textRef.current?.focus(), 350);
        }
    }, [initialMode, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (composerMode !== 'long') return;
        if (submitting) return;

        const normalizedTitle = (longForm.title || '').trim();
        const normalizedBody = (longForm.body || '').trim();
        if (!normalizedTitle || !normalizedBody) return;

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
                    title: normalizedTitle,
                    excerpt: longForm.excerpt || null,
                    body: normalizedBody,
                    format: 'editorjs',
                    visibility: 'draft',
                    price: priceVal,
                };

                if (longForm.id) {
                    await axios.put(`${merchantApiBase}/content-items/${longForm.id}/api`, payload);
                } else {
                    const res = await axios.post(`${merchantApiBase}/content-items/api`, payload);
                    const saved = res.data?.content_item;
                    if (saved?.id) {
                        setLongForm((current) => ({ ...current, id: saved.id }));
                    }
                }

                setLastLongAutosaveSignature(signature);
                setLongAutosaveStatus('Draft auto-saved');
            } catch (error) {
                setLongAutosaveStatus('Draft autosave failed');
            }
        }, 1800);

        return () => clearTimeout(timer);
    }, [composerMode, isOpen, lastLongAutosaveSignature, longForm, submitting]);

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
    };

    const handleClose = () => { reset(); onClose(); };

    const handlePost = async () => {
        if (composerMode === 'short' && !text.trim() && mediaFiles.length === 0) return;
        if (composerMode === 'long' && (!longForm.title.trim() || !longForm.body.trim())) return;
        if (shouldRequireShortTitle && !shortTitle.trim()) {
            toast.error('Paid short content must have a clear title.');
            return;
        }
        if (hasSingleUnlockPrice && parsedShortPrice !== null && parsedShortPrice < 0) {
            toast.error('Unlock price cannot be negative.');
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
            };

            // 3. Submit to Unified Post API
            await axios.post(`${merchantApiBase}/posts`, payload);

            setSubmitting(false);
            handleClose();

            // Redirect to feed or profile
            router.visit('/feed');
            toast.success('Post published successfully!');

        } catch (error) {
            console.error('Publishing failed:', error);
            toast.error(error.response?.data?.message || 'Failed to publish post. Please try again.');
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
            textAreaClass = "text-center text-white placeholder-white/70 font-bold text-3xl sm:text-4xl drop-shadow-md";
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
                        <h2 className="font-black text-lg text-foreground tracking-tight drop-shadow-sm">Chapisho Jipya</h2>
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={handlePost}
                            disabled={
                                submitting
                                || (composerMode === 'short' ? (!text.trim() && mediaFiles.length === 0) : (!longForm.title.trim() || !longForm.body.trim()))
                                || (shouldRequireShortTitle && !shortTitle.trim())
                            }
                            className="h-10 px-6 rounded-full bg-brand-600 text-white text-sm font-bold disabled:opacity-40 transition-all hover:bg-brand-700 shadow-lg shadow-brand-500/20 drop-shadow-sm active:scale-95"
                        >
                            {submitting ? 'Inatuma...' : 'Chapisha'}
                        </motion.button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 relative overflow-hidden pb-24">
                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-20 pt-2">
                            {/* Instagram-style Account Picker */}
                            {auth.user?.merchant_profiles?.length > 0 && (
                                <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl p-4 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1 text-center sm:text-left">Tuma kama...</p>
                                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 justify-center sm:justify-start">
                                        {auth.user.merchant_profiles.map((profile) => {
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
                                                        {profile.type === 'personal' ? 'Binafsi' : 'Biashara'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
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
                                    Short form
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
                                    Long form
                                </button>
                            </div>

                            {composerMode === 'short' ? (
                                <div className={cn(
                                    "flex flex-col transition-all rounded-3xl overflow-hidden shadow-sm border border-border/50 backdrop-blur-sm",
                                    hasBg ? "min-h-[300px]" : "bg-card/60 min-h-[200px]"
                                )} style={hasBg ? { background: bgStyle } : {}}>

                                    {/* Author Info Overlay (if not handled by picker) */}
                                    {!auth.user?.merchant_profiles?.length && (
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
                                            placeholder="What's on your mind?"
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
                                    <div className="grid gap-4 md:grid-cols-1">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Title</label>
                                            <input
                                                type="text"
                                                value={longForm.title}
                                                onChange={(e) => setLongForm((current) => ({ ...current, title: e.target.value }))}
                                                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                                placeholder="Enter article title..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Excerpt</label>
                                        <textarea
                                            value={longForm.excerpt}
                                            onChange={(e) => setLongForm((current) => ({ ...current, excerpt: e.target.value }))}
                                            rows={3}
                                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                            placeholder="Muhtasari mfupi unaoonekana kabla ya kufungua content."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Body</label>
                                        <LongFormBlockEditor
                                            key={`composer-long-editor-${longEditorKey}`}
                                            value={longForm.body}
                                            onChange={(nextBody) => setLongForm((current) => ({ ...current, body: nextBody }))}
                                            placeholder="Write your article, add headings, links, images, and embeds..."
                                            uploadUrl={`${merchantApiBase}/upload/media`}
                                            uploadFields={merchantPayload}
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
                                                <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 shadow-sm border border-white/20">
                                                    <img
                                                        src={item.type === 'bundle' ? '/images/bundle-icon.png' : '/images/subscription-icon.png'}
                                                        className="h-full w-full object-cover"
                                                        alt=""
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-600/80 px-1.5 py-0.5 bg-brand-500/10 rounded-md">
                                                            {item.type === 'bundle' ? 'Bundle' : 'Subscription'}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-[14px] truncate text-foreground leading-tight mt-0.5">{item.title}</p>
                                                    <p className="text-brand-600 font-black text-[11px]">
                                                        {item.price > 0 ? `TZS ${Number(item.price).toLocaleString()}` : 'Free'}
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
                                                <span className="text-xs font-black uppercase tracking-widest text-foreground">Restrict Content</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {selectedProfileKycComplete
                                                    ? 'Toggle to lock this content behind a paywall'
                                                    : 'Complete KYC before locking content for payment'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!selectedProfileKycComplete) {
                                                    toast.error('Complete KYC before locking content for payment.');
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
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">Unlock Price (Single Price)</label>
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex-1">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">TZS</span>
                                                            <input
                                                                type="number"
                                                                value={shortPrice}
                                                                onChange={(e) => setShortPrice(e.target.value)}
                                                                className="h-11 w-full pl-10 pr-3 rounded-xl border border-input bg-background text-sm font-bold"
                                                                placeholder="Example: 5,000"
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground italic leading-tight">Optional: leave blank if this should unlock only via subscription or bundle</p>
                                                    </div>
                                                </div>

                                                {shouldShowShortTitleInput && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                                            Premium Short Title
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={shortTitle}
                                                            onChange={(e) => setShortTitle(e.target.value)}
                                                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                                            placeholder="What customers will unlock"
                                                            required
                                                        />
                                                        <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                            Required so customers know what they will unlock.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="h-px bg-border/50" />

                                                {/* Access Group Selection (Bundles / Subscriptions) */}
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">Assign to Access Group</label>

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
                                                                {tab === 'plan' ? 'Subscriptions' : 'Bundles'}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar pt-1">
                                                        {promotablesLoading ? (
                                                            <div className="flex items-center justify-center py-8"><p className="text-xs text-muted-foreground italic">Loading groups...</p></div>
                                                        ) : promotables[activePromotionTab === 'plan' ? 'plans' : 'bundles'].length === 0 ? (
                                                            <p className="text-[11px] text-muted-foreground text-center py-6 italic">No {activePromotionTab}s available for selection.</p>
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
                                                                        <div className="h-10 w-10 rounded-lg bg-background shadow-sm overflow-hidden shrink-0">
                                                                            <img src={activePromotionTab === 'bundle' ? '/images/bundle-icon.png' : '/images/subscription-icon.png'} className="h-full w-full object-cover" alt="" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="font-bold text-[13px] truncate text-foreground leading-tight">{item.title || item.name}</p>
                                                                            <p className="text-muted-foreground text-[10px] leading-tight font-medium mt-0.5">
                                                                                {item.price > 0 ? `TZS ${Number(item.price).toLocaleString()}` : 'Free'}
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
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-600/80 px-1.5 py-0.5 bg-brand-500/10 rounded-md">PROMOTED PRODUCT</span>
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
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-600">Select Product to Promote</label>
                                        <button onClick={() => setShowProducts(false)} className="text-[10px] text-muted-foreground font-bold hover:text-foreground">Done</button>
                                    </div>
                                    <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar pt-1">
                                        {promotablesLoading ? (
                                            <p className="text-xs text-muted-foreground italic py-4">Checking catalog...</p>
                                        ) : promotables.products.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground py-6 text-center">No products found to promote.</p>
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

                        {/* Floating Toolbox (Bottom - Short Mode Only) */}
                        {composerMode === 'short' && (
                            <div className="absolute bottom-6 left-0 right-0 px-4 bg-gradient-to-t from-background/80 via-background/40 to-transparent pt-10 pb-2 flex justify-center w-full max-w-2xl mx-auto pointer-events-none">
                                <div className="pointer-events-auto flex items-center justify-center gap-1.5 w-max bg-accent/80 backdrop-blur-xl p-2 rounded-full border border-border/50 shadow-xl">
                                    {/* Media picker */}
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => fileRef.current?.click()}
                                        className="h-12 w-12 rounded-full flex items-center justify-center hover:bg-background transition-colors text-brand-600 shadow-sm"
                                        title="Photo/Video"
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
                                        title="Background style"
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
                                        title="Promote a product"
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
