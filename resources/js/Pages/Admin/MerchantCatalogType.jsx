import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

const labels = {
    physical: 'Physical Products',
    digital: 'Digital Downloads',
    service: 'Services / Bookings',
    posts: 'Posts',
    bundles: 'Bundles',
    subscriptions: 'Subscriptions',
};

export default function MerchantCatalogType({ merchantId, type }) {
    const [merchant, setMerchant] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const pageTitle = useMemo(() => `Merchant ${labels[type] || 'Catalog'} - Admin`, [type]);

    const loadMerchant = async () => {
        const res = await fetch(`/admin/api/merchants/${merchantId}`, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load merchant.');
        setMerchant(data.merchant);
    };

    const loadItems = async (nextPage = 1, q = search) => {
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}/catalog/${type}?page=${nextPage}&search=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load catalog.');
            setItems(data.data || []);
            setPage(data.current_page || 1);
            setLastPage(data.last_page || 1);
        } catch (err) {
            toast.error(err.message);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMerchant().catch((e) => toast.error(e.message));
        loadItems(1, '');
    }, [merchantId, type]);

    return (
        <AdminLayout title={pageTitle}>
            <Head title={pageTitle} />

            <div className="space-y-5">
                <div>
                    <Link href={`/admin/merchants/${merchantId}`} className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to merchant
                    </Link>
                    <h1 className="text-2xl font-black text-slate-900 mt-2">
                        {merchant?.display_name || 'Merchant'} - {labels[type] || 'Catalog'}
                    </h1>
                    <p className="text-sm text-slate-600">Read-only admin validation view.</p>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            className="bg-white border-slate-300 text-slate-900 pl-9"
                            placeholder={`Search ${labels[type] || 'items'}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={() => loadItems(1, search)}>Search</Button>
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">Loading...</div>
                        ) : items.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No records found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="text-left p-3 text-slate-500">ID</th>
                                            <th className="text-left p-3 text-slate-500">Title</th>
                                            <th className="text-left p-3 text-slate-500">Type</th>
                                            <th className="text-left p-3 text-slate-500">Status</th>
                                            <th className="text-left p-3 text-slate-500">Price</th>
                                            <th className="text-left p-3 text-slate-500">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-b border-slate-100">
                                                <td className="p-3 text-slate-800">{item.id}</td>
                                                <td className="p-3 text-slate-800">
                                                    {item.title || item.name || item.caption || 'Untitled'}
                                                </td>
                                                <td className="p-3 text-slate-700">
                                                    {item.type || item.billing_interval || (type === 'posts' ? 'post' : type)}
                                                </td>
                                                <td className="p-3 text-slate-700">{item.status || item.visibility || '-'}</td>
                                                <td className="p-3 text-slate-700">
                                                    {item.price !== undefined && item.price !== null ? `TZS ${Number(item.price).toLocaleString()}` : '-'}
                                                </td>
                                                <td className="p-3 text-slate-700">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => loadItems(page - 1, search)}>Prev</Button>
                    <span className="text-sm text-slate-700">Page {page} / {lastPage}</span>
                    <Button variant="outline" disabled={page >= lastPage} onClick={() => loadItems(page + 1, search)}>Next</Button>
                </div>
            </div>
        </AdminLayout>
    );
}
