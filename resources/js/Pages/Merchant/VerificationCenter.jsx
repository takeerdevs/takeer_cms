import React, { useState, useEffect } from 'react';
import MerchantLayout from '@/Layouts/MerchantLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { 
    ShieldCheck, 
    Upload, 
    Clock, 
    AlertCircle, 
    CheckCircle2, 
    FileText, 
    User, 
    MapPin, 
    Briefcase,
    Camera,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function VerificationCenter({ merchantUsername }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [kycData, setKycData] = useState(null);
    const [status, setStatus] = useState('unverified'); // unverified, pending, verified, rejected
    const [view, setView] = useState('status'); // status, form

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        id_type: 'National ID Card (NIDA)',
        id_number: '',
        date_of_birth: '',
        gender: '',
        residential_address: '',
        occupation: '',
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
            
            if (res.data.merchant_kyc_status === 'unverified' || res.data.merchant_kyc_status === 'rejected') {
                setView('form');
            } else {
                setView('status');
            }
        } catch (err) {
            toast.error('Failed to load verification status');
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
            toast.success('KYC submitted successfully!');
            fetchKycStatus();
        } catch (err) {
            const msg = err.response?.data?.message || 'Submission failed. Please check your data.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <MerchantLayout merchantUsername={merchantUsername}>
                <div className="flex items-center justify-center h-64 text-slate-500">
                    Yukipakia maelezo ya uthibitisho...
                </div>
            </MerchantLayout>
        );
    }

    return (
        <MerchantLayout merchantUsername={merchantUsername}>
            <Head title="Verification Center | Takeer" />

            <div className="max-w-2xl mx-auto py-6 px-4">
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 border border-brand-200">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Uthibitisho wa Akaunti</h1>
                        <p className="text-sm text-slate-600">Thibitisha utambulisho wako ili kuanza kutoa pesa.</p>
                    </div>
                </div>

                {view === 'status' && (
                    <div className="space-y-6">
                        <StatusCard status={status} kycData={kycData} onRetry={() => setView('form')} />
                        
                        {status === 'pending' && (
                            <Card className="border-slate-200 bg-amber-50/50">
                                <CardContent className="p-6 flex gap-4">
                                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">Maombi yanachakatwa</h3>
                                        <p className="text-sm text-slate-600 mt-1">
                                            Timu yetu inahakiki maelezo yako. Huu mchakato huchukua masaa 12 hadi 24 ya kazi. Tutakujulisha kupitia SMS yakikamilika.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {kycData && (
                            <div className="space-y-4">
                                <h2 className="text-lg font-black text-slate-900 px-1">Maelezo Yaliyowasilishwa</h2>
                                <div className="grid grid-cols-1 gap-3">
                                    <SummaryItem icon={User} label="Jina Kamili" value={`${kycData.first_name} ${kycData.last_name}`} />
                                    <SummaryItem icon={FileText} label="Aina ya Kitambulisho" value={kycData.id_type} />
                                    <SummaryItem icon={ShieldCheck} label="Namba ya Kitambulisho" value={kycData.id_number} masked />
                                    <SummaryItem icon={MapPin} label="Anwani ya Makazi" value={kycData.residential_address} />
                                    <SummaryItem icon={Briefcase} label="Kazi" value={kycData.occupation} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {view === 'form' && (
                    <form onSubmit={handleSubmit} className="space-y-8 pb-20">
                        <div className="space-y-4">
                            <h2 className="text-lg font-black text-slate-900">1. Taarifa Binafsi</h2>
                            <p className="text-sm text-slate-600">Tafadhali jaza maelezo yako kama yanavyoonekana kwenye kitambulisho chako.</p>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Jina la Kwanza</label>
                                    <Input 
                                        placeholder="Mfano: John" 
                                        value={form.first_name}
                                        onChange={e => setForm({...form, first_name: e.target.value})}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Jina la Mwisho</label>
                                    <Input 
                                        placeholder="Mfano: John" 
                                        value={form.last_name}
                                        onChange={e => setForm({...form, last_name: e.target.value})}
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Aina ya Kitambulisho</label>
                                <select 
                                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    value={form.id_type}
                                    onChange={e => setForm({...form, id_type: e.target.value})}
                                    required
                                >
                                    <option>National ID Card (NIDA)</option>
                                    <option>Passport</option>
                                    <option>Voter ID</option>
                                    <option>Driver License</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Namba ya Kitambulisho</label>
                                <Input 
                                    placeholder="Mfano: 19900101-12345-00001-23" 
                                    value={form.id_number}
                                    onChange={e => setForm({...form, id_number: e.target.value})}
                                    required 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Tarehe ya Kuzaliwa</label>
                                    <Input 
                                        type="date"
                                        value={form.date_of_birth}
                                        onChange={e => setForm({...form, date_of_birth: e.target.value})}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Jinsia</label>
                                    <select 
                                        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={form.gender}
                                        onChange={e => setForm({...form, gender: e.target.value})}
                                        required
                                    >
                                        <option value="">Chagua Jinsia</option>
                                        <option>Male</option>
                                        <option>Female</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Anwani ya Makazi</label>
                                <Input 
                                    placeholder="Mfano: Kariakoo, Dar es Salaam" 
                                    value={form.residential_address}
                                    onChange={e => setForm({...form, residential_address: e.target.value})}
                                    required 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Kazi / Taaluma</label>
                                <Input 
                                    placeholder="Mfano: Retail trader" 
                                    value={form.occupation}
                                    onChange={e => setForm({...form, occupation: e.target.value})}
                                    required 
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-lg font-black text-slate-900">2. Pakia Kitambulisho</h2>
                            <p className="text-sm text-slate-600">Piga picha kitambulisho chako kwa ukaribu na kuhakikisha maandishi yanaonekana vizuri.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Mbele ya Kitambulisho</label>
                                    <UploadArea 
                                        preview={previews.id_front} 
                                        onChange={(e) => handleFileChange(e, 'id_front')} 
                                        id="id_front"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nyuma ya Kitambulisho</label>
                                    <UploadArea 
                                        preview={previews.id_back} 
                                        onChange={(e) => handleFileChange(e, 'id_back')} 
                                        id="id_back"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <Button 
                                type="submit" 
                                className="w-full h-14 text-lg bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-200"
                                disabled={submitting}
                            >
                                {submitting ? 'Inatuma...' : 'Wasilisha Maombi'}
                            </Button>
                            <p className="text-center text-xs text-slate-500 mt-4 px-6">
                                Kwa kubofya wasilisha, unakubali kwamba maelezo uliyotoa ni ya kweli. Maelezo ya uwongo yatapelekea akaunti yako kufungiwa.
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </MerchantLayout>
    );
}

function StatusCard({ status, kycData, onRetry }) {
    const configs = {
        unverified: {
            icon: AlertCircle,
            color: 'bg-slate-100 text-slate-600 border-slate-200',
            label: 'HAUJATHIBITISHWA',
            title: 'Anza Uthibitisho',
            desc: 'Akaunti yako bado haijathibitishwa. Kamilisha hatua hizi ili kuanza kutoa pesa.'
        },
        pending: {
            icon: Clock,
            color: 'bg-amber-100 text-amber-600 border-amber-200',
            label: 'INACHAKATWA',
            title: 'Tumeshapokea maombi yako',
            desc: 'Tunasubiri uhakiki wa timu yetu. Hii huchukua mda mchache.'
        },
        verified: {
            icon: CheckCircle2,
            color: 'bg-emerald-100 text-emerald-600 border-emerald-200',
            label: 'IMETHIBITISHWA',
            title: 'Akaunti imethibitishwa',
            desc: 'Hongera! Sasa unaweza kutoa pesa na kufanya miamala yote bila kikomo.'
        },
        rejected: {
            icon: AlertCircle,
            color: 'bg-red-100 text-red-600 border-red-200',
            label: 'IMEKATALIWA',
            title: 'Uthibitisho umeshindikana',
            desc: kycData?.rejection_reason || 'Picha za kitambulisho hazikuonekana vizuri. Tafadhali jaribu tena.'
        }
    };

    const config = configs[status] || configs.unverified;
    const Icon = config.icon;

    return (
        <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardContent className="p-0">
                <div className={`p-4 flex items-center justify-between border-b ${config.color} border-opacity-30 bg-opacity-50`}>
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs font-black tracking-widest">{config.label}</span>
                    </div>
                </div>
                <div className="p-6">
                    <h3 className="text-xl font-black text-slate-900">{config.title}</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">{config.desc}</p>
                    {status === 'rejected' && (
                        <Button 
                            variant="outline" 
                            className="mt-4 border-red-200 text-red-600 hover:bg-red-50"
                            onClick={onRetry}
                        >
                            Jaribu Tena
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function SummaryItem({ icon: Icon, label, value, masked }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none mb-1">{label}</p>
                    <p className="font-bold text-slate-900 text-sm">
                        {masked ? '•••• •••• •••• ' + value.slice(-4) : value}
                    </p>
                </div>
            </div>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
    );
}

function UploadArea({ preview, onChange, id }) {
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
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                    preview 
                        ? 'border-brand-300 bg-brand-50/20' 
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                }`}
            >
                {preview ? (
                    <div className="relative w-full h-full p-2">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl shadow-sm" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <div className="bg-white p-2 rounded-full text-slate-900">
                                <Camera className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                            <Camera className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-600">Bofya kupiga picha / pakia</p>
                        <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, JPEG • Max 5MB</p>
                    </>
                )}
            </label>
        </div>
    );
}
