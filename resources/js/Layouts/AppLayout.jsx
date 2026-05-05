import { Link, router, usePage } from '@inertiajs/react';
import { Home, Search, Plus, ShoppingBag, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import PostComposer from '@/Components/PostComposer';
import SearchOverlay from '@/Components/SearchOverlay';
import CheckoutModal from '@/Components/CheckoutModal';
import DigitalDownloadModal from '@/Components/DigitalDownloadModal';
import ProfileSwitcher from '@/Components/ProfileSwitcher';
import axios from 'axios';
import { trackPlatformEvent } from '@/lib/attribution';

export default function AppLayout({ children, hideTabBar = false }) {
    const page = usePage();
    const { flash, auth } = page.props;
    const currentUrl = page.url;
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerInitialMode, setComposerInitialMode] = useState('short');
    const [creatingProfile, setCreatingProfile] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Global checkout state
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [checkoutItem, setCheckoutItem] = useState(null);

    // Digital download modal state
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [downloadModalData, setDownloadModalData] = useState(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
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
        window.__openComposer = (mode = 'short') => {
            setComposerInitialMode(mode === 'long' ? 'long' : 'short');
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
    const canOpenComposer = Boolean(auth?.user?.phone_number);
    const hasMerchantProfile = Boolean(auth?.user?.merchant_profiles?.length);

    const openComposerForCurrentUser = async () => {
        if (!auth?.user) {
            router.visit('/merchant/register');
            return;
        }

        if (hasMerchantProfile) {
            setComposerOpen(true);
            return;
        }

        setCreatingProfile(true);
        try {
            await axios.post('/auth/merchant/ensure-personal');
            router.reload({
                only: ['auth'],
                onSuccess: () => setComposerOpen(true),
            });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Tafadhali thibitisha nambari ya simu kwanza.');
            router.visit('/merchant/register');
        } finally {
            setCreatingProfile(false);
        }
    };

    const navItems = [
        { name: 'Feed', href: '/', icon: Home },
        { name: 'Tafuta', href: '#', icon: Search, isSearch: true },
        ...(canOpenComposer ? [{ name: null, href: null, icon: Plus, isCreate: true }] : []),
        { name: 'Oda', href: '/orders', icon: ShoppingBag },
        { name: 'Mimi', href: '/profile', icon: User },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground font-sans antialiased">
            <Toaster position="top-center" richColors />

            {/* ── Full-width content, no sidebar ── */}
            <main className={cn('min-h-screen', hideTabBar ? 'pb-0' : 'pb-20')}>
                {children}
            </main>

            {/* ── Super Fluid Floating Tab Bar (Mobile) ──────────────────────── */}
            {/* ── Floating Tab Bar (all screen sizes) ─────────────────── */}
            {!hideTabBar && (
                <nav className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm">
                    <div className="flex h-14 items-center justify-around px-2 bg-background/80 backdrop-blur-2xl border-[0.5px] border-border/50 rounded-full shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)]">
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
                                        <div className="h-11 w-11 rounded-full bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20 border-2 border-background">
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
                                        className="relative flex items-center justify-center w-10 h-10 rounded-full transition-all tap-highlight-transparent text-muted-foreground active:scale-95"
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
                                        'relative flex items-center justify-center w-10 h-10 rounded-full transition-all tap-highlight-transparent',
                                        active ? 'text-brand-600' : 'text-muted-foreground active:scale-95'
                                    )}
                                >
                                    <Icon className={cn("h-6 w-6 transition-all", active && "scale-110")} strokeWidth={active ? 2.5 : 2} />
                                    {active && (
                                        <motion.div
                                            layoutId="nav-active"
                                            className="absolute -bottom-1 h-1 w-1 rounded-full bg-brand-600"
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
                onClose={() => setComposerOpen(false)}
                initialMode={composerInitialMode}
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
                productTitle={downloadModalData?.productTitle}
                productId={downloadModalData?.itemId}
            />
        </div>
    );
}
