import React from 'react';
import { Link } from '@inertiajs/react';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';
import BrandLogo from '@/Components/BrandLogo';
import LanguageSwitcher from '@/Components/LanguageSwitcher';

export default function AppHeader({ onSearch }) {
    const { t } = useLocale();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const navItems = [
        { href: '/', label: t('nav.feed'), icon: Home },
        { label: t('nav.search'), icon: Search, onClick: onSearch },
        { href: '/orders', label: t('nav.orders'), icon: ShoppingBag },
        { href: '/profile', label: t('nav.me'), icon: User },
    ];

    return (
        <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-background/88 backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <BrandLogo className="shrink-0" />

                <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.label', {}, 'Main navigation')}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = item.href && currentPath === item.href;
                        const className = cn(
                            'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition-colors',
                            active
                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        );

                        if (item.onClick) {
                            return (
                                <button key={item.label} type="button" onClick={item.onClick} className={className}>
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </button>
                            );
                        }

                        return (
                            <Link key={item.href} href={item.href} className={className}>
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <LanguageSwitcher compact className="shrink-0" />
            </div>
        </header>
    );
}
