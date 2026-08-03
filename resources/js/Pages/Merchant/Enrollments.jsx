import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BookOpenText, CalendarClock, ChevronRight, Loader2, RefreshCw, Search, UserCheck, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function Enrollments({ merchantUsername }) {
    const { copy } = useLocale();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ summary: {}, courses: [] });
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');

    useEffect(() => {
        loadEnrollments();
    }, [merchantUsername]);

    const loadEnrollments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/enrollments/api`);
            setData(res.data || { summary: {}, courses: [] });
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load enrollments.', 'Imeshindikana kupakia usajili.'));
        } finally {
            setLoading(false);
        }
    };

    const filteredCourses = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return (data.courses || [])
            .map((course) => {
                const students = (course.students || []).filter((student) => {
                    const haystack = [
                        course.title,
                        student.name,
                        student.phone_number,
                        student.email,
                        student.cohort?.name,
                    ].filter(Boolean).join(' ').toLowerCase();
                    const statusOk = status === 'all' || student.status === status;
                    return statusOk && (!needle || haystack.includes(needle));
                });

                return { ...course, students };
            })
            .filter((course) => course.students.length > 0 || !needle);
    }, [data.courses, search, status]);

    return (
        <AppLayout>
            <Head title={`${copy('Enrollments', 'Usajili')} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">{copy('Enrollments', 'Usajili')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{copy('Manage students, cohorts, applicants, and learning progress across courses and workshops.', 'Simamia wanafunzi, makundi, waombaji na maendeleo ya kujifunza kwenye kozi na warsha.')}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={loadEnrollments} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {copy('Refresh', 'Onyesha upya')}
                        </Button>
                        <Link href={`/merchant/${merchantUsername}/courses`}>
                            <Button className="rounded-xl bg-brand-600 text-white hover:bg-brand-700">
                                {copy('Courses', 'Kozi')}
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <MetricCard label={copy('Courses', 'Kozi')} value={data.summary?.courses || 0} icon={BookOpenText} />
                    <MetricCard label={copy('Students', 'Wanafunzi')} value={data.summary?.students || 0} icon={Users} />
                    <MetricCard label={copy('Cohorts', 'Makundi')} value={data.summary?.cohorts || 0} icon={UserCheck} />
                    <MetricCard label={copy('Active cohorts', 'Makundi hai')} value={data.summary?.active_cohorts || 0} icon={CalendarClock} />
                </div>

                <Card className="rounded-[24px]">
                    <CardContent className="p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                            <label className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="h-11 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy('Search student, course, phone, email, or cohort', 'Tafuta mwanafunzi, kozi, simu, barua pepe au kundi')} />
                            </label>
                            <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-bold" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="all">{copy('All statuses', 'Hali zote')}</option>
                                <option value="active">{copy('Active', 'Hai')}</option>
                                <option value="completed">{copy('Completed', 'Imekamilika')}</option>
                                <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card className="rounded-[24px]">
                        <CardContent className="py-16 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
                            <p className="mt-3 text-sm text-muted-foreground">{copy('Loading enrollments...', 'Inapakia usajili...')}</p>
                        </CardContent>
                    </Card>
                ) : filteredCourses.length === 0 ? (
                    <Card className="rounded-[24px]">
                        <CardContent className="py-16 text-center">
                            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                            <h3 className="mt-3 text-lg font-black">{copy('No enrollments yet', 'Hakuna usajili bado')}</h3>
                            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{copy('Students will appear here after they purchase a course or join a cohort.', 'Wanafunzi wataonekana hapa baada ya kununua kozi au kujiunga na kundi.')}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {filteredCourses.map((course) => (
                            <Card key={course.id} className="overflow-hidden rounded-[24px]">
                                <CardHeader className="border-b bg-slate-50/70">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-black">{course.title}</CardTitle>
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                {course.student_count} {copy(Number(course.student_count) === 1 ? 'student' : 'students', 'wanafunzi')} · {course.lesson_count} {copy(Number(course.lesson_count) === 1 ? 'lesson' : 'lessons', 'masomo')} · {course.cohort_count} {copy(Number(course.cohort_count) === 1 ? 'cohort' : 'cohorts', 'makundi')}
                                            </p>
                                        </div>
                                        <Link href={`/merchant/${merchantUsername}/bundles/${course.id}/course`}>
                                            <Button variant="outline" className="rounded-xl">
                                                {copy('Course manager', 'Msimamizi wa kozi')} <ChevronRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    {(course.active_cohorts || []).length > 0 && (
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {course.active_cohorts.map((cohort) => (
                                                <div key={cohort.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-black text-indigo-950">{cohort.name || copy('Cohort', 'Kundi')}</p>
                                                            <p className="mt-1 text-xs font-semibold text-indigo-800">{formatDate(cohort.starts_at, copy)} · {copy(cohort.status, cohort.status)}</p>
                                                        </div>
                                                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-indigo-700">
                                                            {cohort.enrolled_count}{cohort.capacity ? `/${cohort.capacity}` : ''} {copy('enrolled', 'wamejiandikisha')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(course.students || []).length === 0 ? (
                                        <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                                            {copy('No matching students for this course.', 'Hakuna wanafunzi wanaolingana na kozi hii.')}
                                        </div>
                                    ) : (
                                        <div className="divide-y rounded-2xl border">
                                            {course.students.map((student) => (
                                                <StudentRow key={`${course.id}-${student.id}`} student={student} copy={copy} />
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function MetricCard({ label, value, icon: Icon }) {
    return (
        <Card className="rounded-[20px]">
            <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-black">{Number(value || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                    <Icon className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
}

function StudentRow({ student, copy }) {
    const totalLessons = Number(student.total_lessons || 0);
    const completedLessons = Number(student.completed_lessons || 0);
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return (
        <div className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-foreground">{student.name || copy('Student', 'Mwanafunzi')}</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">{student.status ? copy(student.status, student.status) : copy('active', 'hai')}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{student.source}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{student.phone_number || copy('No phone', 'Hakuna simu')}{student.email ? ` · ${student.email}` : ''}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {student.cohort?.name ? `${student.cohort.name} · ` : ''}{copy('Enrolled', 'Amejiandikisha')} {formatDate(student.enrolled_at, copy)}
                    </p>
                </div>
                <div className="min-w-[240px]">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                        <span>{copy('Progress', 'Maendeleo')}</span>
                        <span>{completedLessons}/{totalLessons} {copy('lessons', 'masomo')}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatDate(value, copy = (english) => english) {
    if (!value) return copy('No date', 'Hakuna tarehe');
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
        return value;
    }
}
