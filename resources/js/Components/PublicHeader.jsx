import React from 'react';
import { cn } from '@/lib/utils';
import BrandLogo from '@/Components/BrandLogo';
import LanguageSwitcher from '@/Components/LanguageSwitcher';

export default function PublicHeader({ children, className = '' }) {
    return (
        <header className={cn('safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl', className)}>
            <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
                <BrandLogo className="shrink-0" />
                <div className="flex min-w-0 items-center justify-end gap-2">
                    {children}
                    <LanguageSwitcher compact className="shrink-0" />
                </div>
            </div>
        </header>
    );
}
