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
    Globe,
    BadgeCheck,
    AlertCircle,
    Trash2,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '@/lib/i18n';

export default function VerificationCenter({ merchantUsername, auth }) {
    const { copy } = useLocale();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [kycData, setKycData] = useState(null);
    const [status, setStatus] = useState('unverified'); // unverified, pending, verified, rejected
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [isCountryActive, setIsCountryActive] = useState(true);
    const [countryName, setCountryName] = useState('');
    const [view, setView] = useState('main');
    const [serviceCategories, setServiceCategories] = useState([]);
    const [serviceCredentials, setServiceCredentials] = useState([]);
    const [legalDocuments, setLegalDocuments] = useState([]);
    const [legalLoading, setLegalLoading] = useState(true);
    const [legalSubmitting, setLegalSubmitting] = useState(false);
    const [credentialForm, setCredentialForm] = useState({
        service_category_id: '',
        document_type: 'professional_license',
        document_name: '',
        document_number: '',
        issuer: '',
        issued_at: '',
        expires_at: '',
        document: null,
    });

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
        fetchServiceCategories();
        fetchServiceCredentials();
        fetchLegalDocuments();
    }, []);

    const fetchLegalDocuments = async () => {
        try {
            const merchantId = auth?.user?.merchant_profiles?.find((profile) => profile.username === merchantUsername)?.id;
            if (!merchantId) return;

            const res = await axios.get('/api/legal/documents', { params: { merchant_id: merchantId } });
            setLegalDocuments(res.data?.documents || []);
        } catch (err) {
            console.error('Failed to load merchant legal documents', err);
        } finally {
            setLegalLoading(false);
        }
    };

    const acceptMerchantDocuments = async () => {
        const merchantId = auth?.user?.merchant_profiles?.find((profile) => profile.username === merchantUsername)?.id;
        if (!merchantId || legalDocuments.length === 0) return;

        setLegalSubmitting(true);
        try {
            await axios.post('/api/legal/acceptances', { merchant_id: merchantId, accept: true });
            toast.success(copy('Merchant terms accepted and saved.', 'Masharti ya mfanyabiashara yamekubaliwa na kuhifadhiwa.'));
            fetchLegalDocuments();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Merchant terms are not enabled by administration yet.', 'Masharti ya mfanyabiashara bado hayajawezeshwa na utawala.'));
        } finally {
            setLegalSubmitting(false);
        }
    };

    const allLegalDocumentsAccepted = legalDocuments.length > 0 && legalDocuments.every((document) => document.accepted);

    const serviceCategoryChoices = serviceCategories.flatMap((category) => {
        const children = category.children || [];
        if (children.length === 0) {
            return [{
                id: category.id,
                label: category.name,
                risk_level: category.risk_level || 'standard',
                required_documents: category.required_documents || [],
            }];
        }

        return children.map((child) => ({
            id: child.id,
            label: `${category.name} / ${child.name}`,
            risk_level: child.risk_level || category.risk_level || 'standard',
            required_documents: child.required_documents || category.required_documents || [],
        }));
    });

    const categoriesRequiringLicense = serviceCategoryChoices.filter((category) => (
        (category.required_documents || []).includes('professional_license')
        || ['elevated', 'regulated', 'restricted'].includes(category.risk_level)
    ));

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

    const fetchServiceCategories = async () => {
        try {
            const res = await axios.get('/api/service-categories');
            setServiceCategories(res.data?.data || []);
        } catch (err) {
            console.error('Failed to load service categories', err);
        }
    };

    const fetchServiceCredentials = async () => {
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/service-credentials/api`);
            setServiceCredentials(res.data?.credentials || []);
        } catch (err) {
            console.error('Failed to load service credentials', err);
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

    const handleCredentialFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setCredentialForm((prev) => ({ ...prev, document: file }));
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
            toast.success(copy('Your application has been received.', 'Ombi lako limepokelewa.'));
            fetchKycStatus();
        } catch (err) {
            const msg = err.response?.data?.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.');
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const submitServiceCredential = async (event) => {
        event.preventDefault();
        if (!credentialForm.service_category_id || !credentialForm.document_name || !credentialForm.document) {
            toast.error(copy('Choose a category, certificate/license name, and file.', 'Chagua kategoria, jina la cheti/leseni na faili.'));
            return;
        }

        setSubmitting(true);
        const formData = new FormData();
        Object.entries(credentialForm).forEach(([key, value]) => {
            if (value) formData.append(key, value);
        });

        try {
            await axios.post(`/merchant/${merchantUsername}/service-credentials/api`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(copy('Credential received.', 'Credential imepokelewa.'));
            setCredentialForm({
                service_category_id: '',
                document_type: 'professional_license',
                document_name: '',
                document_number: '',
                issuer: '',
                issued_at: '',
                expires_at: '',
                document: null,
            });
            setView('main');
            fetchServiceCredentials();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not submit the credential.', 'Imeshindwa kutuma credential.'));
        } finally {
            setSubmitting(false);
        }
    };

    const deleteCredential = async (credential) => {
        if (!window.confirm(copy('Delete this credential?', 'Futa credential hii?'))) return;

        try {
            await axios.delete(`/merchant/${merchantUsername}/service-credentials/api/${credential.id}`);
            toast.success(copy('Credential deleted.', 'Credential imefutwa.'));
            fetchServiceCredentials();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not delete the credential.', 'Imeshindwa kufuta credential.'));
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
                <Head title={`${copy('Coming soon', 'Inakuja hivi karibuni')} | Takeer`} />
                <div className="max-w-xl mx-auto py-20 px-4 text-center">
                    <div className="h-24 w-24 bg-brand-50 text-brand-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-600/10 animate-bounce-slow">
                        <Globe className="h-12 w-12" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
                        {copy('Takeer is coming soon to', 'Takeer inakuja hivi karibuni')} {countryName}!
                    </h1>
                    <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                        {copy('We are working on expanding into', 'Tunafanyia kazi upanuzi wetu nchini')} {countryName} {copy('to enable payments and better business services. You can start selling as soon as we officially open.', 'ili kuwezesha malipo na huduma bora za biashara. Utaweza kuanza kuuza mara tu tutakapofungua rasmi.')}
                    </p>
                    <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 mb-8">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">{copy('Get early updates', 'Pata taarifa mapema')}</p>
                        <p className="text-slate-700 font-bold mb-6">{copy('Send your WhatsApp number or email so we can notify you when we open.', 'Tutumie namba yako ya WhatsApp au barua pepe ili tukujulishe tutakapofungua.')}</p>
                        <div className="flex gap-2">
                            <Input placeholder={copy('Phone number or email', 'Namba ya simu au barua pepe')} className="h-14 rounded-2xl border-2 shadow-inner" />
                            <Button className="h-14 px-8 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black shadow-lg shadow-brand-600/20">
                                {copy('Notify me', 'Nijulishe')}
                            </Button>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={() => router.visit('/profile')} className="text-slate-500 font-bold gap-2">
                        <ArrowLeft className="h-4 w-4" /> {copy('Back to profile', 'Rudi kwenye wasifu')}
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${copy('Verification center', 'Kituo cha uthibitisho')} | Takeer`} />

            <div className="max-w-xl mx-auto py-8 px-4">
                
                {/* ── Header ── */}
                <div className="flex items-center gap-4 mb-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (view === 'form') setView('selection');
                            else if (view === 'credential') setView('main');
                            else if (view === 'selection') setView('main');
                            else router.visit('/profile');
                        }}
                        className="rounded-2xl h-12 w-12 bg-slate-50 border-2 border-slate-100 hover:bg-slate-100 transition-all"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{copy('Verification center', 'Kituo cha uthibitisho')}</h1>
                        <p className="text-sm font-bold text-slate-500">{copy('Complete these steps to start selling.', 'Kamilisha hatua hizi ili kuanza kuuza.')}</p>
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
                                <h2 className="text-2xl font-black text-slate-900">{copy('Under review...', 'Inahakikiwa...')}</h2>
                                <p className="text-slate-600 font-medium max-w-sm mx-auto">
                                    {copy('We have received your documents. Our team is reviewing them now. This process takes 12–24 hours.', 'Tumeshapokea nyaraka zako. Timu yetu inazihakiki sasa hivi. Huu mchakato huchukua masaa 12–24.')}
                                </p>
                            </div>
                            <Button 
                                variant="outline" 
                                className="h-12 rounded-2xl border-2 border-amber-200 text-amber-700 font-bold hover:bg-amber-100"
                                onClick={() => router.visit('/profile')}
                            >
                                {copy('Back to profile', 'Rudi kwenye wasifu')}
                            </Button>
                        </motion.div>
                    ) : view === 'main' ? (
                        <motion.div 
                            key="main"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-8"
                        >
                            {/* Merchant legal acceptance */}
                            <div className="space-y-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">0. {copy('Selling and provider terms', 'Masharti ya kuuza na mtoa huduma')}</h2>
                                <Card className="border-2 border-brand-100 overflow-hidden bg-brand-50/30">
                                    <CardContent className="p-6 space-y-5">
                                        <div className="flex gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">{copy('Merchant Marketplace Agreement', 'Makubaliano ya Soko la Mfanyabiashara')}</h3>
                                                <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
                                                    {copy('Read and accept the merchant, PSP processing, refunds, fees, privacy, restricted products, and complaints terms before publishing a listing.', 'Soma na ukubali masharti ya mfanyabiashara, uchakataji wa PSP, marejesho, ada, faragha, bidhaa zilizozuiwa na malalamiko kabla ya kuchapisha bidhaa.')}
                                                </p>
                                            </div>
                                        </div>

                                        {legalLoading ? (
                                            <p className="text-xs font-bold text-slate-500">{copy('Loading document status...', 'Inapakia hali ya nyaraka...')}</p>
                                        ) : legalDocuments.length === 0 ? (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                                                {copy('Documents are still awaiting approval/activation. You can read them in the', 'Nyaraka bado zinasubiri idhini/kuwashwa. Unaweza kuzisoma kwenye')} <a href="/legal/merchant-marketplace-agreement" target="_blank" rel="noreferrer" className="font-black underline">{copy('Merchant Agreement', 'Makubaliano ya Mfanyabiashara')}</a> {copy('and', 'na')} <a href="/legal" target="_blank" rel="noreferrer" className="font-black underline">{copy('Legal Center', 'Kituo cha Sheria')}</a>.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-2">
                                                    {legalDocuments.map((document) => (
                                                        <div key={document.document_type} className="flex items-center justify-between gap-3 rounded-xl border border-white bg-white px-3 py-2">
                                                            <a href={`/legal/${document.document_type === 'merchant_marketplace_agreement' ? 'merchant-marketplace-agreement' : document.document_type.replaceAll('_', '-')}`} target="_blank" rel="noreferrer" className="text-xs font-black text-brand-700 underline">
                                                                {document.document_type.replaceAll('_', ' ')} · {document.version}
                                                            </a>
                                                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${document.accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {document.accepted ? copy('Accepted', 'Imekubaliwa') : copy('Required', 'Inahitajika')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={acceptMerchantDocuments}
                                                    disabled={legalSubmitting || allLegalDocumentsAccepted}
                                                    className="w-full h-12 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black"
                                                >
                                                    {allLegalDocumentsAccepted ? copy('Terms accepted', 'Masharti yamekubaliwa') : legalSubmitting ? copy('Saving...', 'Inahifadhi...') : copy('Read and accept all terms', 'Soma na kubali masharti yote')}
                                                </Button>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Contact Verification Section */}
                            <div className="space-y-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">1. {copy('Contact verification', 'Uthibitisho wa mawasiliano')}</h2>
                                <div className="grid gap-3">
                                    {/* Phone (Always verified via OTP) */}
                                    <div className="flex items-center justify-between p-5 rounded-3xl border-2 border-slate-100 bg-white">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                                <Phone className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">{copy('Phone number', 'Nambari ya simu')}</p>
                                                <p className="text-xs font-bold text-slate-500">{auth?.user?.phone_number}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                                            <CheckCircle2 className="h-3 w-3" /> {copy('Verified', 'Imethibitishwa')}
                                        </div>
                                    </div>

                                    {/* Email (Google Login) */}
                                    <div className="flex items-center justify-between p-5 rounded-3xl border-2 border-slate-100 bg-white">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                                <Mail className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">{copy('Email', 'Barua pepe')}</p>
                                                <p className="text-xs font-bold text-slate-500">{copy('Verify using Google', 'Thibitisha ukitumia Google')}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm"
                                            className="h-10 px-4 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 flex items-center gap-2"
                                        >
                                            <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-4 w-4" alt="Google" />
                                            {copy('Connect', 'Unganisha')}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Identity Verification Section */}
                            <div className="space-y-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">2. {copy('Identity verification', 'Uthibitisho wa utambulisho')}</h2>
                                <Card className="border-2 border-slate-100 overflow-hidden bg-slate-50/50">
                                    <CardContent className="p-6 space-y-6">
                                        <div className="flex gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
                                                <ShieldCheck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">{copy('National ID / Passport', 'Kitambulisho cha Taifa / Pasipoti')}</h3>
                                                <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
                                                    {copy('We verify your identity to prevent fraud and keep transactions safe.', 'Tunathibitisha utambulisho wako ili kuzuia utapeli na kuhakikisha usalama wa miamala.')}
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            className="w-full h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-lg shadow-none border-b-4 border-brand-800 active:border-b-0 active:translate-y-1 transition-all"
                                            onClick={() => setView('selection')}
                                        >
                                            {copy('Start verification', 'Anza uthibitisho')}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">3. {copy('Service credentials', 'Leseni za huduma')}</h2>
                                <Card className="border-2 border-slate-100 overflow-hidden bg-white">
                                    <CardContent className="p-6 space-y-5">
                                        <div className="flex gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                                                <BadgeCheck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">{copy('Category-specific certificates and licenses', 'Vyeti na leseni za kategoria maalum')}</h3>
                                                <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
                                                    {copy('Services such as clinics, healthcare, legal, transport, security, internet, and technical work may need a certificate or license before publishing.', 'Huduma kama kliniki, afya, sheria, usafiri, usalama, intaneti na kazi za kiufundi zinaweza kuhitaji cheti au leseni kabla ya kuchapishwa.')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {serviceCredentials.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
                                                    <p className="text-sm font-bold text-slate-600">{copy('You have not uploaded a service credential yet.', 'Bado hujapakia hati ya huduma.')}</p>
                                                </div>
                                            ) : serviceCredentials.map((credential) => (
                                                <div key={credential.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-black text-slate-900">{credential.document_name}</p>
                                                            <p className="text-xs font-bold text-slate-500">
                                                                {credential.subcategory_name ? `${credential.category_name} / ${credential.subcategory_name}` : credential.category_name}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {credential.issuer || copy('Issuer not set', 'Mamlaka haijawekwa')}{credential.expires_at ? ` · ${copy('Expires', 'Inaisha')} ${credential.expires_at}` : ''}
                                                            </p>
                                                        </div>
                                                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                            credential.status === 'verified'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : credential.status === 'rejected'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {credential.status === 'verified' ? copy('Verified', 'Imethibitishwa') : credential.status === 'rejected' ? copy('Rejected', 'Imekataliwa') : copy('Under review', 'Inahakikiwa')}
                                                        </span>
                                                    </div>
                                                    {credential.rejection_reason && (
                                                        <p className="mt-2 text-xs font-semibold text-red-700">{credential.rejection_reason}</p>
                                                    )}
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {credential.document_url && (
                                                            <a href={credential.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand-700">
                                                                {copy('Open file', 'Fungua faili')} <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        )}
                                                        {credential.status !== 'verified' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteCredential(credential)}
                                                                className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
                                                            >
                                                                {copy('Delete', 'Futa')} <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg"
                                            onClick={() => setView('credential')}
                                        >
                                            {copy('Upload certificate/license', 'Pakia cheti/leseni')}
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
                            <h2 className="text-xl font-black text-slate-900">{copy('Choose an identity document', 'Chagua aina ya kitambulisho')}</h2>
                            <div className="grid gap-4">
                                <DocTypeCard 
                                    icon={Fingerprint} 
                                    title={copy('NIDA (National ID)', 'NIDA (Kitambulisho cha Taifa)')}
                                    desc={copy('The easiest and fastest way to verify.', 'Njia rahisi na ya haraka zaidi ya kuhakiki.')}
                                    onClick={() => handleDocSelect('NIDA')}
                                />
                                <DocTypeCard 
                                    icon={FileText} 
                                    title={copy('Passport', 'Pasipoti')}
                                    desc={copy('International identity verification.', 'Uthibitisho wa kimataifa.')}
                                    onClick={() => handleDocSelect('Passport')}
                                />
                                <DocTypeCard 
                                    icon={CreditCard} 
                                    title={copy('Voter ID', 'Kitambulisho cha Mpiga Kura')}
                                    desc={copy('Tanzania voter ID.', 'Voters ID ya Tanzania.')}
                                    onClick={() => handleDocSelect('Voters ID')}
                                />
                            </div>
                        </motion.div>
                    ) : view === 'credential' ? (
                        <motion.div
                            key="credential"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pb-20"
                        >
                            <form onSubmit={submitServiceCredential} className="space-y-5">
                                <div className="p-6 rounded-[2rem] border-2 border-amber-100 bg-amber-50/40">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                                            <BadgeCheck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">{copy('Upload a certificate or license', 'Pakia cheti au leseni')}</h3>
                                            <p className="text-sm font-bold text-slate-500">{copy('Choose the category this document authorizes you to work in.', 'Chagua kategoria ambayo hati hii inaruhusu kufanya kazi.')}</p>
                                        </div>
                                    </div>
                                </div>

                                <label className="space-y-2 block">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Service category', 'Kategoria ya huduma')}</span>
                                    <select
                                        className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-4 font-bold"
                                        value={credentialForm.service_category_id}
                                        onChange={(event) => setCredentialForm((prev) => ({ ...prev, service_category_id: event.target.value }))}
                                        required
                                    >
                                        <option value="">{copy('Choose category', 'Chagua kategoria')}</option>
                                        {categoriesRequiringLicense.map((category) => (
                                            <option key={category.id} value={category.id}>{category.label}</option>
                                        ))}
                                    </select>
                                </label>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <label className="space-y-2 block">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Document type', 'Aina ya hati')}</span>
                                        <select
                                            className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-4 font-bold"
                                            value={credentialForm.document_type}
                                            onChange={(event) => setCredentialForm((prev) => ({ ...prev, document_type: event.target.value }))}
                                        >
                                            <option value="professional_license">{copy('Professional license', 'Leseni ya taaluma')}</option>
                                            <option value="certification">{copy('Certificate', 'Cheti')}</option>
                                            <option value="permit">{copy('Permit', 'Kibali')}</option>
                                            <option value="business_license">{copy('Business license', 'Leseni ya biashara')}</option>
                                            <option value="other">{copy('Other', 'Nyingine')}</option>
                                        </select>
                                    </label>
                                    <label className="space-y-2 block">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Document name', 'Jina la hati')}</span>
                                        <Input
                                            value={credentialForm.document_name}
                                            onChange={(event) => setCredentialForm((prev) => ({ ...prev, document_name: event.target.value }))}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                            placeholder={copy('e.g. Medical practice license', 'Mf. Leseni ya udaktari')}
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <Input
                                        value={credentialForm.document_number}
                                        onChange={(event) => setCredentialForm((prev) => ({ ...prev, document_number: event.target.value }))}
                                        className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                        placeholder={copy('Document number', 'Namba ya hati')}
                                    />
                                    <Input
                                        value={credentialForm.issuer}
                                        onChange={(event) => setCredentialForm((prev) => ({ ...prev, issuer: event.target.value }))}
                                        className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                        placeholder={copy('Issuing authority/institution', 'Mamlaka/taasisi iliyotoa')}
                                    />
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <label className="space-y-2 block">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Issued', 'Ilitolewa')}</span>
                                        <Input
                                            type="date"
                                            value={credentialForm.issued_at}
                                            onChange={(event) => setCredentialForm((prev) => ({ ...prev, issued_at: event.target.value }))}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                        />
                                    </label>
                                    <label className="space-y-2 block">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Expires', 'Inaisha')}</span>
                                        <Input
                                            type="date"
                                            value={credentialForm.expires_at}
                                            onChange={(event) => setCredentialForm((prev) => ({ ...prev, expires_at: event.target.value }))}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                        />
                                    </label>
                                </div>

                                <label className="block rounded-[2rem] border-4 border-dashed border-slate-100 bg-slate-50 p-8 text-center cursor-pointer">
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*,application/pdf"
                                        onChange={handleCredentialFileChange}
                                    />
                                    <FileText className="h-10 w-10 mx-auto text-slate-400" />
                                    <p className="mt-3 font-black text-slate-800">
                                        {credentialForm.document ? credentialForm.document.name : copy('Choose a PDF or image', 'Chagua PDF au picha')}
                                    </p>
                                    <p className="text-xs font-bold text-slate-400 mt-1">{copy('JPG, PNG, WEBP or PDF. Max 10MB.', 'JPG, PNG, WEBP au PDF. Max 10MB.')}</p>
                                </label>

                                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 flex gap-2">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <p>{copy('After upload, Takeer will review it. Once verified, you can publish services that require this credential.', 'Baada ya kupakia, Takeer itaikagua. Ukithibitishwa, utaweza kuchapisha huduma zinazohitaji hati hii.')}</p>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black text-xl"
                                    disabled={submitting}
                                >
                                    {submitting ? copy('Submitting...', 'Inatuma...') : copy('Submit credential', 'Wasilisha hati')}
                                </Button>
                            </form>
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
                                        <h3 className="text-lg font-black text-brand-700">{selectedDoc} {copy('Verification', 'Uthibitisho')}</h3>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500">{copy('Make sure the details you enter match your identity document.', 'Hakikisha maelezo unayojaza yanalingana na kitambulisho chako.')}</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('First name', 'Jina la kwanza')}</label>
                                            <Input 
                                                value={form.first_name}
                                                onChange={e => setForm({...form, first_name: e.target.value})}
                                                className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Last name', 'Jina la mwisho')}</label>
                                            <Input 
                                                value={form.last_name}
                                                onChange={e => setForm({...form, last_name: e.target.value})}
                                                className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Date of birth', 'Tarehe ya kuzaliwa')}</label>
                                        <Input 
                                            type="date"
                                            value={form.date_of_birth}
                                            onChange={e => setForm({...form, date_of_birth: e.target.value})}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Identity document number', 'Namba ya kitambulisho')} ({selectedDoc})</label>
                                        <Input 
                                            placeholder={copy('Enter identity document number', 'Ingiza namba ya kitambulisho')}
                                            value={form.id_number}
                                            onChange={e => setForm({...form, id_number: e.target.value})}
                                            className="h-14 rounded-2xl border-2 border-slate-100 font-bold"
                                            required
                                        />
                                    </div>

                                    {/* File Uploads */}
                                    <div className="grid grid-cols-1 gap-6 pt-4">
                                        <div className="space-y-3">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Front of identity document', 'Picha ya mbele ya kitambulisho')}</label>
                                            <UploadBox 
                                                id="id_front" 
                                                preview={previews.id_front} 
                                                onChange={(e) => handleFileChange(e, 'id_front')} 
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">{copy('Back of identity document', 'Picha ya nyuma ya kitambulisho')}</label>
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
                                    {submitting ? copy('Submitting...', 'Inatuma...') : copy('Submit details', 'Wasilisha maelezo')}
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
    const { copy } = useLocale();
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
                        <p className="text-sm font-black text-slate-700">{copy('Click to take a photo / upload', 'Bofya kupiga picha / pakia')}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{copy('Front or back side', 'Upande wa mbele au nyuma')}</p>
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
