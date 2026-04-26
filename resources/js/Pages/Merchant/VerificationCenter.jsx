import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { 
    ShieldCheck, 
    Upload, 
    Clock, 
    CheckCircle2, 
    User, 
    MapPin, 
    Briefcase,
    Camera,
    ArrowLeft,
    Mail,
    Phone,
    Fingerprint,
    CreditCard,
    FileText,
    Globe
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export default function VerificationCenter({ merchantUsername, auth }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [kycData, setKycData] = useState(null);
    const [status, setStatus] = useState('unverified'); // unverified, pending, verified, rejected
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [isCountryActive, setIsCountryActive] = useState(true);
    const [countryName, setCountryName] = useState('');


    const [form, setForm] = useState({
        first_name: auth?.user?.name?.split(' ')[0] || '',
        middle_name: '',
        last_name: auth?.user?.name?.split(' ').slice(1).join(' ') || '',
        id_type: '',
        id_number: '',
        date_of_birth: '',
        country: 'Tanzania',
        id_front: null,
        id_back: null,
    });

    const [previews, setPreviews] = useState({
        id_front: null,
        id_back: null,
    });

    useEffect(() => {
        fetchKycStatus();
    }, []);

    const fetchKycStatus = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/kyc/api`);
            setKycData(res.data.kyc);
            setStatus(res.data.merchant_kyc_status);
            setIsCountryActive(res.data.is_country_active);
            setCountryName(res.data.country?.name || '');
            
            if (res.data.merchant_kyc_status === 'pending') {
                setView('main');
            }
        } catch (err) {
            console.error('Failed to load verification status', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            setForm(prev => ({ ...prev, [field]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDocSelect = (docType) => {
        setSelectedDoc(docType);
        setForm(prev => ({ ...prev, id_type: docType }));
        setView('form');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const formData = new FormData();
        Object.keys(form).forEach(key => {
            if (form[key]) {
                formData.append(key, form[key]);
            }
        });

        try {
            await axios.post(`/merchant/${merchantUsername}/kyc/api`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Ombi lako limepokelewa!');
            fetchKycStatus();
        } catch (err) {
            const msg = err.response?.data?.message || 'Kuna tatizo. Tafadhali jaribu tena.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-[60vh] text-slate-500 font-bold">
                    Inapakia...
                </div>
            </AppLayout>
        );
    }

    if (!isCountryActive) {
        return (
            <AppLayout>
                <Head title="Coming Soon | Takeer" />
                <div className="max-w-xl mx-auto py-20 px-4 text-center">
                    <div className="h-24 w-24 bg-brand-50 text-brand-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-600/10 animate-bounce-slow">
                        <Globe className="h-12 w-12" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
                        Takeer inakuja hivi punde {countryName}!
                    </h1>
                    <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                        Tunafanyia kazi upanuzi wetu nchini {countryName} ili kuwezesha malipo na huduma bora za biashara. 
                        Utaweza kuanza kuuza mara tu tutakapofungua rasmi.
                    </p>
                    <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 mb-8">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Pata taarifa mapema</p>
                        <p className="text-slate-700 font-bold mb-6">Tutumie namba yako ya WhatsApp au barua pepe ili tukujulishe tutakapofungua.</p>
                        <div className="flex gap-2">
                            <Input placeholder="Namba ya simu au Email" className="h-14 rounded-2xl border-2 shadow-inner" />
                            <Button className="h-14 px-8 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black shadow-lg shadow-brand-600/20">
                                Nijulishe
                            </Button>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={() => router.visit('/profile')} className="text-slate-500 font-bold gap-2">
                        <ArrowLeft className="h-4 w-4" /> Rudi kwenye wasifu
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Kituo cha Uthibitisho | Takeer" />

            <div className="max-w-xl mx-auto py-8 px-4">
                
                {/* ── Header ── */}
                <div className="flex items-center gap-4 mb-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (view === 'form') setView('selection');
                            else if (view === 'selection') setView('main');
                            else router.visit('/profile');
                        }}
                        className="rounded-2xl h-12 w-12 bg-slate-50 border-2 border-slate-100 hover:bg-slate-100 transition-all"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kituo cha Uthibitisho</h1>
                        <p className="text-sm font-bold text-slate-500">Kamilisha hatua hizi ili kuanza kuuza.</p>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {status === 'pending' ? (
                        <motion.div 
                            key="pending"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-12 px-6 rounded-[2.5rem] border-2 border-amber-100 bg-amber-50/30 space-y-6"
                        >
                            <div className="h-24 w-24 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mx-auto animate-pulse">
                                <Clock className="h-12 w-12" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900">Inahakikiwa...</h2>
                                <p className="text-slate-600 font-medium max-w-sm mx-auto">
                                    Tumeshapokea nyaraka zako. Timu yetu inazihakiki sasa hivi. Huu mchakato huchukua masaa 12-24.
                                </p>
                            </div>
                            <Button 
                                variant="outline" 
                                className="h-12 rounded-2xl border-2 border-amber-200 text-amber-700 font-bold hover:bg-amber-100"
                                onClick={() => router.visit('/profile')}
                            >
                                Rudi Kwenye Profile
                            </Button>
                        </motion.div>
                    ) : view === 'main' ? (
                        <motion.div 
                            key="main"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-8"
                        >
                            {/* Contact Verification Section */}
                            <div className="space-y-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">1. Uthibitisho wa Mawasiliano</h2>
                                <div className="grid gap-3">
                                    {/* Phone (Always verified via OTP) */}
                                    <div className="flex items-center justify-between p-5 rounded-3xl border-2 border-slate-100 bg-white">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                                <Phone className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">Nambari ya Simu</p>
                                                <p className="text-xs font-bold text-slate-500">{auth?.user?.phone_number}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                                            <CheckCircle2 className="h-3 w-3" /> Imethibitishwa
                                        </div>
                                    </div>

                                    {/* Email (Google Login) */}
                                    <div className="flex items-center justify-between p-5 rounded-3xl border-2 border-slate-100 bg-white">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                                <Mail className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">Barua Pepe (Email)</p>
                                                <p className="text-xs font-bold text-slate-500">Thibitisha ukitumia Google</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm"
                                            className="h-10 px-4 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 flex items-center gap-2"
                                        >
                                            <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-4 w-4" alt="Google" />
                                            Unganisha
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Identity Verification Section */}
                            <div className="space-y-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">2. Uthibitisho wa Utambulisho</h2>
                                <Card className="border-2 border-slate-100 overflow-hidden bg-slate-50/50">
                                    <CardContent className="p-6 space-y-6">
                                        <div className="flex gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
                                                <ShieldCheck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">Kitambulisho cha Taifa / Pasipoti</h3>
                                                <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
                                                    Tunahitaji kuhakiki utambulisho wako ili kuzuia utapeli na kuhakikisha usalama wa miamala.
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            className="w-full h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-lg shadow-none border-b-4 border-brand-800 active:border-b-0 active:translate-y-1 transition-all"
                                            onClick={() => setView('selection')}
                                        >
                                            Anza Uthibitisho
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </motion.div>
                    ) : view === 'selection' ? (
                        <motion.div 
                            key="selection"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <h2 className="text-xl font-black text-slate-900">Chagua Aina ya Kitambulisho</h2>
                            <div className="grid gap-4">
                                <DocTypeCard 
                                    icon={Fingerprint} 
                                    title="NIDA (Kitambulisho cha Taifa)" 
                                    desc="Njia rahisi na ya haraka zaidi ya kuhakiki."
                                    onClick={() => handleDocSelect('NIDA')}
                                />
                                <DocTypeCard 
                                    icon={FileText} 
                                    title="Pasipoti (Passport)" 
                                    desc="Uthibitisho wa kimataifa."
                                    onClick={() => handleDocSelect('Passport')}
                                />
                                <DocTypeCard 
                                    icon={CreditCard} 
                                    title="Kitambulisho cha Mpiga Kura" 
                                    desc="Voters ID ya Tanzania."
                                    onClick={() => handleDocSelect('Voters ID')}
                                />
                            </div>
                        </motion.div>
                    ) : view === 'form' && (
                        <motion.div 
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pb-20"
                        >
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="p-6 rounded-[2rem] border-2 border-brand-100 bg-brand-50/20">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-10 w-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
                                            <Fingerprint className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-lg font-black text-brand-700">{selectedDoc} Verification</h3>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500">Hakikisha maelezo unayojaza yanalingana na kitambulisho chako.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Jina la Kwanza</label>
                                            <Input 
                                                value={form.first_name}
                                                onChange={e => setForm({...form, first_name: e.target.value})}
                                                className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Jina la Mwisho</label>
                                            <Input 
                                                value={form.last_name}
                                                onChange={e => setForm({...form, last_name: e.target.value})}
                                                className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tarehe ya Kuzaliwa</label>
                                        <Input 
                                            type="date"
                                            value={form.date_of_birth}
                                            onChange={e => setForm({...form, date_of_birth: e.target.value})}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Namba ya Kitambulisho ({selectedDoc})</label>
                                        <Input 
                                            placeholder="Ingiza namba ya kitambulisho"
                                            value={form.id_number}
                                            onChange={e => setForm({...form, id_number: e.target.value})}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                            required
                                        />
                                    </div>

                                    {/* File Uploads */}
                                    <div className="grid grid-cols-1 gap-6 pt-4">
                                        <div className="space-y-3">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Picha ya Mbele ya Kitambulisho</label>
                                            <UploadBox 
                                                id="id_front" 
                                                preview={previews.id_front} 
                                                onChange={(e) => handleFileChange(e, 'id_front')} 
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Picha ya Nyuma ya Kitambulisho</label>
                                            <UploadBox 
                                                id="id_back" 
                                                preview={previews.id_back} 
                                                onChange={(e) => handleFileChange(e, 'id_back')} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    type="submit"
                                    className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black text-xl shadow-none border-b-4 border-brand-800 active:border-b-0 active:translate-y-1 transition-all"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Inatuma...' : 'Wasilisha Maelezo'}
                                </Button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AppLayout>
    );
}

function DocTypeCard({ icon: Icon, title, desc, onClick }) {
    return (
        <button 
            onClick={onClick}
            className="flex items-center gap-5 p-6 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-brand-500 hover:bg-brand-50/30 transition-all text-left w-full active:scale-[0.98]"
        >
            <div className="h-14 w-14 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-900">
                <Icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
                <h3 className="font-black text-slate-900">{title}</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="h-6 w-6 text-slate-300" />
        </button>
    );
}

function UploadBox({ id, preview, onChange }) {
    return (
        <div className="relative group">
            <input 
                type="file" 
                id={id} 
                className="hidden" 
                accept="image/*" 
                onChange={onChange}
            />
            <label 
                htmlFor={id}
                className={`flex flex-col items-center justify-center w-full h-64 border-4 border-dashed rounded-[2.5rem] cursor-pointer transition-all ${
                    preview 
                        ? 'border-brand-400 bg-brand-50/20' 
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200'
                }`}
            >
                {preview ? (
                    <div className="relative w-full h-full p-3">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-[2rem]" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2rem]">
                            <div className="bg-white p-3 rounded-full text-slate-900">
                                <Camera className="h-6 w-6" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="h-16 w-16 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-none">
                            <Camera className="h-8 w-8" />
                        </div>
                        <p className="text-sm font-black text-slate-700">Bofya kupiga picha / pakia</p>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Front Side</p>
                    </>
                )}
            </label>
        </div>
    );
}

function ChevronRight({ className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
    );
}
