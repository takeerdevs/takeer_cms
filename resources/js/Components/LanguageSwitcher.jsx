import React from 'react';
import { Languages } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export default function LanguageSwitcher({ className = '' }) {
    const { locale, locales, setLocale, t } = useLocale();

    return (
        <div
            className={`inline-flex items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur ${className}`}
            role="group"
            aria-label={t('language.label')}
        >
            <Languages className="mx-1 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {Object.values(locales).map((item) => (
                <button
                    key={item.code}
                    type="button"
                    onClick={() => setLocale(item.code)}
                    aria-pressed={locale === item.code}
                    title={item.label}
                    className={`rounded-full px-2 py-1 text-[10px] font-black tracking-wide transition ${locale === item.code
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                >
                    {item.shortLabel}
                </button>
            ))}
        </div>
    );
}

