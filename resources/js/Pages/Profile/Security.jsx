import React from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Shield } from 'lucide-react';
import TotpSecurityPanel from '@/Components/Profile/TotpSecurityPanel';
import { useLocale } from '@/lib/i18n';

export default function ProfileSecurity() {
    const { t } = useLocale();
    const { auth } = usePage().props;

    return (
        <AppLayout>
            <Head title={`${t('accountSettings.securityTitle')} | Takeer`} />
            <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-foreground transition-colors hover:bg-muted"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm sm:flex">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-black tracking-tight text-foreground">{t('accountSettings.securityTitle')}</h1>
                            <p className="text-sm text-muted-foreground">{t('accountSettings.securityDescription')}</p>
                        </div>
                    </div>
                </div>

                <TotpSecurityPanel initialEnabled={auth?.user?.two_factor_enabled} />
            </div>
        </AppLayout>
    );
}
