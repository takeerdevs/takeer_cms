import React from 'react';
import { Link } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export default function PolicyNotice({ className = '' }) {
    const { t } = useLocale();
    return (
        <div className={`rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 ${className}`}>
            <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-900">
                        {t('components.publishPolicy')}{' '}
                        <Link href="/legal/merchant-marketplace-agreement" className="underline underline-offset-2">{t('components.merchantAgreement')}</Link>,{' '}
                        <Link href="/legal/restricted-products-services-policy" className="underline underline-offset-2">{t('components.restrictedPolicy')}</Link>, {t('common.and')}{' '}
                        <Link href="/legal/privacy-notice" className="underline underline-offset-2">{t('components.privacyNotice')}</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}
