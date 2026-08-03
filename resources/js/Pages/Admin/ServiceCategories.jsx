import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const trustDocumentOptions = [
    { key: 'identity', label: 'KYC' },
    { key: 'tin', label: 'TIN' },
    { key: 'business_license', label: 'Business license' },
    { key: 'registration', label: 'Registration' },
    { key: 'professional_license', label: 'Professional license' },
    { key: 'ownership_proof', label: 'Ownership proof' },
    { key: 'vehicle_registration', label: 'Vehicle registration' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'operating_permit', label: 'Operating permit' },
];

const emptyForm = {
    name: '',
    parent_id: '',
    sort_order: 0,
    is_active: true,
    option_template: '',
    service_template_key: '',
    allowed_template_keys: [],
    risk_level: 'standard',
    required_documents: ['identity'],
    requires_manual_review: false,
    payout_hold_days: 3,
    max_first_quote_amount: '',
    template_rules: '',
};

const parseJsonField = (value, label) => {
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`${label} is not valid JSON.`);
    }
};

export default function ServiceCategories() {
    const { copy } = useLocale();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [serviceTemplates, setServiceTemplates] = useState({});
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);

    const parentOptions = useMemo(() => categories.map((category) => ({
        id: category.id,
        name: category.name,
    })), [categories]);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const response = await fetch('/admin/api/service-categories?include_inactive=1', {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || copy('Failed to load service categories.', 'Imeshindikana kupakia kategoria za huduma.'));
            setCategories(data.data || []);
            setServiceTemplates(data.service_templates || {});
        } catch (error) {
            toast.error(error.message);
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const resetForm = () => {
        setEditing(null);
        setForm(emptyForm);
    };

    const saveCategory = async () => {
        if (!form.name.trim()) {
            toast.error(copy('Category name is required.', 'Jina la kategoria linahitajika.'));
            return;
        }

        setSaving(true);
        try {
            const url = editing ? `/admin/api/service-categories/${editing.id}` : '/admin/api/service-categories';
            const response = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({
                    name: form.name,
                    parent_id: form.parent_id ? Number(form.parent_id) : null,
                    sort_order: Number(form.sort_order || 0),
                    is_active: Boolean(form.is_active),
                    option_template: parseJsonField(form.option_template, 'Service option template JSON'),
                    service_template_key: form.service_template_key || null,
                    allowed_template_keys: form.allowed_template_keys || [],
                    risk_level: form.risk_level || 'standard',
                    required_documents: form.required_documents || [],
                    requires_manual_review: Boolean(form.requires_manual_review),
                    payout_hold_days: Number(form.payout_hold_days || 3),
                    max_first_quote_amount: form.max_first_quote_amount ? Number(form.max_first_quote_amount) : null,
                    template_rules: parseJsonField(form.template_rules, 'Template rules JSON'),
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || copy('Failed to save service category.', 'Imeshindikana kuhifadhi kategoria ya huduma.'));
            toast.success(data.message || copy('Saved.', 'Imehifadhiwa.'));
            resetForm();
            await loadCategories();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const deleteCategory = async (category) => {
        if (!window.confirm(`${copy('Delete', 'Futa')} "${category.name}"? ${copy('Subcategories will become root categories.', 'Kategoria ndogo zitakuwa kategoria kuu.')}`)) return;

        try {
            const response = await fetch(`/admin/api/service-categories/${category.id}`, {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content || '',
                },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || copy('Failed to delete service category.', 'Imeshindikana kufuta kategoria ya huduma.'));
            toast.success(data.message || copy('Deleted.', 'Imefutwa.'));
            await loadCategories();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const startEdit = (category, parentId = '') => {
        setEditing(category);
        setForm({
            name: category.name || '',
            parent_id: parentId ? String(parentId) : '',
            sort_order: category.sort_order || 0,
            is_active: Boolean(category.is_active),
            option_template: category.option_template ? JSON.stringify(category.option_template, null, 2) : '',
            service_template_key: category.default_template_key || category.service_template_key || '',
            allowed_template_keys: category.allowed_template_keys?.length
                ? category.allowed_template_keys
                : (category.default_template_key || category.service_template_key ? [category.default_template_key || category.service_template_key] : []),
            risk_level: category.risk_level || 'standard',
            required_documents: category.required_documents || ['identity'],
            requires_manual_review: Boolean(category.requires_manual_review),
            payout_hold_days: category.payout_hold_days ?? 3,
            max_first_quote_amount: category.max_first_quote_amount ?? '',
            template_rules: category.template_rules ? JSON.stringify(category.template_rules, null, 2) : '',
        });
    };

    const toggleRequiredDocument = (documentKey) => {
        setForm((prev) => {
            const current = new Set(prev.required_documents || []);
            if (current.has(documentKey)) {
                current.delete(documentKey);
            } else {
                current.add(documentKey);
            }

            return {
                ...prev,
                required_documents: Array.from(current),
            };
        });
    };

    const toggleAllowedTemplate = (templateKey) => {
        setForm((prev) => {
            const current = new Set(prev.allowed_template_keys || []);
            if (current.has(templateKey)) {
                current.delete(templateKey);
            } else {
                current.add(templateKey);
            }
            if (prev.service_template_key) {
                current.add(prev.service_template_key);
            }

            return {
                ...prev,
                allowed_template_keys: Array.from(current),
            };
        });
    };

    const templateEntries = Object.entries(serviceTemplates || {});

    return (
        <AdminLayout title={copy('Service categories', 'Kategoria za huduma')}>
            <Head title={`${copy('Service categories', 'Kategoria za huduma')} | Takeer`} />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Shapes className="h-6 w-6 text-brand-700" /> {copy('Service categories', 'Kategoria za huduma')}
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">
                        {copy('Simple service taxonomy for discovery and service creation. No product facets, brands, models, or variant rules here.', 'Muundo rahisi wa kategoria za huduma kwa ugunduzi na uundaji wa huduma. Hakuna sifa za bidhaa, chapa, modeli au kanuni za vibadala hapa.')}
                    </p>
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-4 space-y-3">
                        <p className="font-bold text-slate-900">{editing ? `${copy('Edit', 'Hariri')} ${editing.name}` : copy('Create service category', 'Unda kategoria ya huduma')}</p>
                        <div className="grid md:grid-cols-5 gap-3">
                            <Input
                                value={form.name}
                                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder={copy('Category or subcategory name', 'Jina la kategoria au kategoria ndogo')}
                            />
                            <select
                                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                                value={form.parent_id}
                                onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
                            >
                                <option value="">{copy('Parent (root)', 'Mzazi (kuu)')}</option>
                                {parentOptions
                                    .filter((option) => !editing || option.id !== editing.id)
                                    .map((option) => (
                                        <option key={option.id} value={option.id}>{option.name}</option>
                                    ))}
                            </select>
                            <Input
                                type="number"
                                min="0"
                                value={form.sort_order}
                                onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                                placeholder={copy('Sort order', 'Mpangilio')}
                            />
                            <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                                />
                                {copy('Active', 'Hai')}
                            </label>
                            <div className="flex gap-2">
                                <Button className="bg-brand-600 hover:bg-brand-700 text-white flex-1" disabled={saving} onClick={saveCategory}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {editing ? copy('Save', 'Hifadhi') : copy('Add', 'Ongeza')}
                                </Button>
                                {editing && (
                                    <Button variant="outline" disabled={saving} onClick={resetForm}>{copy('Cancel', 'Ghairi')}</Button>
                                )}
                            </div>
                        </div>
                        <label className="block space-y-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('Service option template JSON', 'JSON ya kiolezo cha chaguo la huduma')}</span>
                            <textarea
                                className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                                value={form.option_template}
                                onChange={(event) => setForm((prev) => ({ ...prev, option_template: event.target.value }))}
                                placeholder='{"label":"Room type","fields":{"capacity":true,"max_guests":true,"duration_minutes":false,"checkin_time":true,"checkout_time":true},"examples":["Standard Room","Deluxe Room"]}'
                            />
                            <p className="text-xs text-slate-500">
                                {copy('Optional. Put this on subcategories to tailor service options/units in merchant service creation.', 'Si lazima. Weka kwenye kategoria ndogo ili kubinafsisha chaguo/vipimo vya huduma wakati wa kuunda huduma.')}
                            </p>
                        </label>
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-3">
                            <div className="grid md:grid-cols-3 gap-3">
                                <label className="space-y-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('Default workflow', 'Mtiririko chaguo-msingi')}</span>
                                    <select
                                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                                        value={form.service_template_key}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setForm((prev) => ({
                                                ...prev,
                                                service_template_key: value,
                                                allowed_template_keys: value
                                                    ? Array.from(new Set([value, ...(prev.allowed_template_keys || [])]))
                                                    : (prev.allowed_template_keys || []),
                                            }));
                                        }}
                                    >
                                        <option value="">{copy('Auto-detect / generic service', 'Tambua kiotomatiki / huduma ya jumla')}</option>
                                        {templateEntries.map(([key, template]) => (
                                            <option key={key} value={key}>{template.label || key}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="md:col-span-2 space-y-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('Allowed workflows', 'Mitririko inayoruhusiwa')}</span>
                                    <div className="flex flex-wrap gap-2">
                                        {templateEntries.map(([key, template]) => (
                                            <label key={key} className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={(form.allowed_template_keys || []).includes(key)}
                                                    onChange={() => toggleAllowedTemplate(key)}
                                                />
                                                {template.label || key}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <label className="block space-y-1">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('Template rule overrides JSON', 'JSON ya kubadilisha kanuni za kiolezo')}</span>
                                <textarea
                                    className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                                    value={form.template_rules}
                                    onChange={(event) => setForm((prev) => ({ ...prev, template_rules: event.target.value }))}
                                    placeholder='{"rental":{"required_documents":["identity","ownership_proof"],"rental_types":{"vehicle":{"required_documents":["identity","business_license","vehicle_registration","insurance"]}}}}'
                                />
                                <p className="text-xs text-blue-800">
                                    {copy('Optional. Use this when a workflow under this category needs stricter documents or risk rules than the category default.', 'Si lazima. Tumia ikiwa mtiririko chini ya kategoria hii unahitaji nyaraka au kanuni kali zaidi za hatari kuliko chaguo-msingi.')}
                                </p>
                            </label>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
                            <div className="grid md:grid-cols-4 gap-3">
                                <label className="space-y-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('Risk level', 'Kiwango cha hatari')}</span>
                                    <select
                                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                                        value={form.risk_level}
                                        onChange={(event) => setForm((prev) => ({ ...prev, risk_level: event.target.value }))}
                                    >
                                        <option value="standard">{copy('Standard', 'Kawaida')}</option>
                                        <option value="elevated">{copy('Elevated', 'Juu')}</option>
                                        <option value="regulated">{copy('Regulated', 'Inayodhibitiwa')}</option>
                                        <option value="restricted">{copy('Restricted', 'Imezuiwa')}</option>
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('Hold days', 'Siku za kushikilia')}</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={form.payout_hold_days}
                                        onChange={(event) => setForm((prev) => ({ ...prev, payout_hold_days: event.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy('First quote limit', 'Kikomo cha bei ya kwanza')}</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={form.max_first_quote_amount}
                                        onChange={(event) => setForm((prev) => ({ ...prev, max_first_quote_amount: event.target.value }))}
                                        placeholder={copy('Optional', 'Si lazima')}
                                    />
                                </label>
                                <label className="h-10 self-end rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.requires_manual_review}
                                        onChange={(event) => setForm((prev) => ({ ...prev, requires_manual_review: event.target.checked }))}
                                    />
                                    {copy('Manual review', 'Ukaguzi wa mkono')}
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {trustDocumentOptions.map((document) => (
                                    <label key={document.key} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={(form.required_documents || []).includes(document.key)}
                                            onChange={() => toggleRequiredDocument(document.key)}
                                        />
                                        {copy(document.label, document.key === 'business_license' ? 'Leseni ya biashara' : document.key === 'registration' ? 'Usajili' : document.key === 'professional_license' ? 'Leseni ya kitaaluma' : document.key === 'ownership_proof' ? 'Uthibitisho wa umiliki' : document.key === 'vehicle_registration' ? 'Usajili wa gari' : document.key === 'insurance' ? 'Bima' : document.key === 'operating_permit' ? 'Kibali cha uendeshaji' : document.label)}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-amber-800">
                                {copy('These controls decide whether a merchant can publish this service category and which provider settlement rule applies.', 'Vidhibiti hivi huamua kama mfanyabiashara anaweza kuchapisha kategoria hii ya huduma na kanuni gani ya malipo ya mtoa huduma itatumika.')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">{copy('Loading service categories...', 'Inapakia kategoria za huduma...')}</CardContent>
                    </Card>
                ) : categories.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">{copy('No service categories yet.', 'Hakuna kategoria za huduma bado.')}</CardContent>
                    </Card>
                ) : (
                    <div className="grid lg:grid-cols-2 gap-4">
                        {categories.map((category) => (
                            <Card key={category.id} className="bg-white border-slate-200">
                                <CardContent className="p-4 space-y-3">
                                    <CategoryRow category={category} onEdit={() => startEdit(category)} onDelete={() => deleteCategory(category)} />
                                    <div className="space-y-2 pl-4 border-l border-slate-200">
                                        {(category.children || []).length === 0 ? (
                                            <p className="text-sm text-slate-500">{copy('No subcategories yet.', 'Hakuna kategoria ndogo bado.')}</p>
                                        ) : category.children.map((child) => (
                                            <CategoryRow
                                                key={child.id}
                                                category={child}
                                                compact
                                                onEdit={() => startEdit(child, category.id)}
                                                onDelete={() => deleteCategory(child)}
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function CategoryRow({ category, onEdit, onDelete, compact = false }) {
    const { copy } = useLocale();
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
                <p className={`${compact ? 'text-sm' : 'text-base'} font-black text-slate-900 truncate`}>
                    {category.name}
                </p>
                <p className="text-[11px] text-slate-500">
                    /{category.slug} · {copy('sort', 'mpangilio')} {category.sort_order || 0} · {category.is_active ? copy('active', 'hai') : copy('inactive', 'si hai')}{category.option_template ? ` · ${copy('template', 'kiolezo')}` : ''}
                </p>
                <p className="text-[11px] text-blue-700 font-bold">
                    {copy('workflow', 'mtiririko')} {category.default_template_key || category.service_template_key || 'auto'} · {copy('allowed', 'inayoruhusiwa')} {(category.allowed_template_keys || []).join(', ') || copy('default only', 'chaguo-msingi tu')}
                </p>
                <p className="text-[11px] text-amber-700 font-bold">
                    {category.risk_level || 'standard'} · {(category.required_documents || []).join(', ') || copy('no docs', 'hakuna nyaraka')} · {copy('provider review window', 'muda wa ukaguzi wa mtoa huduma')} {category.payout_hold_days ?? 3}d
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" className="h-9 w-9 p-0" onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-9 w-9 p-0 text-red-700 border-red-300" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
