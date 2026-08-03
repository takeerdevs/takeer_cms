import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { CheckCircle2, KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2, UserPlus, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const ROLE_LABELS = {
    MANAGER: 'Manager',
    CASHIER: 'Cashier',
    STOREKEEPER: 'Storekeeper',
    RECEPTIONIST: 'Receptionist',
    BOOKING_MANAGER: 'Booking manager',
    INSTRUCTOR: 'Instructor',
    FULFILLMENT: 'Fulfillment',
    ACCOUNTANT: 'Accountant',
    MARKETER: 'Marketer',
    CONTENT_MANAGER: 'Content manager',
    SUPPORT: 'Support',
};

const emptyForm = () => ({
    name: '',
    phone_number: '',
    role: 'RECEPTIONIST',
    job_title: '',
    display_name: '',
    pin: '',
    dashboard_access_enabled: true,
    pos_access_enabled: false,
    permissions: [],
});

export default function Team({ merchant }) {
    const { copy } = useLocale();
    const merchantUsername = merchant?.username;
    const [staff, setStaff] = useState([]);
    const [registry, setRegistry] = useState({});
    const [presets, setPresets] = useState({});
    const [roles, setRoles] = useState(Object.keys(ROLE_LABELS));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const permissions = useMemo(() => Object.entries(registry).flatMap(([resource, group]) => (
        (group.actions || []).map((action) => `${resource}.${action}`)
    )), [registry]);

    const loadTeam = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/merchant/${merchantUsername}/team/api`);
            setStaff(response.data?.data || []);
            setRegistry(response.data?.permission_registry || {});
            setPresets(response.data?.permission_presets || {});
            setRoles(response.data?.roles || Object.keys(ROLE_LABELS));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load team.', 'Imeshindikana kupakia timu.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTeam();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [merchantUsername]);

    const applyPreset = (role) => {
        const preset = presets[role] || [];
        const nextPermissions = preset.includes('*') ? permissions : preset.filter((permission) => permissions.includes(permission));
        setForm((current) => ({
            ...current,
            role,
            permissions: nextPermissions,
            dashboard_access_enabled: nextPermissions.some((permission) => !permission.startsWith('retail.')),
            pos_access_enabled: nextPermissions.some((permission) => permission.startsWith('retail.')),
        }));
    };

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form };
            if (editing && !payload.pin) delete payload.pin;

            if (editing) {
                await axios.patch(`/merchant/${merchantUsername}/team/${editing.id}/api`, payload);
                toast.success(copy('Team member updated.', 'Mwanachama wa timu amesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/team/api`, payload);
                toast.success(copy('Team member added.', 'Mwanachama wa timu ameongezwa.'));
            }

            setEditing(null);
            setForm(emptyForm());
            await loadTeam();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save team member.', 'Imeshindikana kuhifadhi mwanachama wa timu.'));
        } finally {
            setSaving(false);
        }
    };

    const editStaff = (member) => {
        setEditing(member);
        setForm({
            name: member.user?.name || '',
            phone_number: member.user?.phone_number || '',
            role: member.role || 'RECEPTIONIST',
            job_title: member.job_title || '',
            display_name: member.display_name || '',
            pin: '',
            dashboard_access_enabled: Boolean(member.dashboard_access_enabled),
            pos_access_enabled: Boolean(member.pos_access_enabled),
            permissions: member.permissions || [],
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetPin = async (member) => {
        const pin = window.prompt(`${copy('New 4-digit PIN for', 'PIN mpya ya tarakimu 4 kwa')} ${member.display_name || member.user?.name}`);
        if (!pin) return;
        if (!/^\d{4}$/.test(pin)) {
            toast.error(copy('PIN must be exactly 4 digits.', 'PIN lazima iwe na tarakimu 4 kamili.'));
            return;
        }
        await axios.patch(`/merchant/${merchantUsername}/team/${member.id}/reset-pin/api`, { pin });
        toast.success(copy('PIN reset.', 'PIN imebadilishwa.'));
    };

    const toggleStatus = async (member) => {
        await axios.patch(`/merchant/${merchantUsername}/team/${member.id}/api`, { is_active: !member.is_active });
        await loadTeam();
    };

    const clearDevices = async (member) => {
        if (!window.confirm(copy('Clear trusted devices for this staff member?', 'Ondoa vifaa vinavyoaminika vya mhudumu huyu?'))) return;
        await axios.post(`/merchant/${merchantUsername}/team/${member.id}/clear-devices/api`);
        toast.success(copy('Trusted devices cleared.', 'Vifaa vinavyoaminika vimeondolewa.'));
    };

    const togglePermission = (permission, enabled) => {
        setForm((current) => {
            const next = new Set(current.permissions || []);
            enabled ? next.add(permission) : next.delete(permission);
            return { ...current, permissions: Array.from(next) };
        });
    };

    return (
        <AppLayout>
            <Head title={`${copy('Team', 'Timu')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Operations', 'Uendeshaji')}</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">{copy('Team & access', 'Timu na ufikiaji')}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy('Create staff profiles, assign tool permissions, control POS access, and reset terminal PINs.', 'Unda wasifu wa wahudumu, gawa ruhusa za zana, dhibiti ufikiaji wa POS na badilisha PIN za vituo.')}</p>
                    </div>
                    <Button variant="outline" onClick={loadTeam} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {copy('Refresh', 'Onyesha upya')}
                    </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <Metric label={copy('Team members', 'Wanachama wa timu')} value={staff.length} icon={Users} />
                    <Metric label={copy('Active', 'Hai')} value={staff.filter((member) => member.is_active).length} icon={CheckCircle2} />
                    <Metric label={copy('Dashboard access', 'Ufikiaji wa dashibodi')} value={staff.filter((member) => member.dashboard_access_enabled).length} icon={ShieldCheck} />
                    <Metric label={copy('POS access', 'Ufikiaji wa POS')} value={staff.filter((member) => member.pos_access_enabled).length} icon={Smartphone} />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{editing ? copy('Edit team member', 'Hariri mwanachama wa timu') : copy('Add team member', 'Ongeza mwanachama wa timu')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <Input required placeholder={copy('Full name', 'Jina kamili')} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                                <Input required placeholder="+255..." value={form.phone_number} onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))} />
                                <Input required={!editing} type="password" maxLength={4} placeholder={editing ? copy('New PIN optional', 'PIN mpya si lazima') : copy('4-digit PIN', 'PIN ya tarakimu 4')} value={form.pin} onChange={(event) => setForm((prev) => ({ ...prev, pin: event.target.value }))} />
                                <Input placeholder={copy('Display name', 'Jina la kuonyesha')} value={form.display_name} onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))} />
                                <Input placeholder={copy('Job title', 'Cheo cha kazi')} value={form.job_title} onChange={(event) => setForm((prev) => ({ ...prev, job_title: event.target.value }))} />
                                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={(event) => applyPreset(event.target.value)}>
                                    {roles.map((role) => <option key={role} value={role}>{roleLabel(copy, role)}</option>)}
                                </select>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                                    <input type="checkbox" className="mt-1" checked={form.dashboard_access_enabled} onChange={(event) => setForm((prev) => ({ ...prev, dashboard_access_enabled: event.target.checked }))} />
                                    <span><span className="block text-sm font-bold">{copy('Business dashboard', 'Dashibodi ya biashara')}</span><span className="block text-xs text-muted-foreground">{copy('Allow access to selected business tools.', 'Ruhusu ufikiaji wa zana za biashara zilizochaguliwa.')}</span></span>
                                </label>
                                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                                    <input type="checkbox" className="mt-1" checked={form.pos_access_enabled} onChange={(event) => setForm((prev) => ({ ...prev, pos_access_enabled: event.target.checked }))} />
                                    <span><span className="block text-sm font-bold">{copy('POS terminal', 'Kituo cha POS')}</span><span className="block text-xs text-muted-foreground">{copy('Allow terminal PIN login and retail tools.', 'Ruhusu kuingia kwa PIN ya kituo na zana za rejareja.')}</span></span>
                                </label>
                            </div>

                            <div className="space-y-3 rounded-lg border border-border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-black">{copy('Permissions', 'Ruhusa')}</p>
                                        <p className="text-xs text-muted-foreground">{copy('Pick exactly what this person can do.', 'Chagua hasa anachoweza kufanya mtu huyu.')}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, permissions }))}>{copy('All', 'Zote')}</Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, permissions: [] }))}>{copy('Clear', 'Futa')}</Button>
                                    </div>
                                </div>
                                {Object.entries(registry).map(([resource, group]) => (
                                    <div key={resource} className="rounded-lg bg-muted/40 p-3">
                                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{group.label || resource}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(group.actions || []).map((action) => {
                                                const permission = `${resource}.${action}`;
                                                const checked = form.permissions.includes(permission);
                                                return (
                                                    <label key={permission} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${checked ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-border bg-background text-muted-foreground'}`}>
                                                        <input className="mr-2" type="checkbox" checked={checked} onChange={(event) => togglePermission(permission, event.target.checked)} />
                                                        {action.replaceAll('_', ' ')}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                                {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(emptyForm()); }}>{copy('Cancel', 'Ghairi')}</Button>}
                                <Button disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                    {editing ? copy('Save changes', 'Hifadhi mabadiliko') : copy('Add team member', 'Ongeza mwanachama wa timu')}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {loading ? (
                        <Card className="md:col-span-2 xl:col-span-3"><CardContent className="flex min-h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></CardContent></Card>
                    ) : staff.length === 0 ? (
                        <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-3 text-lg font-black">{copy('No team members yet', 'Hakuna wanachama wa timu bado')}</h3></CardContent></Card>
                    ) : staff.map((member) => (
                        <StaffCard key={member.id} member={member} onEdit={editStaff} onToggle={toggleStatus} onResetPin={resetPin} onClearDevices={clearDevices} />
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}

function Metric({ label, value, icon: Icon }) {
    return (
        <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-muted-foreground" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-black">{value}</p></CardContent></Card>
    );
}

function roleLabel(copy, role) {
    const english = ROLE_LABELS[role] || role.replaceAll('_', ' ');
    const swahili = {
        Manager: 'Msimamizi',
        Cashier: 'Keshia',
        Storekeeper: 'Mhifadhi stoo',
        Receptionist: 'Mhudumu wa mapokezi',
        'Booking manager': 'Msimamizi wa miadi',
        Instructor: 'Mwalimu',
        Fulfillment: 'Utekelezaji wa oda',
        Accountant: 'Mhasibu',
        Marketer: 'Mtaalamu wa masoko',
        'Content manager': 'Msimamizi wa maudhui',
        Support: 'Msaada',
    }[english] || english;
    return copy(english, swahili);
}

function StaffCard({ member, onEdit, onToggle, onResetPin, onClearDevices }) {
    const { copy } = useLocale();
    const name = member.display_name || member.user?.name || copy('Team member', 'Mwanachama wa timu');
    return (
        <Card className={!member.is_active ? 'opacity-70' : ''}>
            <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-black">{name}</h3>
                        {member.display_name && <p className="text-xs text-muted-foreground">{member.user?.name}</p>}
                        <p className="mt-1 text-xs font-bold uppercase text-brand-700">{roleLabel(copy, member.role)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${member.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.is_active ? copy('Active', 'Hai') : copy('Inactive', 'Si hai')}</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{member.job_title || copy('No job title', 'Hakuna cheo cha kazi')}</p>
                    <p>{member.user?.phone_number || copy('No phone', 'Hakuna simu')}</p>
                    <p>{(member.effective_permissions || []).length} {copy('effective permissions', 'ruhusa zinazotumika')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(member)}>{copy('Edit', 'Hariri')}</Button>
                    <Button variant="outline" size="sm" onClick={() => onToggle(member)}>{member.is_active ? <ShieldOff className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{member.is_active ? copy('Deactivate', 'Zima') : copy('Activate', 'Washa')}</Button>
                    <Button variant="outline" size="sm" onClick={() => onResetPin(member)}><KeyRound className="mr-2 h-4 w-4" />{copy('PIN', 'PIN')}</Button>
                    <Button variant="outline" size="sm" onClick={() => onClearDevices(member)}><Trash2 className="mr-2 h-4 w-4" />{copy('Devices', 'Vifaa')}</Button>
                </div>
            </CardContent>
        </Card>
    );
}
