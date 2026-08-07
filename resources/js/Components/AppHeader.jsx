import React from 'react';
import { usePage } from '@inertiajs/react';
import BrandLogo from '@/Components/BrandLogo';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import SocialBuyLink from '@/Components/SocialBuyLink';

export default function AppHeader() {
    const { url } = usePage();
    const isHomepage = url === '/' || (typeof window !== 'undefined' && window.location.pathname === '/');

    return (
        <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-background/88 backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <BrandLogo className="shrink-0" />
                {isHomepage && (
                    <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
                        <SocialBuyLink className="w-full max-w-[560px]" />
                    </div>
                )}
                <LanguageSwitcher compact className="shrink-0" />
            </div>
            {isHomepage && (
                <div className="border-t border-border/50 px-4 py-2.5 lg:hidden">
                    <div className="mx-auto max-w-xl">
                        <SocialBuyLink className="w-full" />
                    </div>
                </div>
            )}
        </header>
    );
}
