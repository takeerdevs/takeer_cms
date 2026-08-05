import React, { useRef } from 'react';
import { ImagePlus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';
import BrandLogo from '@/Components/BrandLogo';
import LanguageSwitcher from '@/Components/LanguageSwitcher';

export default function AppHeader({
    onCompose,
    profile = null,
    isAuthenticated = false,
    isCreating = false,
}) {
    const { t } = useLocale();
    const mediaInputRef = useRef(null);

    const handleMediaPicked = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length > 0) {
            onCompose?.({ mode: 'short', mediaFiles: files });
        }
        event.target.value = '';
    };

    const composerPrompt = (mobile = false) => (
        <div className={cn('flex min-w-0 items-center gap-2.5', mobile ? 'w-full' : 'w-full max-w-[560px]')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-300 to-brand-600 text-sm font-black text-white ring-2 ring-white">
                {isAuthenticated && profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                    <Plus className="h-5 w-5" />
                )}
            </div>
            <button
                type="button"
                onClick={() => onCompose?.({ mode: 'short' })}
                disabled={isCreating}
                className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-slate-100 px-4 text-left text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-200/70 disabled:cursor-wait disabled:opacity-70"
            >
                <span className="truncate">{t('feed.composerPrompt')}</span>
            </button>
            <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                disabled={isCreating}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600 disabled:opacity-50"
                aria-label={t('feed.addMedia')}
            >
                <ImagePlus className="h-5 w-5" />
            </button>
        </div>
    );

    return (
        <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-background/88 backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <BrandLogo className="shrink-0" />
                <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
                    {composerPrompt()}
                </div>
                <LanguageSwitcher compact className="shrink-0" />
            </div>
            <div className="border-t border-border/50 px-4 py-2.5 lg:hidden">
                <div className="mx-auto max-w-xl">
                    {composerPrompt(true)}
                </div>
            </div>
            <input
                ref={mediaInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaPicked}
            />
        </header>
    );
}
