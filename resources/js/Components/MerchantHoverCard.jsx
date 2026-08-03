import { Link } from '@inertiajs/react';
import { BadgeCheck, ShoppingBag } from 'lucide-react';
import FollowStoreButton from './FollowStoreButton';
import { useLocale } from '@/lib/i18n';

export default function MerchantHoverCard({ merchant, align = 'left' }) {
    const { copy } = useLocale();
    const username = merchant?.username || merchant?.slug;
    const displayName = merchant?.display_name || merchant?.name || 'Store';
    const avatarUrl = merchant?.avatar_url;
    const initial = displayName.charAt(0).toUpperCase();
    const profileHref = username ? `/u/${username}` : '#';
    const shopHref = username ? `/u/${username}/shop/all` : '#';

    if (!username) return null;

    return (
        <div
            className={`pointer-events-none absolute top-full z-50 hidden w-[340px] pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 md:block ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-xl shadow-neutral-900/10">
                <div className="flex items-start gap-4">
                    <Link href={profileHref} className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-neutral-500">
                                {initial}
                            </span>
                        )}
                    </Link>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <Link href={profileHref} className="truncate text-xl font-black leading-tight text-foreground hover:text-brand-700">
                                {displayName}
                            </Link>
                            {merchant?.is_verified && <BadgeCheck className="h-5 w-5 shrink-0 text-sky-500" />}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">@{username}</p>
                    </div>
                </div>

                {(merchant?.business_category || merchant?.bio) && (
                    <div className="mt-4 space-y-1">
                        {merchant?.business_category && (
                            <p className="text-sm font-bold text-foreground">{merchant.business_category}</p>
                        )}
                        {merchant?.bio && (
                            <p className="line-clamp-3 whitespace-pre-line text-sm leading-5 text-foreground/85">{merchant.bio}</p>
                        )}
                    </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link
                        href={shopHref}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-black text-white transition-colors hover:bg-neutral-800"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        <span>{copy('Shop', 'Duka')}</span>
                    </Link>
                    <FollowStoreButton
                        merchantSlug={username}
                        initialFollowing={merchant?.is_following}
                        initialCount={merchant?.followers_count}
                        isOwner={merchant?.is_owner}
                        showCount={false}
                        labelFollow={copy('Follow', 'Fuata')}
                        className="h-10 w-full rounded-lg"
                    />
                </div>
            </div>
        </div>
    );
}
