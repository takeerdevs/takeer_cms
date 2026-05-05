import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { Check, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function AdminBrands() {
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newBrandName, setNewBrandName] = useState('');
    const [newModelByBrand, setNewModelByBrand] = useState({});
    const [newModelCategoriesByBrand, setNewModelCategoriesByBrand] = useState({});
    const [editingBrand, setEditingBrand] = useState(null);
    const [editingModel, setEditingModel] = useState(null);

    useEffect(() => {
        loadBrands();
    }, []);

    const loadBrands = async () => {
        setLoading(true);
        try {
            const [brandRes, categoryRes] = await Promise.all([
                axios.get('/admin/api/catalog/brands'),
                axios.get('/admin/api/catalog/categories', { params: { per_page: 50 } }),
            ]);
            setBrands(brandRes.data?.data || []);
            setCategories(flattenCategories(categoryRes.data?.data || []));
        } catch {
            toast.error('Failed to load brands.');
        } finally {
            setLoading(false);
        }
    };

    const createBrand = async () => {
        if (!newBrandName.trim()) {
            toast.error('Brand name is required.');
            return;
        }
        try {
            await axios.post('/admin/api/catalog/brands', { name: newBrandName });
            setNewBrandName('');
            toast.success('Brand created.');
            await loadBrands();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create brand.');
        }
    };

    const saveBrand = async () => {
        if (!editingBrand?.id) return;
        try {
            await axios.put(`/admin/api/catalog/brands/${editingBrand.id}`, {
                name: editingBrand.name,
                is_active: !!editingBrand.is_active,
            });
            setEditingBrand(null);
            toast.success('Brand updated.');
            await loadBrands();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update brand.');
        }
    };

    const deleteBrand = async (brandId) => {
        if (!window.confirm('Delete this brand and all models?')) return;
        try {
            await axios.delete(`/admin/api/catalog/brands/${brandId}`);
            toast.success('Brand deleted.');
            await loadBrands();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete brand.');
        }
    };

    const createBrandModel = async (brandId) => {
        const name = (newModelByBrand[brandId] || '').trim();
        if (!name) {
            toast.error('Model name is required.');
            return;
        }
        try {
            await axios.post(`/admin/api/catalog/brands/${brandId}/models`, {
                name,
                category_ids: newModelCategoriesByBrand[brandId] || [],
            });
            setNewModelByBrand((prev) => ({ ...prev, [brandId]: '' }));
            setNewModelCategoriesByBrand((prev) => ({ ...prev, [brandId]: [] }));
            toast.success('Brand model created.');
            await loadBrands();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create model.');
        }
    };

    const saveModel = async () => {
        if (!editingModel?.id) return;
        try {
            await axios.put(`/admin/api/catalog/brand-models/${editingModel.id}`, {
                name: editingModel.name,
                is_active: !!editingModel.is_active,
                category_ids: editingModel.category_ids || [],
            });
            setEditingModel(null);
            toast.success('Model updated.');
            await loadBrands();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update model.');
        }
    };

    const deleteBrandModel = async (modelId) => {
        if (!window.confirm('Delete this brand model?')) return;
        try {
            await axios.delete(`/admin/api/catalog/brand-models/${modelId}`);
            toast.success('Brand model deleted.');
            await loadBrands();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete model.');
        }
    };

    return (
        <AdminLayout title="Brand & Model Library">
            <Head title="Brand & Model Library | Takeer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Tags className="h-6 w-6 text-brand-700" /> Brand & Model Library
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Manage reusable product brands and models, then allow them per category from Product Categories.</p>
                </div>

                <Card className="bg-white border-slate-200 p-4 space-y-3">
                    <p className="font-bold text-slate-900">Create Brand</p>
                    <div className="flex gap-2">
                        <Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand name e.g Apple" />
                        <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={createBrand}>
                            <Plus className="h-4 w-4 mr-1" /> Create Brand
                        </Button>
                    </div>
                </Card>

                {loading ? (
                    <Card className="bg-white border-slate-200 p-10 text-center text-slate-500">Loading brands...</Card>
                ) : (
                    <div className="space-y-3">
                        {brands.length === 0 ? (
                            <Card className="bg-white border-slate-200 p-10 text-center text-slate-500">No brands yet.</Card>
                        ) : brands.map((brand) => (
                            <Card key={brand.id} className="bg-white border-slate-200 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-black text-slate-900">{brand.name}</p>
                                        <p className="text-xs text-slate-500">{(brand.models || []).length} models · {brand.is_active === false ? 'inactive' : 'active'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setEditingBrand({ id: brand.id, name: brand.name, is_active: brand.is_active !== false })}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" className="text-red-700 border-red-300" onClick={() => deleteBrand(brand.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={newModelByBrand[brand.id] || ''}
                                        onChange={(e) => setNewModelByBrand((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                                        placeholder={`Add model for ${brand.name}`}
                                    />
                                    <Button variant="outline" onClick={() => createBrandModel(brand.id)}>Add Model</Button>
                                </div>
                                <CategoryPicker
                                    label="Categories for new model"
                                    categories={categories}
                                    selectedIds={newModelCategoriesByBrand[brand.id] || []}
                                    onToggle={(categoryId) => {
                                        setNewModelCategoriesByBrand((prev) => {
                                            const current = prev[brand.id] || [];
                                            const exists = current.includes(categoryId);
                                            return {
                                                ...prev,
                                                [brand.id]: exists ? current.filter((id) => id !== categoryId) : [...current, categoryId],
                                            };
                                        });
                                    }}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {(brand.models || []).map((model) => (
                                        <span key={model.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs bg-white">
                                            {model.name}
                                            <span className="text-slate-400">{(model.categories || []).length} categories</span>
                                            {model.is_active === false && <span className="text-slate-400">inactive</span>}
                                            <button
                                                type="button"
                                                className="text-slate-500"
                                                onClick={() => setEditingModel({
                                                    id: model.id,
                                                    name: model.name,
                                                    is_active: model.is_active !== false,
                                                    category_ids: (model.categories || []).map((category) => category.id),
                                                })}
                                            >
                                                edit
                                            </button>
                                            <button type="button" className="text-red-600" onClick={() => deleteBrandModel(model.id)}>x</button>
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!editingBrand} onOpenChange={(open) => { if (!open) setEditingBrand(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Brand</DialogTitle>
                        <DialogDescription>Update the brand name and active state.</DialogDescription>
                    </DialogHeader>
                    {editingBrand && (
                        <div className="space-y-3">
                            <Input value={editingBrand.name} onChange={(e) => setEditingBrand((p) => ({ ...p, name: e.target.value }))} />
                            <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center gap-2 w-fit">
                                <input type="checkbox" checked={!!editingBrand.is_active} onChange={(e) => setEditingBrand((p) => ({ ...p, is_active: e.target.checked }))} />
                                Active
                            </label>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingBrand(null)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveBrand}>
                            <Check className="h-4 w-4 mr-1" /> Save Brand
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingModel} onOpenChange={(open) => { if (!open) setEditingModel(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Model</DialogTitle>
                        <DialogDescription>Update model name and active state.</DialogDescription>
                    </DialogHeader>
                    {editingModel && (
                        <div className="space-y-3">
                            <Input value={editingModel.name} onChange={(e) => setEditingModel((p) => ({ ...p, name: e.target.value }))} />
                            <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center gap-2 w-fit">
                                <input type="checkbox" checked={!!editingModel.is_active} onChange={(e) => setEditingModel((p) => ({ ...p, is_active: e.target.checked }))} />
                                Active
                            </label>
                            <CategoryPicker
                                label="Model is valid for these categories"
                                categories={categories}
                                selectedIds={editingModel.category_ids || []}
                                onToggle={(categoryId) => {
                                    setEditingModel((prev) => {
                                        const current = prev.category_ids || [];
                                        const exists = current.includes(categoryId);
                                        return { ...prev, category_ids: exists ? current.filter((id) => id !== categoryId) : [...current, categoryId] };
                                    });
                                }}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingModel(null)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveModel}>
                            <Check className="h-4 w-4 mr-1" /> Save Model
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function flattenCategories(rootCategories) {
    return rootCategories.flatMap((category) => ([
        { id: category.id, label: category.name },
        ...(category.children || []).map((child) => ({ id: child.id, label: `${category.name} / ${child.name}` })),
    ]));
}

function CategoryPicker({ label, categories, selectedIds, onToggle }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {categories.length === 0 ? (
                    <p className="text-xs text-slate-500">Create categories first.</p>
                ) : categories.map((category) => (
                    <label key={category.id} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs flex items-center gap-2">
                        <input type="checkbox" checked={selectedIds.includes(category.id)} onChange={() => onToggle(category.id)} />
                        <span className="truncate">{category.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
