import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Head, Link, usePage, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import AdminLayout from '@/Layouts/AdminLayout';
import { MessageCircle, Send, CornerDownRight, ChevronLeft, Loader2, Share2, MoreHorizontal, ShoppingBag, ShieldCheck, BadgeCheck, Crown, Unlock, X, User, Lock, Boxes, Trash2, Eye, SmilePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ShoppablePin from '@/Components/ShoppablePin';
import PostManagementMenu from '@/Components/PostManagementMenu';
import EditorJsRenderer from '@/Components/EditorJsRenderer';
import LinkifiedText from '@/Components/LinkifiedText';
import LinkPreviewCard from '@/Components/LinkPreviewCard';
import VideoPlayer from '@/Components/VideoPlayer';
import { getShortPostPresentation } from '@/lib/shortPostStyles';
import { trackAttributionEvent } from '@/lib/attribution';
import { useSubscriptionCountdown } from '@/lib/subscriptionCountdown';
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
const quickReactionEmojis = ['👍', '❤️', '🔥'];
const buildRankedReactionEmojis = ({ summary = [], selected = null, fallback = [], limit = null }) => {
    const seen = new Set();
    const ranked = [];
    const push = (emoji) => {
        if (!emoji || seen.has(emoji)) return;
        seen.add(emoji);
        ranked.push(emoji);
    };

    push(selected);
    [...summary]
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .forEach((entry) => push(entry.emoji));
    fallback.forEach(push);

    return limit ? ranked.slice(0, limit) : ranked;
};
const formatCompactCount = (value) => {
    const count = Number(value || 0);
    if (count < 1000) return String(count);
    if (count < 1000000) {
        const formatted = (count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '');
        return `${formatted}K`;
    }
    const formatted = (count / 1000000).toFixed(count >= 10000000 ? 0 : 1).replace(/\.0$/, '');
    return `${formatted}M`;
};
const emptyGuestEngagement = {
    open: false,
    step: 'identity',
    action: 'comment',
    text: '',
    emoji: '',
    parentId: null,
    name: '',
    phone: '',
    otp: '',
    sending: false,
    verifying: false,
    error: '',
};
const moderationReasons = [
    { value: 'spam', label: 'Spam or repetitive content' },
    { value: 'scam', label: 'Misleading or scam activity' },
    { value: 'misleading', label: 'Misleading content' },
    { value: 'harassment', label: 'Harassment or abusive content' },
    { value: 'copyright', label: 'Copyright or stolen content' },
    { value: 'adult_content', label: 'Adult or explicit content' },
    { value: 'policy_violation', label: 'Takeer policy violation' },
    { value: 'other', label: 'Other policy reason' },
];

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

export default function PostDetail({ post: initialPost, initialComments, readOnly = false, adminMode = false, backHref = null }) {
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
    const [portalReady, setPortalReady] = useState(false);
    const [customReaction, setCustomReaction] = useState('');
    const [commentsNextUrl, setCommentsNextUrl] = useState(null);
    const [loadingMoreComments, setLoadingMoreComments] = useState(false);
    const commentsLoadMoreRef = useRef(null);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [adminAction, setAdminAction] = useState(null);
    const [showAdminRemoveModal, setShowAdminRemoveModal] = useState(false);
    const [moderationReason, setModerationReason] = useState('policy_violation');
    const [moderationPublicReason, setModerationPublicReason] = useState('Takeer policy violation');
    const [moderationInternalNote, setModerationInternalNote] = useState('');
    const [showPublicNotice, setShowPublicNotice] = useState(true);
    const [guestUser, setGuestUser] = useState(null);
    const [guestEngagement, setGuestEngagement] = useState(emptyGuestEngagement);
    const isAuthenticated = Boolean(auth?.user || guestUser);

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        if (!showReactionPicker || typeof document === 'undefined') {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [showReactionPicker]);

    useEffect(() => {
        if (!initialPost?.id || readOnly) return;

        trackAttributionEvent('post_view', {
            entity_type: 'post',
            entity_id: initialPost.id,
            merchant_id: initialPost?.merchant?.id || initialPost?.merchant_id || null,
            value: initialPost?.restricted_price || null,
            metadata: {
                public_id: initialPost?.public_id || null,
                is_restricted: Boolean(initialPost?.is_restricted),
            },
        });
    }, [initialPost?.id, readOnly]);

    useEffect(() => {
        if (!window.Echo || !post?.id) return;

        const channel = window.Echo.channel('posts');
        const listener = (event) => {
            if (String(event.post_id) !== String(post.id)) return;

            setPost((current) => ({
                ...current,
                comment_count: event.comment_count ?? current.comment_count,
            }));

            if (Array.isArray(event.reaction_summary)) {
                setReactionSummary(event.reaction_summary);
            }
        };

        channel.listen('.post.engagement.updated', listener);

        return () => {
            channel.stopListening('.post.engagement.updated', listener);
        };
    }, [post?.id]);

    // Listen for unlock events dispatched by CheckoutModal
    useEffect(() => {
        const handleUnlocking = (e) => {
            const unlockType = initialPost.unlock_item_type || 'post';
            const unlockId = initialPost.unlock_item_id || initialPost.id;
            const matchesType = e.detail?.itemType === unlockType;
            const matchesId = String(e.detail?.itemId) === String(unlockId);
            if (matchesType && matchesId) setIsUnlocking(true);
        };

        const handleUnlocked = async (e) => {
            const unlockType = initialPost.unlock_item_type || 'post';
            const unlockId = initialPost.unlock_item_id || initialPost.id;
            const matchesType = e.detail?.itemType === unlockType;
            const matchesId = String(e.detail?.itemId) === String(unlockId);
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
            } catch { }
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
    const isDeleted = post.is_deleted ?? Boolean(post.deleted_at);
    const commentsEnabled = post.comments_enabled ?? true;
    const reactionsEnabled = post.reactions_enabled ?? true;
    const canShowComments = (commentsEnabled || isDeleted) && !post.removed_notice;
    const canShowReactions = (reactionsEnabled || isDeleted) && !post.removed_notice;

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
            if (![401, 403].includes(e.response?.status)) {
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

    const openGuestEngagement = ({ action, text = '', emoji = '', parentId = null }) => {
        setGuestEngagement({
            ...emptyGuestEngagement,
            open: true,
            action,
            text,
            emoji,
            parentId,
        });
    };

    const closeGuestEngagement = () => {
        setGuestEngagement(emptyGuestEngagement);
    };

    const updateGuestEngagement = (changes) => {
        setGuestEngagement((current) => ({ ...current, ...changes, error: changes.error ?? current.error }));
    };

    const sendGuestOtp = async () => {
        if (!guestEngagement.name.trim() || !guestEngagement.phone.trim()) {
            updateGuestEngagement({ error: 'Enter your name and phone number to continue.' });
            return;
        }

        updateGuestEngagement({ sending: true, error: '' });
        try {
            await axios.post('/auth/otp/send', {
                phone_number: guestEngagement.phone.trim(),
            });
            updateGuestEngagement({ sending: false, step: 'otp', error: '' });
        } catch (e) {
            updateGuestEngagement({
                sending: false,
                error: e.response?.data?.message || 'Could not send OTP. Please check the phone number and try again.',
            });
        }
    };

    const completeGuestEngagement = async () => {
        if (!guestEngagement.otp.trim()) {
            updateGuestEngagement({ error: 'Enter the OTP sent to your phone.' });
            return;
        }

        updateGuestEngagement({ verifying: true, error: '' });
        try {
            const res = await axios.post(`/posts/${initialPost.id}/guest-engagement`, {
                name: guestEngagement.name.trim(),
                phone_number: guestEngagement.phone.trim(),
                otp: guestEngagement.otp.trim(),
                action: guestEngagement.action,
                text: guestEngagement.text,
                parent_id: guestEngagement.parentId,
                emoji: guestEngagement.emoji,
            });

            setGuestUser(res.data?.user || { name: guestEngagement.name.trim() });

            if (guestEngagement.action === 'comment') {
                if (guestEngagement.parentId) {
                    fetchComments({ append: false });
                } else if (res.data?.comment) {
                    setComments((prev) => [res.data.comment, ...prev]);
                }
                setCommentText('');
                setReplyingTo(null);
                setPost((prev) => ({
                    ...prev,
                    comment_count: res.data?.comment_count ?? ((prev.comment_count || 0) + 1),
                }));
                toast.success(res.data?.message || 'Your comment has been posted.');
            } else {
                setMyReaction(res.data?.my_reaction || guestEngagement.emoji);
                setReactionSummary(res.data?.reaction_summary || []);
                toast.success(res.data?.message || 'Reaction added.');
            }

            router.reload({ only: ['auth'], preserveScroll: true, preserveState: true });
            closeGuestEngagement();
        } catch (e) {
            updateGuestEngagement({
                verifying: false,
                error: e.response?.data?.message || 'Could not finish this action. Please try again.',
            });
        }
    };

    const handleSendComment = async () => {
        if (readOnly) return;
        if (isDeleted) {
            toast.error('Comments are disabled on deleted content.');
            return;
        }
        if (!commentsEnabled) return;
        if (!commentText.trim()) return;
        if (!isAuthenticated) {
            openGuestEngagement({
                action: 'comment',
                text: commentText.trim(),
                parentId: replyingTo?.id || null,
            });
            return;
        }
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
        if (!isAuthenticated) {
            if (!next) return;
            openGuestEngagement({ action: 'reaction', emoji: next });
            return;
        }
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

    const openAdminRemoveModal = () => {
        const selected = moderationReasons.find((reason) => reason.value === moderationReason);
        setModerationPublicReason(post.moderation?.public_reason || selected?.label || 'Takeer policy violation');
        setShowAdminRemoveModal(true);
    };

    const handleAdminDeletePost = async () => {
        if (!adminMode || isDeleted || adminAction) return;
        const selected = moderationReasons.find((reason) => reason.value === moderationReason);
        const publicReason = moderationPublicReason.trim() || selected?.label || 'Takeer policy violation';

        setAdminAction('delete');
        try {
            const res = await axios.delete(`/admin/api/posts/${post.public_id || post.id}`, {
                data: {
                    reason_code: moderationReason,
                    public_reason: publicReason,
                    internal_note: moderationInternalNote.trim() || null,
                    show_public_notice: showPublicNotice,
                },
            });
            if (res.data?.post) setPost(res.data.post);
            toast.success(res.data?.message || 'Post removed.');
            setShowAdminRemoveModal(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove post.');
        } finally {
            setAdminAction(null);
        }
    };

    const handleAdminRestorePost = async () => {
        if (!adminMode || !isDeleted || adminAction) return;
        if (!window.confirm('Restore this post to public/admin feeds?')) return;

        setAdminAction('restore');
        try {
            const res = await axios.post(`/admin/api/posts/${post.public_id || post.id}/restore`);
            if (res.data?.post) setPost(res.data.post);
            toast.success(res.data?.message || 'Post restored.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to restore post.');
        } finally {
            setAdminAction(null);
        }
    };

    const mediaItems = post.media?.length
        ? post.media.filter(Boolean)
        : post.images?.length
            ? post.images
            : post.media_url ? [{ url: post.media_url, media_type: post.media_type || 'image' }] : [];
    const mediaItemType = (item) => {
        if (typeof item === 'string') return /\.(mp4|mov|webm|ogg)(\?|$)/i.test(item) ? 'video' : 'image';
        return item.media_type || item.type || 'image';
    };
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
    const isSubscriptionPromotable = promotableType === 'subscription_plan' && Boolean(promotableItem?.slug || firstPromotable?.id);
    const subscriptionRouteKey = promotableItem?.slug || firstPromotable?.id;
    const subscriptionMembership = promotableItem?.viewer_subscription || null;
    const hasActiveSubscriptionMembership = Boolean(subscriptionMembership?.current_period_end);
    const subscriptionTimeLeft = useSubscriptionCountdown(subscriptionMembership?.current_period_end);
    const subscriptionEndsLabel = subscriptionMembership?.current_period_end
        ? new Date(subscriptionMembership.current_period_end).toLocaleString('sw-TZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;
    const subscriptionCadence = (() => {
        const interval = promotableItem?.billing_interval || 'monthly';
        const count = Number(promotableItem?.interval_count || 1);
        const labels = {
            hourly: ['Hour', 'Hours'],
            daily: ['Day', 'Days'],
            weekly: ['Week', 'Weeks'],
            monthly: ['Month', 'Months'],
        };
        const [single, plural] = labels[interval] || [interval, `${interval}s`];

        return count <= 1 ? single : `Every ${count} ${plural}`;
    })();
    const hasSingleUnlockOption = isRestricted && post.restricted_price !== null;
    const hasPromotableOption = isRestricted && promotables.length > 0;
    const linkPreview = post.link_preview || null;
    const deletedAtLabel = post.deleted_at
        ? new Date(post.deleted_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null;

    // Bundle Items parsing
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
    const variantPriceLabel = minVariantPrice === maxVariantPrice
        ? `TZS ${minVariantPrice.toLocaleString()}`
        : `TZS ${minVariantPrice.toLocaleString()} - ${maxVariantPrice.toLocaleString()}`;
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
    const attachedProductIsService = attachedProduct?.type === 'service';
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
    const attachedProductPriceLabel = (() => {
        if (!attachedProductIsService) return `TZS ${productDisplayPrice.toLocaleString()}`;
        if (attachedProductPriceDisplay === 'hidden' || attachedProductServiceMode === 'showcase_only') return 'Contact provider';
        if (attachedProductPriceDisplay === 'quote_only' || attachedProductServiceMode === 'request_quote') return 'Quote after request';
        if (attachedProductPriceDisplay === 'starts_from') return `From TZS ${productDisplayPrice.toLocaleString()}`;
        if (attachedProductPriceDisplay === 'package') return `TZS ${productDisplayPrice.toLocaleString()} package`;
        return `TZS ${productDisplayPrice.toLocaleString()}${serviceUnitLabels[attachedProductPriceDisplay] || ''}`;
    })();
    const attachedProductCtaLabel = readOnly
        ? 'View'
        : attachedProduct?.has_access
            ? 'Fungua'
            : attachedProductIsService
                ? (attachedProductServiceMode === 'book_appointment' ? 'Book' : 'View Service')
                : 'Nunua';
    const productHasDiscount = attachedProduct
        ? !attachedProductIsService && Number(attachedProduct.discounted_price) > 0 && Number(attachedProduct.discounted_price) < Number(attachedProduct.price)
        : false;
    const sortedReactions = [...reactionSummary].sort((a, b) => (b.count || 0) - (a.count || 0));
    const reactionCounts = Object.fromEntries((reactionSummary || []).map((entry) => [entry.emoji, Number(entry.count || 0)]));
    const rankedQuickReactionEmojis = buildRankedReactionEmojis({
        summary: reactionSummary,
        selected: myReaction,
        fallback: quickReactionEmojis,
        limit: 3,
    });
    const rankedReactionPickerEmojis = buildRankedReactionEmojis({
        summary: reactionSummary,
        selected: myReaction,
        fallback: reactionPickerEmojis,
    });
    const quickReactionChips = rankedQuickReactionEmojis.map((emoji) => ({
        emoji,
        count: reactionCounts[emoji] || 0,
    }));

    const handleSubscriptionRenewClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        window.__openCheckout?.({
            id: firstPromotable?.id || promotableItem?.id,
            title: promotableItem?.name || promotableItem?.title || 'Membership',
            price: Number(promotableItem?.price || 0),
            checkoutType: 'subscription_plan',
            merchant: post.merchant || null,
        });
    };

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
                                    {variantPriceLabel}
                                </p>
                                <p className="text-[11px] text-slate-600 leading-tight truncate">
                                    {variantAttributeSummary.join(', ')}
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="text-brand-600 dark:text-brand-400 font-black text-2xl leading-none">{attachedProductPriceLabel}</p>
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
                        className="w-full h-10 rounded-lg bg-brand-600 text-white text-sm font-black hover:bg-brand-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                    >
                        <ShoppingBag className="h-4 w-4" /> {attachedProductCtaLabel}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <LayoutComponent {...layoutProps}>
            <Head title={`${post.merchant.name} - Chapisho`} />

            <div className="max-w-[600px] mx-auto pb-40">
                {/* Header Navigation */}
                <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border transition-all">
                    <div className="flex items-center gap-3 h-14">
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
                                href={`/u/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
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

                {adminMode && (
                    <div className={`border-b px-5 py-3 ${isDeleted ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                {isDeleted ? (
                                    <Trash2 className="h-4 w-4 shrink-0" />
                                ) : (
                                    <Eye className="h-4 w-4 shrink-0" />
                                )}
                                <span className="text-xs font-black uppercase tracking-widest">
                                    {isDeleted ? 'Removed post' : 'Live post'}
                                </span>
                                {deletedAtLabel && (
                                    <span className="text-xs font-semibold text-rose-800/80">
                                        Removed {deletedAtLabel}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-bold">
                                {isRestricted && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">
                                        <Lock className="h-3 w-3" />
                                        Restricted
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/80 px-2 py-0.5 text-slate-700">
                                    <MessageCircle className="h-3 w-3" />
                                    {post.comment_count ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/80 px-2 py-0.5 text-slate-700">
                                    <SmilePlus className="h-3 w-3" />
                                    {(reactionSummary || []).reduce((sum, entry) => sum + Number(entry.count || 0), 0)}
                                </span>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {isDeleted ? (
                                <button
                                    type="button"
                                    onClick={handleAdminRestorePost}
                                    disabled={Boolean(adminAction)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                                >
                                    {adminAction === 'restore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                    Restore Post
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={openAdminRemoveModal}
                                    disabled={Boolean(adminAction)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                                >
                                    {adminAction === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    Remove Post
                                </button>
                            )}
                            <Link
                                href={`/admin/merchants/${post.merchant?.id || post.merchant_id}`}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100"
                            >
                                View Merchant
                            </Link>
                        </div>
                    </div>
                )}

                {post.removed_notice && !adminMode && (
                    <div className="mx-5 mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
                        <Trash2 className="mx-auto h-8 w-8 text-rose-600" />
                        <h2 className="mt-3 text-lg font-black text-rose-950">This post was removed</h2>
                        <p className="mt-2 text-sm leading-6 text-rose-800">
                            This post is no longer available because it violated Takeer rules.
                        </p>
                        {post.moderation?.public_reason && (
                            <p className="mt-3 rounded-xl bg-white/40 px-3 py-2 text-sm font-semibold text-rose-900">
                                Reason: {post.moderation.public_reason}
                            </p>
                        )}
                    </div>
                )}

                {/* Merchant Section */}
                <div className={`flex items-center gap-3 px-5 py-6 ${adminMode && isDeleted ? 'bg-rose-50/35' : ''}`}>
                    <Link
                        href={`/u/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
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
                                href={`/u/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
                                className="font-bold text-base text-foreground leading-none truncate font-display hover:text-brand-600 transition-colors"
                            >
                                {post.merchant_profile?.display_name || post.merchant?.name}
                            </Link>
                            {post.merchant_profile?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/u/${post.merchant_profile?.username || post.merchant?.username || post.merchant?.name?.toLowerCase().replace(/\s/g, '_')}`}
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

                {linkPreview && !isLocked && (
                    <div className="px-5 pb-6">
                        <LinkPreviewCard preview={linkPreview} playable />
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
                                                    id: post.unlock_item_id || post.id,
                                                    title: post.title || 'Locked content',
                                                    price: singleUnlockPrice,
                                                    checkoutType: post.unlock_item_type || 'post',
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

                {isSubscriptionPromotable && (
                    <div className="mx-5 mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60">
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                                        <Crown className="h-7 w-7 text-emerald-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Subscription</p>
                                        <p className="text-2xl font-black leading-tight truncate">{promotableItem?.name || promotableItem?.title || 'Membership'}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">TZS</p>
                                    <p className="text-2xl font-black text-brand-600">{Number(promotableItem?.price || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="mt-4">
                                {hasActiveSubscriptionMembership ? (
                                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Membership active</p>
                                        <p className="mt-1 text-lg font-black tabular-nums">{subscriptionTimeLeft}</p>
                                        {subscriptionEndsLabel && (
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">Ends {subscriptionEndsLabel}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Renewal</p>
                                        <p className="mt-1 text-base font-black">{subscriptionCadence}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-5 pb-5">
                            <button
                                onClick={(e) => {
                                    if (hasActiveSubscriptionMembership) {
                                        handleSubscriptionRenewClick(e);
                                        return;
                                    }

                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.visit(`/plan/${subscriptionRouteKey}`);
                                }}
                                className="w-full h-12 rounded-xl bg-emerald-600 text-white text-base font-extrabold hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                            >
                                <Crown className="h-5 w-5" /> {hasActiveSubscriptionMembership ? 'Renew access' : 'View Membership'}
                            </button>
                            {hasActiveSubscriptionMembership && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        router.visit(`/plan/${subscriptionRouteKey}`);
                                    }}
                                    className="mt-2 w-full h-10 rounded-xl border border-emerald-200 bg-white text-sm font-black text-emerald-800 hover:bg-emerald-50 transition-colors"
                                >
                                    Open membership
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Bundle Attachment Card & Grid */}
                {isBundlePromotable && (
                    <div className="mx-5 mb-6 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/40 dark:border-sky-900/50 dark:from-slate-900 dark:to-sky-950/40 overflow-hidden">
                        {isCourseBundle && courseModuleGroups.length > 0 ? (
                            <div className="p-4 space-y-3">
                                <div className="rounded-xl border border-sky-100 bg-white/85 px-4 py-3 dark:border-sky-900/50 dark:bg-slate-900/80">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Course Curriculum</p>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                                        <div className="rounded-lg bg-sky-50 px-3 py-3 dark:bg-sky-950/40">
                                            <p className="text-2xl font-black text-sky-900 dark:text-sky-100">{courseModuleGroups.length}</p>
                                            <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">Modules</p>
                                        </div>
                                        <div className="rounded-lg bg-sky-50 px-3 py-3 dark:bg-sky-950/40">
                                            <p className="text-2xl font-black text-sky-900 dark:text-sky-100">{bundleItemsCount}</p>
                                            <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">Lessons</p>
                                        </div>
                                    </div>
                                </div>
                                {courseModuleGroups.slice(0, 5).map((module, idx) => (
                                    <div key={`${module.title}-${idx}`} className="rounded-xl border border-border/70 bg-background px-4 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-black truncate">{module.title}</p>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{module.lessons.length} lessons</span>
                                        </div>
                                        <div className="mt-2 grid gap-1">
                                            {module.lessons.slice(0, 3).map((lesson, lessonIdx) => (
                                                <p key={`${lesson.item_type}-${lesson.item_id}-${lessonIdx}`} className="text-sm text-muted-foreground truncate">
                                                    {lesson.is_preview ? 'Preview · ' : ''}{lesson.lesson_title || lesson.title}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : shouldShowBundleItemsGrid && (
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
                                    {isCourseBundle
                                        ? `${courseModuleGroups.length || 1} module(s) • ${bundleItemsCount} lesson(s)`
                                        : (bundleItemsCount > 0 ? `${bundleItemsCount} item(s)` : 'Bundle access')}
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
                                <Boxes className="h-5 w-5" /> {isCourseBundle ? (readOnly ? 'View Course' : 'Open Course') : (readOnly ? 'View Bundle' : 'Open Bundle')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Full-Width Image Stack */}
                {!isLocked && mediaItems.length > 0 && (
                    <>
                        <div className="flex flex-col gap-8 scroll-mt-20">
                            {mediaItems.map((img, idx) => {
                                const mediaUrl = typeof img === 'string' ? img : (img.processed_url || img.hls_url || img.url);
                                const mediaType = mediaItemType(img);
                                const isVideo = mediaType === 'video';
                                const isProcessing = isVideo
                                    && typeof img !== 'string'
                                    && ['pending', 'processing'].includes(img.processing_status)
                                    && !img.processed_url
                                    && !img.hls_url;

                                return (
                                    <div key={idx} className="flex flex-col gap-2">
                                        {/* The Media */}
                                        <div className="relative w-full bg-muted overflow-hidden">
                                            {isVideo && isProcessing ? (
                                                <div className="min-h-[320px] bg-zinc-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
                                                    <Loader2 className="h-8 w-8 text-white/70 animate-spin" />
                                                    <div>
                                                        <p className="text-base font-semibold text-white">Processing video...</p>
                                                        <p className="mt-1 text-sm text-white/55">Playback will be ready shortly.</p>
                                                    </div>
                                                </div>
                                            ) : isVideo ? (
                                                <VideoPlayer
                                                    src={typeof img === 'string' ? mediaUrl : img.url}
                                                    processedUrl={typeof img === 'string' ? null : img.processed_url}
                                                    hlsUrl={typeof img === 'string' ? null : img.hls_url}
                                                    poster={typeof img === 'string' ? undefined : img.thumbnail_url || undefined}
                                                    className="w-full h-auto block bg-black"
                                                    autoPlay
                                                    muted
                                                    loop
                                                    controls={false}
                                                    overlayMuteToggle
                                                    playsInline
                                                    preload="metadata"
                                                />
                                            ) : (
                                                <img
                                                    src={mediaUrl}
                                                    className="w-full h-auto block"
                                                    alt={`Post media ${idx + 1}`}
                                                />
                                            )}

                                            {/* Hotspots Overlay */}
                                            {!isVideo && <div className="absolute inset-0 pointer-events-none z-10">
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
                                            </div>}
                                        </div>
                                    </div>
                                );
                            })}
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
                                        {quickReactionChips.map((entry) => (
                                            <button
                                                key={entry.emoji}
                                                type="button"
                                                onClick={() => handleReact(entry.emoji)}
                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition-all border shrink-0 ${myReaction === entry.emoji ? 'bg-brand-100 border-brand-300' : 'bg-background border-border hover:bg-accent'}`}
                                            >
                                                <span>{entry.emoji}</span>
                                                {entry.count > 0 && (
                                                    <span className="text-xs font-black text-muted-foreground">{formatCompactCount(entry.count)}</span>
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
                                            {quickReactionChips.map((entry) => (
                                                <div
                                                    key={`locked-detail-preview-${entry.emoji}`}
                                                    className="inline-flex items-center gap-1 justify-center rounded-full h-8 min-w-8 px-2 border border-border bg-muted/70 text-sm"
                                                >
                                                    <span>{entry.emoji}</span>
                                                    {entry.count > 0 && (
                                                        <span className="text-[10px] font-black text-muted-foreground">{formatCompactCount(entry.count)}</span>
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

                {portalReady && createPortal(
                    <AnimatePresence>
                        {showReactionPicker && !readOnly && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-4"
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
                                            {rankedReactionPickerEmojis.map((emoji) => (
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
                    </AnimatePresence>,
                    document.body
                )}

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

            <AnimatePresence>
                {guestEngagement.open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                        onClick={closeGuestEngagement}
                    >
                        <motion.div
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 24, opacity: 0 }}
                            className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                        {guestEngagement.action === 'comment' ? 'Post your comment' : 'Add your reaction'}
                                    </p>
                                    <h3 className="text-lg font-black tracking-tight">Confirm with phone</h3>
                                </div>
                                <button type="button" onClick={closeGuestEngagement} className="h-9 w-9 rounded-full hover:bg-accent flex items-center justify-center">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="rounded-2xl border border-border bg-accent/40 p-4">
                                    {guestEngagement.action === 'comment' ? (
                                        <>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Your comment</p>
                                            <p className="text-sm font-semibold leading-relaxed text-foreground break-words">
                                                {guestEngagement.text}
                                            </p>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-2xl bg-background border border-border flex items-center justify-center text-2xl">
                                                {guestEngagement.emoji}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your reaction</p>
                                                <p className="text-sm font-bold">Confirm to add this reaction.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {guestEngagement.step === 'identity' ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Name</label>
                                            <input
                                                type="text"
                                                value={guestEngagement.name}
                                                onChange={(e) => updateGuestEngagement({ name: e.target.value, error: '' })}
                                                className="mt-1 w-full h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-brand-400"
                                                placeholder="Your name"
                                                maxLength={80}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Phone number</label>
                                            <input
                                                type="tel"
                                                value={guestEngagement.phone}
                                                onChange={(e) => updateGuestEngagement({ phone: e.target.value, error: '' })}
                                                className="mt-1 w-full h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-brand-400"
                                                placeholder="+255..."
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-brand-900">
                                            <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />
                                            <p className="text-xs font-semibold leading-relaxed">
                                                We sent a 6-digit OTP to <span className="font-black">{guestEngagement.phone}</span>.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">OTP code</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={guestEngagement.otp}
                                                onChange={(e) => updateGuestEngagement({ otp: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
                                                onKeyDown={(e) => e.key === 'Enter' && completeGuestEngagement()}
                                                className="mt-1 w-full h-14 rounded-2xl border border-border bg-background px-4 text-center text-2xl font-black tracking-[0.35em] outline-none focus:border-brand-400"
                                                placeholder="000000"
                                                maxLength={6}
                                            />
                                        </div>
                                    </div>
                                )}

                                {guestEngagement.error && (
                                    <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-red-700">
                                        {guestEngagement.error}
                                    </p>
                                )}

                                <div className="flex items-center gap-3">
                                    {guestEngagement.step === 'otp' && (
                                        <button
                                            type="button"
                                            onClick={() => updateGuestEngagement({ step: 'identity', otp: '', error: '' })}
                                            className="h-12 px-4 rounded-2xl border border-border text-sm font-black hover:bg-accent"
                                        >
                                            Edit
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={guestEngagement.step === 'identity' ? sendGuestOtp : completeGuestEngagement}
                                        disabled={guestEngagement.sending || guestEngagement.verifying}
                                        className="flex-1 h-12 rounded-2xl bg-brand-600 text-white text-sm font-black hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {(guestEngagement.sending || guestEngagement.verifying) && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {guestEngagement.step === 'identity' ? 'Send OTP' : 'Confirm and post'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAdminRemoveModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                        onClick={() => !adminAction && setShowAdminRemoveModal(false)}
                    >
                        <motion.div
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 24, opacity: 0 }}
                            className="w-full max-w-lg rounded-2xl border border-rose-200 bg-background shadow-2xl overflow-hidden"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-rose-900">Remove Post</h3>
                                    <p className="mt-1 text-xs text-muted-foreground">Choose the reason the merchant and public notice should show.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAdminRemoveModal(false)}
                                    disabled={Boolean(adminAction)}
                                    className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center disabled:opacity-50"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reason</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {moderationReasons.map((reason) => (
                                            <button
                                                key={reason.value}
                                                type="button"
                                                onClick={() => {
                                                    setModerationReason(reason.value);
                                                    setModerationPublicReason(reason.label);
                                                }}
                                                className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors ${moderationReason === reason.value ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-border hover:bg-accent'}`}
                                            >
                                                {reason.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground" htmlFor="moderation-public-reason">Public reason</label>
                                    <input
                                        id="moderation-public-reason"
                                        value={moderationPublicReason}
                                        onChange={(event) => setModerationPublicReason(event.target.value)}
                                        className="h-11 w-full rounded-xl border border-border px-3 text-sm"
                                        maxLength={255}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground" htmlFor="moderation-internal-note">Internal note</label>
                                    <textarea
                                        id="moderation-internal-note"
                                        value={moderationInternalNote}
                                        onChange={(event) => setModerationInternalNote(event.target.value)}
                                        className="min-h-[90px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                                        placeholder="Optional admin-only context..."
                                        maxLength={2000}
                                    />
                                </div>
                                <label className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={showPublicNotice}
                                        onChange={(event) => setShowPublicNotice(event.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    Show a removed-post notice on direct public links
                                </label>
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAdminRemoveModal(false)}
                                    disabled={Boolean(adminAction)}
                                    className="h-10 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAdminDeletePost}
                                    disabled={Boolean(adminAction) || !moderationPublicReason.trim()}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-60"
                                >
                                    {adminAction === 'delete' && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Remove Post
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </LayoutComponent>
    );
}
