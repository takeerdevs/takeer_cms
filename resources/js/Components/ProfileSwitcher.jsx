import React, { useState } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Store, User, Plus, Check, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfileSwitcher({ className, onCreateBusiness }) {
    const { auth, activeMerchant: sharedActiveMerchant } = usePage().props;
    const merchants = auth?.user?.merchant_profiles ?? [];
    const [isOpen, setIsOpen] = useState(false);

    // Find active merchant from URL if possible, or fallback to default
    const pathParts = window.location.pathname.split('/');
    const merchantFromUrl = pathParts[1] === 'merchant' ? pathParts[2] : null;
    
    const activeMerchant = sharedActiveMerchant 
        || merchants.find(m => m.username === merchantFromUrl) 
        || merchants.find(m => m.is_default) 
        || merchants[0];

    if (!auth?.user?.is_merchant || merchants.length === 0) return null;

    return (
        <div className={cn("relative z-[60]", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-card/60 backdrop-blur-md border border-border/50 shadow-sm transition-all hover:bg-card active:scale-95"
            >
                <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-brand-100 bg-brand-50 flex items-center justify-center shrink-0">
                    {activeMerchant?.avatar_url ? (
                        <img src={activeMerchant.avatar_url} className="h-full w-full object-cover" alt="" />
                    ) : (
                        activeMerchant?.type === 'personal' ? <User className="h-4 w-4 text-brand-600" /> : <Store className="h-4 w-4 text-brand-600" />
                    )}
                </div>
                <div className="flex flex-col items-start min-w-0 max-w-[120px]">
                    <span className="text-[11px] font-black text-foreground truncate leading-tight">
                        {activeMerchant?.display_name}
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate uppercase tracking-widest font-bold">
                        {activeMerchant?.type || 'Business'}
                    </span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[-1]"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="fixed left-4 right-4 top-28 bg-card/95 backdrop-blur-xl border border-border/50 rounded-[2rem] shadow-2xl overflow-hidden p-2 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
                        >
                            <div className="p-3 border-b border-border/50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Badili Akaunti</p>
                            </div>
                            
                            <div className="max-h-[350px] overflow-y-auto no-scrollbar py-2 space-y-1">
                                {merchants.map((merchant) => {
                                    const isActive = activeMerchant?.id === merchant.id;
                                    return (
                                        <button
                                            key={merchant.id}
                                            onClick={() => {
                                                setIsOpen(false);
                                                router.post(`/merchant/switch/${merchant.username}`, {}, {
                                                    onSuccess: () => {
                                                        router.visit('/profile');
                                                    }
                                                });
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-2xl transition-all group w-full text-left",
                                                isActive ? "bg-brand-50/50 dark:bg-brand-900/20" : "hover:bg-muted/50"
                                            )}
                                        >
                                            <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-background bg-muted flex items-center justify-center shrink-0">
                                                {merchant.avatar_url ? (
                                                    <img src={merchant.avatar_url} className="h-full w-full object-cover" alt="" />
                                                ) : (
                                                    merchant.type === 'personal' ? <User className="h-5 w-5 text-muted-foreground" /> : <Store className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn("font-bold text-sm truncate", isActive ? "text-brand-600" : "text-foreground")}>
                                                    {merchant.display_name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground truncate">@{merchant.username}</p>
                                            </div>
                                            {isActive && (
                                                <div className="h-6 w-6 rounded-full bg-brand-600 flex items-center justify-center text-white shrink-0">
                                                    <Check className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="p-2 border-t border-border/50">
                                {(() => {
                                    const hasVerifiedProfile = merchants.some(m => m.is_verified || m.kyc?.status === 'verified');
                                    
                                    if (!hasVerifiedProfile) {
                                        return (
                                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 opacity-80">
                                                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                                    <Plus className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-xs text-slate-600">Ongeza Biashara Mpya</p>
                                                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Tafadhali hakiki kitambulisho chako kwanza ili kuongeza biashara.</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return onCreateBusiness ? (
                                        <button
                                            onClick={() => { setIsOpen(false); onCreateBusiness(); }}
                                            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-brand-600 flex items-center justify-center shrink-0 text-white shadow-lg shadow-brand-600/20">
                                                <Plus className="h-5 w-5" />
                                            </div>
                                            <span className="font-bold text-sm">Ongeza Biashara Mpya</span>
                                        </button>
                                    ) : (
                                        <Link
                                            href="/profile"
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                                                <Plus className="h-5 w-5" />
                                            </div>
                                            <span className="font-bold text-sm">Ongeza Biashara Mpya</span>
                                        </Link>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
