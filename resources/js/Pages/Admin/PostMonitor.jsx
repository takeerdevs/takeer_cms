import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import PostCard from '@/Components/PostCard';
import EditorJsRenderer from '@/Components/EditorJsRenderer';
import LinkifiedText from '@/Components/LinkifiedText';

export default function PostMonitor({ postRef }) {
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/admin/api/posts/${postRef}`, { headers: { Accept: 'application/json' } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to load post.');
                setPost(data.post || null);
            } catch (err) {
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [postRef]);

    return (
        <AdminLayout title="Post Monitor">
            <Head title="Admin Post Monitor | Takeer" />
            <div className="space-y-5">
                <div>
                    <Link href="/admin/feed" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to feed
                    </Link>
                </div>
                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">Loading post...</CardContent>
                    </Card>
                ) : !post ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">Post not found.</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <PostCard post={post} readOnly detailHref={`/admin/posts/${post.public_id || post.id}`} />
                        </div>

                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5 space-y-3">
                                <h2 className="text-lg font-black text-slate-900">Full Post Content (Admin Read-only)</h2>
                                {post.excerpt && (
                                    <p className="text-sm text-slate-700">
                                        <LinkifiedText text={post.excerpt} />
                                    </p>
                                )}
                                {post.body && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        {looksLikeEditorJs(post.body) ? (
                                            <EditorJsRenderer content={post.body} />
                                        ) : (
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.body}</p>
                                        )}
                                    </div>
                                )}
                                <div className="text-xs text-slate-600">
                                    <p>Views: {post.views_count || 0}</p>
                                    <p>Likes: {post.likes_count || 0}</p>
                                    <p>Comments: {post.comment_count || 0}</p>
                                    <p>Created: {post.created_at ? new Date(post.created_at).toLocaleString() : '-'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function looksLikeEditorJs(value) {
    if (!value) return false;
    if (typeof value === 'object') return Array.isArray(value.blocks);
    if (typeof value !== 'string') return false;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed?.blocks);
    } catch {
        return false;
    }
}
