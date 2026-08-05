import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';
import SeoHead from '@/Components/SeoHead';
import {
    ShieldCheck, Zap, ArrowRight, Package,
    CheckCircle2, Star, Share2, Info
} from 'lucide-react';
import CheckoutModal from '@/Components/CheckoutModal';
import { useLocale } from '@/lib/i18n';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import BrandLogo from '@/Components/BrandLogo';

export default function PublicPaymentPage({ page, merchant }) {
    const { locale, t, copy } = useLocale();
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    const handleBuy = (item) => {
        // Prepare the product object for CheckoutModal
        const productObj = {
            id: item.item_id,
            title: item.item?.title || copy('Unknown item', 'Bidhaa isiyojulikana'),
            price: item.item?.price || page.amount || 0,
            images: item.item?.images || [],
            type: item.item_type === 'App\\Models\\Product' ? item.item?.type : 'bundle',
            purchasable_type: item.item_type === 'App\\Models\\Product' ? 'product' : 'bundle',
            payment_page_id: page.id,
            // Spread other needed properties
            ...item.item
        };
        setSelectedProduct(productObj);
        setIsCheckoutOpen(true);
    };

    const themeColor = page.theme_color || '#059669';

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-brand-100 selection:text-brand-900">
            <Head>
                <title>{page.title} | {t('paymentPage.securedBy')}</title>
                <meta name="description" content={page.description || t('paymentPage.quickCheckout')} />
            </Head>
            <SeoHead />

            {/* Premium Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                    <BrandLogo />
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher compact />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">{t('paymentPage.processedByPsp')}</span>
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-10 pb-32">

                {/* Hero / Merchant Branding */}
                <section className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-block p-1 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                        <img
                            src={merchant.storefront_setting?.avatar_url || 'https://ui-avatars.com/api/?name=' + merchant.display_name}
                            className="h-20 w-20 rounded-[22px] object-cover"
                            alt={merchant.display_name}
                        />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{page.title}</h1>
                        <p className="text-slate-500 mt-2 font-medium max-w-md mx-auto leading-relaxed">
                            {page.description || t('paymentPage.specialOffer', { merchant: merchant.display_name })}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-4 pt-2">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <img key={i} className="w-8 h-8 rounded-full border-2 border-slate-50" src={`https://i.pravatar.cc/100?u=user${i}`} alt={t('paymentPage.buyerAlt')} />
                            ))}
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{copy('Joined by 2.4k+ customers', 'Imejiunga na wateja 2.4k+')}</span>
                    </div>
                </section>

                {/* Items Grid */}
                <section className="space-y-6">
                    {page.items.map((item, index) => (
                        <Card
                            key={index}
                            className="overflow-hidden border-slate-200 shadow-xl shadow-slate-200/40 hover:scale-[1.02] transition-transform duration-300"
                        >
                            <CardContent className="p-0">
                                <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                                    <img
                                        src={item.item?.images?.[0]?.url || 'https://via.placeholder.com/600x400?text=Product'}
                                        className="w-full h-full object-cover"
                                        alt={item.item?.title}
                                    />
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-white/90 backdrop-blur-sm text-slate-900 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                                            {item.item_type.split('\\').pop()}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">{item.item?.title}</h3>
                                            <div className="flex items-center gap-1 mt-1">
                                                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />)}
                                                <span className="text-[10px] font-bold text-slate-400 ml-1">{t('paymentPage.reviews')}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-slate-900">
                                                {new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(item.item?.price || 0)}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{t('paymentPage.incVat')}</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => handleBuy(item)}
                                        className="w-full h-14 rounded-2xl text-white font-black text-lg shadow-lg group transition-all"
                                        style={{ backgroundColor: themeColor, boxShadow: `0 10px 20px -5px ${themeColor}40` }}
                                    >
                                        {t('paymentPage.orderNow')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </Button>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 p-2.5 rounded-xl">
                                            <Zap className="h-4 w-4 text-amber-500" /> {t('paymentPage.instantAccess')}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 p-2.5 rounded-xl">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" /> {t('paymentPage.secure')}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                {/* Trust Section */}
                <footer className="text-center space-y-6 pt-8">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 opacity-50">
                            <ShieldCheck className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('paymentPage.buyerProtection')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                            {t('paymentPage.trustDescription')}
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/M-Pesa_Logo.png" className="h-4 grayscale opacity-50" alt="M-Pesa" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/d/d1/Visa_Logo.png" className="h-3 grayscale opacity-50" alt="Visa" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b7/MasterCard_Logo.svg" className="h-4 grayscale opacity-50" alt="Mastercard" />
                    </div>
                </footer>
            </main>

            {/* Checkout Integration */}
            {selectedProduct && (
                <CheckoutModal
                    product={selectedProduct}
                    isOpen={isCheckoutOpen}
                    onOpenChange={setIsCheckoutOpen}
                />
            )}
        </div>
    );
}
