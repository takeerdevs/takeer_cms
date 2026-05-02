import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import {
    Users,
    UserPlus,
    ShieldCheck,
    Smartphone,
    MapPin,
    Key,
    MoreHorizontal,
    Trash2,
    CheckCircle2,
    XCircle,
    User,
    ArrowRightLeft,
    LinkIcon,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';

export default function Staff({ merchant }) {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [locations, setLocations] = useState([]);

    const [form, setForm] = useState({
        name: '',
        phone_number: '',
        role: 'CASHIER',
        pin: '',
        assigned_location_id: ''
    });

    const fetchStaff = async () => {
        try {
            const res = await window.axios.get('/api/retail/staff');
            setStaff(res.data.data || []);
        } catch (err) {
            if (err.response?.status === 403) {
                setPermissionError(err.response.data.message);
            } else {
                console.error('Failed to load staff', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchLocations = async () => {
        try {
            const res = await window.axios.get('/api/merchant/locations');
            setLocations(res.data.data || []);
        } catch (err) {
            console.error('Failed to load locations', err);
        }
    };

    useEffect(() => {
        fetchStaff();
        fetchLocations();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                const payload = { ...form };
                if (!payload.pin) delete payload.pin;
                await window.axios.patch(`/api/retail/staff/${editingStaff.id}`, payload);
                toast.success('Habari za mhudumu zimepataishwa!');
            } else {
                await window.axios.post('/api/retail/staff', form);
                toast.success('Mhudumu amesajiliwa kikamilifu!');
            }
            setIsAdding(false);
            setEditingStaff(null);
            setForm({ name: '', phone_number: '', role: 'CASHIER', pin: '', assigned_location_id: '' });
            fetchStaff();
        } catch (err) {
            alert('Imeshindwa kuhifadhi: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleEdit = (s) => {
        setEditingStaff(s);
        setIsAdding(true);
        setForm({
            name: s.user?.name || '',
            phone_number: s.user?.phone_number || '',
            role: s.role,
            pin: '', // Keep empty unless changing
            assigned_location_id: s.assigned_location_id || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleResetPin = async (s) => {
        const newPin = prompt('Enter new 4-digit PIN for ' + s.user?.name);
        if (!newPin || newPin.length !== 4) return;
        try {
            await window.axios.patch(`/api/retail/staff/${s.id}/reset-pin`, { pin: newPin });
            toast.success('PIN updated successfully!');
        } catch (err) {
            toast.error('Failed to reset PIN');
        }
    };

    const handleClearDevices = async (s) => {
        if (!confirm('This will log out this staff from all trusted terminals and require an OTP on next login. Proceed?')) return;
        try {
            await window.axios.post(`/api/retail/staff/${s.id}/clear-devices`);
            toast.success('All trusted devices cleared!');
        } catch (err) {
            toast.error('Failed to clear devices');
        }
    };

    const toggleStatus = async (s) => {
        try {
            await window.axios.patch(`/api/retail/staff/${s.id}`, { is_active: !s.is_active });
            fetchStaff();
        } catch (err) {
            console.error('Failed to toggle status', err);
        }
    };

    return (
        <AppLayout>
            <Head title="Staff Management | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">

                {permissionError ? (
                    <div className="py-20 flex flex-col items-center text-center">
                        <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                            <Users className="h-10 w-10 text-amber-600" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">Ufikiaji Umezuiwa</h2>
                        <p className="text-muted-foreground max-w-md mb-8">{permissionError}</p>

                        <div className="flex flex-wrap justify-center gap-4">
                            <Button
                                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-12 px-6"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/pos`)}
                            >
                                <ShoppingCart className="mr-2 h-5 w-5" /> Fungua POS (Uza)
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                                    Team & Access <Users className="h-8 w-8 text-brand-600" />
                                </h1>
                                <p className="text-muted-foreground">Manage employees and their terminal access PINs.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const url = `${window.location.origin}/${merchant.username}/terminal`;
                                        navigator.clipboard.writeText(url);
                                        toast.success('Terminal link copied to clipboard!');
                                    }}
                                    className="rounded-xl border-brand-200"
                                >
                                    <LinkIcon className="mr-2 h-4 w-4 text-brand-600" /> Copy Link
                                </Button>
                                <Button
                                    onClick={() => {
                                        setIsAdding(!isAdding);
                                        if (editingStaff) setEditingStaff(null);
                                        if (!isAdding) setForm({ name: '', phone_number: '', role: 'CASHIER', pin: '', assigned_location_id: '' });
                                    }}
                                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg"
                                >
                                    {isAdding ? 'Cancel' : <><UserPlus className="mr-2 h-4 w-4" /> Enroll Staff</>}
                                </Button>
                            </div>
                        </div>

                        {isAdding && (
                            <Card className="glass-card border-brand-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4">
                                <CardHeader className="bg-brand-50/50 p-6">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <UserPlus className="h-5 w-5 text-brand-600" /> 
                                        {editingStaff ? `Update Info: ${editingStaff.user?.name}` : 'Enroll New Staff Member'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Full Name</label>
                                            <Input
                                                required
                                                placeholder="Mf. Juma Kassim"
                                                className="rounded-xl"
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                                            <Input
                                                required
                                                placeholder="+255..."
                                                className="rounded-xl"
                                                value={form.phone_number}
                                                onChange={e => setForm({ ...form, phone_number: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Role</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                                value={form.role}
                                                onChange={e => setForm({ ...form, role: e.target.value })}
                                            >
                                                <option value="CASHIER">Cashier (POS only)</option>
                                                <option value="STOREKEEPER">Storekeeper (Transfers)</option>
                                                <option value="MANAGER">Manager (Full Access + Voids)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Primary Location</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                                value={form.assigned_location_id}
                                                onChange={e => setForm({ ...form, assigned_location_id: e.target.value })}
                                            >
                                                <option value="">No specific location</option>
                                                {locations.map(loc => (
                                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                                {editingStaff ? '4-Digit Terminal PIN (optional - only if changing)' : '4-Digit Terminal PIN'}
                                            </label>
                                            <Input
                                                required={!editingStaff}
                                                type="password"
                                                maxLength={4}
                                                placeholder="****"
                                                className="rounded-xl font-mono text-lg tracking-widest"
                                                value={form.pin}
                                                onChange={e => setForm({ ...form, pin: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-11 font-black uppercase tracking-widest text-[10px]">
                                                {editingStaff ? 'Save Changes' : 'Enroll Member'}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {staff.map((s) => (
                                <Card key={s.id} className={`glass-card border shadow-sm transition-all ${!s.is_active ? 'opacity-60 bg-gray-50' : 'bg-white hover:shadow-md'}`}>
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
                                                <User className="h-6 w-6" />
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white transition-all shadow-sm"
                                                    onClick={() => handleEdit(s)}
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="font-black text-lg">{s.user?.name}</h3>
                                                <p className="text-xs font-bold text-brand-600 flex items-center gap-1">
                                                    <ShieldCheck className="h-3 w-3" /> {s.role}
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Smartphone className="h-3 w-3" /> {s.user?.phone_number}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" /> {s.location?.name || 'All Locations'}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-brand-50 flex items-center justify-between">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[10px] font-bold text-muted-foreground hover:text-brand-600"
                                                    onClick={() => toggleStatus(s)}
                                                >
                                                    {s.is_active ? <><XCircle className="mr-1 h-3 w-3" /> Deactivate</> : <><CheckCircle2 className="mr-1 h-3 w-3" /> Reactivate</>}
                                                </Button>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-brand-600"
                                                        onClick={() => handleResetPin(s)}
                                                        title="Reset PIN"
                                                    >
                                                        <Key className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                                        onClick={() => handleClearDevices(s)}
                                                        title="De-authorize Devices"
                                                    >
                                                        <ShieldAlert className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {staff.length === 0 && !loading && (
                                <div className="col-span-full py-20 text-center border-2 border-dashed border-brand-100 rounded-3xl">
                                    <Users className="h-16 w-16 text-brand-100 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-gray-400">No staff enrolled yet</h2>
                                    <p className="text-muted-foreground mt-2">Start adding team members to manage your shops.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
