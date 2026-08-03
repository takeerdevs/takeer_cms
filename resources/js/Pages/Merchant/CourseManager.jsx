import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { ArrowLeft, CalendarClock, CheckCircle, Copy, Loader2, RefreshCw, UserCheck, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function CourseManager({ merchantUsername, bundleId }) {
    const { copy } = useLocale();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [busySessionId, setBusySessionId] = useState(null);

    useEffect(() => {
        loadDashboard();
    }, [merchantUsername, bundleId]);

    async function loadDashboard() {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/bundles/${bundleId}/course/api`);
            setData(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load course.', 'Imeshindikana kupakia kozi.'));
        } finally {
            setLoading(false);
        }
    }

    async function generatePin(sessionId) {
        setBusySessionId(sessionId);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/bundles/${bundleId}/course/sessions/${sessionId}/check-in-code`);
            toast.success(`${copy('Check-in PIN', 'PIN ya kuingia')}: ${res.data?.session?.check_in_code}`);
            await loadDashboard();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to generate PIN.', 'Imeshindikana kutengeneza PIN.'));
        } finally {
            setBusySessionId(null);
        }
    }

    async function markAttendance(sessionId, userId, status = 'present') {
        setBusySessionId(sessionId);
        try {
            await axios.post(`/merchant/${merchantUsername}/bundles/${bundleId}/course/sessions/${sessionId}/attendance`, { user_id: userId, status });
            toast.success(copy('Attendance saved.', 'Mahudhurio yamehifadhiwa.'));
            await loadDashboard();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save attendance.', 'Imeshindikana kuhifadhi mahudhurio.'));
        } finally {
            setBusySessionId(null);
        }
    }

    const attendanceBySession = useMemo(() => {
        const map = {};
        (data?.sessions || []).forEach((session) => {
            map[session.id] = new Set((session.attendances || [])
                .filter((attendance) => ['present', 'late'].includes(attendance.status))
                .map((attendance) => attendance.user_id));
        });
        return map;
    }, [data?.sessions]);

    const lessonCount = data?.bundle?.lesson_count || 0;

    return (
        <AppLayout>
            <Head title={`${copy('Course manager', 'Msimamizi wa kozi')} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href={`/merchant/${merchantUsername}/bundles`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                            {copy('Back to bundles', 'Rudi kwenye vifurushi')}
                        </Link>
                        <h1 className="mt-3 text-3xl font-black text-foreground">{data?.bundle?.title || copy('Course manager', 'Msimamizi wa kozi')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{copy('Manage enrolled students, progress, live sessions, and check-in.', 'Simamia wanafunzi waliosajiliwa, maendeleo, vipindi vya moja kwa moja na kuingia.')}</p>
                    </div>
                    <Button variant="outline" className="rounded-xl" onClick={loadDashboard} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {copy('Refresh', 'Onyesha upya')}
                    </Button>
                </div>

                {loading ? (
                    <Card className="rounded-[24px]">
                        <CardContent className="py-16 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-600" />
                            <p className="mt-3 text-sm text-muted-foreground">{copy('Loading course...', 'Inapakia kozi...')}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-4">
                            <MetricCard label={copy('Students', 'Wanafunzi')} value={data?.students?.length || 0} icon={Users} />
                            <MetricCard label={copy('Lessons', 'Masomo')} value={lessonCount} icon={CheckCircle} />
                            <MetricCard label={copy('Cohorts', 'Makundi')} value={data?.cohorts?.length || 0} icon={UserCheck} />
                            <MetricCard label={copy('Live sessions', 'Vipindi vya moja kwa moja')} value={data?.sessions?.length || 0} icon={CalendarClock} />
                        </div>

                        <Card className="rounded-[24px]">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">{copy('Enrolled students', 'Wanafunzi waliosajiliwa')}</CardTitle>
                                <CardDescription>{copy('Students who bought the course or joined a cohort.', 'Wanafunzi walionunua kozi au kujiunga na kundi.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(data?.students || []).length === 0 ? (
                                    <EmptyState title={copy('No students yet', 'Hakuna wanafunzi bado')} body={copy('Students will appear here after purchase or cohort enrollment.', 'Wanafunzi wataonekana hapa baada ya kununua au kusajiliwa kwenye kundi.')} />
                                ) : data.students.map((student) => {
                                    const percent = lessonCount ? Math.round((student.completed_lessons / lessonCount) * 100) : 0;
                                    return (
                                        <div key={student.id} className="rounded-2xl border border-border bg-background px-4 py-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="font-black text-foreground">{student.name || copy('Student', 'Mwanafunzi')}</p>
                                                    <p className="text-sm text-muted-foreground">{student.phone_number || copy('No phone', 'Hakuna simu')} {student.email ? `· ${student.email}` : ''}</p>
                                                    {student.cohort && (
                                                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-700">{student.cohort.name || copy('Cohort', 'Kundi')} · {formatDate(student.cohort.enrolled_at)}</p>
                                                    )}
                                                </div>
                                                <div className="min-w-[220px]">
                                                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                                                        <span>{copy('Progress', 'Maendeleo')}</span>
                                                        <span>{student.completed_lessons}/{lessonCount} {copy('lessons', 'masomo')}</span>
                                                    </div>
                                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[24px]">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">{copy('Live sessions & check-in', 'Vipindi vya moja kwa moja na kuingia')}</CardTitle>
                                <CardDescription>{copy('Generate a PIN during class or mark attendance manually.', 'Tengeneza PIN wakati wa darasa au weka mahudhurio kwa mkono.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(data?.sessions || []).length === 0 ? (
                                    <EmptyState title={copy('No live sessions', 'Hakuna vipindi vya moja kwa moja')} body={copy('Live class lessons will appear here after you add them in the curriculum.', 'Masomo ya darasa la moja kwa moja yataonekana hapa baada ya kuyaongeza kwenye mtaala.')} />
                                ) : data.sessions.map((session) => {
                                    const checkedIn = attendanceBySession[session.id] || new Set();
                                    return (
                                        <div key={session.id} className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4 space-y-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-amber-700">{copy('Live class', 'Darasa la moja kwa moja')}</p>
                                                    <h3 className="mt-1 text-lg font-black text-foreground">{session.lesson_title}</h3>
                                                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(session.starts_at)} {session.duration_minutes ? `· ${session.duration_minutes} ${copy('min', 'dak')}` : ''}</p>
                                                    {(session.venue || session.meeting_url) && (
                                                        <p className="mt-1 text-sm text-muted-foreground">{session.venue || session.meeting_url}</p>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {session.check_in_code && (
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800"
                                                            onClick={() => {
                                                                navigator.clipboard?.writeText(session.check_in_code);
                                                                toast.success(copy('PIN copied.', 'PIN imenakiliwa.'));
                                                            }}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                            PIN {session.check_in_code}
                                                        </button>
                                                    )}
                                                    <Button className="rounded-xl bg-amber-500 text-white hover:bg-amber-600" onClick={() => generatePin(session.id)} disabled={busySessionId === session.id}>
                                                        {busySessionId === session.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                                            {copy('Generate PIN', 'Tengeneza PIN')}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl bg-white p-3">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{copy('Attendance', 'Mahudhurio')}</p>
                                                    <span className="text-xs font-black text-foreground">{checkedIn.size}/{data.students.length} {copy('checked in', 'wameingia')}</span>
                                                </div>
                                                <div className="grid gap-2">
                                                    {(data?.students || []).map((student) => {
                                                        const present = checkedIn.has(student.id);
                                                        return (
                                                            <div key={`${session.id}-${student.id}`} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                    <p className="text-sm font-black">{student.name || copy('Student', 'Mwanafunzi')}</p>
                                                                    <p className="text-xs text-muted-foreground">{present ? copy('Checked in', 'Ameingia') : copy('Not checked in', 'Hajaingia')}</p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Button variant={present ? 'outline' : 'default'} className="rounded-xl" onClick={() => markAttendance(session.id, student.id, 'present')} disabled={busySessionId === session.id}>
                                                                        {copy('Present', 'Yupo')}
                                                                    </Button>
                                                                    <Button variant="outline" className="rounded-xl" onClick={() => markAttendance(session.id, student.id, 'absent')} disabled={busySessionId === session.id}>
                                                                        {copy('Absent', 'Hayupo')}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function MetricCard({ label, value, icon: Icon }) {
    return (
        <Card className="rounded-[20px]">
            <CardContent className="flex items-center justify-between gap-3 p-5">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-black">{value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                    <Icon className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyState({ title, body }) {
    return (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
            <p className="font-black text-foreground">{title}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
    );
}

function formatDate(value) {
    if (!value) return 'No date set';
    return new Date(value).toLocaleString();
}
