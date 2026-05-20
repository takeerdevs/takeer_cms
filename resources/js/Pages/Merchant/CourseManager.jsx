import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { ArrowLeft, CalendarClock, CheckCircle, Copy, Loader2, RefreshCw, UserCheck, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function CourseManager({ merchantUsername, bundleId }) {
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
            toast.error(error.response?.data?.message || 'Imeshindwa kupakia course.');
        } finally {
            setLoading(false);
        }
    }

    async function generatePin(sessionId) {
        setBusySessionId(sessionId);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/bundles/${bundleId}/course/sessions/${sessionId}/check-in-code`);
            toast.success(`PIN ya check-in: ${res.data?.session?.check_in_code}`);
            await loadDashboard();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kutengeneza PIN.');
        } finally {
            setBusySessionId(null);
        }
    }

    async function markAttendance(sessionId, userId, status = 'present') {
        setBusySessionId(sessionId);
        try {
            await axios.post(`/merchant/${merchantUsername}/bundles/${bundleId}/course/sessions/${sessionId}/attendance`, { user_id: userId, status });
            toast.success('Attendance imehifadhiwa.');
            await loadDashboard();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi attendance.');
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
            <Head title="Course Manager | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href={`/merchant/${merchantUsername}/bundles`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                            Back to bundles
                        </Link>
                        <h1 className="mt-3 text-3xl font-black text-foreground">{data?.bundle?.title || 'Course Manager'}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Manage enrolled students, progress, live sessions, and check-in.</p>
                    </div>
                    <Button variant="outline" className="rounded-xl" onClick={loadDashboard} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <Card className="rounded-[24px]">
                        <CardContent className="py-16 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-600" />
                            <p className="mt-3 text-sm text-muted-foreground">Inapakia course...</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-4">
                            <MetricCard label="Students" value={data?.students?.length || 0} icon={Users} />
                            <MetricCard label="Lessons" value={lessonCount} icon={CheckCircle} />
                            <MetricCard label="Cohorts" value={data?.cohorts?.length || 0} icon={UserCheck} />
                            <MetricCard label="Live sessions" value={data?.sessions?.length || 0} icon={CalendarClock} />
                        </div>

                        <Card className="rounded-[24px]">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">Enrolled Students</CardTitle>
                                <CardDescription>Students who bought the course or joined a cohort.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(data?.students || []).length === 0 ? (
                                    <EmptyState title="No students yet" body="Students will appear here after purchase or cohort enrollment." />
                                ) : data.students.map((student) => {
                                    const percent = lessonCount ? Math.round((student.completed_lessons / lessonCount) * 100) : 0;
                                    return (
                                        <div key={student.id} className="rounded-2xl border border-border bg-background px-4 py-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="font-black text-foreground">{student.name || 'Student'}</p>
                                                    <p className="text-sm text-muted-foreground">{student.phone_number || 'No phone'} {student.email ? `· ${student.email}` : ''}</p>
                                                    {student.cohort && (
                                                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-700">{student.cohort.name || 'Cohort'} · {formatDate(student.cohort.enrolled_at)}</p>
                                                    )}
                                                </div>
                                                <div className="min-w-[220px]">
                                                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                                                        <span>Progress</span>
                                                        <span>{student.completed_lessons}/{lessonCount} lessons</span>
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
                                <CardTitle className="text-lg font-black">Live Sessions & Check-In</CardTitle>
                                <CardDescription>Generate a PIN during class or mark attendance manually.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(data?.sessions || []).length === 0 ? (
                                    <EmptyState title="No live sessions" body="Live class lessons will appear here after you add them in the curriculum." />
                                ) : data.sessions.map((session) => {
                                    const checkedIn = attendanceBySession[session.id] || new Set();
                                    return (
                                        <div key={session.id} className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4 space-y-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-amber-700">Live Class</p>
                                                    <h3 className="mt-1 text-lg font-black text-foreground">{session.lesson_title}</h3>
                                                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(session.starts_at)} {session.duration_minutes ? `· ${session.duration_minutes} min` : ''}</p>
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
                                                                toast.success('PIN copied.');
                                                            }}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                            PIN {session.check_in_code}
                                                        </button>
                                                    )}
                                                    <Button className="rounded-xl bg-amber-500 text-white hover:bg-amber-600" onClick={() => generatePin(session.id)} disabled={busySessionId === session.id}>
                                                        {busySessionId === session.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                                        Generate PIN
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl bg-white p-3">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Attendance</p>
                                                    <span className="text-xs font-black text-foreground">{checkedIn.size}/{data.students.length} checked in</span>
                                                </div>
                                                <div className="grid gap-2">
                                                    {(data?.students || []).map((student) => {
                                                        const present = checkedIn.has(student.id);
                                                        return (
                                                            <div key={`${session.id}-${student.id}`} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                    <p className="text-sm font-black">{student.name || 'Student'}</p>
                                                                    <p className="text-xs text-muted-foreground">{present ? 'Checked in' : 'Not checked in'}</p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Button variant={present ? 'outline' : 'default'} className="rounded-xl" onClick={() => markAttendance(session.id, student.id, 'present')} disabled={busySessionId === session.id}>
                                                                        Present
                                                                    </Button>
                                                                    <Button variant="outline" className="rounded-xl" onClick={() => markAttendance(session.id, student.id, 'absent')} disabled={busySessionId === session.id}>
                                                                        Absent
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
