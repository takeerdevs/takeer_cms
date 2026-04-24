import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    BookOpenText,
    Loader2,
    MessageCircle,
    Plus,
    Search,
    ShieldCheck,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function MerchantPosts({ merchantUsername = '' }) {
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState([]);
    const [contentReports, setContentReports] = useState([]);
    const [commerceSummary, setCommerceSummary] = useState(null);
    const [postSearch, setPostSearch] = useState('');
    const [postTypeFilter, setPostTypeFilter] = useState('all');
    const [savingPostInteraction, setSavingPostInteraction] = useState(null);
    const [resolvingReportId, setResolvingReportId] = useState(null);

    useEffect(() => {
        loadPage();
    }, []);

    const isImageLikeUrl = (value) => {
        const raw = String(value || '').toLowerCase();
        if (!raw || raw.startsWith('private://')) return false;
        return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/.test(raw) || raw.includes('/storage/');
    };

    const filteredPosts = useMemo(() => {
        return posts.filter((entry) => {
            const hay = `${entry.title || ''} ${entry.caption || ''}`.toLowerCase();
            const matchesSearch = hay.includes(postSearch.toLowerCase());
            const matchesType = postTypeFilter === 'all' || entry.post_type === postTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [posts, postSearch, postTypeFilter]);

    const sectionSummaryCards = useMemo(() => {
        const postsSummary = commerceSummary?.sections?.posts || {};
        return [
            { label: 'All Posts', value: postsSummary.total_items ?? posts.length },
            { label: 'Long Form', value: postsSummary.long_form ?? 0 },
            { label: 'Total Views', value: Number(postsSummary.total_views ?? 0).toLocaleString() },
            { label: 'Sales Today', value: `TZS ${Number(postsSummary.today_sales ?? 0).toLocaleString()}` },
        ];
    }, [commerceSummary, posts.length]);

    async function loadPage() {
        setLoading(true);
        try {
            const [postsRes, reportsRes, summaryRes] = await Promise.all([
                axios.get('/merchant/posts/api'),
                axios.get('/merchant/content-reports/api'),
                axios.get(`/merchant/${merchantUsername}/orders/api/commerce-summary`).catch(() => ({ data: null })),
            ]);

            setPosts(postsRes.data?.data || []);
            setContentReports(reportsRes.data?.data || []);
            setCommerceSummary(summaryRes.data || null);
        } catch (error) {
            toast.error('Imeshindwa kupakia posts manager.');
        } finally {
            setLoading(false);
        }
    }

    async function updatePostInteractionOverride(postId, field, value) {
        const key = `${postId}:${field}`;
        setSavingPostInteraction(key);
        try {
            const payload = { [field]: value };
            await axios.patch(`/merchant/posts/${postId}/interaction/api`, payload);
            setPosts((current) => current.map((entry) => {
                if (entry.id !== postId) return entry;

                const next = { ...entry, [field]: value };
                const commentsGlobal = Boolean(next.global_comments_enabled ?? true);
                const reactionsGlobal = Boolean(next.global_reactions_enabled ?? true);

                next.comments_enabled = next.comments_enabled_override !== null
                    ? Boolean(next.comments_enabled_override)
                    : commentsGlobal;
                next.reactions_enabled = next.reactions_enabled_override !== null
                    ? Boolean(next.reactions_enabled_override)
                    : reactionsGlobal;

                return next;
            }));
            toast.success('Post override imesasishwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kusasisha override ya post.');
        } finally {
            setSavingPostInteraction(null);
        }
    }

    async function resolveContentReport(reportId, status, actionTaken = 'none') {
        setResolvingReportId(reportId);
        try {
            await axios.patch(`/merchant/content-reports/${reportId}/resolve/api`, {
                status,
                action_taken: actionTaken,
            });
            setContentReports((current) => current.map((entry) => (
                entry.id === reportId
                    ? { ...entry, status, action_taken: actionTaken, resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null }
                    : entry
            )));
            toast.success('Report imesasishwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kusasisha report.');
        } finally {
            setResolvingReportId(null);
        }
    }

    if (loading) {
        return (
            <AppLayout>
                <Head title="Posts | Takeer" />
                <div className="max-w-6xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Inapakia posts...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Posts | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <Card className="rounded-[24px] border-brand-200/70">
                    <CardHeader>
                        <CardTitle className="text-lg font-black">Posts Summary</CardTitle>
                        <CardDescription>
                            {commerceSummary?.date ? `Daily metrics for ${commerceSummary.date}` : 'Useful performance snapshot for posts.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {sectionSummaryCards.map((item) => (
                            <div key={item.label} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                                <p className="mt-2 text-xl font-black text-foreground">{item.value}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="rounded-[24px]">
                    <CardHeader>
                        <CardTitle className="text-lg font-black">All Posts (Short + Long)</CardTitle>
                        <CardDescription>
                            Simamia posts zako zote hapa.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={postSearch}
                                        onChange={(e) => setPostSearch(e.target.value)}
                                        placeholder="Search posts..."
                                        className="h-11 pl-10 rounded-xl"
                                    />
                                </div>
                                <select
                                    value={postTypeFilter}
                                    onChange={(e) => setPostTypeFilter(e.target.value)}
                                    className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                >
                                    <option value="all">All types</option>
                                    <option value="short">Short Form</option>
                                    <option value="long">Long Form</option>
                                </select>
                            </div>
                            <Button className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl" onClick={() => window.__openComposer?.()}>
                                <Plus className="mr-2 h-4 w-4" />
                                New Post
                            </Button>
                        </div>

                        {filteredPosts.length === 0 ? (
                            <EmptyState icon={MessageCircle} title="Hakuna posts bado" body="Ukichapisha post, utaweza kui-manage hapa." />
                        ) : filteredPosts.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-border/70 px-4 py-4 space-y-3 overflow-hidden">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="h-12 w-12 rounded-xl border border-border/70 bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                                            {isImageLikeUrl(entry.cover_image) ? (
                                                <img src={entry.cover_image} alt={entry.title || entry.caption || 'Post'} className="h-full w-full object-cover" />
                                            ) : (
                                                <BookOpenText className="h-5 w-5 text-brand-600" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black truncate">{entry.title || entry.caption || `Post #${entry.id}`}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${entry.post_type === 'long' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                                                    {entry.post_type === 'long' ? 'Long Form' : 'Short Form'}
                                                </span>
                                                {entry.content_visibility && (
                                                    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        {entry.content_visibility}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                Views {Number(entry.views_count || 0).toLocaleString()} · Likes {Number(entry.likes_count || 0).toLocaleString()} · Comments {Number(entry.comment_count || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1 min-w-0">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Comments Override</label>
                                        <select
                                            className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                                            value={entry.comments_enabled_override === null ? 'inherit' : (entry.comments_enabled_override ? 'on' : 'off')}
                                            onChange={(e) => {
                                                const next = e.target.value === 'inherit' ? null : e.target.value === 'on';
                                                updatePostInteractionOverride(entry.id, 'comments_enabled_override', next);
                                            }}
                                            disabled={savingPostInteraction === `${entry.id}:comments_enabled_override`}
                                        >
                                            <option value="inherit">Inherit ({entry.global_comments_enabled ? 'ON' : 'OFF'})</option>
                                            <option value="on">Force ON</option>
                                            <option value="off">Force OFF</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1 min-w-0">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Reactions Override</label>
                                        <select
                                            className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                                            value={entry.reactions_enabled_override === null ? 'inherit' : (entry.reactions_enabled_override ? 'on' : 'off')}
                                            onChange={(e) => {
                                                const next = e.target.value === 'inherit' ? null : e.target.value === 'on';
                                                updatePostInteractionOverride(entry.id, 'reactions_enabled_override', next);
                                            }}
                                            disabled={savingPostInteraction === `${entry.id}:reactions_enabled_override`}
                                        >
                                            <option value="inherit">Inherit ({entry.global_reactions_enabled ? 'ON' : 'OFF'})</option>
                                            <option value="on">Force ON</option>
                                            <option value="off">Force OFF</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="rounded-[24px] border-amber-200/70">
                    <CardHeader>
                        <CardTitle className="text-lg font-black">Content Reports Queue</CardTitle>
                        <CardDescription>
                            Ripoti za sera kutoka kwa wateja.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {contentReports.length === 0 ? (
                            <EmptyState icon={ShieldCheck} title="Hakuna reports kwa sasa" body="Ripoti mpya zitaonekana hapa." />
                        ) : contentReports.map((report) => (
                            <div key={report.id} className="rounded-2xl border border-border/70 px-4 py-4 space-y-3">
                                <div>
                                    <p className="text-sm font-black">Report #{report.id} · {report.item_type} #{report.item_id}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Reason: {report.reason} · Status: <span className="font-bold uppercase">{report.status}</span></p>
                                </div>

                                {report.notes && (
                                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">{report.notes}</p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" className="rounded-xl" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'under_review', 'none')}>
                                        Under Review
                                    </Button>
                                    <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'warn_content')}>
                                        Resolve + Warn
                                    </Button>
                                    <Button variant="outline" className="rounded-xl" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'dismissed', 'none')}>
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function EmptyState({ icon: Icon, title, body }) {
    return (
        <div className="rounded-3xl border border-dashed border-border px-5 py-10 text-center">
            <div className="mx-auto h-14 w-14 bg-muted flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-black">{title}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-6">{body}</p>
        </div>
    );
}
