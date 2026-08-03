import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
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
    ShieldAlert,
    Upload,
    ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

export default function Staff({ merchant }) {
    const { copy } = useLocale();
    const [staff, setStaff] = useState([]);
    const [permissionRegistry, setPermissionRegistry] = useState({});
    const [permissionPresets, setPermissionPresets] = useState({});
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [locations, setLocations] = useState([]);

    const [form, setForm] = useState({
        name: '',
        phone_number: '',
        role: 'CASHIER',
        job_title: '',
        display_name: '',
        avatar_url: '',
        pin: '',
        assigned_location_id: '',
        dashboard_access_enabled: false,
        pos_access_enabled: true,
        permissions: []
    });
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const fetchStaff = async () => {
        try {
            const res = await window.axios.get('/api/retail/staff');
            setStaff(res.data.data || []);
            setPermissionRegistry(res.data.permission_registry || {});
            setPermissionPresets(res.data.permission_presets || {});
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
                toast.success(copy('Staff details updated.', 'Taarifa za mhudumu zimesasishwa.'));
            } else {
                await window.axios.post('/api/retail/staff', form);
                toast.success(copy('Staff member enrolled successfully.', 'Mhudumu amesajiliwa kikamilifu.'));
            }
            setIsAdding(false);
            setEditingStaff(null);
            setForm(emptyForm());
            fetchStaff();
        } catch (err) {
            alert(copy('Unable to save: ', 'Imeshindikana kuhifadhi: ') + (err.response?.data?.message || err.message));
        }
    };

    const handleEdit = (s) => {
        setEditingStaff(s);
        setIsAdding(true);
        setForm({
            name: s.user?.name || '',
            phone_number: s.user?.phone_number || '',
            role: s.role,
            job_title: s.job_title || '',
            display_name: s.display_name || '',
            avatar_url: s.avatar_url || '',
            pin: '', // Keep empty unless changing
            assigned_location_id: s.assigned_location_id || '',
            dashboard_access_enabled: Boolean(s.dashboard_access_enabled),
            pos_access_enabled: Boolean(s.pos_access_enabled ?? true),
            permissions: s.permissions || []
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleResetPin = async (s) => {
        const newPin = prompt(copy('Enter new 4-digit PIN for ', 'Weka PIN mpya ya tarakimu 4 kwa ') + s.user?.name);
        if (!newPin || newPin.length !== 4) return;
        try {
            await window.axios.patch(`/api/retail/staff/${s.id}/reset-pin`, { pin: newPin });
            toast.success(copy('PIN updated successfully.', 'PIN imesasishwa kikamilifu.'));
        } catch (err) {
            toast.error(copy('Failed to reset PIN.', 'Imeshindikana kubadilisha PIN.'));
        }
    };

    const handleClearDevices = async (s) => {
        if (!confirm(copy('This will log out this staff member from all trusted terminals and require an OTP on next login. Proceed?', 'Hii itamtoa mhudumu huyu kwenye vituo vyote vinavyoaminika na itahitaji OTP wakati wa kuingia tena. Uendelee?'))) return;
        try {
            await window.axios.post(`/api/retail/staff/${s.id}/clear-devices`);
            toast.success(copy('All trusted devices cleared.', 'Vifaa vyote vinavyoaminika vimeondolewa.'));
        } catch (err) {
            toast.error(copy('Failed to clear devices.', 'Imeshindikana kuondoa vifaa.'));
        }
    };

    const handleAvatarUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'avatars');

        try {
            const uploadUrl = merchant.username ? `/merchant/${merchant.username}/upload/media` : '/merchant/upload/media';
            const res = await window.axios.post(uploadUrl, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setForm((current) => ({ ...current, avatar_url: res.data.url }));
            toast.success(copy('Staff photo uploaded.', 'Picha ya mhudumu imepakiwa.'));
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Failed to upload staff photo.', 'Imeshindikana kupakia picha ya mhudumu.'));
        } finally {
            setUploadingAvatar(false);
            event.target.value = '';
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

    const emptyForm = () => ({
        name: '',
        phone_number: '',
        role: 'CASHIER',
        job_title: '',
        display_name: '',
        avatar_url: '',
        pin: '',
        assigned_location_id: '',
        dashboard_access_enabled: false,
        pos_access_enabled: true,
        permissions: []
    });

    const allRegisteredPermissions = Object.entries(permissionRegistry).flatMap(([resource, group]) =>
        (group.actions || []).map((action) => `${resource}.${action}`)
    );

    const setPermission = (permission, enabled) => {
        setForm((current) => {
            const permissions = new Set(current.permissions || []);
            enabled ? permissions.add(permission) : permissions.delete(permission);
            return { ...current, permissions: Array.from(permissions) };
        });
    };

    const setResourcePermissions = (resource, enabled) => {
        const group = permissionRegistry[resource];
        if (!group) return;

        setForm((current) => {
            const permissions = new Set(current.permissions || []);
            (group.actions || []).forEach((action) => {
                const permission = `${resource}.${action}`;
                enabled ? permissions.add(permission) : permissions.delete(permission);
            });
            return { ...current, permissions: Array.from(permissions) };
        });
    };

    const applyPreset = (preset) => {
        const presetPermissions = permissionPresets[preset] || [];
        const permissions = presetPermissions.includes('*') ? allRegisteredPermissions : presetPermissions;

        setForm((current) => ({
            ...current,
            dashboard_access_enabled: permissions.some((permission) => !permission.startsWith('retail.')),
            pos_access_enabled: permissions.some((permission) => permission.startsWith('retail.')),
            permissions: permissions.filter((permission) => allRegisteredPermissions.includes(permission))
        }));
    };

    return (
        <AppLayout>
            <Head title={`${copy('Staff Management', 'Usimamizi wa Wahudumu')} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">

                {permissionError ? (
                    <div className="py-20 flex flex-col items-center text-center">
                        <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                            <Users className="h-10 w-10 text-amber-600" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">{copy('Access restricted', 'Ufikiaji umezuiwa')}</h2>
                        <p className="text-muted-foreground max-w-md mb-8">{permissionError}</p>

                        <div className="flex flex-wrap justify-center gap-4">
                            <Button
                                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-12 px-6"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/pos`)}
                            >
                                <ShoppingCart className="mr-2 h-5 w-5" /> {copy('Open POS', 'Fungua POS')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                                    {copy('Team & access', 'Timu na ufikiaji')} <Users className="h-8 w-8 text-brand-600" />
                                </h1>
                                <p className="text-muted-foreground">{copy('Manage employees and their terminal access PINs.', 'Simamia wafanyakazi na PIN zao za kufikia vituo.')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const url = `${window.location.origin}/${merchant.username}/terminal`;
                                        navigator.clipboard.writeText(url);
                                        toast.success(copy('Terminal link copied to clipboard.', 'Kiungo cha kituo kimenakiliwa.'));
                                    }}
                                    className="rounded-xl border-brand-200"
                                >
                                    <LinkIcon className="mr-2 h-4 w-4 text-brand-600" /> {copy('Copy link', 'Nakili kiungo')}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setIsAdding(!isAdding);
                                        if (editingStaff) setEditingStaff(null);
                                        if (!isAdding) setForm(emptyForm());
                                    }}
                                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg"
                                >
                                    {isAdding ? copy('Cancel', 'Ghairi') : <><UserPlus className="mr-2 h-4 w-4" /> {copy('Enroll staff', 'Sajili mhudumu')}</>}
                                </Button>
                            </div>
                        </div>

                        {isAdding && (
                            <Card className="glass-card border-brand-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4">
                                <CardHeader className="bg-brand-50/50 p-6">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <UserPlus className="h-5 w-5 text-brand-600" /> 
                                        {editingStaff ? `${copy('Update information', 'Sasisha taarifa')}: ${editingStaff.user?.name}` : copy('Enroll new staff member', 'Sajili mhudumu mpya')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 lg:col-span-3 flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white border border-brand-100 flex items-center justify-center text-brand-600">
                                                {form.avatar_url ? (
                                                    <img src={form.avatar_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="h-7 w-7" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-black text-slate-900">{copy('Work profile photo', 'Picha ya wasifu wa kazi')}</p>
                                                <p className="text-xs font-semibold text-muted-foreground">{copy('Only used inside this business, separate from the person’s platform account.', 'Itatumika ndani ya biashara hii pekee, tofauti na akaunti ya mtu kwenye jukwaa.')}</p>
                                            </div>
                                            <label className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50">
                                                <Upload className="h-4 w-4" />
                                                {uploadingAvatar ? copy('Uploading...', 'Inapakia...') : copy('Upload', 'Pakia')}
                                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                            </label>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Full name', 'Jina kamili')}</label>
                                            <Input
                                                required
                                                placeholder={copy('e.g. Juma Kassim', 'Mf. Juma Kassim')}
                                                className="rounded-xl"
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Phone number', 'Namba ya simu')}</label>
                                            <Input
                                                required
                                                placeholder="+255..."
                                                className="rounded-xl"
                                                value={form.phone_number}
                                                onChange={e => setForm({ ...form, phone_number: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Work display name', 'Jina la kuonyesha kazini')}</label>
                                            <Input
                                                placeholder={copy('Optional, e.g. Dr. Amina', 'Si lazima, mfano Dkt. Amina')}
                                                className="rounded-xl"
                                                value={form.display_name}
                                                onChange={e => setForm({ ...form, display_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Access level', 'Kiwango cha ufikiaji')}</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                                value={form.role}
                                                onChange={e => setForm({ ...form, role: e.target.value })}
                                            >
                                                <option value="CASHIER">{copy('Cashier (POS only)', 'Keshia (POS pekee)')}</option>
                                                <option value="STOREKEEPER">{copy('Storekeeper (transfers)', 'Mhifadhi stoo (uhamishaji)')}</option>
                                                <option value="MANAGER">{copy('POS manager (approvals + voids)', 'Msimamizi wa POS (idhini na kufuta miamala)')}</option>
                                            </select>
                                            <p className="text-[10px] font-semibold text-slate-500">
                                                {copy('Dashboard access comes from advanced permissions below.', 'Ufikiaji wa dashibodi unatokana na ruhusa za ziada hapa chini.')}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Permission preset', 'Kiolezo cha ruhusa')}</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                                defaultValue=""
                                                onChange={e => {
                                                    if (e.target.value) applyPreset(e.target.value);
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">{copy('Choose a template...', 'Chagua kiolezo...')}</option>
                                                {Object.keys(permissionPresets)
                                                    .filter((preset) => preset !== 'OWNER')
                                                    .map((preset) => (
                                                        <option key={preset} value={preset}>{preset.replaceAll('_', ' ')}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Job title', 'Cheo cha kazi')}</label>
                                            <Input
                                                placeholder={copy('Pharmacist, driver, cleaner...', 'Mfamasia, dereva, msafishaji...')}
                                                className="rounded-xl"
                                                value={form.job_title}
                                                onChange={e => setForm({ ...form, job_title: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">{copy('Primary location', 'Eneo kuu')}</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                                value={form.assigned_location_id}
                                                onChange={e => setForm({ ...form, assigned_location_id: e.target.value })}
                                            >
                                                <option value="">{copy('No specific location', 'Hakuna eneo maalum')}</option>
                                                {locations.map(loc => (
                                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                                {editingStaff ? copy('4-digit terminal PIN (optional — only if changing)', 'PIN ya tarakimu 4 ya kituo (si lazima — ikiwa inabadilishwa)') : copy('4-digit terminal PIN', 'PIN ya tarakimu 4 ya kituo')}
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
                                        <div className="md:col-span-2 lg:col-span-3 grid gap-3 md:grid-cols-2">
                                            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                                                    checked={form.pos_access_enabled}
                                                    onChange={e => setForm({ ...form, pos_access_enabled: e.target.checked })}
                                                />
                                                <span>
                                                    <span className="block text-sm font-black text-slate-900">{copy('Allow POS terminal access', 'Ruhusu ufikiaji wa kituo cha POS')}</span>
                                                    <span className="block text-xs font-semibold text-slate-500">{copy('Can use PIN/device login for POS and retail operations.', 'Anaweza kutumia PIN/kifaa kuingia kwenye POS na shughuli za rejareja.')}</span>
                                                </span>
                                            </label>
                                            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                                                    checked={form.dashboard_access_enabled}
                                                    onChange={e => setForm({ ...form, dashboard_access_enabled: e.target.checked })}
                                                />
                                                <span>
                                                    <span className="block text-sm font-black text-slate-900">{copy('Allow merchant dashboard access', 'Ruhusu ufikiaji wa dashibodi ya mfanyabiashara')}</span>
                                                    <span className="block text-xs font-semibold text-slate-500">{copy('Shows this business in their account switcher and enables selected dashboard permissions.', 'Huonyesha biashara hii kwenye chaguo la akaunti na kuwezesha ruhusa za dashibodi zilizochaguliwa.')}</span>
                                                </span>
                                            </label>
                                        </div>
                                        <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-slate-200 bg-white p-4 space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-900">{copy('Advanced permissions', 'Ruhusa za ziada')}</h3>
                                                    <p className="text-xs font-semibold text-slate-500">{copy('Resource + action controls for this business.', 'Udhibiti wa rasilimali na vitendo kwa biashara hii.')}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                        onClick={() => setForm({ ...form, permissions: allRegisteredPermissions, dashboard_access_enabled: true, pos_access_enabled: true })}
                                                    >
                                                        {copy('Select all', 'Chagua zote')}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                        onClick={() => setForm({ ...form, permissions: [] })}
                                                    >
                                                        {copy('Clear', 'Futa')}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid gap-3">
                                                {Object.entries(permissionRegistry).map(([resource, group]) => {
                                                    const actions = group.actions || [];
                                                    const selectedCount = actions.filter((action) => form.permissions?.includes(`${resource}.${action}`)).length;
                                                    const allSelected = actions.length > 0 && selectedCount === actions.length;

                                                    return (
                                                        <div key={resource} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                                                                        checked={allSelected}
                                                                        onChange={e => setResourcePermissions(resource, e.target.checked)}
                                                                    />
                                                                    <span className="text-sm font-black text-slate-900">{group.label || resource}</span>
                                                                </label>
                                                                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">
                                                                    {selectedCount}/{actions.length}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {actions.map((action) => {
                                                                    const permission = `${resource}.${action}`;
                                                                    const checked = form.permissions?.includes(permission);

                                                                    return (
                                                                        <label
                                                                            key={permission}
                                                                            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${checked ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500'}`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
                                                                                checked={checked}
                                                                                onChange={e => setPermission(permission, e.target.checked)}
                                                                            />
                                                                            {action.replaceAll('_', ' ')}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex items-end">
                                            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-11 font-black uppercase tracking-widest text-[10px]">
                                                {editingStaff ? copy('Save changes', 'Hifadhi mabadiliko') : copy('Enroll member', 'Sajili mhudumu')}
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
                                            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100 overflow-hidden">
                                                {s.avatar_url ? (
                                                    <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="h-6 w-6" />
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {s.is_active ? copy('Active', 'Anafanya kazi') : copy('Inactive', 'Hafanyi kazi')}
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
                                                <h3 className="font-black text-lg">{s.display_name || s.user?.name}</h3>
                                                {s.display_name && (
                                                    <p className="text-xs font-semibold text-slate-400">{s.user?.name}</p>
                                                )}
                                                <p className="text-xs font-bold text-brand-600 flex items-center gap-1">
                                                    <ShieldCheck className="h-3 w-3" /> {s.role === 'CASHIER' ? copy('Cashier', 'Keshia') : s.role === 'STOREKEEPER' ? copy('Storekeeper', 'Mhifadhi stoo') : s.role === 'MANAGER' ? copy('Manager', 'Msimamizi') : s.role}
                                                </p>
                                                {s.job_title && (
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{s.job_title}</p>
                                                )}
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${s.pos_access_enabled ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        POS {s.pos_access_enabled ? copy('On', 'Imewashwa') : copy('Off', 'Imezimwa')}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${s.dashboard_access_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        {copy('Dashboard', 'Dashibodi')} {s.dashboard_access_enabled ? copy('On', 'Imewashwa') : copy('Off', 'Imezimwa')}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        {(s.effective_permissions || []).length} {copy('permissions', 'ruhusa')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Smartphone className="h-3 w-3" /> {s.user?.phone_number}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" /> {s.location?.name || copy('All locations', 'Maeneo yote')}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-brand-50 flex items-center justify-between">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[10px] font-bold text-muted-foreground hover:text-brand-600"
                                                    onClick={() => toggleStatus(s)}
                                                >
                                                    {s.is_active ? <><XCircle className="mr-1 h-3 w-3" /> {copy('Deactivate', 'Zima')}</> : <><CheckCircle2 className="mr-1 h-3 w-3" /> {copy('Reactivate', 'Washa tena')}</>}
                                                </Button>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-brand-600"
                                                        onClick={() => handleResetPin(s)}
                                                        title={copy('Reset PIN', 'Badilisha PIN')}
                                                    >
                                                        <Key className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                                        onClick={() => handleClearDevices(s)}
                                                        title={copy('De-authorize devices', 'Ondoa uaminifu wa vifaa')}
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
                                    <h2 className="text-xl font-bold text-gray-400">{loading ? copy('Loading staff...', 'Inapakia wahudumu...') : copy('No staff enrolled yet', 'Hakuna mhudumu aliyesajiliwa bado')}</h2>
                                    <p className="text-muted-foreground mt-2">{copy('Start adding team members to manage your shops.', 'Anza kuongeza wanachama wa timu ili kusimamia maduka yako.')}</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
