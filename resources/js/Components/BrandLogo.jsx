import React from 'react';
import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';

export default function BrandLogo({
    href = '/',
    label = 'Takeer',
    subtitle = '',
    compact = false,
    className = '',
}) {
    const content = (
        <>
            <img
                src="/logo.png"
                alt=""
                aria-hidden="true"
                className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_6px_12px_rgba(207,62,35,0.16)]"
            />
            {!compact && (
                <span className="min-w-0">
                    <span className="block truncate text-base font-black leading-none tracking-[-0.035em] text-foreground">
                        {label}
                    </span>
                    {subtitle && (
                        <span className="mt-1.5 block truncate text-[8px] font-bold uppercase tracking-[0.2em] text-brand-600">
                            {subtitle}
                        </span>
                    )}
                </span>
            )}
        </>
    );

    return (
        <Link
            href={href}
            aria-label={compact ? label : undefined}
            className={cn('inline-flex min-w-0 items-center gap-2.5', className)}
        >
            {content}
        </Link>
    );
}
