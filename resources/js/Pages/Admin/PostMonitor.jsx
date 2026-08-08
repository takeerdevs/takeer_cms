import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import PostCard from '@/Components/PostCard';
import LongFormContentRenderer from '@/Components/LongFormContentRenderer';
import { isLexicalDocument } from '@/lib/longFormContent';
import LinkifiedText from '@/Components/LinkifiedText';
import { useLocale } from '@/lib/i18n';

export default function PostMonitor({ postRef }) {
    const { t, copy } = useLocale();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/admin/api/posts/${postRef}`, { headers: { Accept: 'application/json' } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || t('adminUi.noPosts'));
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
        <AdminLayout title={t('admin.nav.feedMonitor')}>
            <Head title={`${t('admin.nav.feedMonitor')} | Takeer`} />
            <div className="space-y-5">
                <div>
                    <Link href="/admin/feed" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> {copy('Back to feed', 'Rudi kwenye feed')}
                    </Link>
                </div>
                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">{t('adminUi.loadingFeed')}</CardContent>
                    </Card>
                ) : !post ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">{copy('Post not found.', 'Post haikupatikana.')}</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <PostCard post={post} readOnly detailHref={`/admin/posts/${post.public_id || post.id}`} />
                        </div>

                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5 space-y-3">
                                <h2 className="text-lg font-black text-slate-900">{copy('Full Post Content (Admin Read-only)', 'Maudhui yote ya post (Admin kusoma tu)')}</h2>
                                {post.excerpt && (
                                    <p className="text-sm text-slate-700">
                                        <LinkifiedText text={post.excerpt} />
                                    </p>
                                )}
                                {post.body && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        {post.content_format === 'lexical' || isLexicalDocument(post.body) ? (
                                            <LongFormContentRenderer data={post.body} />
                                        ) : (
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.body}</p>
                                        )}
                                    </div>
                                )}
                                <div className="text-xs text-slate-600">
                                    <p>{copy('Views', 'Mionekano')}: {post.views_count || 0}</p>
                                    <p>{copy('Likes', 'Likes')}: {post.likes_count || 0}</p>
                                    <p>{copy('Comments', 'Maoni')}: {post.comment_count || 0}</p>
                                    <p>{copy('Created', 'Iliundwa')}: {post.created_at ? new Date(post.created_at).toLocaleString() : '-'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
