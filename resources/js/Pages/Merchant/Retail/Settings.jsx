import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { 
    Settings, 
    Shield, 
    Percent, 
    CreditCard, 
    Smartphone, 
    Save,
    ChevronLeft,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Switch } from '@/Components/ui/Switch';
import { Label } from '@/Components/ui/Label';
import { toast } from 'sonner';

export default function RetailSettings({ merchant }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        max_no_pin_discount_percent: 5,
        require_pin_for_partial_payment: true,
        allow_remote_approval: true,
        allow_online_reservation: false,
        reservation_max_hours: 24
    });

    const fetchSettings = async () => {
        try {
            const res = await window.axios.get('/api/retail/settings');
            if (res.data.data) {
                setSettings(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load settings', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await window.axios.patch('/api/retail/settings', settings);
            toast.success('Mipangilio imehifadhiwa kikamilifu!');
        } catch (err) {
            toast.error('Imeshindwa kuhifadhi mipangilio.');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    if (loading) return null;

    return (
        <AppLayout>
            <Head title="Retail Settings | Takeer" />
            
            <div className="max-w-4xl mx-auto py-8 px-4 md:px-6">
                <div className="flex items-center gap-4 mb-8">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl"
                        onClick={() => window.history.back()}
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-brand-900">Retail Settings</h1>
                        <p className="text-muted-foreground font-medium">Configure POS operational limits and approvals.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Discount Thresholds */}
                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <Percent className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Discount Thresholds</CardTitle>
                            <CardDescription className="font-medium">
                                Control how much discount staff can give without manager PIN.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Max No-PIN Discount (%)</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Staff can bargain up to this percentage without needing approval.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number"
                                        className="w-24 h-12 rounded-xl text-center font-black text-brand-600 border-brand-100"
                                        value={settings.max_no_pin_discount_percent}
                                        onChange={(e) => setSettings({...settings, max_no_pin_discount_percent: parseInt(e.target.value)})}
                                    />
                                    <span className="font-black text-brand-900">%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Operational Security */}
                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <Shield className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Operational Security</CardTitle>
                            <CardDescription className="font-medium">
                                Manage PIN requirements and remote overrides.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">PIN for Partial Payments</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Require Manager PIN whenever an order is not fully paid (Credit/Deni).</p>
                                </div>
                                <Switch 
                                    checked={settings.require_pin_for_partial_payment}
                                    onCheckedChange={(val) => setSettings({...settings, require_pin_for_partial_payment: val})}
                                />
                            </div>

                            <div className="h-px bg-brand-50"></div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Allow Remote Approval</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Allow staff to request approval via notification when manager is away.</p>
                                </div>
                                <Switch 
                                    checked={settings.allow_remote_approval}
                                    onCheckedChange={(val) => setSettings({...settings, allow_remote_approval: val})}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Online Reservation & Fulfillment */}
                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <Clock className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Online Reservation</CardTitle>
                            <CardDescription className="font-medium">
                                Enable customers to reserve items online via partial payments.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Allow Online Reservations</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Enable 'Pay Later' / Partial payment for online orders (Reservations).</p>
                                </div>
                                <Switch 
                                    checked={settings.allow_online_reservation}
                                    onCheckedChange={(val) => setSettings({...settings, allow_online_reservation: val})}
                                />
                            </div>

                            <div className="h-px bg-brand-50"></div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Reservation Limit (Hours)</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Maximum time allowed to complete payment before order expires.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number"
                                        className="w-24 h-12 rounded-xl text-center font-black text-brand-600 border-brand-100"
                                        value={settings.reservation_max_hours}
                                        onChange={(e) => setSettings({...settings, reservation_max_hours: parseInt(e.target.value)})}
                                    />
                                    <span className="font-black text-brand-900 text-sm">Hours</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button 
                            className="h-14 px-10 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-lg shadow-xl shadow-brand-600/20"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Inahifadhi...' : (
                                <>Hifadhi Mabadiliko <Save className="ml-2 h-5 w-5" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
