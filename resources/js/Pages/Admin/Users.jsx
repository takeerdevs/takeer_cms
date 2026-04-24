import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Users, Search, ShieldCheck, Ban, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [meta, setMeta] = useState({ total: 0 });

    const fetchUsers = (nextPage = 1, q = search) => {
        setLoading(true);
        fetch(`/admin/api/users?page=${nextPage}&search=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load users.');
                return data;
            })
            .then(data => {
                setUsers(data.data ?? []);
                setPage(data.current_page ?? 1);
                setLastPage(data.last_page ?? 1);
                setMeta({ total: data.total ?? 0 });
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setUsers([]);
                setLoading(false);
            });
    };

    useEffect(() => { fetchUsers(1, ''); }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers(1, search);
    };

    const toggleRole = async (userId, role) => {
        try {
            const res = await fetch(`/admin/api/users/${userId}/toggle-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message);
            fetchUsers(page);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const toggleBan = async (userId) => {
        try {
            const res = await fetch(`/admin/api/users/${userId}/toggle-ban`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message);
            fetchUsers(page);
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <AdminLayout title="Users">
            <Head title="Admin Users | Takeer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Users className="h-6 w-6 text-sky-700" /> Users
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Manage users, roles, and ban status.</p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            className="bg-white border-slate-300 text-slate-900 pl-9"
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white">Search</Button>
                </form>

                <Card className="bg-white border-slate-200 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm min-w-[840px]">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left p-4 text-slate-500 font-medium">#</th>
                                <th className="text-left p-4 text-slate-500 font-medium">Name / Phone</th>
                                <th className="text-left p-4 text-slate-500 font-medium">Role</th>
                                <th className="text-center p-4 text-slate-500 font-medium">Merchant</th>
                                <th className="text-center p-4 text-slate-500 font-medium">Admin</th>
                                <th className="text-center p-4 text-slate-500 font-medium">Ban</th>
                                <th className="text-right p-4 text-slate-500 font-medium">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No users match this search.</td></tr>
                            ) : users.map(user => {
                                const isMerchant = user.role === 'merchant';
                                return (
                                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-500 font-mono text-xs">{user.id}</td>
                                        <td className="p-4">
                                            <p className="font-semibold text-slate-900">{user.name || '—'}</p>
                                            <p className="text-slate-500 text-xs">{user.phone_number || 'No phone'}</p>
                                        </td>
                                        <td className="p-4 text-slate-700 text-xs uppercase font-bold">{user.role || 'buyer'}</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => toggleRole(user.id, 'is_merchant')}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${isMerchant ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                {isMerchant ? <UserCheck className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                                                {isMerchant ? 'Yes' : 'No'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => toggleRole(user.id, 'is_admin')}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${user.is_admin ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                {user.is_admin ? 'Yes' : 'No'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => toggleBan(user.id)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${user.is_banned ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                <Ban className="h-3.5 w-3.5" />
                                                {user.is_banned ? 'Banned' : 'Active'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right text-slate-500 text-xs">
                                            {new Date(user.created_at).toLocaleDateString('sw-TZ')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>

                <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-600">Total users: {meta.total}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" disabled={page <= 1} onClick={() => fetchUsers(page - 1)}>Prev</Button>
                        <span className="text-sm text-slate-700">Page {page} / {lastPage}</span>
                        <Button variant="outline" disabled={page >= lastPage} onClick={() => fetchUsers(page + 1)}>Next</Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
