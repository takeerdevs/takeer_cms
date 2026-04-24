import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import AdminLayout from '@/Layouts/AdminLayout';
import { MessageCircle, Send, CornerDownRight, ChevronLeft, Loader2, Share2, MoreHorizontal, ShoppingBag, ShieldCheck, BadgeCheck, Unlock, X, User, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import LikeButton from '@/Components/LikeButton';
import ShoppablePin from '@/Components/ShoppablePin';
import PostManagementMenu from '@/Components/PostManagementMenu';
import EditorJsRenderer from '@/Components/EditorJsRenderer';
import LinkifiedText from '@/Components/LinkifiedText';
import { getShortPostPresentation } from '@/lib/shortPostStyles';
import { toast } from 'sonner';

function CommentItem({ comment, onReply }) {
    const [showReplies, setShowReplies] = useState(false);
    const normalizeList = (items) => {
        if (Array.isArray(items)) return items;
        if (Array.isArray(items?.data)) return items.data;
        return [];
    };
    // Threads-style: render only direct replies of this source comment.
    const replies = normalizeList(comment.replies || []);
    const hasReplies = replies.length > 0;
    const previewReply = hasReplies ? replies[0] : null;
    const extraReplies = hasReplies ? replies.slice(1) : [];
    const visibleExtraReplies = showReplies ? extraReplies : [];

    return (
        <div className="py-4 border-b border-border/50 last:border-0">
            <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-accent border border-border flex items-center justify-center text-muted-foreground shrink-0">
                    <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground">{comment.user.name}</span>
                        <span className="text-[10px] text-muted-foreground">{comment.created_at}</span>
                    </div>
                    <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">{comment.text}</p>
                    <div className="mt-2 flex items-center gap-4">
                        <button
                            onClick={() => onReply(comment)}
                            className="text-xs font-bold text-muted-foreground hover:text-brand-600 transition-colors flex items-center gap-1"
                        >
                            <CornerDownRight className="h-3 w-3" />
                            Jibu
                        </button>
                    </div>
                </div>
            </div>

            {hasReplies && (
                <div className="mt-3 relative">
                    <div className="absolute left-5 -top-3 bottom-5 w-px bg-border/70" />
                    <div className="space-y-3">
                        {previewReply && (
                            <div className="relative flex gap-3">
                                <div className="h-10 w-10 rounded-full bg-accent border border-border flex items-center justify-center text-muted-foreground shrink-0">
                                    <User className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="text-xs font-bold text-foreground">{previewReply.user.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{previewReply.created_at}</span>
                                    </div>
                                    <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">{previewReply.text}</p>
                                </div>
                            </div>
                        )}

                        {visibleExtraReplies.map((reply) => (
                            <div key={reply.id} className="flex gap-3">
                                <div className="h-10 w-10 rounded-full bg-accent border border-border flex items-center justify-center text-muted-foreground shrink-0">
                                    <User className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="text-xs font-bold text-foreground">{reply.user.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{reply.created_at}</span>
                                    </div>
                                    <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">{reply.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {extraReplies.length > 0 && (
                        <button
                            onClick={() => setShowReplies((prev) => !prev)}
                            className="pl-12 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showReplies ? 'Ficha majibu' : `Onyesha majibu (${extraReplies.length})`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return 'Sasa hivi';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
};

function bodyLooksLikeEditorJs(body) {
    if (typeof body === 'object' && body !== null && Array.isArray(body.blocks)) return true;
    if (typeof body !== 'string') return false;
    try {
        const parsed = JSON.parse(body);
        return Array.isArray(parsed?.blocks);
    } catch {
        return false;
    }
}

function sanitizeHtml(html) {
    if (typeof window === 'undefined') return String(html || '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return '';

    root.querySelectorAll('script,style,iframe,object,embed,form').forEach((node) => node.remove());
    root.querySelectorAll('*').forEach((el) => {
        [...el.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();
            const value = (attr.value || '').toLowerCase();
            if (name.startsWith('on')) {
                el.removeAttribute(attr.name);
                return;
            }
            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return root.innerHTML;
}

const reactionPickerEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👋', '🔥', '👏', '🎉', '💯', '🤝', '👌', '😍', '🤔', '🥹', '💔', '😡', '😴', '🌟', '✅', '💪', '🫶', '🙌'];

function normalizeCommentsPayload(payload) {
    if (Array.isArray(payload)) {
        return { items: payload, next: null };
    }

    if (payload && Array.isArray(payload.data)) {
        return {
            items: payload.data,
            next: payload?.links?.next || null,
        };
    }

    return { items: [], next: null };
}

export default function PostDetail({ post: initialPost, initialComments, readOnly = false, backHref = null }) {
    const { auth } = usePage().props;
    const LayoutComponent = readOnly ? AdminLayout : AppLayout;
    const layoutProps = readOnly ? { title: 'Post Monitor', hideTopBar: true } : { hideTabBar: true };
    const [post, setPost] = useState(initialPost);
    const [comments, setComments] = useState(initialComments || []);
    const [loadingComments, setLoadingComments] = useState(Boolean(!initialComments && !(initialPost?.is_restricted && !initialPost?.has_access)));
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [reactionSummary, setReactionSummary] = useState(initialPost?.reaction_summary || []);
    const [myReaction, setMyReaction] = useState(initialPost?.my_reaction || null);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [customReaction, setCustomReaction] = useState('');
    const [commentsNextUrl, setCommentsNextUrl] = useState(null);
    const [loadingMoreComments, setLoadingMoreComments] = useState(false);
    const commentsLoadMoreRef = useRef(null);
    const [isUnlocking, setIsUnlocking] = useState(false);

    // Listen for unlock events dispatched by CheckoutModal
    useEffect(() => {
        const handleUnlocking = (e) => {
            const matchesType = ['post', 'content_item'].includes(e.detail?.itemType);
            const matchesId = String(e.detail?.itemId) === String(initialPost.id);
            if (matchesType && matchesId) setIsUnlocking(true);
        };

        const handleUnlocked = async (e) => {
            const matchesType = ['post', 'content_item'].includes(e.detail?.itemType);
            const matchesId = String(e.detail?.itemId) === String(initialPost.id);
            if (!matchesType || !matchesId) return;

            try {
                const routeKey = initialPost.public_id ?? initialPost.id;
                const res = await fetch(`/api/pwa/post/${routeKey}`, {
                    headers: { Accept: 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.post) {
                        setPost(data.post);
                        // Also reload comments now that we have access
                        fetchComments({ append: false });
                    }
                }
            } catch {}
            setIsUnlocking(false);
        };

        window.addEventListener('takeer:access-unlocking', handleUnlocking);
        window.addEventListener('takeer:access-unlocked', handleUnlocked);
        return () => {
            window.removeEventListener('takeer:access-unlocking', handleUnlocking);
            window.removeEventListener('takeer:access-unlocked', handleUnlocked);
        };
    }, [initialPost.id, initialPost.public_id]);

    const hasAccess = post.has_access ?? true;
    const isRestricted = post.is_restricted ?? false;
    const isLocked = isRestricted && !hasAccess;
    const isDeleted = post.is_deleted ?? false;
    const commentsEnabled = post.comments_enabled ?? true;
    const reactionsEnabled = post.reactions_enabled ?? true;
    const canShowComments = commentsEnabled || isDeleted;
    const canShowReactions = reactionsEnabled || isDeleted;

    // Sync state when deferred comments arrive
    useEffect(() => {
        if (!canShowComments) {
            setComments([]);
            setLoadingComments(false);
            return;
        }

        if (initialComments) {
            const normalized = normalizeCommentsPayload(initialComments);
            setComments(normalized.items);
            setCommentsNextUrl(normalized.next);
            setLoadingComments(false);
        } else if (!isLocked) {
            // Fallback: if no comments provided on mount, fetch them
            fetchComments({ append: false });
        } else {
            setComments([]);
            setCommentsNextUrl(null);
            setLoadingComments(false);
        }
    }, [initialComments, isLocked, canShowComments]);

    const fetchComments = async ({ append = false, url = null } = {}) => {
        if (!canShowComments) return;
        if (append) {
            setLoadingMoreComments(true);
        } else {
            setLoadingComments(true);
        }
        try {
            const endpoint = url || `/posts/${initialPost.id}/comments?per_page=20`;
            const res = await axios.get(endpoint);
            const normalized = normalizeCommentsPayload(res.data);

            if (append) {
                setComments((prev) => {
                    const seen = new Set(prev.map((c) => c.id));
                    const merged = [...prev];
                    normalized.items.forEach((item) => {
                        if (!seen.has(item.id)) {
                            merged.push(item);
                        }
                    });
                    return merged;
                });
            } else {
                setComments(normalized.items);
            }
            setCommentsNextUrl(normalized.next);
        } catch (e) {
            if (e.response?.status !== 403) {
                toast.error(e.response?.data?.message || 'Imeshindwa kupakia maoni.');
            }
        } finally {
            if (append) {
                setLoadingMoreComments(false);
            } else {
                setLoadingComments(false);
            }
        }
    };

    useEffect(() => {
        if (!commentsNextUrl || loadingComments || loadingMoreComments || !canShowComments || isLocked) {
            return;
        }

        const target = commentsLoadMoreRef.current;
        if (!target) return;

        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first?.isIntersecting && commentsNextUrl) {
                fetchComments({ append: true, url: commentsNextUrl });
            }
        }, { rootMargin: '300px 0px 300px 0px' });

        observer.observe(target);
        return () => observer.disconnect();
    }, [commentsNextUrl, loadingComments, loadingMoreComments, canShowComments, isLocked]);

    const handleSendComment = async () => {
        if (readOnly) return;
        if (isDeleted) {
            toast.error('Comments are disabled on deleted content.');
            return;
        }
        if (!commentsEnabled) return;
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            const res = await axios.post(`/posts/${initialPost.id}/comment`, {
                text: commentText,
                parent_id: replyingTo?.id || null
            });

            if (replyingTo) {
                fetchComments({ append: false });
            } else {
                setComments(prev => [res.data.comment, ...prev]);
            }

            setCommentText('');
            setReplyingTo(null);
            setPost(prev => ({ ...prev, comment_count: prev.comment_count + 1 }));
        } catch (e) {
            toast.error(e.response?.data?.message || 'Imeshindwa kutuma maoni.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReact = async (emoji) => {
        if (readOnly) return;
        if (isDeleted) {
            toast.error('Reactions are disabled on deleted content.');
            return;
        }
        if (!reactionsEnabled) return;

        const next = myReaction === emoji ? null : emoji;
        setMyReaction(next);

        try {
            const res = await axios.post(`/posts/${initialPost.id}/react`, { emoji: next });
            setMyReaction(res.data?.my_reaction || null);
            setReactionSummary(res.data?.reaction_summary || []);
        } catch (e) {
            setMyReaction(myReaction);
            toast.error(e.response?.data?.message || 'Imeshindwa kuweka reaction.');
        }
    };

    const handleCustomReaction = () => {
        if (readOnly) return;
        const emoji = customReaction.trim();
        if (!emoji) return;
        handleReact(emoji);
        setCustomReaction('');
        setShowReactionPicker(false);
    };

    const mediaItems = post.images?.length
        ? post.images
        : post.media?.length
            ? post.media.map((item) => item?.url).filter(Boolean)
            : post.media_url ? [post.media_url] : [];
    const postHotspots = post.resolved_hotspots || post.hotspots || {};
    const postType = post.post_type || (post.body || post.excerpt ? 'long' : 'short');
    const isLongForm = postType === 'long';
    const shortPresentation = getShortPostPresentation({
        text: post.caption || '',
        bgStyle: post.bg_style,
        hasMedia: mediaItems.length > 0,
    });
    const promotables = Array.isArray(post.promotables) ? post.promotables : [];
    const hasMultiplePromotables = promotables.length > 1;
    const firstPromotable = promotables[0] || null;
    const promotableType = firstPromotable?.type || null;
    const promotableItem = firstPromotable?.item || null;
    const hasSingleUnlockOption = isRestricted && post.restricted_price !== null;
    const hasPromotableOption = isRestricted && promotables.length > 0;
    
    // Bundle Items parsing
    const promotableBundleRouteKey = promotableItem?.slug || firstPromotable?.id;
    const isBundlePromotable = promotableType === 'bundle' && Boolean(promotableBundleRouteKey);
    const bundleItems = Array.isArray(promotableItem?.bundle_items) ? promotableItem.bundle_items : [];
    const shouldShowBundleItemsGrid = isBundlePromotable && bundleItems.length > 0;
    const hasBundlePrice = Number(promotableItem?.price || 0) > 0;
    const bundleItemsCount = Number(promotableItem?.items_count ?? promotableItem?.items?.length ?? 0);
    const isImageLikeUrl = (value) => /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(String(value || '').trim());
    const resolveBundleItemHref = (item) => {
        if (item?.item_type === 'product') {
            const key = item?.slug || item?.item_id;
            return key ? route('product.show', key) : null;
        }
        if (item?.item_type === 'content_item') {
            const key = item?.slug || item?.item_id;
            return key ? `/content/${key}` : null;
        }
        return null;
    };

    const singleUnlockPrice = Number(post.restricted_price || 0);
    const attachedProduct = post.product || post.product_tags?.[0]?.product || null;
    const productRouteKey = attachedProduct?.slug ?? attachedProduct?.id;
    const attachedProductVariants = ((attachedProduct?.variants || []).filter((variant) => (
        variant?.is_active !== false
    )));
    const hasVariantPricing = Boolean(attachedProduct?.has_variants && attachedProductVariants.length > 0);
    const variantPrices = attachedProductVariants
        .map((variant) => Number(variant?.price))
        .filter((value) => Number.isFinite(value));
    const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
    const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
    const variantAttributeSummary = useMemo(() => {
        if (!hasVariantPricing) return [];

        const keyOrder = [];
        const valuesByKey = {};

        attachedProductVariants.forEach((variant) => {
            Object.entries(variant?.attributes || {}).forEach(([key, rawValue]) => {
                const value = String(rawValue || '').trim();
                if (!value) return;
                if (!valuesByKey[key]) {
                    valuesByKey[key] = [];
                    keyOrder.push(key);
                }
                if (!valuesByKey[key].includes(value)) {
                    valuesByKey[key].push(value);
                }
            });
        });

        const toLabel = (key) => String(key || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase());

        return keyOrder.slice(0, 3).map((key) => {
            const values = valuesByKey[key] || [];
            if (values.length === 0) return null;
            if (values.length === 1) return `${toLabel(key)}: ${values[0]}`;
            return `${toLabel(key)}: ${values[0]} - ${values[values.length - 1]}`;
        }).filter(Boolean);
    }, [attachedProductVariants, hasVariantPricing]);
    const productDisplayPrice = attachedProduct
        ? Number(attachedProduct.discounted_price) > 0
            ? Number(attachedProduct.discounted_price)
            : Number(attachedProduct.price || 0)
        : 0;
    const productHasDiscount = attachedProduct
        ? Number(attachedProduct.discounted_price) > 0 && Number(attachedProduct.discounted_price) < Number(attachedProduct.price)
        : false;
    const sortedReactions = [...reactionSummary].sort((a, b) => (b.count || 0) - (a.count || 0));
    const defaultPreviewReactions = ['👍', '❤️', '🔥'];
    const topReactionChips = sortedReactions.length > 0
        ? sortedReactions.slice(0, 3)
        : defaultPreviewReactions.map((emoji) => ({ emoji, count: 0 }));

    const renderProductAttachmentCard = (className = '') => {
        if (!attachedProduct) return null;

        return (
            <div className={`mx-5 rounded-2xl overflow-hidden border border-brand-200/70 bg-gradient-to-br from-white to-brand-50/40 dark:border-brand-900/50 dark:from-slate-900 dark:to-brand-950/40 ${className}`}>
                <Link
                    href={route('product.show', productRouteKey)}
                    className="flex items-center gap-3 px-3.5 pt-3 pb-2 min-w-0"
                >
                    {attachedProduct.image_url && (
                        <div className="h-14 w-14 overflow-hidden border border-border/70 dark:border-border/90 bg-background shrink-0">
                            <img src={attachedProduct.image_url} alt={attachedProduct.title} className="h-full w-full object-cover" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-[22px] leading-tight text-foreground truncate">{attachedProduct.title}</p>
                        {hasVariantPricing ? (
                            <div className="space-y-0.5">
                                <p className="text-brand-600 dark:text-brand-400 font-black text-2xl leading-none">
                                    TZS {minVariantPrice.toLocaleString()} - {maxVariantPrice.toLocaleString()}
                                </p>
                                <p className="text-[11px] text-slate-600 leading-tight truncate">
                                    {variantAttributeSummary.join(', ')}
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="text-brand-600 dark:text-brand-400 font-black text-2xl leading-none">TZS {productDisplayPrice.toLocaleString()}</p>
                                {productHasDiscount && (
                                    <p className="text-muted-foreground text-sm line-through opacity-70">
                                        TZS {Number(attachedProduct.price || 0).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </Link>
                <div className="px-3.5 pb-3">
                    <button
                        onClick={() => {
                            if (!productRouteKey) return;
                            
                            if (attachedProduct.type === 'digital') {
                                if (!attachedProduct.has_access) {
                                    window.__openCheckout?.({
                                        id: attachedProduct.id,
                                        title: attachedProduct.title,
                                        price: productDisplayPrice,
                                        checkoutType: 'product',
                                        merchant: post.merchant || null,
                                    });
                                } else {
                                    // Product is owned: Open digital download modal directly
                                    window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                                        detail: {
                                            itemId: attachedProduct.id,
                                            itemType: 'product',
                                            orderId: attachedProduct.latest_order_id,
                                            productTitle: attachedProduct.title,
                                        }
                                    }));
                                }
                            } else {
                                router.visit(route('product.show', productRouteKey));
                            }
                        }}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-500 dark:to-brand-400 text-white text-base font-extrabold hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25"
                    >
                        <ShoppingBag className="h-4 w-4" /> {readOnly ? 'View' : (attachedProduct.has_access ? 'Fungua' : 'Nunua')}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <LayoutComponent {...layoutProps}>
            <Head title={`${post.merchant.name} - Chapisho`} />

            <div className="max-w-3xl mx-auto pb-40">
                {/* Header Navigation */}
                <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border transition-all">
                    <div className="flex items-center gap-3 px-4 h-14">
                        <button
                            type="button"
                            onClick={() => {
                                if (backHref) {
                                    router.visit(backHref);
                                } else if (window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    router.visit('/feed');
                                }
                            }}
                            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <h1 className="font-black text-base uppercase tracking-tight truncate flex-1">
                            Chapisho la <Link
                                href={`/m/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                                className="hover:text-brand-600 transition-colors"
                            >
                                {post.merchant.name}
                            </Link>
                        </h1>
                        {!readOnly && (
                            <PostManagementMenu
                                post={post}
                                isOwner={auth?.user?.id === post.merchant_id}
                                canReport={Boolean(auth?.user?.id && (post.has_access ?? true))}
                            />
                        )}
                    </div>
                </div>

                {/* Merchant Section */}
                <div className="flex items-center gap-3 px-5 py-6">
                    <Link
                        href={`/m/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                        className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-lg border-2 border-background shadow-sm overflow-hidden hover:opacity-90 transition-opacity"
                    >
                        {post.merchant_profile?.avatar_url ? (
                            <img src={post.merchant_profile.avatar_url} className="h-full w-full object-cover" alt="" />
                        ) : (
                            (post.merchant_profile?.display_name || post.merchant?.name || 'T').charAt(0).toUpperCase()
                        )}
                    </Link>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <Link
                                href={`/m/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                                className="font-bold text-base text-foreground leading-none truncate font-display hover:text-brand-600 transition-colors"
                            >
                                {post.merchant_profile?.display_name || post.merchant?.name}
                            </Link>
                            {post.merchant_profile?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/m/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                                className="text-xs text-muted-foreground truncate opacity-80 hover:text-brand-600 transition-colors"
                            >
                                @{post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}
                            </Link>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground opacity-30" />
                            <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
                        </div>
                    </div>
                    {(post.merchant_profile?.successful_sales || post.merchant_profile?.unsuccessful_sales) && (
                        <div className="text-[10px] font-black text-green-700 bg-green-100/80 px-2 py-1 rounded-full flex items-center gap-1 border border-green-200">
                            <ShieldCheck className="h-3 w-3" />
                            {Math.round((post.merchant_profile.successful_sales / ((post.merchant_profile.successful_sales + post.merchant_profile.unsuccessful_sales) || 1)) * 100)}% Trust
                        </div>
                    )}
                </div>

                {/* Content Header / Summary */}
                {(post.title || post.excerpt || post.caption) && (
                    <div className="px-5 pb-6 space-y-3">
                        {post.title && (
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{post.title}</h2>
                        )}
                        {post.excerpt && (
                            <div className="text-sm text-muted-foreground leading-7 whitespace-pre-wrap">
                                <LinkifiedText
                                    text={post.excerpt}
                                    maxLinkLength={56}
                                    linkClassName="text-brand-600 hover:text-brand-700 underline underline-offset-2 break-all"
                                />
                            </div>
                        )}
                        {post.caption && !isLongForm && !(!isLongForm && shortPresentation.hasBg) && (
                            <div className={`${isLongForm ? 'text-base leading-relaxed font-medium' : `${shortPresentation.textClass} leading-[1.4]`} whitespace-pre-wrap`}>
                                <LinkifiedText
                                    text={post.caption}
                                    maxLinkLength={48}
                                    linkClassName="text-brand-600 hover:text-brand-700 underline underline-offset-2 break-all"
                                />
                            </div>
                        )}
                    </div>
                )}

                {!isLocked && !isLongForm && shortPresentation.hasBg && (
                    <div className="mx-5 mb-8 rounded-3xl min-h-[280px] flex items-center justify-center px-8 py-12" style={{ background: shortPresentation.bgValue }}>
                        <div className={`${shortPresentation.textClass} leading-[1.2] text-center whitespace-pre-wrap`}>
                            <LinkifiedText
                                text={post.caption}
                                maxLinkLength={56}
                                linkClassName="text-brand-600 hover:text-brand-700 underline underline-offset-2 break-all"
                            />
                        </div>
                    </div>
                )}

                {/* Locked overlay card */}
                {isLocked && (
                    <div className="px-5 pb-6">
                        {isUnlocking ? (
                            <div className="flex flex-col items-center gap-4 py-10 animate-in fade-in">
                                <div className="h-20 w-20 rounded-3xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                                </div>
                                <div className="text-center">
                                    <p className="font-black text-base text-foreground">Inafungua content yako...</p>
                                    <p className="text-sm text-muted-foreground mt-1">Subiri kidogo, malipo yanakaguliwa</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-center mb-3">
                                    <Unlock className="h-10 w-10 text-muted-foreground/60" />
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    {hasSingleUnlockOption && (
                                        <button
                                            onClick={() => {
                                                if (readOnly) return;
                                                window.__openCheckout?.({
                                                    id: post.id,
                                                    title: post.title || 'Locked content',
                                                    price: singleUnlockPrice,
                                                    checkoutType: 'post',
                                                    merchant: post.merchant || null,
                                                });
                                            }}
                                            className="inline-flex items-center justify-center min-w-48 px-5 py-1.5 rounded-full border-[1.5px] border-foreground text-foreground font-medium text-xs hover:bg-foreground hover:text-background transition-all"
                                        >
                                            {`Unlock Tsh ${singleUnlockPrice.toLocaleString()}`}
                                        </button>
                                    )}
                                    {promotables.length > 0 && (
                                        <div className="flex flex-col gap-2 mt-4 items-center">
                                            {promotables.map((promo, idx) => {
                                                const routeKey = promo.item?.slug || promo.id;
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (promo.type === 'subscription_plan') {
                                                                router.visit(`/plan/${routeKey}`);
                                                            } else if (promo.type === 'bundle') {
                                                                router.visit(`/bundle/${routeKey}`);
                                                            } else {
                                                                window.__openCheckout?.({
                                                                    id: promo.id,
                                                                    title: promo.item?.name || promo.item?.title || post.title || 'Premium access',
                                                                    price: Number(promo.item?.price || 0),
                                                                    checkoutType: promo.type,
                                                                    merchant: post.merchant || null,
                                                                });
                                                            }
                                                        }}
                                                        className="inline-flex items-center justify-center min-w-48 px-5 py-2 rounded-full border-[1.5px] border-foreground text-foreground font-medium text-sm hover:bg-foreground hover:text-background transition-all"
                                                    >
                                                        {promo.type === 'subscription_plan'
                                                            ? `Subscribe ${(promo.item?.name || promo.item?.title || 'Plan')}: Tsh ${Number(promo.item?.price || 0).toLocaleString()}`
                                                            : `Join ${(promo.item?.title || 'Bundle')}: Tsh ${Number(promo.item?.price || 0).toLocaleString()}`
                                                        }
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Long-form body */}
                {!isLocked && isLongForm && post.body && (
                    <div className="px-5 pb-8">
                        {bodyLooksLikeEditorJs(post.body) ? (
                            <EditorJsRenderer data={post.body} />
                        ) : String(post.body).trim().startsWith('<') ? (
                            <div className="prose prose-sm max-w-none leading-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }} />
                        ) : (
                            <div className="text-base leading-8 whitespace-pre-wrap">
                                <LinkifiedText
                                    text={post.body}
                                    maxLinkLength={56}
                                    linkClassName="text-brand-600 hover:text-brand-700 underline underline-offset-2 break-all"
                                />
                            </div>
                        )}
                    </div>
                )}

                {renderProductAttachmentCard('mb-2')}

                {/* Bundle Attachment Card & Grid */}
                {isBundlePromotable && (
                    <div className="mx-5 mb-6 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/40 dark:border-sky-900/50 dark:from-slate-900 dark:to-sky-950/40 overflow-hidden">
                        {shouldShowBundleItemsGrid && (
                            <div className="grid grid-cols-2 gap-1 p-1.5">
                                {bundleItems.slice(0, 8).map((item, idx) => {
                                    const href = resolveBundleItemHref(item);
                                    const price = Number(item?.price || 0);
                                    return (
                                        <Link
                                            key={`${item.item_type}-${item.item_id}-${idx}`}
                                            href={href || '#'}
                                            onClick={(e) => {
                                                if (!href) {
                                                    e.preventDefault();
                                                }
                                                e.stopPropagation();
                                            }}
                                            className="group relative h-48 overflow-hidden rounded-xl border border-white/50 bg-slate-900"
                                        >
                                            {isImageLikeUrl(item?.image_url) ? (
                                                <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-800 to-slate-900">
                                                    <Boxes className="h-8 w-8 text-white/80" />
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
                                                <p className="text-sm font-black text-white truncate">{item.title}</p>
                                                <p className="text-xs font-bold text-white/90">{price > 0 ? `TZS ${price.toLocaleString()}` : 'Free'}</p>
                                                {href && (
                                                    <span className="mt-1 inline-flex h-6 min-w-16 items-center justify-center rounded-full border border-white/80 px-2 text-xs font-black text-white">
                                                        Open
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                        <Link
                            href={route('bundle.show', promotableBundleRouteKey)}
                            className="flex items-center gap-3 px-4 pt-4 pb-3 flex-1 min-w-0"
                        >
                            <div className="h-16 w-16 overflow-hidden border border-border/70 dark:border-border/90 bg-background shrink-0 rounded-xl flex items-center justify-center">
                                {promotableItem?.course_cover_image_url ? (
                                    <img src={promotableItem.course_cover_image_url} alt={promotableItem?.title || 'Bundle'} className="h-full w-full object-cover" />
                                ) : (
                                    <Boxes className="h-7 w-7 text-sky-600" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-[24px] leading-tight text-foreground truncate">{promotableItem?.title || 'Bundle Offer'}</p>
                                {hasBundlePrice && (
                                    <p className="text-sky-700 dark:text-sky-300 font-black text-2xl leading-none mt-1">
                                        TZS {Number(promotableItem?.price || 0).toLocaleString()}
                                    </p>
                                )}
                                <p className="text-xs text-slate-600 leading-tight truncate mt-1">
                                    {bundleItemsCount > 0 ? `${bundleItemsCount} item(s)` : 'Bundle access'}
                                    {promotableItem?.is_course ? ' • Course' : ''}
                                </p>
                            </div>
                        </Link>
                        <div className="px-4 pb-4">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.visit(route('bundle.show', promotableBundleRouteKey));
                                }}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 dark:from-sky-500 dark:to-cyan-400 text-white text-base font-extrabold hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-500/25"
                            >
                                <Boxes className="h-5 w-5" /> {readOnly ? 'View Bundle' : 'Open Bundle'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Full-Width Image Stack */}
                {!isLocked && mediaItems.length > 0 && (
                    <>
                        <div className="flex flex-col gap-8 scroll-mt-20">
                            {mediaItems.map((img, idx) => (
                                <div key={idx} className="flex flex-col gap-2">
                                    {/* The Image */}
                                    <div className="relative w-full bg-muted overflow-hidden">
                                        <img
                                            src={typeof img === 'string' ? img : img.url}
                                            className="w-full h-auto block"
                                            alt={`Post image ${idx + 1}`}
                                        />

                                        {/* Hotspots Overlay */}
                                        <div className="absolute inset-0 pointer-events-none z-10">
                                            <div className="relative w-full h-full pointer-events-auto">
                                                {(postHotspots?.[idx] || []).map((tag, tIdx) => (
                                                    <ShoppablePin
                                                        key={tIdx}
                                                        tag={tag}
                                                        onProductTap={(p) => {
                                                            if (p.type === 'digital') {
                                                                window.__openCheckout?.({
                                                                    id: p.id,
                                                                    title: p.title,
                                                                    price: Number(p.discounted_price) > 0 ? Number(p.discounted_price) : Number(p.price),
                                                                    checkoutType: 'product',
                                                                    merchant: post.merchant || null,
                                                                });
                                                            } else {
                                                                const key = p?.slug ?? p?.id;
                                                                if (key) window.location.href = `/product/${key}`;
                                                            }
                                                        }}
                                                        merchant={post.merchant}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {renderProductAttachmentCard('mt-8 mb-8')}

                {(canShowComments || canShowReactions) && (
                    <div className="px-5 mb-5 py-3 border-y border-border/50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            {canShowComments && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const section = document.getElementById('comments-section');
                                        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        if (!readOnly && !isLocked && !isDeleted) {
                                            const entry = document.getElementById('comment-input');
                                            entry?.focus();
                                        }
                                    }}
                                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl hover:bg-accent transition-colors text-muted-foreground"
                                >
                                    <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
                                    <span className="text-sm font-semibold">{post.comment_count ?? 0}</span>
                                </button>
                            )}
                        </div>

                        {canShowReactions && (
                            <>
                                {!isLocked && !isDeleted && !readOnly ? (
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        {topReactionChips.map((entry) => (
                                            <button
                                                key={entry.emoji}
                                                type="button"
                                                onClick={() => handleReact(entry.emoji)}
                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition-all border shrink-0 ${myReaction === entry.emoji ? 'bg-brand-100 border-brand-300' : 'bg-background border-border hover:bg-accent'}`}
                                            >
                                                <span>{entry.emoji}</span>
                                                {entry.count > 0 && (
                                                    <span className="text-xs font-black text-muted-foreground">{entry.count}</span>
                                                )}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setShowReactionPicker(true)}
                                            className="inline-flex items-center justify-center rounded-full h-8 w-8 border border-border bg-background hover:bg-accent text-muted-foreground shrink-0"
                                            aria-label="More reactions"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative flex justify-end">
                                        <div className="flex items-center gap-1.5 opacity-45">
                                            {(sortedReactions.length > 0 ? sortedReactions.slice(0, 3) : defaultPreviewReactions.map((emoji) => ({ emoji, count: 0 }))).map((entry) => (
                                                <div
                                                    key={`locked-detail-preview-${entry.emoji}`}
                                                    className="inline-flex items-center gap-1 justify-center rounded-full h-8 min-w-8 px-2 border border-border bg-muted/70 text-sm"
                                                >
                                                    <span>{entry.emoji}</span>
                                                    {entry.count > 0 && (
                                                        <span className="text-[10px] font-black text-muted-foreground">{entry.count}</span>
                                                    )}
                                                </div>
                                            ))}
                                            <div className="inline-flex items-center justify-center rounded-full h-8 w-8 border border-border bg-muted/70 text-muted-foreground shrink-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-background/95 border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                                <Lock className="h-3 w-3" />
                                                {isDeleted ? 'Read only' : 'Unlock'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                <AnimatePresence>
                    {showReactionPicker && !readOnly && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-4"
                            onClick={() => setShowReactionPicker(false)}
                        >
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 20, opacity: 0 }}
                                className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                                    <h3 className="font-black text-sm uppercase tracking-wider">Choose Reaction</h3>
                                    <button type="button" onClick={() => setShowReactionPicker(false)} className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="grid grid-cols-8 gap-2">
                                        {reactionPickerEmojis.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                    handleReact(emoji);
                                                    setShowReactionPicker(false);
                                                }}
                                                className={`h-10 rounded-xl border text-xl transition-colors ${myReaction === emoji ? 'bg-brand-100 border-brand-300' : 'border-border hover:bg-accent'}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    {/*<div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customReaction}
                                            onChange={(e) => setCustomReaction(e.target.value)}
                                            placeholder="Use any emoji"
                                            className="flex-1 h-10 rounded-xl border border-border px-3 text-sm"
                                            maxLength={16}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCustomReaction}
                                            className="h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700"
                                        >
                                            Set
                                        </button>
                                    </div>*/}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Comments Section */}
                {canShowComments && (
                    <div id="comments-section" className="px-5 pb-6">
                        {isLocked ? (
                            <div className="py-12 text-center">
                                <div className="h-14 w-14 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Unlock className="h-7 w-7 text-muted-foreground/60" />
                                </div>
                                <p className="text-muted-foreground text-sm font-bold uppercase tracking-tight">Maoni yamefungwa</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">Fungua post hii kuona na kuandika maoni.</p>
                            </div>
                        ) : loadingComments ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inapakia maoni...</p>
                            </div>
                        ) : comments.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                {comments.map(c => (
                                    <CommentItem
                                        key={c.id}
                                        comment={c}
                                        onReply={(cmt) => {
                                            if (readOnly) return;
                                            setReplyingTo(cmt);
                                            const entry = document.getElementById('comment-input');
                                            entry?.focus();
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MessageCircle className="h-8 w-8 text-muted/40" />
                                </div>
                                <p className="text-muted-foreground text-sm font-bold uppercase tracking-tight">Hakuna maoni bado</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Kuwa wa kwanza kutoa maoni yako...</p>
                            </div>
                        )}

                        {!isLocked && canShowComments && commentsNextUrl && (
                            <div ref={commentsLoadMoreRef} className="h-10 flex items-center justify-center">
                                {loadingMoreComments && (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sticky Comment Area */}
            {!readOnly && !isLocked && commentsEnabled && !isDeleted && (
                <div className="fixed bottom-0 inset-x-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border p-4 pb-safe-offset-4">
                    <div className="max-w-2xl mx-auto">
                        <AnimatePresence>
                            {replyingTo && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mb-3 px-4 py-2 bg-brand-50 rounded-xl flex items-center justify-between text-xs overflow-hidden border border-brand-100"
                                >
                                    <p className="truncate text-brand-900 font-medium">
                                        Unamjibu <span className="font-black text-brand-600">@{replyingTo.user.name}</span>
                                    </p>
                                    <button onClick={() => setReplyingTo(null)} className="font-black text-brand-600 uppercase tracking-tighter hover:text-brand-700">Ghairi</button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-accent border border-border flex items-center justify-center text-muted-foreground shadow-sm shrink-0">
                                <User className="h-5 w-5" />
                            </div>
                            <div className="flex-1 flex items-center gap-3 bg-accent/50 rounded-2xl px-4 py-2.5 border border-border focus-within:border-brand-400 focus-within:bg-background transition-all shadow-sm">
                                <input
                                    id="comment-input"
                                    type="text"
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                                    placeholder={replyingTo ? "Andika jibu lako..." : "Andika maoni yako..."}
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground h-7 font-medium"
                                />
                                <button
                                    onClick={handleSendComment}
                                    disabled={submitting || !commentText.trim()}
                                    className="h-10 w-10 flex items-center justify-center bg-brand-600 rounded-full text-white shadow-lg disabled:opacity-30 disabled:shadow-none hover:bg-brand-700 transition-all active:scale-90"
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </LayoutComponent>
    );
}
