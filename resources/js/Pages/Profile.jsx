import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage, router, useForm } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/Components/ui/Dialog';
import {
    UserCircle, Shield, Settings, LogOut, Store, ExternalLink, LayoutDashboard, ChevronRight, Plus, ChevronDown, ChevronUp, BarChart3, Package, DownloadCloud, Briefcase
} from 'lucide-react';
import axios from 'axios';

export default function Profile({ thisMonthEarnings = 0, salesBreakdown = { digital: 0, physical: 0, services: 0 }, countries = [], currencies = [] }) {
    const { auth } = usePage().props;
    const merchants = auth?.user?.merchant_profiles ?? [];

    const [isSecurityOpen, setIsSecurityOpen] = useState(false);
    const [isCreateShopModalOpen, setIsCreateShopModalOpen] = useState(false);

    const defaultCountry = merchants.length > 0 ? String(merchants[0].country_id) : (countries.length > 0 ? String(countries[0].id) : '');
    const defaultCurrency = merchants.length > 0 ? String(merchants[0].currency_id) : (currencies.length > 0 ? String(currencies[0].id) : '');

    const { data: createData, setData: setCreateData, post: createPost, processing: createProcessing, errors: createErrors, reset: createReset, clearErrors: clearCreateErrors } = useForm({
        store_name: '',
        display_name: '',
        country_id: defaultCountry,
        currency_id: defaultCurrency,
    });

    useEffect(() => {
        // Keeps defaults synchronized if they load late
        if (!createData.country_id && defaultCountry) setCreateData('country_id', defaultCountry);
        if (!createData.currency_id && defaultCurrency) setCreateData('currency_id', defaultCurrency);
    }, [defaultCountry, defaultCurrency]);

    const handleLogout = () => {
        router.post('/logout', {}, {
            onFinish: () => {
                localStorage.removeItem('takeer_token');
                delete axios.defaults.headers.common['Authorization'];
            }
        });
    };

    const handleCreateShop = (e) => {
        e.preventDefault();
        createPost('/merchant/create', {
            onSuccess: () => {
                createReset();
                setIsCreateShopModalOpen(false);
            }
        });
    };

    const totalSales = salesBreakdown.digital + salesBreakdown.physical + salesBreakdown.services;

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-TZ', {
            style: 'currency',
            currency: 'TZS',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getPercent = (value) => {
        if (totalSales === 0) return 0;
        return Math.round((value / totalSales) * 100);
    };

    return (
        <AppLayout>
            <Head title="Akaunti Yangu | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-6 p-4 pb-20">

                    {/* ── Header ── */}
                    <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 shrink-0 border-2 border-brand-200">
                                <UserCircle className="h-10 w-10" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-foreground tracking-tight">Akaunti Yangu</h1>
                                <p className="text-sm font-medium text-muted-foreground capitalize">{auth?.user?.role || 'Mtumiaji'} Profile</p>
                            </div>
                        </div>
                        {auth?.user?.is_merchant && (
                            <button
                                onClick={() => setIsCreateShopModalOpen(true)}
                                className="h-10 w-10 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                                title="Ongeza Biashara Mpya"
                            >
                                <Plus className="h-6 w-6" />
                            </button>
                        )}
                    </div>

                    {/* ── Overall Earnings Dashboard ── */}
                    {auth?.user?.is_merchant && (
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <BarChart3 className="h-5 w-5 text-brand-600" />
                                    <h2 className="font-bold text-lg">Ripoti ya Ujumla (Mwezi Huu)</h2>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8 items-center">
                                    {/* Total Earnings */}
                                    <div className="bg-white dark:bg-background rounded-2xl p-6 border border-border shadow-sm">
                                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mapato Yote</p>
                                        <h3 className="text-4xl font-black text-foreground tracking-tight flex items-baseline gap-1">
                                            {formatMoney(thisMonthEarnings)}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Share bidhaa zako/weka link ya biashara yako kwenye bio mitandao ya kijamii uongeze mauzo.
                                        </p>
                                    </div>

                                    {/* Sales Categories Chart */}
                                    <div className="space-y-4">
                                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Mgawanyo wa Mauzo ({totalSales})
                                        </p>

                                        <div className="space-y-3">
                                            {/* Digital Bar */}
                                            <div>
                                                <div className="flex justify-between text-sm font-bold mb-1">
                                                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                        <DownloadCloud className="h-4 w-4" /> Digital / Unlockables
                                                    </span>
                                                    <span>{salesBreakdown.digital}</span>
                                                </div>
                                                <div className="h-2.5 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${getPercent(salesBreakdown.digital)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Physical Bar */}
                                            <div>
                                                <div className="flex justify-between text-sm font-bold mb-1">
                                                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                                        <Package className="h-4 w-4" /> Physical Products
                                                    </span>
                                                    <span>{salesBreakdown.physical}</span>
                                                </div>
                                                <div className="h-2.5 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${getPercent(salesBreakdown.physical)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Services Bar */}
                                            <div>
                                                <div className="flex justify-between text-sm font-bold mb-1">
                                                    <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                                                        <Briefcase className="h-4 w-4" /> Huduma (Services)
                                                    </span>
                                                    <span>{salesBreakdown.services}</span>
                                                </div>
                                                <div className="h-2.5 w-full bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${getPercent(salesBreakdown.services)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── My Businesses (Biashara Zangu) ── */}
                    {merchants.length > 0 && (
                        <Card className="border-brand-500/20 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-brand-600 to-brand-500 pb-4">
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Store className="h-5 w-5" /> Biashara Zangu
                                </CardTitle>
                                <p className="text-brand-100 text-xs mt-0.5">
                                    {merchants.length === 1 ? '1 biashara' : `${merchants.length} biashara`} • Dhibiti biashara zako hapa
                                </p>
                            </CardHeader>
                            <CardContent className="p-0">
                                {merchants.map((merchant, idx) => (
                                    <div
                                        key={merchant.id}
                                        className={`${idx > 0 ? 'border-t border-border/60' : ''}`}
                                    >
                                        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                                            {/* Avatar */}
                                            <div className="relative shrink-0">
                                                {merchant.avatar_url ? (
                                                    <img
                                                        src={merchant.avatar_url}
                                                        alt={merchant.display_name}
                                                        className="h-12 w-12 rounded-xl object-cover ring-2 ring-brand-100"
                                                    />
                                                ) : (
                                                    <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center ring-2 ring-brand-100">
                                                        <Store className="h-6 w-6 text-brand-500" />
                                                    </div>
                                                )}
                                                {merchant.is_default && (
                                                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full ring-2 ring-background" title="Biashara Kuu" />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate leading-tight">
                                                    {merchant.display_name || merchant.username}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                                                    @{merchant.username}
                                                    {merchant.kyc_status && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${merchant.kyc_status === 'approved'
                                                            ? 'bg-green-100 text-green-700'
                                                            : merchant.kyc_status === 'pending'
                                                                ? 'bg-yellow-100 text-yellow-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {merchant.kyc_status === 'approved' ? '✓ Imethibitishwa' : merchant.kyc_status}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Quick action buttons */}
                                        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                                            <Link
                                                href={`/merchant/${merchant.username}/dashboard`}
                                                className="flex flex-row items-center gap-1.5 p-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors group border border-brand-100/50"
                                            >
                                                <LayoutDashboard className="h-5 w-5 text-brand-600 group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-semibold text-brand-700">Dashboard</span>
                                            </Link>
                                            <Link
                                                href={`/merchant/${merchant.username}/settings`}
                                                className="flex flex-row items-center gap-1.5 p-2.5 rounded-xl bg-muted/40 hover:bg-muted transition-colors group"
                                            >
                                                <Settings className="h-5 w-5 text-muted-foreground group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-semibold text-muted-foreground">Mipangilio</span>
                                            </Link>
                                            <a
                                                href={`/m/${merchant.username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-row items-center gap-1.5 p-2.5 rounded-xl bg-muted/40 hover:bg-muted transition-colors group"
                                            >
                                                <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-semibold text-muted-foreground">Biashara Yangu</span>
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Register as merchant CTA (non-merchants only) */}
                    {!auth?.user?.is_merchant && (
                        <Card className="border-dashed border-2 border-brand-300 bg-brand-50/50 hover:bg-brand-50 transition-colors">
                            <CardContent className="flex items-center justify-between p-5">
                                <div>
                                    <p className="font-bold text-brand-900">Fungua Biashara Yako</p>
                                    <p className="text-sm text-brand-700 mt-0.5">Anza kuuza bidhaa leo na Takeer</p>
                                </div>
                                <Link
                                    href="/merchant/register"
                                    className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-all active:scale-95 shadow-md"
                                >
                                    Jiunge Sasa <ChevronRight className="h-4 w-4" />
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Collapsible Security Profile Card ── */}
                    <Card className="border-border shadow-sm overflow-hidden">
                        <button
                            className="w-full text-left bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between p-5"
                            onClick={() => setIsSecurityOpen(!isSecurityOpen)}
                        >
                            <div className="flex items-center gap-3">
                                <Shield className="h-5 w-5 text-muted-foreground" />
                                <span className="font-bold text-foreground">Wasifu na Usalama</span>
                            </div>
                            {isSecurityOpen ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                        </button>

                        {isSecurityOpen && (
                            <CardContent className="p-6 border-t border-border animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-dashed gap-1">
                                        <span className="text-muted-foreground text-sm font-medium">Namba ya Simu</span>
                                        <span className="font-bold text-foreground">
                                            {auth?.user?.phone_number ?
                                                `${auth.user.phone_number.slice(0, 4)} ••• ••• ${auth.user.phone_number.slice(-3)}` :
                                                '+255 ••• ••• ***'}
                                        </span>
                                    </div>

                                    <div className="pt-6 grid grid-cols-2 gap-3">
                                        <Link href="/profile/settings" className="w-full flex items-center justify-center h-11 rounded-xl font-semibold border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                                            <Settings className="mr-2 h-4 w-4" /> Mipangilio
                                        </Link>
                                        <Button
                                            variant="outline"
                                            className="w-full h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold transition-colors"
                                            onClick={handleLogout}
                                        >
                                            <LogOut className="mr-2 h-4 w-4 relative top-[1px]" /> Toka Nje
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                </div>
            </div>

            {/* ── Create New Shop Modal ── */}
            <Dialog open={isCreateShopModalOpen} onOpenChange={(open) => {
                setIsCreateShopModalOpen(open);
                if (!open) clearCreateErrors();
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ongeza Biashara Mpya</DialogTitle>
                        <DialogDescription>
                            Tengeneza biashara nyingine udhibiti biashara tofauti.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateShop} className="space-y-5 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">Jina la Biashara (Business Name)</label>
                            <Input
                                required
                                maxLength="100"
                                placeholder="Mf. Takeer Tech Store"
                                className="h-12 font-medium"
                                value={createData.store_name}
                                onChange={e => {
                                    setCreateData('store_name', e.target.value);
                                    if (!createData.display_name) {
                                        setCreateData('display_name', e.target.value);
                                    }
                                }}
                            />
                            {createErrors.store_name && <p className="text-sm text-red-500 font-medium">{createErrors.store_name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">Jina Linaloonekana (Display Name)</label>
                            <Input
                                required
                                maxLength="100"
                                placeholder="Mf. Tech Store"
                                className="h-12 font-medium"
                                value={createData.display_name}
                                onChange={e => setCreateData('display_name', e.target.value)}
                            />
                            {createErrors.display_name && <p className="text-sm text-red-500 font-medium">{createErrors.display_name}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-muted-foreground">Nchi (Country)</label>
                                <select
                                    required
                                    value={createData.country_id}
                                    onChange={e => setCreateData('country_id', e.target.value)}
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {countries.map(country => (
                                        <option key={country.id} value={country.id}>{country.name}</option>
                                    ))}
                                </select>
                                {createErrors.country_id && <p className="text-sm text-red-500 font-medium">{createErrors.country_id}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-muted-foreground">Sarafu (Currency)</label>
                                <select
                                    required
                                    value={createData.currency_id}
                                    onChange={e => setCreateData('currency_id', e.target.value)}
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {currencies.map(currency => (
                                        <option key={currency.id} value={currency.id}>{currency.name} ({currency.code})</option>
                                    ))}
                                </select>
                                {createErrors.currency_id && <p className="text-sm text-red-500 font-medium">{createErrors.currency_id}</p>}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-6 pt-2">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-11" onClick={() => setIsCreateShopModalOpen(false)}>
                                Ghairi
                            </Button>
                            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 h-11 font-bold" disabled={createProcessing || !createData.store_name}>
                                {createProcessing ? 'Inahifadhi...' : 'Tengeneza Biashara'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}
