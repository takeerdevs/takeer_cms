import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { useLocale } from '@/lib/i18n';

const audienceOrder = ['Buyers', 'Merchants and sellers', 'Buyers and merchants', 'All users'];

export default function LegalIndex({ platformPolicies = [], documents = [] }) {
    const { t } = useLocale();
    const policyLabels = {
        '/terms': { title: t('legal.terms'), description: t('legal.termsDescription', {}, 'The rules for using Takeer as a customer, creator, seller, merchant, or service provider.') },
        '/privacy': { title: t('legal.privacy'), description: t('legal.privacyDescription', {}, 'How Takeer collects, uses, shares, and protects information across the platform.') },
    };
    const audienceLabels = {
        Buyers: t('legal.buyers'),
        'Merchants and sellers': t('legal.merchants'),
        'Buyers and merchants': t('legal.buyersMerchants'),
        'All users': t('legal.allUsers'),
    };
    return (
        <AppLayout>
            <Head title={`${t('legal.title')} | Takeer`} />
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">{t('legal.title')}</h1>
                    <p className="text-sm leading-7 text-muted-foreground">
                        {t('legal.intro')}
                    </p>
                </div>

                <div className="space-y-8">
                    {platformPolicies.length > 0 && (
                        <section>
                            <h2 className="text-lg font-black">{t('legal.platformPolicies')}</h2>
                            <div className="mt-3 space-y-4">
                                {platformPolicies.map((policy) => (
                                    <Link key={policy.href} href={policy.href} className="group block space-y-1">
                                        <h3 className="font-black text-brand-700 group-hover:underline">{policyLabels[policy.href]?.title || policy.title}</h3>
                                        <p className="text-sm leading-7 text-muted-foreground">{policyLabels[policy.href]?.description || policy.description}</p>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {audienceOrder.map((audience) => {
                        const items = documents.filter((document) => document.audience === audience);
                        if (items.length === 0) return null;

                        return (
                            <section key={audience}>
                                <h2 className="text-lg font-black">{audienceLabels[audience] || audience}</h2>
                                <div className="mt-3 space-y-4">
                                    {items.map((document) => (
                                        <Link
                                            key={document.slug}
                                            href={`/legal/${document.slug}`}
                                            className="group block space-y-1"
                                        >
                                            <h3 className="font-black text-brand-700 group-hover:underline">{t(`legal.documents.${document.slug}.title`)}</h3>
                                            <p className="text-sm leading-7 text-muted-foreground">{t(`legal.documents.${document.slug}.description`)}</p>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <p className="text-sm leading-7 text-muted-foreground">
                    {t('legal.support').split('Takeer Support')[0]}<Link href="/help" className="font-black text-brand-700 underline">Takeer Support</Link>{t('legal.support').split('Takeer Support')[1]}
                </p>
            </div>
        </AppLayout>
    );
}
