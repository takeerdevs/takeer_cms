import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, ShieldAlert, Users, ArrowDownToLine,
    Settings2, ShoppingBag, ChevronLeft, Store, Flag, Shapes, Newspaper,
    ShieldCheck, Globe, Wallet, Percent, Crown, Calendar, Bell, BarChart3, LinkIcon,
    Tags, Ruler, WalletCards
} from 'lucide-react';

const adminNav = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Attention', href: '/admin/attention', icon: Bell },
    { name: 'Disputes', href: '/admin/disputes', icon: ShieldAlert },
    { name: 'Safety Reviews', href: '/admin/trust-safety-reviews', icon: ShieldCheck },
    { name: 'Notifications', href: '/admin/notifications', icon: Bell },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Tracked Links', href: '/admin/tracked-links', icon: LinkIcon },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Merchants', href: '/admin/merchants', icon: Store },
    { name: 'Forwarders', href: '/admin/forwarders', icon: Globe },
    { name: 'Verifications', href: '/admin/verifications', icon: ShieldCheck },
    { name: 'Content Reports', href: '/admin/content-reports', icon: Flag },
    { name: 'Feed Monitor', href: '/admin/feed', icon: Newspaper },
    { name: 'Services', href: '/admin/services', icon: Calendar },
    { name: 'Service Categories', href: '/admin/service-categories', icon: Shapes },
    { name: 'Categories', href: '/admin/categories', icon: Shapes },
    { name: 'Brands & Models', href: '/admin/brands', icon: Tags },
    { name: 'Sellable Units', href: '/admin/sellable-units', icon: Ruler },
    { name: 'Countries', href: '/admin/countries', icon: Globe },
    { name: 'Platform Wallet', href: '/admin/platform-wallet', icon: Wallet },
    { name: 'Pricing & Fees', href: '/admin/fee-policies', icon: Percent },
    { name: 'Subscriptions', href: '/admin/subscriptions', icon: Crown },
    { name: 'Withdrawals', href: '/admin/withdrawals', icon: ArrowDownToLine },
    { name: 'Payout Settings', href: '/admin/payout-settings', icon: WalletCards },
    { name: 'General Settings', href: '/admin/settings', icon: Settings2 },
    { name: 'AI Settings', href: '/admin/ai-settings', icon: Settings2 },
];

export default function AdminLayout({ children, title = 'Admin', hideTopBar = false }) {
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
                    <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <p className="font-black text-slate-900 text-sm leading-none">Takeer</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Admin Panel</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {adminNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = current === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                                    isActive
                                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                )}
                            >
                                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand-700')} />
                                <span className="flex-1">{item.name}</span>
                                {item.href === '/admin/attention' && attentionSummary.total > 0 && (
                                    <span className="min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                                        {attentionSummary.total > 99 ? '99+' : attentionSummary.total}
                                    </span>
                                )}
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
                        <ChevronLeft className="h-4 w-4" /> Back to App
                    </Link>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                {!hideTopBar && (
                    <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-8">
                        <h1 className="text-sm font-semibold text-slate-700">{title}</h1>
                        <Link
                            href="/admin/attention"
                            aria-label="Open admin attention center"
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
                )}
                <div className="p-6 md:p-8 max-w-5xl animate-in fade-in duration-300">
                    {children}
                </div>
            </main>
        </div>
    );
}
