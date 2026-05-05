import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { Check, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const emptyUnit = {
    name: '',
    code: '',
    symbol: '',
    unit_category: 'count',
    base_unit_code: '',
    conversion_factor_to_base: 1,
    allows_decimal: false,
    common_quantities_json: '[]',
    is_active: true,
    sort_order: 0,
};

const categories = ['count', 'weight', 'volume', 'length', 'area', 'package'];

export default function SellableUnits() {
    const [unitTypes, setUnitTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unitForm, setUnitForm] = useState(emptyUnit);
    const [editingUnit, setEditingUnit] = useState(null);

    useEffect(() => {
        loadUnits();
    }, []);

    const loadUnits = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/api/catalog/unit-types');
            setUnitTypes(res.data?.data || []);
        } catch {
            toast.error('Failed to load unit types.');
        } finally {
            setLoading(false);
        }
    };

    const parseCommonQuantities = (raw) => {
        try {
            const parsed = JSON.parse(raw || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            throw new Error('Common quantities must be valid JSON.');
        }
    };

    const unitPayload = (source) => ({
        name: source.name,
        code: source.code,
        symbol: source.symbol || null,
        unit_category: source.unit_category,
        base_unit_code: source.base_unit_code || null,
        conversion_factor_to_base: Number(source.conversion_factor_to_base || 1),
        allows_decimal: Boolean(source.allows_decimal),
        common_quantities: parseCommonQuantities(source.common_quantities_json),
        localized_labels: source.localized_labels || null,
        is_active: Boolean(source.is_active),
        sort_order: Number(source.sort_order || 0),
    });

    const createUnitType = async () => {
        if (!unitForm.name.trim() || !unitForm.code.trim()) {
            toast.error('Unit name and code are required.');
            return;
        }
        try {
            await axios.post('/admin/api/catalog/unit-types', unitPayload(unitForm));
            setUnitForm(emptyUnit);
            toast.success('Unit type created.');
            await loadUnits();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to create unit type.');
        }
    };

    const openEditUnit = (unit) => {
        setEditingUnit({
            id: unit.id,
            name: unit.name || '',
            code: unit.code || '',
            symbol: unit.symbol || '',
            unit_category: unit.unit_category || 'count',
            base_unit_code: unit.base_unit_code || '',
            conversion_factor_to_base: unit.conversion_factor_to_base || 1,
            allows_decimal: !!unit.allows_decimal,
            common_quantities_json: JSON.stringify(unit.common_quantities || [], null, 2),
            localized_labels: unit.localized_labels || null,
            is_active: unit.is_active !== false,
            sort_order: unit.sort_order || 0,
        });
    };

    const saveUnit = async () => {
        if (!editingUnit?.id) return;
        try {
            await axios.put(`/admin/api/catalog/unit-types/${editingUnit.id}`, unitPayload(editingUnit));
            setEditingUnit(null);
            toast.success('Unit type updated.');
            await loadUnits();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to update unit type.');
        }
    };

    const deleteUnitType = async (unitId) => {
        if (!window.confirm('Delete this unit type?')) return;
        try {
            await axios.delete(`/admin/api/catalog/unit-types/${unitId}`);
            toast.success('Unit type deleted.');
            await loadUnits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete unit type.');
        }
    };

    const grouped = unitTypes.reduce((acc, unit) => {
        const key = unit.unit_category || 'other';
        acc[key] = acc[key] || [];
        acc[key].push(unit);
        return acc;
    }, {});

    return (
        <AdminLayout title="Sellable Unit Library">
            <Head title="Sellable Unit Library | Takeer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Ruler className="h-6 w-6 text-brand-700" /> Sellable Unit Library
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Manage reusable selling units and fractional quantity presets for global commerce.</p>
                </div>

                <Card className="bg-white border-slate-200 p-4 space-y-3">
                    <p className="font-bold text-slate-900">Create Unit</p>
                    <UnitFields unit={unitForm} setUnit={setUnitForm} />
                    <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={createUnitType}>
                        <Plus className="h-4 w-4 mr-1" /> Create Unit
                    </Button>
                </Card>

                {loading ? (
                    <Card className="bg-white border-slate-200 p-10 text-center text-slate-500">Loading units...</Card>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(grouped).map(([category, items]) => (
                            <Card key={category} className="bg-white border-slate-200 p-4 space-y-3">
                                <p className="font-black uppercase tracking-wider text-xs text-slate-600">{category}</p>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {items.map((unit) => (
                                        <div key={unit.id} className="rounded-lg border border-slate-200 p-3 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{unit.name} <span className="text-slate-500 font-medium">({unit.code})</span></p>
                                                <p className="text-xs text-slate-500">{unit.symbol || unit.code} · base {unit.base_unit_code || unit.code} · factor {unit.conversion_factor_to_base}</p>
                                                <p className="text-xs text-slate-500">{unit.allows_decimal ? 'Decimal/fractional allowed' : 'Whole quantities only'} · {(unit.common_quantities || []).length} quick amounts · {unit.is_active === false ? 'inactive' : 'active'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" onClick={() => openEditUnit(unit)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" className="text-red-700 border-red-300" onClick={() => deleteUnitType(unit.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!editingUnit} onOpenChange={(open) => { if (!open) setEditingUnit(null); }}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Unit Type</DialogTitle>
                        <DialogDescription>Update unit math, labels, and quick quantity presets.</DialogDescription>
                    </DialogHeader>
                    {editingUnit && <UnitFields unit={editingUnit} setUnit={setEditingUnit} />}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUnit(null)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveUnit}>
                            <Check className="h-4 w-4 mr-1" /> Save Unit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function UnitFields({ unit, setUnit }) {
    return (
        <div className="space-y-3">
            <div className="grid md:grid-cols-4 gap-2">
                <Input value={unit.name} onChange={(e) => setUnit((p) => ({ ...p, name: e.target.value }))} placeholder="Name e.g Kilogram" />
                <Input value={unit.code} onChange={(e) => setUnit((p) => ({ ...p, code: e.target.value }))} placeholder="Code e.g kg" />
                <Input value={unit.symbol} onChange={(e) => setUnit((p) => ({ ...p, symbol: e.target.value }))} placeholder="Symbol" />
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={unit.unit_category} onChange={(e) => setUnit((p) => ({ ...p, unit_category: e.target.value }))}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <Input value={unit.base_unit_code} onChange={(e) => setUnit((p) => ({ ...p, base_unit_code: e.target.value }))} placeholder="Base e.g g/ml" />
                <Input type="number" min="0" step="0.000001" value={unit.conversion_factor_to_base} onChange={(e) => setUnit((p) => ({ ...p, conversion_factor_to_base: e.target.value }))} placeholder="Factor to base" />
                <Input type="number" min="0" value={unit.sort_order} onChange={(e) => setUnit((p) => ({ ...p, sort_order: e.target.value }))} placeholder="Sort order" />
                <div className="flex gap-2">
                    <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                        <input type="checkbox" checked={!!unit.allows_decimal} onChange={(e) => setUnit((p) => ({ ...p, allows_decimal: e.target.checked }))} />
                        Decimal
                    </label>
                    <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                        <input type="checkbox" checked={!!unit.is_active} onChange={(e) => setUnit((p) => ({ ...p, is_active: e.target.checked }))} />
                        Active
                    </label>
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Common quantities JSON</p>
                <Textarea
                    className="font-mono text-xs min-h-32"
                    value={unit.common_quantities_json}
                    onChange={(e) => setUnit((p) => ({ ...p, common_quantities_json: e.target.value }))}
                    placeholder='[{"label":"Robo kilo","quantity":0.25,"aliases":["robo"]}]'
                />
            </div>
        </div>
    );
}
