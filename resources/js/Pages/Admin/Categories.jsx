import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { Shapes, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const emptyCategory = { name: '', parent_id: '', image_url: '', is_active: true, sort_order: 0, brand_ids: [] };
const emptyAttr = {
    key: '',
    label: '',
    input_type: 'text',
    ui_hint: '',
    options_csv: '',
    unit_options_csv: '',
    is_required: false,
    is_filterable: true,
    is_variant_axis: false,
    ai_extractable: false,
    sort_order: 0,
};

export default function AdminCategories() {
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoryPage, setCategoryPage] = useState(1);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 10, total: 0 });
    const [categoryForm, setCategoryForm] = useState(emptyCategory);
    const [attributeFormByCategory, setAttributeFormByCategory] = useState({});
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingAttribute, setEditingAttribute] = useState(null);

    const [newBrandName, setNewBrandName] = useState('');
    const [newModelByBrand, setNewModelByBrand] = useState({});

    useEffect(() => {
        loadData(categoryPage);
    }, [categoryPage]);

    const loadData = async (page = 1) => {
        setLoading(true);
        try {
            const [categoryRes, brandRes] = await Promise.all([
                axios.get('/admin/api/catalog/categories', { params: { page, per_page: pagination.per_page || 10 } }),
                axios.get('/admin/api/catalog/brands'),
            ]);
            setCategories(categoryRes.data?.data || []);
            setPagination(categoryRes.data?.pagination || { current_page: 1, last_page: 1, per_page: 10, total: 0 });
            setBrands(brandRes.data?.data || []);
        } catch {
            toast.error('Failed to load catalog data.');
        } finally {
            setLoading(false);
        }
    };

    const allCategoryOptions = useMemo(() => ([
        ...categories.map((c) => ({ id: c.id, label: c.name })),
        ...categories.flatMap((c) => (c.children || []).map((s) => ({ id: s.id, label: `${c.name} / ${s.name}` }))),
    ]), [categories]);

    const createCategory = async () => {
        if (!categoryForm.name.trim()) {
            toast.error('Category name is required.');
            return;
        }
        try {
            await axios.post('/admin/api/catalog/categories', {
                ...categoryForm,
                parent_id: categoryForm.parent_id ? Number(categoryForm.parent_id) : null,
                sort_order: Number(categoryForm.sort_order || 0),
                brand_ids: (categoryForm.brand_ids || []).map(Number),
            });
            toast.success('Category created.');
            setCategoryForm(emptyCategory);
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create category.');
        }
    };

    const saveCategory = async () => {
        if (!editingCategory?.id) return;
        try {
            await axios.put(`/admin/api/catalog/categories/${editingCategory.id}`, {
                name: editingCategory.name,
                parent_id: editingCategory.parent_id || null,
                image_url: editingCategory.image_url || null,
                is_active: !!editingCategory.is_active,
                sort_order: Number(editingCategory.sort_order || 0),
                brand_ids: (editingCategory.brand_ids || []).map(Number),
            });
            toast.success('Category updated.');
            setEditingCategory(null);
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update category.');
        }
    };

    const deleteCategory = async (id) => {
        if (!window.confirm('Delete this category and all child attributes?')) return;
        try {
            await axios.delete(`/admin/api/catalog/categories/${id}`);
            toast.success('Category deleted.');
            const nextPage = categories.length === 1 && categoryPage > 1 ? categoryPage - 1 : categoryPage;
            setCategoryPage(nextPage);
            await loadData(nextPage);
        } catch {
            toast.error('Failed to delete category.');
        }
    };

    const createAttribute = async (categoryId) => {
        const current = attributeFormByCategory[categoryId] || emptyAttr;
        if (!current.key.trim() || !current.label.trim()) {
            toast.error('Attribute key and label are required.');
            return;
        }

        try {
            await axios.post(`/admin/api/catalog/categories/${categoryId}/attributes`, {
                key: current.key,
                label: current.label,
                input_type: current.input_type,
                ui_hint: current.input_type === 'number' ? (current.ui_hint || null) : null,
                options: current.input_type === 'select'
                    ? current.options_csv.split(',').map((x) => x.trim()).filter(Boolean)
                    : [],
                unit_options: current.input_type === 'number'
                    ? current.unit_options_csv.split(',').map((x) => x.trim()).filter(Boolean)
                    : [],
                is_required: Boolean(current.is_required),
                is_filterable: Boolean(current.is_filterable),
                is_variant_axis: current.input_type === 'select' ? Boolean(current.is_variant_axis) : false,
                ai_extractable: Boolean(current.ai_extractable),
                sort_order: Number(current.sort_order || 0),
            });
            toast.success('Attribute created.');
            setAttributeFormByCategory((prev) => ({ ...prev, [categoryId]: emptyAttr }));
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create attribute.');
        }
    };

    const saveAttribute = async () => {
        if (!editingAttribute?.id) return;
        try {
            await axios.put(`/admin/api/catalog/attributes/${editingAttribute.id}`, {
                key: editingAttribute.key,
                label: editingAttribute.label,
                input_type: editingAttribute.input_type,
                ui_hint: editingAttribute.input_type === 'number' ? (editingAttribute.ui_hint || null) : null,
                options: editingAttribute.input_type === 'select'
                    ? (editingAttribute.options_csv || '').split(',').map((x) => x.trim()).filter(Boolean)
                    : [],
                unit_options: editingAttribute.input_type === 'number'
                    ? (editingAttribute.unit_options_csv || '').split(',').map((x) => x.trim()).filter(Boolean)
                    : [],
                is_required: !!editingAttribute.is_required,
                is_filterable: !!editingAttribute.is_filterable,
                is_variant_axis: editingAttribute.input_type === 'select' ? !!editingAttribute.is_variant_axis : false,
                ai_extractable: !!editingAttribute.ai_extractable,
                sort_order: Number(editingAttribute.sort_order || 0),
            });
            toast.success('Attribute updated.');
            setEditingAttribute(null);
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update attribute.');
        }
    };

    const deleteAttribute = async (id) => {
        if (!window.confirm('Delete this attribute?')) return;
        try {
            await axios.delete(`/admin/api/catalog/attributes/${id}`);
            toast.success('Attribute deleted.');
            await loadData(categoryPage);
        } catch {
            toast.error('Failed to delete attribute.');
        }
    };

    const openEditCategory = (category) => {
        setEditingCategory({
            id: category.id,
            name: category.name,
            parent_id: category.parent_id || '',
            image_url: category.image_url || '',
            is_active: !!category.is_active,
            sort_order: category.sort_order || 0,
            brand_ids: (category.brands || []).map((brand) => brand.id),
        });
    };

    const openEditAttribute = (attr) => {
        setEditingAttribute({
            id: attr.id,
            key: attr.key,
            label: attr.label,
            input_type: attr.input_type,
            ui_hint: attr.ui_hint || '',
            options_csv: Array.isArray(attr.options) ? attr.options.join(', ') : '',
            unit_options_csv: Array.isArray(attr.unit_options) ? attr.unit_options.join(', ') : '',
            is_required: !!attr.is_required,
            is_filterable: attr.is_filterable !== false,
            is_variant_axis: !!attr.is_variant_axis,
            ai_extractable: !!attr.ai_extractable,
            sort_order: attr.sort_order || 0,
        });
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
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create brand.');
        }
    };

    const createBrandModel = async (brandId) => {
        const name = (newModelByBrand[brandId] || '').trim();
        if (!name) {
            toast.error('Model name is required.');
            return;
        }
        try {
            await axios.post(`/admin/api/catalog/brands/${brandId}/models`, { name });
            setNewModelByBrand((prev) => ({ ...prev, [brandId]: '' }));
            toast.success('Brand model created.');
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create model.');
        }
    };

    const deleteBrand = async (brandId) => {
        if (!window.confirm('Delete this brand and all models?')) return;
        try {
            await axios.delete(`/admin/api/catalog/brands/${brandId}`);
            toast.success('Brand deleted.');
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete brand.');
        }
    };

    const deleteBrandModel = async (modelId) => {
        if (!window.confirm('Delete this brand model?')) return;
        try {
            await axios.delete(`/admin/api/catalog/brand-models/${modelId}`);
            toast.success('Brand model deleted.');
            await loadData(categoryPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete model.');
        }
    };

    return (
        <AdminLayout title="Categories">
            <Head title="Admin Categories | Takeer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Shapes className="h-6 w-6 text-brand-700" /> Product Categories, Facets & Brands
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Manage category tree, filter facets, and brand/model catalog.</p>
                </div>

                <Card className="bg-white border-slate-200 p-4 space-y-3">
                    <p className="font-bold text-slate-900">Brand & Model Library</p>
                    <div className="flex gap-2">
                        <Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand name e.g Apple" />
                        <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={createBrand}>Create Brand</Button>
                    </div>
                    <div className="space-y-2">
                        {brands.length === 0 ? (
                            <p className="text-sm text-slate-500">No brands yet.</p>
                        ) : brands.map((brand) => (
                            <div key={brand.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-900">{brand.name}</p>
                                    <Button variant="outline" className="text-red-700 border-red-300" onClick={() => deleteBrand(brand.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={newModelByBrand[brand.id] || ''}
                                        onChange={(e) => setNewModelByBrand((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                                        placeholder={`Add model for ${brand.name}`}
                                    />
                                    <Button variant="outline" onClick={() => createBrandModel(brand.id)}>Add Model</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(brand.models || []).map((model) => (
                                        <span key={model.id} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs">
                                            {model.name}
                                            <button type="button" className="text-red-600" onClick={() => deleteBrandModel(model.id)}>x</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="bg-white border-slate-200 p-4 space-y-3">
                    <p className="font-bold text-slate-900">Create Category</p>
                    <div className="grid md:grid-cols-5 gap-3">
                        <Input value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} placeholder="Category name" />
                        <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={categoryForm.parent_id} onChange={(e) => setCategoryForm((p) => ({ ...p, parent_id: e.target.value }))}>
                            <option value="">Parent (root)</option>
                            {allCategoryOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                        <Input value={categoryForm.image_url} onChange={(e) => setCategoryForm((p) => ({ ...p, image_url: e.target.value }))} placeholder="Category image URL" />
                        <Input type="number" min="0" value={categoryForm.sort_order} onChange={(e) => setCategoryForm((p) => ({ ...p, sort_order: e.target.value }))} placeholder="Sort order" />
                        <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={createCategory}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Category
                        </Button>
                    </div>
                    <BrandPicker
                        label="Allowed brands for this category"
                        brands={brands}
                        selectedIds={categoryForm.brand_ids || []}
                        onToggle={(brandId) => {
                            setCategoryForm((prev) => {
                                const exists = (prev.brand_ids || []).includes(brandId);
                                return { ...prev, brand_ids: exists ? prev.brand_ids.filter((id) => id !== brandId) : [...(prev.brand_ids || []), brandId] };
                            });
                        }}
                    />
                </Card>

                {loading ? (
                    <Card className="bg-white border-slate-200 p-10 text-center text-slate-500">Loading categories...</Card>
                ) : (
                    <div className="space-y-4">
                        {categories.map((category) => (
                            <Card key={category.id} className="bg-white border-slate-200 p-4 space-y-4">
                                <CategoryHeader category={category} onEdit={openEditCategory} onDelete={deleteCategory} />

                                <BrandSummary brands={category.brands || []} />

                                <AttributeBlock
                                    title={`${category.name} Attributes`}
                                    attributes={category.attributes || []}
                                    form={attributeFormByCategory[category.id] || emptyAttr}
                                    setForm={(next) => setAttributeFormByCategory((prev) => ({ ...prev, [category.id]: next }))}
                                    onCreate={() => createAttribute(category.id)}
                                    onDelete={deleteAttribute}
                                    onEdit={openEditAttribute}
                                />

                                {(category.children || []).map((child) => (
                                    <div key={child.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-3">
                                        <CategoryHeader category={child} displayName={`${category.name} / ${child.name}`} onEdit={openEditCategory} onDelete={deleteCategory} />
                                        <BrandSummary brands={child.brands || []} />
                                        <AttributeBlock
                                            title={`${child.name} Attributes`}
                                            attributes={child.attributes || []}
                                            form={attributeFormByCategory[child.id] || emptyAttr}
                                            setForm={(next) => setAttributeFormByCategory((prev) => ({ ...prev, [child.id]: next }))}
                                            onCreate={() => createAttribute(child.id)}
                                            onDelete={deleteAttribute}
                                            onEdit={openEditAttribute}
                                        />
                                    </div>
                                ))}
                            </Card>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">
                        Showing page {pagination.current_page} of {pagination.last_page} ({pagination.total} root categories)
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={pagination.current_page <= 1}
                            onClick={() => setCategoryPage((prev) => Math.max(1, prev - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            disabled={pagination.current_page >= pagination.last_page}
                            onClick={() => setCategoryPage((prev) => Math.min(pagination.last_page, prev + 1))}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog open={!!editingCategory} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>Update category details and allowed brands.</DialogDescription>
                    </DialogHeader>
                    {editingCategory && (
                        <div className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-3">
                                <Input value={editingCategory.name} onChange={(e) => setEditingCategory((p) => ({ ...p, name: e.target.value }))} placeholder="Category name" />
                                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={editingCategory.parent_id} onChange={(e) => setEditingCategory((p) => ({ ...p, parent_id: e.target.value }))}>
                                    <option value="">Parent (root)</option>
                                    {allCategoryOptions.filter((option) => option.id !== editingCategory.id).map((option) => (
                                        <option key={option.id} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                                <Input value={editingCategory.image_url} onChange={(e) => setEditingCategory((p) => ({ ...p, image_url: e.target.value }))} placeholder="Image URL" />
                                <Input type="number" min="0" value={editingCategory.sort_order} onChange={(e) => setEditingCategory((p) => ({ ...p, sort_order: e.target.value }))} placeholder="Sort order" />
                            </div>
                            <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center gap-2 w-fit">
                                <input type="checkbox" checked={!!editingCategory.is_active} onChange={(e) => setEditingCategory((p) => ({ ...p, is_active: e.target.checked }))} />
                                Active
                            </label>
                            <BrandPicker
                                label="Allowed brands"
                                brands={brands}
                                selectedIds={editingCategory.brand_ids || []}
                                onToggle={(brandId) => {
                                    setEditingCategory((prev) => {
                                        const exists = (prev.brand_ids || []).includes(brandId);
                                        return { ...prev, brand_ids: exists ? prev.brand_ids.filter((id) => id !== brandId) : [...(prev.brand_ids || []), brandId] };
                                    });
                                }}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveCategory}>
                            <Check className="h-4 w-4 mr-1" /> Save Category
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingAttribute} onOpenChange={(open) => { if (!open) setEditingAttribute(null); }}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Attribute</DialogTitle>
                        <DialogDescription>Update facet behavior and input style.</DialogDescription>
                    </DialogHeader>
                    {editingAttribute && (
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Key</p>
                                <Input value={editingAttribute.key} onChange={(e) => setEditingAttribute((p) => ({ ...p, key: e.target.value }))} placeholder="key" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Label</p>
                                <Input value={editingAttribute.label} onChange={(e) => setEditingAttribute((p) => ({ ...p, label: e.target.value }))} placeholder="label" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Input Type</p>
                                <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={editingAttribute.input_type} onChange={(e) => setEditingAttribute((p) => ({ ...p, input_type: e.target.value }))}>
                                    <option value="text">text</option>
                                    <option value="number">number</option>
                                    <option value="select">select</option>
                                    <option value="boolean">boolean</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Options (CSV)</p>
                                <Input
                                    value={editingAttribute.options_csv}
                                    onChange={(e) => setEditingAttribute((p) => ({ ...p, options_csv: e.target.value }))}
                                    placeholder="e.g SSD, HDD, NVMe"
                                    disabled={editingAttribute.input_type !== 'select'}
                                />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Number UI Hint</p>
                                <select
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                                    value={editingAttribute.ui_hint || ''}
                                    onChange={(e) => setEditingAttribute((p) => ({ ...p, ui_hint: e.target.value }))}
                                    disabled={editingAttribute.input_type !== 'number'}
                                >
                                    <option value="">no hint</option>
                                    <option value="number_with_unit">number + unit</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Units (CSV)</p>
                                <Input
                                    value={editingAttribute.unit_options_csv || ''}
                                    onChange={(e) => setEditingAttribute((p) => ({ ...p, unit_options_csv: e.target.value }))}
                                    placeholder="e.g GB, TB"
                                    disabled={editingAttribute.input_type !== 'number'}
                                />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Sort Order</p>
                                <Input type="number" min="0" value={editingAttribute.sort_order ?? 0} onChange={(e) => setEditingAttribute((p) => ({ ...p, sort_order: e.target.value }))} placeholder="0" />
                                <p className="text-[11px] text-slate-500">Lower number appears first in merchant form and filters.</p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:col-span-2">
                                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                                    <input type="checkbox" checked={!!editingAttribute.is_required} onChange={(e) => setEditingAttribute((p) => ({ ...p, is_required: e.target.checked }))} /> Required
                                </label>
                                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                                    <input type="checkbox" checked={!!editingAttribute.is_filterable} onChange={(e) => setEditingAttribute((p) => ({ ...p, is_filterable: e.target.checked }))} /> Filterable
                                </label>
                                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={!!editingAttribute.is_variant_axis}
                                        onChange={(e) => setEditingAttribute((p) => ({ ...p, is_variant_axis: e.target.checked }))}
                                        disabled={editingAttribute.input_type !== 'select'}
                                    />
                                    Variant axis
                                </label>
                                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                                    <input type="checkbox" checked={!!editingAttribute.ai_extractable} onChange={(e) => setEditingAttribute((p) => ({ ...p, ai_extractable: e.target.checked }))} /> AI
                                </label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingAttribute(null)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveAttribute}>
                            <Check className="h-4 w-4 mr-1" /> Save Attribute
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function CategoryHeader({ category, displayName, onEdit, onDelete }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="font-black text-slate-900">{displayName || category.name}</p>
                <p className="text-xs text-slate-600">/{category.slug}</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => onEdit(category)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" className="text-red-700 border-red-300" onClick={() => onDelete(category.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
            </div>
        </div>
    );
}

function BrandPicker({ label, brands, selectedIds, onToggle }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</p>
            <div className="grid md:grid-cols-4 gap-2">
                {brands.length === 0 ? (
                    <p className="text-xs text-slate-500">Create brands first.</p>
                ) : brands.map((brand) => (
                    <label key={brand.id} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center gap-2">
                        <input type="checkbox" checked={selectedIds.includes(brand.id)} onChange={() => onToggle(brand.id)} />
                        <span className="truncate">{brand.name}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

function BrandSummary({ brands }) {
    return (
        <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Allowed Brands</p>
            {brands.length === 0 ? (
                <p className="text-xs text-slate-500">No brand restriction.</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {brands.map((brand) => (
                        <span key={brand.id} className="rounded-full border border-slate-300 px-2 py-1 text-xs">{brand.name} ({(brand.models || []).length})</span>
                    ))}
                </div>
            )}
        </div>
    );
}

function AttributeBlock({ title, attributes, form, setForm, onCreate, onDelete, onEdit }) {
    return (
        <div className="space-y-3">
            <p className="text-sm font-bold text-slate-800">{title}</p>
            <div className="grid md:grid-cols-8 gap-2">
                <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="key e.g ram" />
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label e.g RAM" />
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.input_type} onChange={(e) => setForm({ ...form, input_type: e.target.value })}>
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="select">select</option>
                    <option value="boolean">boolean</option>
                </select>
                <Input value={form.options_csv} onChange={(e) => setForm({ ...form, options_csv: e.target.value })} placeholder="Options CSV" />
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs" value={form.ui_hint || ''} onChange={(e) => setForm({ ...form, ui_hint: e.target.value })}>
                    <option value="">no hint</option>
                    <option value="number_with_unit">number + unit</option>
                </select>
                <Input value={form.unit_options_csv || ''} onChange={(e) => setForm({ ...form, unit_options_csv: e.target.value })} placeholder="Units CSV e.g GB,TB" />
                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                    <input type="checkbox" checked={!!form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} /> Required
                </label>
                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                    <input type="checkbox" checked={!!form.is_filterable} onChange={(e) => setForm({ ...form, is_filterable: e.target.checked })} /> Filterable
                </label>
                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!form.is_variant_axis}
                        onChange={(e) => setForm({ ...form, is_variant_axis: e.target.checked })}
                        disabled={form.input_type !== 'select'}
                    />
                    Variant axis
                </label>
                <label className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs flex items-center gap-2">
                    <input type="checkbox" checked={!!form.ai_extractable} onChange={(e) => setForm({ ...form, ai_extractable: e.target.checked })} /> AI
                </label>
                <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={onCreate}>Add Attribute</Button>
            </div>
            <div className="space-y-2">
                {attributes.length === 0 ? (
                    <p className="text-xs text-slate-500">No attributes yet.</p>
                ) : attributes.map((attr) => (
                    <div key={attr.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-800">
                            <span className="font-semibold">{attr.label}</span> ({attr.key}) · {attr.input_type}
                            {attr.ui_hint ? ` · ${attr.ui_hint}` : ''}
                            {attr.is_required ? ' · required' : ''}
                            {attr.is_filterable ? ' · filterable' : ''}
                            {attr.is_variant_axis ? ' · variant-axis' : ''}
                            {attr.ai_extractable ? ' · ai' : ''}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onEdit(attr)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" className="text-red-700 border-red-300" onClick={() => onDelete(attr.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
