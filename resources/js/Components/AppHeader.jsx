import React from 'react';
import { usePage } from '@inertiajs/react';
import BrandLogo from '@/Components/BrandLogo';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import SocialBuyLink from '@/Components/SocialBuyLink';

export default function AppHeader() {
    const { url } = usePage();
    const isHomepage = url === '/' || (typeof window !== 'undefined' && window.location.pathname === '/');

    return (
        <header className="safe-top sticky top-0 z-40 border-b border-white/80 bg-white/82 shadow-[0_8px_30px_-24px_rgba(73,32,20,0.52)] backdrop-blur-2xl">
            <div className="mx-auto flex min-h-[4.5rem] w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <BrandLogo subtitle="Social commerce" className="shrink-0" />
                {isHomepage && (
                    <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
                        <SocialBuyLink className="w-full max-w-[560px]" />
                    </div>
                )}
                <LanguageSwitcher compact className="shrink-0" />
            </div>
            {isHomepage && (
                <div className="border-t border-border/60 bg-background/35 px-4 py-2.5 lg:hidden">
                    <div className="mx-auto max-w-xl">
                        <SocialBuyLink className="w-full" />
                    </div>
                </div>
            )}
        </header>
    );
}
