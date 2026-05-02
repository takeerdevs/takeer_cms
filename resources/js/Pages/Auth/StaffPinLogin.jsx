import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Key, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { toast } from 'sonner';

export default function StaffPinLogin({ merchant }) {
    const [form, setForm] = useState({
        phone_number: '',
        pin: '',
        otp: '',
    });
    const [showOtp, setShowOtp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get or generate a persistent device_id for this browser
    const getDeviceId = () => {
        let id = localStorage.getItem('retail_device_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('retail_device_id', id);
        }
        return id;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload = {
                ...form,
                device_id: getDeviceId(),
            };
            const res = await window.axios.post('/api/retail/staff/pin-login', payload);
            
            if (res.data.status === 'needs_otp') {
                setShowOtp(true);
                toast.success('Verification required. Check your phone for OTP.');
                return;
            }

            // Save the token to local storage for the terminal session
            localStorage.setItem('retail_staff_token', res.data.token);
            localStorage.setItem('retail_staff_info', JSON.stringify(res.data.staff));
            localStorage.setItem('retail_staff_location', JSON.stringify(res.data.location || null));
            localStorage.setItem('retail_staff_merchant', JSON.stringify(res.data.merchant || null));
            
            // Role-based landing after staff login
            router.visit(res.data.landing_path || `/merchant/${res.data.merchant.username}/retail/pos`);
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your phone and PIN.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <Head title={`Staff Terminal | ${merchant.display_name || merchant.username}`} />
            
            <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden bg-white">
                <CardHeader className="pt-12 pb-6 text-center flex flex-col items-center">
                    {merchant.avatar_url ? (
                        <div className="h-20 w-20 rounded-3xl overflow-hidden shadow-lg mb-6 border-4 border-white">
                            <img src={merchant.avatar_url} alt={merchant.display_name} className="h-full w-full object-cover" />
                        </div>
                    ) : (
                        <div className="h-20 w-20 bg-brand-600 rounded-3xl flex items-center justify-center shadow-lg mb-6 shadow-brand-200">
                            <ShieldCheck className="h-10 w-10 text-white" />
                        </div>
                    )}
                    <CardTitle className="text-2xl font-black">Staff Terminal Login</CardTitle>
                    <div className="mt-1">
                        <span className="text-[11px] font-black text-brand-600 uppercase tracking-[0.2em]">{merchant.display_name || merchant.username}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">Enter your phone and terminal PIN to continue.</p>
                </CardHeader>
                <CardContent className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Smartphone className="h-3 w-3" /> Mobile Number
                            </label>
                            <Input 
                                required
                                placeholder="+255..."
                                className="h-12 rounded-xl text-lg font-bold"
                                value={form.phone_number}
                                onChange={e => setForm({...form, phone_number: e.target.value})}
                            />
                        </div>

                        {!showOtp ? (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Key className="h-3 w-3" /> 4-Digit PIN
                                </label>
                                <Input 
                                    required
                                    type="password"
                                    maxLength={4}
                                    placeholder="****"
                                    className="h-12 rounded-xl text-center text-2xl font-mono tracking-[1em]"
                                    value={form.pin}
                                    onChange={e => setForm({...form, pin: e.target.value})}
                                />
                            </div>
                        ) : (
                            <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
                                <label className="text-xs font-bold text-brand-600 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" /> 6-Digit Verification Code
                                </label>
                                <Input 
                                    required
                                    maxLength={6}
                                    placeholder="000000"
                                    className="h-12 rounded-xl text-center text-2xl font-bold tracking-[0.5em]"
                                    value={form.otp}
                                    onChange={e => setForm({...form, otp: e.target.value})}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowOtp(false)}
                                    className="text-[10px] font-bold text-muted-foreground hover:text-brand-600 uppercase tracking-widest"
                                >
                                    Re-enter PIN
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold animate-in fade-in zoom-in-95">
                                {error}
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            className="w-full h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-lg shadow-xl shadow-brand-600/20"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full"></div>
                            ) : (
                                <>Unlock Terminal <ArrowRight className="ml-2 h-5 w-5" /></>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Powered by Takeer Retail Engine</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
