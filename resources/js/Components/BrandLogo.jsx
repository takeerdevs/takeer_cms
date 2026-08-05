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
                src="/images/brand/takeer-mark.svg"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 shrink-0"
            />
            {!compact && (
                <span className="min-w-0">
                    <span className="block truncate text-sm font-black leading-none tracking-tight text-foreground">
                        {label}
                    </span>
                    {subtitle && (
                        <span className="mt-1 block truncate text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
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
