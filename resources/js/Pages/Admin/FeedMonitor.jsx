import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import PostCard from '@/Components/PostCard';
import { useMemo } from 'react';

export default function FeedMonitor() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [merchantFilter, setMerchantFilter] = useState('');

    const currentMerchantFilter = useMemo(() => {
        if (merchantFilter) return merchantFilter;
        if (typeof window === 'undefined') return '';
        return new URLSearchParams(window.location.search).get('merchant') || '';
    }, [merchantFilter]);

    const loadPosts = async (nextPage = 1, q = search) => {
        setLoading(true);
        try {
            const merchantPart = currentMerchantFilter ? `&merchant=${encodeURIComponent(currentMerchantFilter)}` : '';
            const res = await fetch(`/admin/api/feed?page=${nextPage}&search=${encodeURIComponent(q)}${merchantPart}`, { headers: { Accept: 'application/json' } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load feed.');
            setPosts(data.data || []);
            setPage(data.current_page || 1);
            setLastPage(data.last_page || 1);
        } catch (err) {
            toast.error(err.message);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const queryMerchant = new URLSearchParams(window.location.search).get('merchant') || '';
            setMerchantFilter(queryMerchant);
        }
    }, []);

    useEffect(() => { loadPosts(1, ''); }, [currentMerchantFilter]);

    return (
        <AdminLayout title="Feed Monitor" hideTopBar>
            <Head title="Admin Feed Monitor | Takeer" />

            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Platform Feed Monitor</h1>
                    <p className="text-sm text-slate-600">Read-only visibility into all posts, including restricted content.</p>
                    {currentMerchantFilter && (
                        <p className="text-xs text-slate-500 mt-1">
                            Filtered by merchant ID: {currentMerchantFilter}
                        </p>
                    )}
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            className="bg-white border-slate-300 text-slate-900 pl-9"
                            placeholder="Search feed..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={() => loadPosts(1, search)}>Search</Button>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">Loading feed...</CardContent>
                    </Card>
                ) : posts.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">No posts found.</CardContent>
                    </Card>
                ) : (
                    <div className="max-w-lg mx-auto divide-y divide-border rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        {posts.map((post) => (
                            <div key={post.id}>
                                <PostCard
                                    post={post}
                                    readOnly
                                    adminMode
                                    detailHref={`/admin/posts/${post.public_id || post.id}`}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => loadPosts(page - 1, search)}>Prev</Button>
                    <span className="text-sm text-slate-700">Page {page} / {lastPage}</span>
                    <Button variant="outline" disabled={page >= lastPage} onClick={() => loadPosts(page + 1, search)}>Next</Button>
                </div>
            </div>
        </AdminLayout>
    );
}
