import React from 'react';
import { Link } from '@inertiajs/react';
import { MapPin, Store, BadgeCheck } from 'lucide-react';

export default function MerchantSearchCard({ merchant }) {
    if (!merchant) return null;

    const success = Number(merchant.successful_sales || 0);
    const failed = Number(merchant.unsuccessful_sales || 0);
    const totalRated = success + failed;
    const trust = totalRated > 0 ? Math.round((success / totalRated) * 100) : null;

    return (
        <div className="p-4 bg-gradient-to-b from-background to-accent/20">
            <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-brand-100 border border-border/60 shrink-0">
                    {merchant.avatar_url ? (
                        <img src={merchant.avatar_url} alt={merchant.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-700 font-black">
                            {(merchant.name || 'M').charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-base text-foreground truncate">{merchant.name}</p>
                        {merchant.is_verified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                                <BadgeCheck className="h-3 w-3" /> Verified
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">@{merchant.username}</p>
                    {merchant.bio && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{merchant.bio}</p>}

                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-accent/70">{merchant.products_count} bidhaa</span>
                        <span className="px-2 py-0.5 rounded-full bg-accent/70">{merchant.posts_count} posts</span>
                        <span className="px-2 py-0.5 rounded-full bg-accent/70">{trust === null ? 'No trust data' : `${trust}% trust`}</span>
                    </div>

                    {merchant.primary_location && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">
                                {merchant.primary_location.name || 'Location'}
                                {merchant.primary_location.city ? `, ${merchant.primary_location.city}` : ''}
                                {merchant.primary_location.region ? `, ${merchant.primary_location.region}` : ''}
                                {(merchant.location_extra_count || 0) > 0 ? ` +${merchant.location_extra_count}` : ''}
                            </span>
                        </div>
                    )}

                    <Link
                        href={merchant.store_url || `/m/${merchant.username}`}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-3 py-2 text-sm font-bold"
                    >
                        <Store className="h-4 w-4" />
                        Tembelea Biashara
                    </Link>
                </div>
            </div>
        </div>
    );
}
