import React from 'react';
import { Link } from '@inertiajs/react';
import { ArrowRight, Globe2, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

export default function SocialBuyLink({ className = '', compact = false }) {
    const { copy } = useLocale();

    return (
        <Link
            href="/buy-from-social-media"
            aria-label={copy('Buy safely from online sellers', 'Nunua kwa wauzaji wa mtandaoni kwa usalama')}
            className={cn(
                'group inline-flex min-w-0 items-center gap-2.5',
                compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
                className,
            )}
        >
            <SocialPlatformMarks />
            <span className="min-w-0 flex-1">
                <span className={cn('block truncate font-black text-slate-950', compact ? 'text-xs' : 'text-sm')}>
                    {compact ? copy('Buy safely', 'Nunua kwa usalama') : copy('Buy from online sellers', 'Nunua kwa wauzaji wa mtandaoni')}
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-bold text-brand-700">
                    {compact ? copy('Code or link', 'Namba au link') : copy('Safely through Takeer', 'Kwa usalama kupitia Takeer')}
                </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}

export function SocialPlatformMarks() {
    return (
        <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-600 text-white ring-2 ring-brand-50">
                <Globe2 className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white ring-2 ring-brand-50">
                <ShoppingBag className="h-4 w-4" />
            </span>
        </span>
    );
}
