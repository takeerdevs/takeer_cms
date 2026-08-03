import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Bell, Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function FollowStoreButton({
    merchantSlug,
    initialFollowing = false,
    initialCount = 0,
    isOwner = false,
    variant = 'default',
    className = '',
    showCount = true,
    labelFollow = null,
    labelFollowing = null,
}) {
    const { t } = useLocale();
    const { auth } = usePage().props;
    const [isFollowing, setIsFollowing] = useState(Boolean(initialFollowing));
    const [followersCount, setFollowersCount] = useState(Number(initialCount || 0));
    const [ownedByViewer, setOwnedByViewer] = useState(Boolean(isOwner));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!auth?.user || !merchantSlug || isOwner) return undefined;

        let cancelled = false;
        axios.get(`/api/merchant/${merchantSlug}/follow`)
            .then((response) => {
                if (cancelled) return;
                setIsFollowing(Boolean(response.data?.is_following));
                setFollowersCount(Number(response.data?.followers_count || 0));
                setOwnedByViewer(Boolean(response.data?.is_owner));
            })
            .catch(() => { });

        return () => {
            cancelled = true;
        };
    }, [auth?.user, merchantSlug, isOwner]);

    if (ownedByViewer || !merchantSlug) return null;

    const toggleFollow = async () => {
        if (!auth?.user) {
            router.visit('/login');
            return;
        }

        setLoading(true);
        try {
            const response = isFollowing
                ? await axios.delete(`/api/merchant/${merchantSlug}/follow`)
                : await axios.post(`/api/merchant/${merchantSlug}/follow`);

            setIsFollowing(Boolean(response.data?.is_following));
            setFollowersCount(Number(response.data?.followers_count || 0));
            toast.success(isFollowing ? t('sharedUi.storeUnfollowed') : t('sharedUi.storeFollowed'));
        } catch (error) {
            toast.error(error.response?.data?.message || t('sharedUi.followFailed'));
        } finally {
            setLoading(false);
        }
    };

    if (variant === 'avatar') {
        return (
            <button
                type="button"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFollow();
                }}
                disabled={loading}
                title={isFollowing ? t('sharedUi.followingStore') : t('sharedUi.followStore')}
                aria-label={isFollowing ? t('sharedUi.followingStore') : t('sharedUi.followStore')}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-70 ${isFollowing ? 'bg-neutral-900' : 'bg-brand-600'} ${className}`}
            >
                {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFollowing ? (
                    <Check className="h-3.5 w-3.5" />
                ) : (
                    <Plus className="h-4 w-4" strokeWidth={3} />
                )}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggleFollow}
            disabled={loading}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${isFollowing
                ? 'border-neutral-200 bg-white text-foreground hover:bg-neutral-50'
                : 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
                } ${className}`}
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Bell className="h-4 w-4" />
            )}
            <span>{isFollowing ? (labelFollowing || t('sharedUi.followingStore')) : (labelFollow || t('sharedUi.followStore'))}</span>
            {showCount && followersCount > 0 && (
                <span className={isFollowing ? 'text-muted-foreground' : 'text-white/80'}>
                    {formatFollowerCount(followersCount)}
                </span>
            )}
        </button>
    );
}

function formatFollowerCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
}
