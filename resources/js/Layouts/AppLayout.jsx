import { Link, router, usePage } from '@inertiajs/react';
import { Home, Search, Plus, ShoppingBag, User, ArrowRight, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import PostComposer from '@/Components/PostComposer';
import SearchOverlay from '@/Components/SearchOverlay';
import CheckoutModal from '@/Components/CheckoutModal';
import DigitalDownloadModal from '@/Components/DigitalDownloadModal';
import SeoHead from '@/Components/SeoHead';
import axios from 'axios';
import { trackPlatformEvent } from '@/lib/attribution';
import { hasMerchantPermission } from '@/lib/merchantPermissions';
import { useLocale } from '@/lib/i18n';
import AppHeader from '@/Components/AppHeader';

export default function AppLayout({ children, hideTabBar = false }) {
    const page = usePage();
    const { flash, auth } = page.props;
    const { t } = useLocale();
    const currentUrl = page.url;
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerInitialMode, setComposerInitialMode] = useState('short');
    const [composerOptions, setComposerOptions] = useState({});
    const [creatingProfile, setCreatingProfile] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [pendingSocialRequests, setPendingSocialRequests] = useState(0);

    // Global checkout state
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [checkoutItem, setCheckoutItem] = useState(null);

    // Digital download modal state
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [downloadModalData, setDownloadModalData] = useState(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        const normalizedFlashError = String(flash?.error || '').trim().toLowerCase();
        if (flash?.error && !['unauthenticated.', 'unauthorized'].includes(normalizedFlashError)) {
            toast.error(flash.error);
        }
    }, [flash]);

    useEffect(() => {
        if (typeof window === 'undefined' || !currentUrl) return;

        const path = window.location.pathname;
        trackPlatformEvent(path === '/' || path === '/feed' ? 'feed_view' : 'page_view', {
            source: 'app',
            source_url: window.location.href,
            metadata: {
                path,
                title: document.title,
                authenticated: Boolean(auth?.user),
                has_merchant_profile: Boolean(auth?.user?.merchant_profiles?.length),
            },
        });
    }, [currentUrl]);

    // Expose global openers
    useEffect(() => {
        window.__openComposer = (options = 'short') => {
            const nextOptions = typeof options === 'object' && options !== null ? options : { mode: options };
            setComposerInitialMode(nextOptions.mode === 'long' ? 'long' : 'short');
            setComposerOptions(nextOptions);
            setComposerOpen(true);
        };
        window.__openSearch = () => setSearchOpen(true);
        window.__openCheckout = (item) => {
            setCheckoutItem(item);
            setCheckoutOpen(true);
        };

        // Listen for post-payment events from CheckoutModal
        const handleDigitalReady = (e) => {
            setDownloadModalData(e.detail);
            setDownloadModalOpen(true);
        };
        window.addEventListener('takeer:digital-ready', handleDigitalReady);

        return () => {
            delete window.__openComposer;
            delete window.__openSearch;
            delete window.__openCheckout;
            window.removeEventListener('takeer:digital-ready', handleDigitalReady);
        };
    }, []);

    // Tab bar nav items (visible on all screen sizes)
    const hasMerchantProfile = Boolean(auth?.user?.merchant_profiles?.length);
    const hasPostableMerchantProfile = Boolean(auth?.user?.merchant_profiles?.some((profile) => (
        hasMerchantPermission(profile.permissions || [], 'posts.create')
        || hasMerchantPermission(profile.permissions || [], 'posts.publish')
    )));
    const canOpenComposer = Boolean(auth?.user?.phone_number) && (!hasMerchantProfile || hasPostableMerchantProfile);

    useEffect(() => {
        if (!hasMerchantProfile) {
            setPendingSocialRequests(0);
            return;
        }

        let cancelled = false;
        axios.get('/api/merchant/social-commerce/requests')
            .then((response) => {
                if (cancelled) return;
                const items = response.data?.data || [];
                setPendingSocialRequests(items.filter((item) => ['claimed', 'onboarding', 'product_setup', 'offer_ready'].includes(item.status)).length);
            })
            .catch(() => {
                if (!cancelled) setPendingSocialRequests(0);
            });

        return () => { cancelled = true; };
    }, [hasMerchantProfile, currentUrl]);

    const openComposerForCurrentUser = async (options = {}) => {
        const nextOptions = typeof options === 'object' && options !== null ? options : {};

        if (!auth?.user) {
            router.visit('/merchant/register');
            return;
        }

        if (hasMerchantProfile) {
            if (!hasPostableMerchantProfile) {
                toast.error(t('common.postPermission', {}, 'You do not have permission to create posts for any business account.'));
                return;
            }
            setComposerInitialMode(nextOptions.mode === 'long' ? 'long' : 'short');
            setComposerOptions(nextOptions);
            setComposerOpen(true);
            return;
        }

        setCreatingProfile(true);
        try {
            await axios.post('/auth/merchant/ensure-personal');
            router.reload({
                only: ['auth'],
                onSuccess: () => {
                    setComposerInitialMode(nextOptions.mode === 'long' ? 'long' : 'short');
                    setComposerOptions(nextOptions);
                    setComposerOpen(true);
                },
            });
        } catch (error) {
            toast.error(error.response?.data?.message || t('common.verifyPhone', {}, 'Tafadhali thibitisha nambari ya simu kwanza.'));
            router.visit('/merchant/register');
        } finally {
            setCreatingProfile(false);
        }
    };

    useEffect(() => {
        window.__openComposerForCurrentUser = openComposerForCurrentUser;

        return () => {
            delete window.__openComposerForCurrentUser;
        };
    }, [auth?.user, hasMerchantProfile, hasPostableMerchantProfile, t]);

    const navItems = [
        { name: t('nav.feed'), href: '/', icon: Home },
        { name: t('nav.search'), href: '#', icon: Search, isSearch: true },
        ...(canOpenComposer ? [{ name: null, href: null, icon: Plus, isCreate: true }] : []),
        { name: t('nav.orders'), href: '/orders', icon: ShoppingBag },
        { name: t('nav.me'), href: '/profile', icon: User },
    ];

    return (
        <div className="relative isolate min-h-screen overflow-x-clip bg-background font-sans text-foreground antialiased">
            <AmbientWaveBackground />
            <Toaster position="top-center" richColors />
            <AppHeader
                onCompose={openComposerForCurrentUser}
                profile={auth?.user?.merchant_profiles?.find((profile) => profile.is_default) || auth?.user?.merchant_profiles?.[0] || null}
                isAuthenticated={Boolean(auth?.user)}
                isCreating={creatingProfile}
            />

            {pendingSocialRequests > 0 && !String(currentUrl || '').startsWith('/merchant/social-commerce/requests') && (
                <Link href="/merchant/social-commerce/requests" className="relative z-20 mx-auto mt-2 flex w-[calc(100%-2rem)] max-w-5xl items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-950 shadow-sm transition hover:border-orange-300 hover:bg-orange-100/70">
                    <span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Inbox className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-black">{t('socialCommerce.pendingSellerRequests', { count: pendingSocialRequests }, `${pendingSocialRequests} pending social-media ${pendingSocialRequests === 1 ? 'request' : 'requests'}`)}</span><span className="block truncate text-xs font-semibold text-orange-800/75">{t('socialCommerce.finishSellerSetup', {}, 'Finish seller setup or prepare the buyer offer.')}</span></span></span><ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
            )}

            {/* ── Full-width content, no sidebar ── */}
            <main className={cn('relative z-10 min-h-screen', hideTabBar ? 'pb-0' : 'pb-20')}>
                {children}
            </main>
            <SeoHead />

            {/* ── Floating Tab Bar (all screen sizes) ─────────────────── */}
            {!hideTabBar && (
                <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 env-safe-bottom">
                    <div className="flex h-[3.75rem] items-center justify-around rounded-[1.35rem] border border-white/90 bg-white/88 px-2 shadow-[0_18px_50px_-18px_rgba(73,32,20,0.42)] backdrop-blur-2xl">
                        {navItems.map((item, i) => {
                            const Icon = item.icon;
                            if (item.isCreate) {
                                return (
                                    <button
                                        key="create"
                                        onClick={openComposerForCurrentUser}
                                        disabled={creatingProfile}
                                        className="flex items-center justify-center transition-transform active:scale-90 disabled:opacity-60"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-gradient-to-br from-brand-500 to-commerce-500 shadow-lg shadow-brand-500/25">
                                            <Plus className="h-6 w-6 text-white" strokeWidth={3} />
                                        </div>
                                    </button>
                                );
                            }
                            if (item.isSearch) {
                                return (
                                    <button
                                        key="search-mobile"
                                        onClick={() => setSearchOpen(true)}
                                        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all tap-highlight-transparent hover:bg-brand-50 hover:text-brand-700 active:scale-95"
                                    >
                                        <Icon className="h-6 w-6 transition-all" strokeWidth={2} />
                                    </button>
                                );
                            }

                            const active = typeof window !== 'undefined' && window.location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href || i}
                                    href={item.href}
                                    className={cn(
                                        'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all tap-highlight-transparent',
                                        active ? 'bg-brand-50 text-brand-700 shadow-inner shadow-brand-100/50' : 'text-muted-foreground hover:bg-brand-50 hover:text-brand-700 active:scale-95'
                                    )}
                                >
                                    <Icon className={cn("h-6 w-6 transition-all", active && "scale-110")} strokeWidth={active ? 2.5 : 2} />
                                    {active && (
                                        <motion.div
                                            layoutId="nav-active"
                                            className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-commerce-500"
                                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}

            {/* ── Global Overlays ────────────────────────────────── */}
            <PostComposer
                isOpen={composerOpen}
                onClose={() => {
                    setComposerOpen(false);
                    setComposerOptions({});
                }}
                initialMode={composerInitialMode}
                initialMerchantUsername={composerOptions.merchantUsername}
                prefillText={composerOptions.text}
                prefillFiles={composerOptions.mediaFiles || []}
                forwarderRoutes={composerOptions.forwarderRoutes || []}
            />

            <SearchOverlay
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
            />

            <CheckoutModal
                isOpen={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                product={checkoutItem}
            />

            <DigitalDownloadModal
                isOpen={downloadModalOpen}
                onClose={() => setDownloadModalOpen(false)}
                orderId={downloadModalData?.orderId}
                entitlementId={downloadModalData?.entitlementId}
                productTitle={downloadModalData?.productTitle}
                productId={downloadModalData?.itemId}
                accessProduct={downloadModalData?.accessProduct}
            />
        </div>
    );
}

function AmbientWaveBackground() {
    const lines = Array.from({ length: 16 }, (_, index) => {
        const yOffset = index * 9;
        return {
            id: index,
            opacity: 0.12 + index * 0.024,
            d: [
                `M -160 ${675 - yOffset}`,
                `C 120 ${785 - index * 14} 315 ${625 - index * 19} 520 ${560 - index * 13}`,
                `S 850 ${235 + index * 9} 1060 ${230 + index * 4}`,
                `S 1315 ${270 - index * 6} 1600 ${145 - index * 2}`,
            ].join(' '),
        };
    });

    return (
        <div className="app-wave-background" aria-hidden="true">
            <svg viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
                <defs>
                    <linearGradient id="ambient-wave-gradient" x1="0%" y1="82%" x2="100%" y2="18%">
                        <stop offset="0%" stopColor="#f45d3a" stopOpacity="0.02" />
                        <stop offset="30%" stopColor="#f45d3a" stopOpacity="0.28" />
                        <stop offset="67%" stopColor="#ffb89f" stopOpacity="0.11" />
                        <stop offset="100%" stopColor="#f8890b" stopOpacity="0.23" />
                    </linearGradient>
                </defs>
                <g>
                    {lines.map((line) => (
                        <path
                            key={line.id}
                            className="app-wave-line"
                            d={line.d}
                            opacity={line.opacity}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
}
