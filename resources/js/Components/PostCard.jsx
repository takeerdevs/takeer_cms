import React, { useMemo, useState, useEffect } from 'react';
import { MessageCircle, MoreHorizontal, ShoppingBag, Clock, BadgeCheck, Crown, Unlock, Lock, X, Boxes, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link, router, usePage } from '@inertiajs/react';
import PostManagementMenu from './PostManagementMenu';
import MediaGrid from './MediaGrid';
import LinkifiedText from './LinkifiedText';
import { getShortPostPresentation } from '@/lib/shortPostStyles';
import { toast } from 'sonner';
import axios from 'axios';

const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return 'Sasa hivi';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
};

export default function PostCard({ post, readOnly = false, detailHref = null }) {
    const { auth } = usePage().props;
    const [reactionSummary, setReactionSummary] = useState(post.reaction_summary || []);
    const [myReaction, setMyReaction] = useState(post.my_reaction || null);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [localPost, setLocalPost] = useState(post);
    const [isUnlocking, setIsUnlocking] = useState(false);

    // Listen for payment unlock events
    useEffect(() => {
        const handleUnlocking = (e) => {
            const unlockType = localPost.unlock_item_type || 'post';
            const unlockId = localPost.unlock_item_id || localPost.id;
            const matchesType = e.detail?.itemType === unlockType;
            const matchesId = String(e.detail?.itemId) === String(unlockId);
            if (matchesType && matchesId) setIsUnlocking(true);
        };

        const handleUnlocked = async (e) => {
            const unlockType = localPost.unlock_item_type || 'post';
            const unlockId = localPost.unlock_item_id || localPost.id;
            const matchesType = e.detail?.itemType === unlockType;
            const matchesId = String(e.detail?.itemId) === String(unlockId);
            if (!matchesType || !matchesId) return;

            // Refetch the post with fresh access
            try {
                const routeKey = localPost.public_id ?? localPost.id;
                const res = await fetch(`/api/pwa/post/${routeKey}`, {
                    headers: { Accept: 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.post) setLocalPost(data.post);
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
    }, [localPost.id, localPost.public_id]);

    // Use localPost (updated after unlock) for rendering
    const postData = localPost;

    const postRouteKey = postData.public_id ?? postData.id;
    const mediaItems = postData.images?.length
        ? postData.images
        : postData.media?.length
            ? postData.media.map((item) => item?.url).filter(Boolean)
            : postData.media_url ? [postData.media_url] : [];
    const isText = postData.media_type === 'text' && mediaItems.length === 0;

    const hasAccess = postData.has_access ?? true;
    const isRestricted = postData.is_restricted ?? false;
    const isLocked = isRestricted && !hasAccess;
    const commentsEnabled = postData.comments_enabled ?? true;
    const reactionsEnabled = postData.reactions_enabled ?? true;
    const canUseReactions = reactionsEnabled && hasAccess;
    const shouldShowLockedReactionPreview = reactionsEnabled && !hasAccess;
    const postType = postData.post_type || (postData.body || postData.excerpt ? 'long' : 'short');
    const isLongForm = postType === 'long';
    const promotables = Array.isArray(postData.promotables) ? postData.promotables : [];
    const hasMultiplePromotables = promotables.length > 1;
    const firstPromotable = promotables[0] || null;
    const promotableType = firstPromotable?.type || null;
    const promotableItem = firstPromotable?.item || null;
    const isSubscriptionPromotable = promotableType === 'subscription_plan' && Boolean(promotableItem?.slug || firstPromotable?.id);
    const subscriptionRouteKey = promotableItem?.slug || firstPromotable?.id;
    const subscriptionItemsCount = Number(promotableItem?.items_count || 0);
    const subscriptionCadence = `${promotableItem?.interval_count || 1} ${promotableItem?.billing_interval || 'month'}`;
    const promotableBundleRouteKey = promotableItem?.slug || firstPromotable?.id;
    const isBundlePromotable = promotableType === 'bundle' && Boolean(promotableBundleRouteKey);
    const bundleItems = Array.isArray(promotableItem?.bundle_items) ? promotableItem.bundle_items : [];
    const courseModules = Array.isArray(promotableItem?.course_modules) ? promotableItem.course_modules : [];
    const isCourseBundle = Boolean(promotableItem?.is_course);
    const shouldShowBundleItemsGrid = isBundlePromotable && bundleItems.length > 0;
    const hasBundlePrice = Number(promotableItem?.price || 0) > 0;
    const bundleItemsCount = courseModules.length > 0
        ? courseModules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0)
        : Number(promotableItem?.items_count ?? promotableItem?.items?.length ?? 0);
    const courseModuleGroups = useMemo(() => {
        if (!isCourseBundle) return [];
        if (courseModules.length > 0) return courseModules;
        const groups = [];
        bundleItems.forEach((item) => {
            const title = item.section_title || 'Moduli';
            let group = groups.find((entry) => entry.title === title);
            if (!group) {
                group = { title, lessons: [] };
                groups.push(group);
            }
            group.lessons.push(item);
        });
        return groups;
    }, [bundleItems, courseModules, isCourseBundle]);
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
    const hasSingleUnlockOption = isRestricted && postData.restricted_price !== null;
    const hasPromotableOption = isRestricted && Boolean(firstPromotable?.id && promotableType);
    const singleUnlockPrice = Number(postData.restricted_price || 0);
    const shouldShowPremiumCtas = isLocked && (hasSingleUnlockOption || hasPromotableOption);

    const attachedProduct = postData.product || postData.product_tags?.[0]?.product || null;
    const shouldShowOpenCta = !isLocked && isLongForm && !attachedProduct && !isBundlePromotable && !isSubscriptionPromotable;
    const productRouteKey = attachedProduct?.slug || attachedProduct?.id;
    const attachedProductVariants = ((attachedProduct?.variants || []).filter((variant) => (
        variant?.is_active !== false
    )));
    const hasVariantPricing = Boolean(attachedProduct?.has_variants && attachedProductVariants.length > 0);
    const variantPrices = attachedProductVariants
        .map((variant) => Number(variant?.price))
        .filter((value) => Number.isFinite(value));
    const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
    const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
    const variantPriceLabel = minVariantPrice === maxVariantPrice
        ? `TZS ${minVariantPrice.toLocaleString()}`
        : `TZS ${minVariantPrice.toLocaleString()} - ${maxVariantPrice.toLocaleString()}`;
    const attachedProductIsService = attachedProduct?.type === 'service';
    const attachedServiceTrust = attachedProductIsService ? (attachedProduct?.service_trust || {}) : {};
    const attachedServiceTrustReady = Boolean(attachedServiceTrust.trust_ready);
    const attachedServiceCredentialOk = !attachedServiceTrust.credential_required || Boolean(attachedServiceTrust.credential_verified);
    const attachedProductServiceMode = attachedProduct?.service_mode || (
        attachedProduct?.service_is_showcase || attachedProduct?.service_pricing_model === 'showcase_only'
            ? 'showcase_only'
            : attachedProduct?.service_pricing_model === 'contract_quote'
                ? 'request_quote'
                : 'pay_now'
    );
    const attachedProductPriceDisplay = attachedProduct?.service_price_display || (
        attachedProduct?.service_pricing_model === 'hourly_rate'
            ? 'hourly'
            : attachedProduct?.service_pricing_model === 'contract_quote'
                ? 'quote_only'
                : 'fixed'
    );
    const serviceUnitLabels = {
        hourly: ' / hour',
        daily: ' / day',
        nightly: ' / night',
        weekly: ' / week',
        monthly: ' / month',
        yearly: ' / year',
        per_person: ' / person',
        per_visit: ' / visit',
        per_session: ' / session',
        per_project: ' / project',
    };
    const attachedProductPrice = Number(attachedProduct?.discounted_price > 0 ? attachedProduct.discounted_price : attachedProduct?.price || 0);
    const attachedProductPriceLabel = (() => {
        if (!attachedProductIsService) return `TZS ${attachedProductPrice.toLocaleString()}`;
        if (attachedProductPriceDisplay === 'hidden' || attachedProductServiceMode === 'showcase_only') return 'Contact provider';
        if (attachedProductPriceDisplay === 'quote_only' || attachedProductServiceMode === 'request_quote') return 'Quote after request';
        if (attachedProductPriceDisplay === 'starts_from') return `From TZS ${attachedProductPrice.toLocaleString()}`;
        if (attachedProductPriceDisplay === 'package') return `TZS ${attachedProductPrice.toLocaleString()} package`;
        return `TZS ${attachedProductPrice.toLocaleString()}${serviceUnitLabels[attachedProductPriceDisplay] || ''}`;
    })();
    const attachedProductCtaLabel = readOnly
        ? 'View'
        : attachedProduct?.has_access
            ? 'Fungua'
            : attachedProductIsService
                ? (attachedProductServiceMode === 'book_appointment' ? 'Book' : 'View Service')
                : 'Nunua';
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
    const hasMedia = mediaItems.length > 0;
    const shortPresentation = getShortPostPresentation({
        text: postData.caption || '',
        bgStyle: postData.bg_style,
        hasMedia,
    });
    const feedSummaryText = String(((isBundlePromotable || isSubscriptionPromotable) ? (promotableItem?.description || postData.excerpt) : (postData.excerpt || postData.caption)) || '')
        .replace(/\s+/g, ' ')
        .trim();

    const goToPostDetails = () => {
        if (detailHref) {
            router.visit(detailHref);
            return;
        }
        router.visit(route('post.show', postRouteKey));
    };

    const openCheckout = ({ id, title, price, checkoutType }) => {
        if (!window.__openCheckout) return;
        window.__openCheckout({
            id,
            title,
            price,
            checkoutType,
            merchant: postData.merchant || null,
        });
    };

    const handleSingleUnlockClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        openCheckout({
            id: postData.unlock_item_id || postData.id,
            title: postData.title || 'Locked content',
            price: singleUnlockPrice,
            checkoutType: postData.unlock_item_type || 'post',
        });
    };

    const handlePromotableUnlockClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!hasPromotableOption) return;

        if (hasMultiplePromotables) {
            goToPostDetails();
            return;
        }

        // Navigate to the promotable's detail page instead of opening checkout directly
        const routeKey = promotableItem?.slug || firstPromotable?.id;
        if (promotableType === 'subscription_plan') {
            router.visit(`/plan/${routeKey}`);
        } else if (promotableType === 'bundle') {
            router.visit(`/bundle/${routeKey}`);
        } else if (firstPromotable?.id) {
            openCheckout({
                id: firstPromotable.id,
                title: promotableItem?.name || promotableItem?.title || postData.title || 'Premium access',
                price: Number(promotableItem?.price || 0),
                checkoutType: promotableType,
            });
        }
    };

    const reactionPickerEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👋', '🔥', '👏', '🎉', '💯', '🤝', '👌', '😍', '🤔', '🥹', '💔', '😡', '😴', '🌟', '✅', '💪', '🫶', '🙌'];
    const defaultPreviewReactions = ['👍', '❤️', '🔥'];
    const sortedReactions = useMemo(() => (
        [...reactionSummary].sort((a, b) => (b.count || 0) - (a.count || 0))
    ), [reactionSummary]);
    const topReactionChips = useMemo(() => {
        if (sortedReactions.length > 0) return sortedReactions.slice(0, 3);
        return defaultPreviewReactions.map((emoji) => ({ emoji, count: 0 }));
    }, [sortedReactions]);

    const handleReact = async (emoji) => {
        if (readOnly || !canUseReactions) return;

        const prevReaction = myReaction;
        const next = prevReaction === emoji ? null : emoji;
        setMyReaction(next);

        try {
            const res = await axios.post(`/posts/${postData.id}/react`, { emoji: next });
            setMyReaction(res.data?.my_reaction || null);
            setReactionSummary(res.data?.reaction_summary || []);
        } catch (e) {
            setMyReaction(prevReaction);
            toast.error(e.response?.data?.message || 'Imeshindwa kuweka reaction.');
        }
    };

    return (
        <article className="bg-card border-b border-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <Link
                    href={`/m/${postData.merchant_profile?.username || postData.merchant?.username || postData.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                    className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm border-2 border-background shadow-sm overflow-hidden hover:opacity-90 transition-opacity"
                >
                    {postData.merchant_profile?.avatar_url ? (
                        <img src={postData.merchant_profile.avatar_url} className="h-full w-full object-cover" alt="" />
                    ) : (
                        (postData.merchant_profile?.display_name || postData.merchant?.name || 'T').charAt(0).toUpperCase()
                    )}
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="flex items-center gap-1 max-w-full">
                            <Link
                                href={`/m/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                                className="font-bold text-sm text-foreground leading-none truncate hover:text-brand-600 transition-colors"
                            >
                                {post.merchant_profile?.display_name || post.merchant?.name}
                            </Link>
                            {post.merchant_profile?.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                        </div>
                    </div>
                    <Link
                        href={`/m/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                        className="text-[10px] text-muted-foreground mt-0.5 truncate block hover:text-brand-600 transition-colors"
                    >
                        @{post.merchant_profile?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}
                    </Link>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                </div>
                {!readOnly && (
                    <PostManagementMenu
                        post={post}
                        isOwner={auth?.user?.id === post.merchant_id}
                        canReport={Boolean(auth?.user?.id && (post.has_access ?? true))}
                    />
                )}
            </div>

            <div className="px-4 pb-3 space-y-3 cursor-pointer" onClick={goToPostDetails}>
                {isLongForm && postData.title && (
                    <h2 className="text-[1.85rem] font-[900] leading-[1.15] tracking-[-0.02em] text-foreground">
                        {postData.title}
                    </h2>
                )}
                {!isLongForm && isRestricted && postData.title && (
                    <h3 className="text-xl font-bold leading-tight text-foreground">
                        {postData.title}
                    </h3>
                )}

                {(postData.excerpt || postData.caption) && (
                    <div className={isLongForm ? 'text-[14px] leading-[1.5] text-foreground/80 font-medium line-clamp-3' : `${shortPresentation.textClass} leading-[1.4] line-clamp-3`}>
                        <LinkifiedText
                            text={feedSummaryText}
                            maxLinkLength={40}
                            stopPropagationOnLinkClick
                            linkClassName="text-brand-600 hover:text-brand-700 underline underline-offset-2 break-all"
                        />
                    </div>
                )}

                {shouldShowOpenCta && (
                    <div className="pt-1 flex justify-center">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                goToPostDetails();
                            }}
                            className="inline-flex items-center justify-center min-w-32 px-8 py-2 rounded-full border-[1.5px] border-foreground text-foreground font-bold text-base hover:bg-foreground hover:text-background transition-all"
                        >
                            Open
                        </button>
                    </div>
                )}

                {/* Lock area: spinner during unlock, then CTAs if still locked */}
                {isUnlocking ? (
                    <div className="pt-4 flex flex-col items-center gap-3 py-6 animate-in fade-in">
                        <div className="h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">Inafungua content yako...</p>
                    </div>
                ) : shouldShowPremiumCtas && (
                    <div className="pt-1">
                        <div className="flex items-center justify-center mb-3">
                            <Unlock className="h-10 w-10 text-muted-foreground/60" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            {hasSingleUnlockOption && (
                                <button
                                    onClick={handleSingleUnlockClick}
                                    className="inline-flex items-center justify-center min-w-48 px-5 py-1.5 rounded-full border-[1.5px] border-foreground text-foreground font-medium text-xs hover:bg-foreground hover:text-background transition-all"
                                >
                                    {`Unlock Tsh ${singleUnlockPrice.toLocaleString()}`}
                                </button>
                            )}
                            {hasPromotableOption && (
                                <button
                                    onClick={handlePromotableUnlockClick}
                                    className="inline-flex items-center justify-center min-w-48 px-5 py-1.5 rounded-full border-[1.5px] border-foreground text-foreground font-medium text-xs hover:bg-foreground hover:text-background transition-all"
                                >
                                    {hasMultiplePromotables 
                                        ? `Unlock Options` 
                                        : promotableType === 'subscription_plan'
                                            ? `Subscribe ${(promotableItem?.name || promotableItem?.title || 'Plan')}: Tsh ${Number(promotableItem?.price || 0).toLocaleString()}`
                                            : `Join ${(promotableItem?.title || 'Bundle')}: Tsh ${Number(promotableItem?.price || 0).toLocaleString()}`
                                    }
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isText && shortPresentation.hasBg && !isLocked && (
                <div
                    onClick={goToPostDetails}
                    className="mx-0 flex items-center justify-center py-10 no-underline px-8 min-h-[260px] cursor-pointer"
                    style={{ background: shortPresentation.bgValue }}
                >
                    <p className={`${shortPresentation.textClass} leading-[1.2] select-none`}>
                        {post.caption}
                    </p>
                </div>
            )}

            {!isText && mediaItems.length > 0 && !isLocked && (
                <div className="px-0 cursor-pointer space-y-3" onClick={goToPostDetails}>
                    {post.product?.description && (
                        <div className="px-4 pb-1">
                            <p className="text-[13px] text-muted-foreground leading-relaxed italic border-l-2 border-brand-500/30 pl-3">
                                {post.product.description}
                            </p>
                        </div>
                    )}
                    <MediaGrid items={mediaItems} onTap={goToPostDetails} />
                </div>
            )}

            {attachedProduct && (
                <div className="my-1 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-white to-brand-50/40 dark:border-brand-900/50 dark:from-slate-900 dark:to-brand-950/40 overflow-hidden">
                    <Link
                        href={route('product.show', productRouteKey)}
                        className="flex items-center gap-3 px-3.5 pt-3 pb-2 flex-1 min-w-0"
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
                                        {variantPriceLabel}
                                    </p>
                                    <p className="text-[11px] text-slate-600 leading-tight truncate">
                                        {variantAttributeSummary.join(", ")}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="text-brand-600 dark:text-brand-400 font-black text-2xl leading-none">
                                        {attachedProductPriceLabel}
                                    </p>
                                    {attachedProduct.discounted_price > 0 && Number(attachedProduct.discounted_price) < Number(attachedProduct.price) && (
                                        <p className="text-muted-foreground text-sm line-through opacity-70">
                                            TZS {Number(attachedProduct.price).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </Link>
                    {attachedProductIsService && (
                        <div className="mx-3.5 mb-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {attachedServiceTrustReady ? (
                                        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                    )}
                                    <span className="text-xs font-black text-emerald-950 truncate">
                                        {attachedServiceTrustReady ? 'Imekaguliwa na Takeer' : 'Uhakiki unaendelea'}
                                    </span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 shrink-0">
                                    SafePay
                                </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
                                <span>{attachedServiceTrust.identity_verified ? 'KYC' : 'KYC pending'}</span>
                                <span>•</span>
                                <span>{attachedServiceCredentialOk ? 'Leseni OK' : 'Leseni pending'}</span>
                                <span>•</span>
                                <span>{attachedServiceTrust.completed_services_count || 0} completed</span>
                                <span>•</span>
                                <span>{attachedServiceTrust.disputes_count || 0} disputes</span>
                            </div>
                        </div>
                    )}
                    <div className="px-3.5 pb-3">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!productRouteKey) return;
                                
                                if (attachedProduct.type === 'digital') {
                                    if (!attachedProduct.has_access) {
                                        openCheckout({
                                            id: attachedProduct.id,
                                            title: attachedProduct.title,
                                            price: attachedProduct.discounted_price > 0 ? attachedProduct.discounted_price : attachedProduct.price,
                                            checkoutType: 'product'
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
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-500 dark:to-brand-400 text-white text-base font-extrabold hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-brand-500/25"
                        >
                            <ShoppingBag className="h-4 w-4" /> {attachedProductCtaLabel}
                        </button>
                    </div>
                </div>
            )}

            {isSubscriptionPromotable && (
                <div className="my-1 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60">
                    <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                                    <Crown className="h-6 w-6 text-emerald-700" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Subscription</p>
                                    <p className="text-xl font-black leading-tight truncate">{promotableItem?.name || promotableItem?.title || 'Membership'}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">TZS</p>
                                <p className="text-xl font-black text-brand-600">{Number(promotableItem?.price || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Access</p>
                                <p className="mt-1 text-sm font-black">{subscriptionItemsCount > 0 ? `${subscriptionItemsCount} items` : 'Member content'}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Renewal</p>
                                <p className="mt-1 text-sm font-black capitalize">{subscriptionCadence}</p>
                            </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground line-clamp-2">
                            {promotableItem?.description || 'Jiunge kupata maudhui ya wanachama na updates mpya kadri zinavyoongezwa.'}
                        </p>
                    </div>
                    <div className="px-4 pb-4">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.visit(`/plan/${subscriptionRouteKey}`);
                            }}
                            className="w-full h-11 rounded-xl bg-emerald-600 text-white text-base font-extrabold hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                        >
                            <Crown className="h-4 w-4" /> View Membership
                        </button>
                    </div>
                </div>
            )}

            {isBundlePromotable && (
                <div className="my-1 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/40 dark:border-sky-900/50 dark:from-slate-900 dark:to-sky-950/40 overflow-hidden">
                    {isCourseBundle && courseModuleGroups.length > 0 ? (
                        <div className="p-3 space-y-2">
                            <div className="rounded-xl border border-sky-100 bg-white/85 px-3 py-2 dark:border-sky-900/50 dark:bg-slate-900/80">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Course Curriculum</p>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                                    <div className="rounded-lg bg-sky-50 px-2 py-2 dark:bg-sky-950/40">
                                        <p className="text-lg font-black text-sky-900 dark:text-sky-100">{courseModuleGroups.length}</p>
                                        <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">Modules</p>
                                    </div>
                                    <div className="rounded-lg bg-sky-50 px-2 py-2 dark:bg-sky-950/40">
                                        <p className="text-lg font-black text-sky-900 dark:text-sky-100">{bundleItemsCount}</p>
                                        <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">Lessons</p>
                                    </div>
                                </div>
                            </div>
                            {courseModuleGroups.slice(0, 3).map((module, idx) => (
                                <div key={`${module.title}-${idx}`} className="rounded-xl border border-border/70 bg-background px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-black truncate">{module.title}</p>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{module.lessons.length} lessons</span>
                                    </div>
                                    <div className="mt-1 space-y-1">
                                        {module.lessons.slice(0, 2).map((lesson, lessonIdx) => (
                                            <p key={`${lesson.item_type}-${lesson.item_id}-${lessonIdx}`} className="text-xs text-muted-foreground truncate">
                                                {lesson.is_preview ? 'Preview · ' : ''}{lesson.lesson_title || lesson.title}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : shouldShowBundleItemsGrid && (
                        <div className="grid grid-cols-2 gap-1 p-1.5">
                            {bundleItems.slice(0, 6).map((item, idx) => {
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
                                        className="group relative h-44 overflow-hidden rounded-xl border border-white/50 bg-slate-900"
                                    >
                                        {isImageLikeUrl(item?.image_url) ? (
                                            <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-800 to-slate-900">
                                                <Boxes className="h-8 w-8 text-white/80" />
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5">
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
                        className="flex items-center gap-3 px-3.5 pt-3 pb-2 flex-1 min-w-0"
                    >
                        <div className="h-14 w-14 overflow-hidden border border-border/70 dark:border-border/90 bg-background shrink-0 rounded-xl flex items-center justify-center">
                            {promotableItem?.course_cover_image_url ? (
                                <img src={promotableItem.course_cover_image_url} alt={promotableItem?.title || 'Bundle'} className="h-full w-full object-cover" />
                            ) : (
                                <Boxes className="h-6 w-6 text-sky-600" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-[22px] leading-tight text-foreground truncate">{promotableItem?.title || 'Bundle Offer'}</p>
                            {hasBundlePrice && (
                                <p className="text-sky-700 dark:text-sky-300 font-black text-2xl leading-none">
                                    TZS {Number(promotableItem?.price || 0).toLocaleString()}
                                </p>
                            )}
                            <p className="text-[11px] text-slate-600 leading-tight truncate mt-0.5">
                                {isCourseBundle
                                    ? `${courseModuleGroups.length || 1} module(s) • ${bundleItemsCount} lesson(s)`
                                    : (bundleItemsCount > 0 ? `${bundleItemsCount} item(s)` : 'Bundle access')}
                            </p>
                        </div>
                    </Link>
                    <div className="px-3.5 pb-3">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.visit(route('bundle.show', promotableBundleRouteKey));
                            }}
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 dark:from-sky-500 dark:to-cyan-400 text-white text-base font-extrabold hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-500/25"
                        >
                            <Boxes className="h-4 w-4" /> {isCourseBundle ? (readOnly ? 'View Course' : 'Open Course') : (readOnly ? 'View Bundle' : 'Open Bundle')}
                        </button>
                    </div>
                </div>
            )}

            {(commentsEnabled || canUseReactions || shouldShowLockedReactionPreview) && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/50">
                    <div className="min-w-0">
                        {commentsEnabled && (
                            readOnly ? (
                                <button
                                    type="button"
                                    onClick={goToPostDetails}
                                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl hover:bg-accent transition-colors text-muted-foreground w-fit"
                                >
                                    <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
                                    <span className="text-sm font-semibold">{post.comment_count ?? 0}</span>
                                </button>
                            ) : (
                                <Link
                                    href={route('post.show', postRouteKey)}
                                    prefetch
                                    state={{ post }}
                                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl hover:bg-accent transition-colors text-muted-foreground w-fit"
                                >
                                    <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
                                    <span className="text-sm font-semibold">{post.comment_count ?? 0}</span>
                                </Link>
                            )
                        )}
                    </div>

                    {canUseReactions && !readOnly && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {topReactionChips.map((entry) => (
                                <button
                                    key={entry.emoji}
                                    type="button"
                                    onClick={() => handleReact(entry.emoji)}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition-colors border ${myReaction === entry.emoji ? 'bg-brand-100 border-brand-300' : 'bg-background border-border hover:bg-accent'}`}
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
                                className="inline-flex items-center justify-center rounded-full h-8 w-8 border border-border bg-background hover:bg-accent text-muted-foreground"
                                aria-label="More reactions"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {canUseReactions && readOnly && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {topReactionChips.map((entry) => (
                                <div
                                    key={entry.emoji}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm border bg-background border-border text-muted-foreground"
                                >
                                    <span>{entry.emoji}</span>
                                    {entry.count > 0 && (
                                        <span className="text-xs font-black text-muted-foreground">{entry.count}</span>
                                    )}
                                </div>
                            ))}
                            <div
                                className="inline-flex items-center justify-center rounded-full h-8 w-8 border border-border bg-background text-muted-foreground"
                                aria-label="Reactions overview"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </div>
                        </div>
                    )}

                    {shouldShowLockedReactionPreview && (
                        <div className="relative">
                            <div className="flex items-center gap-1.5 opacity-45">
                                {defaultPreviewReactions.map((emoji) => (
                                    <div
                                        key={`locked-preview-${emoji}`}
                                        className="inline-flex items-center justify-center rounded-full h-8 min-w-8 px-2 border border-border bg-muted/70 text-sm"
                                    >
                                        {emoji}
                                    </div>
                                ))}
                                <div className="inline-flex items-center justify-center rounded-full h-8 w-8 border border-border bg-muted/70 text-muted-foreground">
                                    <MoreHorizontal className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="inline-flex items-center gap-1 rounded-full bg-background/95 border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                    <Lock className="h-3 w-3" />
                                    Unlock
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {canUseReactions && showReactionPicker && (
                <div
                    className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowReactionPicker(false)}
                >
                    <div
                        className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                            <h3 className="font-black text-sm uppercase tracking-wider">Choose Reaction</h3>
                            <button
                                type="button"
                                onClick={() => setShowReactionPicker(false)}
                                className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4">
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
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}
