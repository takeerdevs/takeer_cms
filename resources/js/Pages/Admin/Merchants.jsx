import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Store, Search, ShieldAlert, BadgeCheck, Power } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const kycOptions = ['unverified', 'pending', 'verified', 'rejected'];

export default function AdminMerchants() {
    const [merchants, setMerchants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [busyMerchantId, setBusyMerchantId] = useState(null);

    const fetchMerchants = (nextPage = 1, nextSearch = search, nextStatus = status) => {
        setLoading(true);
        fetch(`/admin/api/merchants?page=${nextPage}&search=${encodeURIComponent(nextSearch)}&status=${encodeURIComponent(nextStatus)}`, { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load merchants.');
                return data;
            })
            .then(data => {
                const paged = data.merchants || {};
                setMerchants(paged.data || []);
                setPage(paged.current_page || 1);
                setLastPage(paged.last_page || 1);
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setMerchants([]);
                setLoading(false);
            });
    };

    useEffect(() => { fetchMerchants(1, '', 'all'); }, []);

    const patchMerchant = async (merchantId, payload) => {
        setBusyMerchantId(merchantId);
        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}`, {
                method: 'PUT',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update merchant');
            toast.success(data.message || 'Merchant updated');
            fetchMerchants(page);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyMerchantId(null);
        }
    };

    return (
        <AdminLayout title="Merchants">
            <Head title="Admin Merchants | Takeer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Store className="h-6 w-6 text-indigo-700" /> Merchant Control
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Manage merchant trust, verification, activity, and suspension controls.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            className="bg-white border-slate-300 text-slate-900 pl-9"
                            placeholder="Search by merchant name or username..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>
                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => fetchMerchants(1, search, status)}>Apply Filters</Button>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm min-w-[1100px]">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="p-4 text-left text-slate-500">Merchant</th>
                                <th className="p-4 text-left text-slate-500">Owner</th>
                                <th className="p-4 text-left text-slate-500">Catalog</th>
                                <th className="p-4 text-left text-slate-500">KYC</th>
                                <th className="p-4 text-center text-slate-500">Verified</th>
                                <th className="p-4 text-center text-slate-500">Active</th>
                                <th className="p-4 text-center text-slate-500">Suspended</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading merchants...</td></tr>
                            ) : merchants.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No merchants found.</td></tr>
                            ) : merchants.map((merchant) => (
                                <tr
                                    key={merchant.id}
                                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                    onClick={() => router.visit(`/admin/merchants/${merchant.id}`)}
                                >
                                    <td className="p-4">
                                        <p className="font-semibold text-slate-900">{merchant.display_name}</p>
                                        <p className="text-xs text-slate-500">@{merchant.username}</p>
                                        <p className="text-xs text-slate-500 mt-1">ID #{merchant.id}</p>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-slate-700">{merchant.user?.name || '—'}</p>
                                        <p className="text-xs text-slate-500">{merchant.user?.phone_number || merchant.user?.email || '—'}</p>
                                    </td>
                                    <td className="p-4 text-xs text-slate-600">
                                        products: {merchant.products_count || 0}<br />
                                        posts: {merchant.posts_count || 0}<br />
                                        content items: {merchant.content_items_count || 0}<br />
                                        orders: {merchant.orders_count || 0}
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={merchant.kyc_status || 'unverified'}
                                            onChange={(e) => patchMerchant(merchant.id, { kyc_status: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                                            disabled={busyMerchantId === merchant.id}
                                        >
                                            {kycOptions.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Button
                                            variant="outline"
                                            disabled={busyMerchantId === merchant.id}
                                            className={merchant.is_verified ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-700'}
                                            onClick={(e) => { e.stopPropagation(); patchMerchant(merchant.id, { is_verified: !merchant.is_verified }); }}
                                        >
                                            <BadgeCheck className="h-4 w-4 mr-1" />
                                            {merchant.is_verified ? 'Yes' : 'No'}
                                        </Button>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Button
                                            variant="outline"
                                            disabled={busyMerchantId === merchant.id}
                                            className={merchant.is_active ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'}
                                            onClick={(e) => { e.stopPropagation(); patchMerchant(merchant.id, { is_active: !merchant.is_active }); }}
                                        >
                                            <Power className="h-4 w-4 mr-1" />
                                            {merchant.is_active ? 'Active' : 'Inactive'}
                                        </Button>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Button
                                            variant="outline"
                                            disabled={busyMerchantId === merchant.id}
                                            className={merchant.is_suspended ? 'border-red-300 text-red-700' : 'border-slate-300 text-slate-700'}
                                            onClick={(e) => { e.stopPropagation(); patchMerchant(merchant.id, { is_suspended: !merchant.is_suspended }); }}
                                        >
                                            <ShieldAlert className="h-4 w-4 mr-1" />
                                            {merchant.is_suspended ? 'Yes' : 'No'}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => fetchMerchants(page - 1, search, status)}>Prev</Button>
                    <span className="text-sm text-slate-700">Page {page} / {lastPage}</span>
                    <Button variant="outline" disabled={page >= lastPage} onClick={() => fetchMerchants(page + 1, search, status)}>Next</Button>
                </div>
            </div>
        </AdminLayout>
    );
}
