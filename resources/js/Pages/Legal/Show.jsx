import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { useLocale } from '@/lib/i18n';

export default function LegalShow({ document }) {
    const { locale, t } = useLocale();
    const title = t(`legal.documents.${document?.slug}.title`);
    const html = document?.html_by_locale?.[locale] || document?.html || '';
    return (
        <AppLayout>
            <Head title={`${title || document?.title || 'Legal document'} | Takeer`} />
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
                <Link href="/legal" className="inline-flex text-sm font-black text-brand-700 hover:text-brand-900">
                    ← {t('legal.back')}
                </Link>

                <div className="legal-document-content" dangerouslySetInnerHTML={{ __html: html }} />

                <p className="text-sm leading-7 text-muted-foreground">
                    {t('legal.questions')} <Link href="/help" className="font-black text-brand-700 underline">{t('common.contactSupport')}</Link>.
                </p>
            </div>
        </AppLayout>
    );
}
