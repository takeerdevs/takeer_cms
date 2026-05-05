import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    Play, Lock, FileText, ChevronRight, ChevronDown,
    ArrowLeft, CheckCircle2, Layout, Info, Globe,
    ChevronLeft, Menu, X, PlayCircle, ExternalLink,
    CheckCircle, Circle, Loader2, Download, Headphones, BookOpenText
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import EditorJsRenderer from '@/Components/EditorJsRenderer';
import { toast } from 'sonner';
import axios from 'axios';

export default function CoursePlayer({ product, course, hasFullAccess }) {
    const [activeLesson, setActiveLesson] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [expandedModules, setExpandedModules] = useState({});
    const [localCurriculum, setLocalCurriculum] = useState(course.curriculum);
    const [isToggling, setIsToggling] = useState(false);
    const [checkInCode, setCheckInCode] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);

    useEffect(() => {
        const nextCurriculum = Array.isArray(course?.curriculum) ? course.curriculum : [];
        setLocalCurriculum(nextCurriculum);

        const lessons = nextCurriculum.flatMap((module) => module.lessons || []);
        setActiveLesson((current) => {
            if (current && lessons.some((lesson) => lesson.id === current.id)) {
                return lessons.find((lesson) => lesson.id === current.id) || current;
            }

            return lessons.find((lesson) => !lesson.is_locked) || lessons[0] || null;
        });

        if (nextCurriculum[0]?.id) {
            setExpandedModules((current) => ({ ...current, [nextCurriculum[0].id]: true }));
        }
    }, [course?.id, course?.curriculum]);

    // Auto-select first available lesson
    useEffect(() => {
        if (localCurriculum.length > 0) {
            const firstModule = localCurriculum[0];
            if (firstModule.lessons.length > 0) {
                const firstAvailable = firstModule.lessons.find(l => !l.is_locked) || firstModule.lessons[0];
                setActiveLesson(firstAvailable);
            }

            // Expand first module
            setExpandedModules({ [firstModule.id]: true });
        }
    }, []);

    useEffect(() => {
        const syncSidebarForViewport = () => {
            setIsSidebarOpen(window.innerWidth >= 1024);
        };

        syncSidebarForViewport();
        window.addEventListener('resize', syncSidebarForViewport);

        return () => window.removeEventListener('resize', syncSidebarForViewport);
    }, []);

    useEffect(() => {
        const loadPrimaryAsset = async () => {
            if (!activeLesson?.primary_asset || activeLesson.is_locked || activeLesson.content_url || activeLesson.primary_asset.asset_type !== 'file') {
                return;
            }

            try {
                const res = await axios.post(`/api/bundle-lesson-assets/${activeLesson.primary_asset.id}/access-link`);
                if (res.data?.url) {
                    setActiveLesson((current) => current?.id === activeLesson.id ? { ...current, content_url: res.data.url } : current);
                }
            } catch (error) {
                // Keep the explicit open button available if inline loading fails.
            }
        };

        loadPrimaryAsset();
    }, [activeLesson?.id]);

    const toggleModule = (id) => {
        setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const selectLesson = (lesson) => {
        if (lesson.is_locked) return;
        setActiveLesson(lesson);
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    const toggleLessonCompletion = async (lessonId) => {
        if (isToggling) return;
        setIsToggling(true);
        try {
            const res = await axios.post(`/learn/bundle-lessons/${lessonId}/complete`);
            const isCompleted = res.data.completed;

            setLocalCurriculum(prev => prev.map(m => ({
                ...m,
                lessons: m.lessons.map(l => l.id === lessonId ? { ...l, is_completed: isCompleted } : l)
            })));

            if (activeLesson?.id === lessonId) {
                setActiveLesson(prev => ({ ...prev, is_completed: isCompleted }));
            }

            if (isCompleted) {
                toast.success('Hongera! Somo limekamilika.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kuhifadhi hatua.');
        } finally {
            setIsToggling(false);
        }
    };

    const submitLiveCheckIn = async () => {
        if (!activeLesson?.live_session?.id || checkingIn) return;
        if (!checkInCode.trim()) {
            toast.error('Weka PIN ya check-in.');
            return;
        }

        setCheckingIn(true);
        try {
            await axios.post(`/learn/bundle-live-sessions/${activeLesson.live_session.id}/check-in`, { code: checkInCode.trim() });
            toast.success('Umefanikiwa kufanya check-in.');
            setCheckInCode('');

            setLocalCurriculum(prev => prev.map(module => ({
                ...module,
                lessons: module.lessons.map(lesson => lesson.id === activeLesson.id
                    ? { ...lesson, live_session: { ...lesson.live_session, checked_in: true } }
                    : lesson
                ),
            })));
            setActiveLesson(prev => ({ ...prev, live_session: { ...prev.live_session, checked_in: true } }));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Check-in imeshindikana.');
        } finally {
            setCheckingIn(false);
        }
    };

    // Calculate progress
    const allLessons = localCurriculum.flatMap(m => m.lessons);
    const totalLessons = allLessons.length;
    const completedLessonsCount = allLessons.filter(l => l.is_completed).length;
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;
    const primaryAsset = activeLesson?.primary_asset || null;
    const activeContentItem = primaryAsset?.asset_type === 'content_item'
        && primaryAsset?.content_item
        && !primaryAsset?.mime
        ? primaryAsset.content_item
        : primaryAsset?.asset_type === 'post' && primaryAsset?.post
            ? primaryAsset.post
            : null;
    const primaryMime = String(primaryAsset?.mime || '').toLowerCase();
    const isPrimaryVideo = primaryMime.startsWith('video/');
    const isPrimaryAudio = primaryMime.startsWith('audio/');
    const hasPrimaryResource = Boolean(primaryAsset?.id || primaryAsset?.asset_id || primaryAsset?.url || primaryAsset?.content_item || primaryAsset?.post);
    const isPrimaryDownload = hasPrimaryResource && !activeContentItem && !isPrimaryVideo && !isPrimaryAudio && !activeLesson?.live_session;
    const shouldShowPrimarySurface = Boolean(activeLesson?.is_locked || activeLesson?.live_session || isPrimaryVideo || isPrimaryAudio || isPrimaryDownload);
    const lessonPosition = activeLesson ? allLessons.findIndex(l => l.id === activeLesson.id) + 1 : 0;
    const lessonTypeLabel = activeContentItem
        ? 'Reading'
        : isPrimaryVideo
            ? 'Video'
            : isPrimaryAudio
                ? 'Audio'
                : activeLesson?.live_session
                    ? 'Live Session'
                    : 'Resource';

    const openLessonAsset = async (asset) => {
        if (!asset) return;

        if (asset.asset_type && asset.asset_type !== 'file') {
            if (asset.asset_type === 'content_item') {
                window.open(`/content/${asset.asset_id}`, '_blank', 'noopener,noreferrer');
                return;
            }
            if (asset.asset_type === 'post') {
                window.open(asset.post?.public_id ? `/p/${asset.post.public_id}` : `/p/${asset.asset_id}`, '_blank', 'noopener,noreferrer');
                return;
            }
            if (asset.asset_type === 'product') {
                window.open(`/product/${asset.asset_id}`, '_blank', 'noopener,noreferrer');
                return;
            }
        }

        try {
            const res = await axios.post(`/api/bundle-lesson-assets/${asset.id}/access-link`);
            if (res.data?.url) {
                window.open(res.data.url, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kufungua faili la somo.');
        }
    };

    const bodyLooksLikeEditorJs = (body) => {
        if (typeof body === 'object' && body !== null && Array.isArray(body.blocks)) return true;
        if (typeof body !== 'string') return false;
        try {
            const parsed = JSON.parse(body);
            return Array.isArray(parsed?.blocks);
        } catch {
            return false;
        }
    };

    const sanitizeHtml = (html) => {
        if (typeof window === 'undefined') return String(html || '');
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
        const root = doc.body.firstElementChild;
        if (!root) return '';

        root.querySelectorAll('script,style,iframe,object,embed,form').forEach((node) => node.remove());
        root.querySelectorAll('*').forEach((el) => {
            [...el.attributes].forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = (attr.value || '').toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return root.innerHTML;
    };

    const renderContentBody = (contentItem) => {
        if (!contentItem?.body) {
            return (
                <p className="text-base leading-8 text-muted-foreground">
                    {contentItem?.excerpt || 'Content hii haina maelezo ya ziada bado.'}
                </p>
            );
        }

        if (contentItem.format === 'editorjs' || bodyLooksLikeEditorJs(contentItem.body)) {
            return <EditorJsRenderer data={contentItem.body} />;
        }

        if (contentItem.format === 'html' || String(contentItem.body).trim().startsWith('<')) {
            return <div className="prose prose-sm max-w-none leading-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentItem.body) }} />;
        }

        return <div className="whitespace-pre-wrap text-base leading-8 text-slate-700">{contentItem.body}</div>;
    };

    const resolvedReading = (contentItem) => {
        const linkedPost = contentItem?.linked_post || {};
        const directPostMedia = Array.isArray(contentItem?.media) ? contentItem.media : [];

        return {
            title: linkedPost.title || contentItem?.title || activeLesson?.title || 'Course reading',
            excerpt: linkedPost.excerpt || contentItem?.excerpt || '',
            body: linkedPost.body || contentItem?.body || '',
            format: linkedPost.body || primaryAsset?.asset_type === 'post' ? 'post' : contentItem?.format,
            media: Array.isArray(linkedPost.media) && linkedPost.media.length > 0 ? linkedPost.media : directPostMedia,
        };
    };

    const displayContentTitle = (contentItem) => {
        const rawTitle = String(resolvedReading(contentItem).title || '').trim();
        if (!rawTitle || rawTitle === '__short_locked__') return activeLesson?.title || 'Course reading';
        return rawTitle;
    };

    const renderLessonHeader = () => (
        <div className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-700">
                            {activeContentItem ? <BookOpenText className="h-3.5 w-3.5" /> : isPrimaryAudio ? <Headphones className="h-3.5 w-3.5" /> : <Layout className="h-3.5 w-3.5" />}
                            {lessonTypeLabel}
                        </span>
                        <span className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Lesson {lessonPosition} of {totalLessons}
                        </span>
                        {activeLesson.is_preview && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                Free Preview
                            </span>
                        )}
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                        {activeContentItem ? displayContentTitle(activeContentItem) : activeLesson.title}
                    </h2>
                    {activeLesson.body && !activeContentItem && (
                        <p className="max-w-3xl text-base leading-7 text-muted-foreground">{activeLesson.body}</p>
                    )}
                </div>

                {!activeLesson.is_locked && (
                    <Button
                        onClick={() => toggleLessonCompletion(activeLesson.id)}
                        disabled={isToggling}
                        className={`h-12 shrink-0 rounded-2xl px-6 text-xs font-black uppercase tracking-widest transition-all ${activeLesson.is_completed
                            ? 'border border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100'
                            : 'bg-sky-600 text-white shadow-lg hover:bg-sky-700'
                            }`}
                    >
                        {isToggling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : activeLesson.is_completed ? (
                            <><CheckCircle className="mr-2 h-4 w-4" /> Completed</>
                        ) : activeContentItem ? (
                            <><Circle className="mr-2 h-4 w-4" /> Mark as Read</>
                        ) : (
                            <><Circle className="mr-2 h-4 w-4" /> Mark as Complete</>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );

    const renderSupportingAssets = () => {
        const assets = Array.isArray(activeLesson?.supporting_assets) ? activeLesson.supporting_assets : [];
        if (assets.length === 0) return null;

        return (
            <div className="rounded-3xl border border-border bg-card p-5 md:p-6">
                <div className="flex flex-col gap-1">
                    <h4 className="font-black">Supporting Materials</h4>
                    <p className="text-sm text-muted-foreground">Open extra files, worksheets, references, or examples attached to this lesson.</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {assets.map((asset) => (
                        <button
                            key={asset.id}
                            type="button"
                            onClick={() => openLessonAsset(asset)}
                            className="group flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-left hover:border-sky-200 hover:bg-sky-50"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-sky-950">{asset.name || 'Material'}</p>
                                <p className="mt-1 text-xs text-sky-800/70">{asset.mime || asset.asset_type || 'resource'}{asset.size ? ` · ${(Number(asset.size) / 1024 / 1024).toFixed(1)} MB` : ''}</p>
                            </div>
                            <ExternalLink className="h-4 w-4 shrink-0 text-sky-700 transition-transform group-hover:translate-x-0.5" />
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderReadingLesson = () => (
        (() => {
            const reading = resolvedReading(activeContentItem);

            return <>
            {renderLessonHeader()}
            <article className="rounded-3xl border border-border bg-white p-5 shadow-sm md:p-8">
                {reading.media.length > 0 && (
                    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-muted">
                        {reading.media[0].media_type === 'video' ? (
                            <video src={reading.media[0].media_url} controls className="max-h-[520px] w-full bg-black object-contain" />
                        ) : (
                            <img src={reading.media[0].media_url} alt="" className="max-h-[520px] w-full object-cover" />
                        )}
                    </div>
                )}
                {reading.excerpt && (
                    <p className="mb-6 border-b border-border pb-5 text-lg leading-8 text-muted-foreground">{reading.excerpt}</p>
                )}
                <div className="max-w-none">
                    {renderContentBody(reading)}
                </div>
            </article>
            {renderSupportingAssets()}
        </>;
        })()
    );

    const renderPrimaryAssetSurface = () => (
        <div className={`${activeLesson.live_session && !activeLesson.content_url ? 'min-h-[260px]' : 'aspect-video'} overflow-hidden rounded-3xl border border-border bg-slate-950 shadow-sm`}>
            {activeLesson.is_locked ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center bg-white/90 p-6 text-center backdrop-blur-xl">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50">
                        <Lock className="h-8 w-8 text-sky-600" />
                    </div>
                    <h3 className="mb-2 text-2xl font-black text-foreground">Somo Limerekodiwa (Locked)</h3>
                    <p className="mb-8 max-w-sm font-medium text-muted-foreground">
                        Nunua kozi hii kamili ili upate ufikiaji wa masomo yote na ujifunze kwa undani zaidi.
                    </p>
                    <Button className="h-12 rounded-2xl bg-sky-600 px-10 font-black text-white shadow-xl hover:bg-sky-700">
                        UNLOCK FULL COURSE
                    </Button>
                </div>
            ) : isPrimaryVideo && activeLesson.content_url ? (
                <video key={activeLesson.id} src={activeLesson.content_url} controls className="h-full w-full object-contain" poster={product.image_url} />
            ) : isPrimaryAudio && activeLesson.content_url ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center bg-sky-950 p-8 text-center text-white">
                    <Headphones className="mb-5 h-16 w-16 text-sky-200" />
                    <h3 className="text-2xl font-black">{activeLesson.title}</h3>
                    <audio key={activeLesson.id} src={activeLesson.content_url} controls className="mt-6 w-full max-w-2xl" />
                </div>
            ) : activeLesson.live_session ? (
                <div className="flex min-h-[260px] flex-col justify-center bg-amber-50 p-6 md:p-8">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-700">Live Session</p>
                    <h3 className="mt-3 text-2xl font-black text-amber-950 md:text-3xl">{activeLesson.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-amber-900/80 md:text-base">
                        {activeLesson.live_session.starts_at ? new Date(activeLesson.live_session.starts_at).toLocaleString() : 'Muda bado haujawekwa'}
                        {activeLesson.live_session.duration_minutes ? ` · ${activeLesson.live_session.duration_minutes} min` : ''}
                    </p>
                    {activeLesson.live_session.venue && <p className="mt-1 text-sm text-amber-900/80">Mahali: {activeLesson.live_session.venue}</p>}
                    <div className="mt-5 flex flex-wrap gap-3">
                        {activeLesson.live_session.meeting_url && (
                            <button type="button" onClick={() => window.open(activeLesson.live_session.meeting_url, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm">
                                <ExternalLink className="h-4 w-4" />
                                Join Live Class
                            </button>
                        )}
                        {primaryAsset && (
                            <button type="button" onClick={() => openLessonAsset(primaryAsset)} className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-5 py-3 text-sm font-black text-amber-900">
                                <FileText className="h-4 w-4" />
                                Open Class Material
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center bg-white p-8 text-center">
                    <Download className="mb-5 h-16 w-16 text-sky-600" />
                    <h3 className="text-2xl font-black text-foreground">{primaryAsset?.name || activeLesson.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        Download or open this lesson resource, then mark the lesson complete when finished.
                    </p>
                    <button type="button" onClick={() => openLessonAsset(primaryAsset)} disabled={!primaryAsset} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-6 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">
                        <ExternalLink className="h-4 w-4" />
                        Open Resource
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-sky-500/20">
            <Head title={`${product.title} - Course Player`} />

            {/* Header */}
            <header className="h-16 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href={`/${product.merchant.username}`} className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="font-black text-sm lg:text-base line-clamp-1">{product.title}</h1>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{product.merchant.display_name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!hasFullAccess && (
                        <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-9 text-xs rounded-lg shadow-lg">
                            Buy Full Course
                        </Button>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="lg:hidden h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center"
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
                {isSidebarOpen && (
                    <button
                        type="button"
                        aria-label="Close curriculum"
                        className="fixed inset-x-0 top-16 bottom-0 z-30 bg-black/25 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar (Curriculum) */}
                <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-16 bottom-0 z-40 w-[min(88vw,22rem)] bg-card border-r border-border shadow-2xl transition-transform duration-300 overflow-y-auto lg:static lg:top-auto lg:bottom-auto lg:translate-x-0 lg:w-80 lg:shadow-none lg:flex lg:shrink-0`}>
                    <div className="p-4 space-y-6 w-full">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Course Curriculum</h2>
                                {isSidebarOpen && <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden"><X className="h-4 w-4" /></button>}
                            </div>

                            {/* Progress Bar */}
                            <div className="bg-sky-50/70 rounded-2xl p-3 border border-sky-100">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span className="text-sky-700">{progressPercentage}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-sky-600 transition-all duration-1000 ease-out"
                                        style={{ width: `${progressPercentage}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-muted-foreground font-bold mt-2 uppercase tracking-tighter">
                                    {completedLessonsCount} of {totalLessons} lessons completed
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 pb-8">
                            {localCurriculum.map((module, mIdx) => (
                                <div key={module.id} className="space-y-1">
                                    <button
                                        onClick={() => toggleModule(module.id)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors group"
                                    >
                                        <div className="h-6 w-6 rounded-lg bg-sky-50 flex items-center justify-center text-sky-700 font-black text-[10px]">
                                            {mIdx + 1}
                                        </div>
                                        <span className="flex-1 text-left text-sm font-bold transition-colors">{module.title}</span>
                                        {expandedModules[module.id] ? <ChevronDown className="h-4 w-4 opacity-40" /> : <ChevronRight className="h-4 w-4 opacity-40" />}
                                    </button>

                                    {expandedModules[module.id] && (
                                        <div className="ml-9 space-y-1 py-1">
                                            {module.lessons.map((lesson) => (
                                                <button
                                                    key={lesson.id}
                                                    onClick={() => selectLesson(lesson)}
                                                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-xs transition-all group ${activeLesson?.id === lesson.id
                                                        ? 'bg-sky-50 text-sky-800 font-bold'
                                                        : lesson.is_locked
                                                            ? 'opacity-40 cursor-not-allowed'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    <div className="shrink-0">
                                                        {lesson.is_locked ? (
                                                            <Lock className="h-3.5 w-3.5" />
                                                        ) : lesson.is_completed ? (
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" />
                                                        ) : (
                                                            <PlayCircle className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                                                        )}
                                                    </div>
                                                    <span className="flex-1 text-left line-clamp-1">{lesson.title}</span>
                                                    {lesson.is_preview && !hasFullAccess && (
                                                        <span className="text-[8px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full font-black uppercase">Free</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Main Player Area */}
                <main className="flex-1 bg-muted/20 overflow-y-auto relative">
                    {activeLesson ? (
                        <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-8">
                            {activeContentItem ? (
                                renderReadingLesson()
                            ) : (
                                <>
                                    {shouldShowPrimarySurface && renderPrimaryAssetSurface()}
                                    {renderLessonHeader()}

                                    {activeLesson.live_session?.check_in_enabled && (
                                        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 space-y-2">
                                            <h4 className="font-black text-amber-900">Class Check-In</h4>
                                            <div className="rounded-2xl border border-amber-200 bg-white p-3">
                                                {activeLesson.live_session.checked_in ? (
                                                    <p className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
                                                        <CheckCircle className="h-4 w-4" />
                                                        Umefanya check-in kwa session hii.
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col gap-2 sm:flex-row">
                                                        <input
                                                            className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground"
                                                            value={checkInCode}
                                                            onChange={(event) => setCheckInCode(event.target.value)}
                                                            placeholder="Weka PIN ya check-in"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={submitLiveCheckIn}
                                                            disabled={checkingIn}
                                                            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-70"
                                                        >
                                                            {checkingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                            Check In
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {renderSupportingAssets()}

                                    {!activeLesson.body && !primaryAsset && !activeLesson.live_session && (
                                        <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-3">
                                            <h4 className="font-bold">Maelezo ya ziada</h4>
                                            <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                                                Chagua lesson content au supporting material kwenye course builder ili somo hili liwe na maudhui ya kufungua.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center p-12 text-center">
                            <div className="space-y-4 max-w-sm">
                                <div className="h-20 w-20 bg-sky-50 rounded-[40px] flex items-center justify-center mx-auto mb-8 animate-pulse">
                                    <Layout className="h-10 w-10 text-sky-600" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">Tayarisha Somo lako...</h3>
                                <p className="text-sm text-muted-foreground">Chagua somo kutoka kwenye curriculum ili uanze kujifunza.</p>
                            </div>
                        </div>
                    )}
                </main>

            </div>
        </div>
    );
}
