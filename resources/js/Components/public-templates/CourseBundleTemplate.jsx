import React, { useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    BookOpenText,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    Clock3,
    GraduationCap,
    PlayCircle,
    ShieldCheck,
    Store,
    Users,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';

export default function CourseBundleTemplate({ bundle }) {
    const merchant = bundle?.merchant || {};
    const modules = useMemo(() => {
        if (Array.isArray(bundle?.course_modules) && bundle.course_modules.length > 0) return bundle.course_modules;

        const grouped = [];
        (bundle?.items || []).forEach((item, index) => {
            const title = item.section_title || 'Course lessons';
            let module = grouped.find((entry) => entry.title === title);
            if (!module) {
                module = { title, lessons: [] };
                grouped.push(module);
            }
            module.lessons.push({
                id: `${item.item_type}-${item.item_id}-${index}`,
                title: item.lesson_title || item.title || `Lesson ${index + 1}`,
                summary: item.lesson_summary,
                duration_minutes: item.lesson_duration_minutes,
                unlock_after_days: item.unlock_after_days,
                is_preview: item.is_preview,
                assets: Array.isArray(item.supporting_materials) ? item.supporting_materials : [],
            });
        });

        return grouped;
    }, [bundle?.course_modules, bundle?.items]);
    const cohorts = Array.isArray(bundle?.cohorts) ? bundle.cohorts : [];
    const outcomes = Array.isArray(bundle?.course_outcomes) ? bundle.course_outcomes : [];
    const requirements = Array.isArray(bundle?.course_requirements) ? bundle.course_requirements : [];
    const lessonCount = modules.reduce((total, module) => total + (module.lessons?.length || 0), 0);
    const totalMinutes = modules.reduce((total, module) => (
        total + (module.lessons || []).reduce((sum, lesson) => sum + Number(lesson.duration_minutes || 0), 0)
    ), 0);
    const totalHoursLabel = totalMinutes > 0 ? `${Math.max(1, Math.round(totalMinutes / 60))} hrs` : 'Self paced';
    const formatLabel = {
        self_paced: 'Self-paced course',
        cohort: 'Cohort course',
        live: 'Live course',
    }[bundle?.course_format || 'self_paced'] || 'Course';
    const coverImage = bundle?.course_cover_image_url;
    const checkoutItem = {
        ...bundle,
        checkoutType: 'bundle',
        has_physical_items: false,
        merchant,
    };

    const openCheckout = () => {
        window.__openCheckout?.(checkoutItem);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${bundle.title} | Takeer`} />
            <div className="min-h-screen bg-slate-50 pb-28 text-slate-950">
                <section className="relative overflow-hidden bg-slate-950 text-white">
                    {coverImage ? (
                        <img src={coverImage} alt={bundle.title} className="absolute inset-0 h-full w-full object-cover opacity-70" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#22c55e,#111827_56%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
                    <div className="relative z-10 mx-auto flex min-h-[460px] max-w-6xl flex-col justify-between p-4 md:p-8">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="max-w-4xl">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <GraduationCap className="h-3.5 w-3.5" />
                                    {formatLabel}
                                </span>
                                {cohorts.length > 0 && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                        <Users className="h-3.5 w-3.5" />
                                        {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{bundle.title}</h1>
                            <p className="mt-4 max-w-3xl text-base leading-7 text-white/85">{bundle.description || 'Structured learning program with lessons, materials, and guided progress.'}</p>
                            <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                <span className="inline-flex items-center gap-1.5"><BookOpenText className="h-4 w-4" />{lessonCount || 0} lessons</span>
                                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{totalHoursLabel}</span>
                                {merchant?.display_name && <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4" />{merchant.display_name}</span>}
                            </div>
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-6xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        {outcomes.length > 0 && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">What students will learn</h2>
                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    {outcomes.map((outcome, index) => (
                                        <div key={`${outcome}-${index}`} className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-950">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                                            <span>{outcome}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-black">Curriculum</h2>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{modules.length} module{modules.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="mt-5 space-y-3">
                                {modules.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-semibold text-slate-500">Lessons will appear here.</div>
                                ) : modules.map((module, moduleIndex) => (
                                    <div key={module.id || module.title || moduleIndex} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Module {moduleIndex + 1}</p>
                                        <h3 className="mt-1 font-black">{module.title || `Module ${moduleIndex + 1}`}</h3>
                                        <div className="mt-3 divide-y divide-slate-200">
                                            {(module.lessons || []).map((lesson, lessonIndex) => (
                                                <div key={lesson.id || `${moduleIndex}-${lessonIndex}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500">
                                                        {lesson.is_preview ? <PlayCircle className="h-4 w-4 text-emerald-600" /> : <BookOpenText className="h-4 w-4" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-black">{lesson.title || `Lesson ${lessonIndex + 1}`}</p>
                                                            {lesson.is_preview && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Preview</span>}
                                                        </div>
                                                        {lesson.summary && <p className="mt-1 text-sm leading-6 text-slate-600">{lesson.summary}</p>}
                                                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
                                                            {lesson.duration_minutes && <span>{lesson.duration_minutes} min</span>}
                                                            {Number(lesson.unlock_after_days || 0) > 0 && <span>Unlocks after {lesson.unlock_after_days} day(s)</span>}
                                                            {lesson.live_session?.starts_at && <span>Live {new Date(lesson.live_session.starts_at).toLocaleString()}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {(cohorts.length > 0 || requirements.length > 0) && (
                            <section className="grid gap-4 md:grid-cols-2">
                                {cohorts.length > 0 && (
                                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                        <h2 className="text-lg font-black">Upcoming cohorts</h2>
                                        <div className="mt-4 space-y-3">
                                            {cohorts.map((cohort) => (
                                                <div key={cohort.id || cohort.name} className="rounded-xl bg-indigo-50 p-3 text-indigo-950">
                                                    <p className="font-black">{cohort.name || 'Cohort'}</p>
                                                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-indigo-800">
                                                        {cohort.starts_at && <span>Starts {new Date(cohort.starts_at).toLocaleDateString()}</span>}
                                                        {cohort.capacity && <span>{cohort.capacity} seats</span>}
                                                        {cohort.status && <span>{cohort.status}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {requirements.length > 0 && (
                                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                        <h2 className="text-lg font-black">Requirements</h2>
                                        <div className="mt-4 space-y-2">
                                            {requirements.map((requirement, index) => (
                                                <div key={`${requirement}-${index}`} className="flex gap-2 text-sm font-semibold text-slate-700">
                                                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                                    <span>{requirement}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {merchant?.slug && (
                            <Link href={`/m/${merchant.slug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                                        <Store className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-black">{merchant.display_name || merchant.name || 'Training provider'}</p>
                                        <p className="text-sm text-slate-500">View more courses and offers</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Link>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Enrollment price</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">TZS {Number(bundle?.price || 0).toLocaleString()}</p>
                            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                <MiniStat label="Lessons" value={lessonCount || 0} />
                                <MiniStat label="Modules" value={modules.length || 0} />
                                <MiniStat label="Cohorts" value={cohorts.length || 0} />
                            </div>
                            <Button className="mt-5 h-12 w-full rounded-xl text-base font-black" onClick={openCheckout}>
                                <Zap className="mr-2 h-5 w-5" />
                                Enroll now
                            </Button>
                        </section>

                        <section className="rounded-2xl bg-emerald-50 p-4 text-emerald-950 ring-1 ring-emerald-100">
                            <div className="flex gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Learning access</p>
                                    <p className="mt-1 text-sm text-emerald-900/75">After payment, lessons and course materials are managed from the buyer learning area.</p>
                                </div>
                            </div>
                        </section>
                    </aside>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
                    <div className="mx-auto flex max-w-5xl items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase text-slate-500">Enrollment price</p>
                            <p className="truncate text-lg font-black text-brand-700">TZS {Number(bundle?.price || 0).toLocaleString()}</p>
                        </div>
                        <Button className="h-12 rounded-xl font-black" onClick={openCheckout}>
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Enroll
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-black">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
        </div>
    );
}
