import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, ShieldAlert, Users,
    Settings2, ChevronLeft, Store, Flag, Shapes, Newspaper,
    ShieldCheck, Globe, Percent, Crown, Calendar, Bell, BarChart3, LinkIcon,
    Tags, Ruler, Activity, Gauge, LifeBuoy, RefreshCcw, FileText
} from 'lucide-react';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import BrandLogo from '@/Components/BrandLogo';
import { useLocale } from '@/lib/i18n';

const adminNav = [
    { key: 'dashboard', href: '/admin', icon: LayoutDashboard }, { key: 'attention', href: '/admin/attention', icon: Bell }, { key: 'disputes', href: '/admin/disputes', icon: ShieldAlert }, { key: 'safety', href: '/admin/trust-safety-reviews', icon: ShieldCheck }, { key: 'notifications', href: '/admin/notifications', icon: Bell }, { key: 'enquiries', href: '/admin/enquiries', icon: LifeBuoy }, { key: 'analytics', href: '/admin/analytics', icon: BarChart3 }, { key: 'trackedLinks', href: '/admin/tracked-links', icon: LinkIcon }, { key: 'users', href: '/admin/users', icon: Users }, { key: 'merchants', href: '/admin/merchants', icon: Store }, { key: 'forwarders', href: '/admin/forwarders', icon: Globe }, { key: 'verifications', href: '/admin/verifications', icon: ShieldCheck }, { key: 'contentReports', href: '/admin/content-reports', icon: Flag }, { key: 'feedMonitor', href: '/admin/feed', icon: Newspaper }, { key: 'systemHealth', href: '/health', icon: Activity, external: true }, { key: 'horizon', href: '/admin/horizon', icon: Gauge, external: true }, /* Service administration is hidden for the launch. */ { key: 'categories', href: '/admin/categories', icon: Shapes }, { key: 'brands', href: '/admin/brands', icon: Tags }, { key: 'sellableUnits', href: '/admin/sellable-units', icon: Ruler }, { key: 'countries', href: '/admin/countries', icon: Globe }, { key: 'fees', href: '/admin/fee-policies', icon: Percent }, { key: 'subscriptions', href: '/admin/subscriptions', icon: Crown }, { key: 'refunds', href: '/admin/refunds', icon: RefreshCcw }, { key: 'paymentOperations', href: '/admin/payment-operations', icon: Activity }, { key: 'legalDocuments', href: '/admin/legal-documents', icon: FileText }, { key: 'settings', href: '/admin/settings', icon: Settings2 }, { key: 'aiSettings', href: '/admin/ai-settings', icon: Settings2 }, { key: 'aiUsage', href: '/admin/ai-usage', icon: BarChart3 },
];

export default function AdminLayout({ children, title = 'Admin', hideTopBar = false }) {
    const { t, copy } = useLocale();
    const localizedAdminNav = adminNav.map((item) => ({ ...item, name: t(`admin.nav.${item.key}`) }));
    const current = typeof window !== 'undefined' ? window.location.pathname : '';
    const previousHadDarkClass = useRef(false);
    const [attentionSummary, setAttentionSummary] = useState({ total: 0 });

    useEffect(() => {
        if (typeof document === 'undefined') return;
        previousHadDarkClass.current = document.documentElement.classList.contains('dark');
        document.documentElement.classList.remove('dark');
        document.body.style.backgroundColor = '#f8fafc';

        return () => {
            document.body.style.backgroundColor = '';
            if (previousHadDarkClass.current) {
                document.documentElement.classList.add('dark');
            }
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        fetch('/admin/api/attention/summary', { headers: { Accept: 'application/json' } })
            .then((response) => response.ok ? response.json() : null)
            .then((summary) => {
                if (!cancelled && summary) {
                    setAttentionSummary(summary);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex">
            <Toaster position="top-center" richColors />

            {/* Sidebar */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-slate-200 bg-white h-screen sticky top-0">
                {/* Brand */}
                <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-200">
                    <BrandLogo
                        href="/admin"
                        subtitle={copy('Admin Panel', 'Paneli ya msimamizi')}
                        className="w-full"
                    />
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {localizedAdminNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = current === item.href;
                        const className = cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            isActive
                                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        );
                        const content = (
                            <>
                                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand-700')} />
                                <span className="flex-1">{item.name}</span>
                                {item.href === '/admin/attention' && attentionSummary.total > 0 && (
                                    <span className="min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                                        {attentionSummary.total > 99 ? '99+' : attentionSummary.total}
                                    </span>
                                )}
                            </>
                        );

                        if (item.external) {
                            return (
                                <a key={item.href} href={item.href} className={className}>
                                    {content}
                                </a>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={className}
                            >
                                {content}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-slate-200 space-y-0.5">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" /> {t('admin.backToApp')}
                    </Link>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                        <h1 className={cn('min-w-0 truncate text-sm font-semibold text-slate-700', hideTopBar && 'sr-only')}>{title}</h1>
                        <div className="ml-auto flex items-center gap-2">
                            <LanguageSwitcher compact />
                            <Link
                                href="/admin/attention"
                                aria-label={t('admin.openAttention')}
                                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                                <Bell className="h-4 w-4" />
                                {attentionSummary.total > 0 && (
                                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                                        {attentionSummary.total > 99 ? '99+' : attentionSummary.total}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="p-6 md:p-8 max-w-5xl animate-in fade-in duration-300">
                    {children}
                </div>
            </main>
        </div>
    );
}
