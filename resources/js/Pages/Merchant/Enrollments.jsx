import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BookOpenText, CalendarClock, ChevronRight, Loader2, RefreshCw, Search, UserCheck, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function Enrollments({ merchantUsername }) {
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
            toast.error(error.response?.data?.message || 'Failed to load enrollments.');
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
            <Head title="Enrollments | Takeer" />
            <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Enrollments</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Manage students, cohorts, applicants, and learning progress across courses and workshops.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={loadEnrollments} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                        <Link href={`/merchant/${merchantUsername}/courses`}>
                            <Button className="rounded-xl bg-brand-600 text-white hover:bg-brand-700">
                                Courses
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <MetricCard label="Courses" value={data.summary?.courses || 0} icon={BookOpenText} />
                    <MetricCard label="Students" value={data.summary?.students || 0} icon={Users} />
                    <MetricCard label="Cohorts" value={data.summary?.cohorts || 0} icon={UserCheck} />
                    <MetricCard label="Active Cohorts" value={data.summary?.active_cohorts || 0} icon={CalendarClock} />
                </div>

                <Card className="rounded-[24px]">
                    <CardContent className="p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                            <label className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="h-11 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, course, phone, email, or cohort" />
                            </label>
                            <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-bold" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card className="rounded-[24px]">
                        <CardContent className="py-16 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
                            <p className="mt-3 text-sm text-muted-foreground">Loading enrollments...</p>
                        </CardContent>
                    </Card>
                ) : filteredCourses.length === 0 ? (
                    <Card className="rounded-[24px]">
                        <CardContent className="py-16 text-center">
                            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                            <h3 className="mt-3 text-lg font-black">No enrollments yet</h3>
                            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Students will appear here after they purchase a course or join a cohort.</p>
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
                                                {course.student_count} student{Number(course.student_count) === 1 ? '' : 's'} · {course.lesson_count} lesson{Number(course.lesson_count) === 1 ? '' : 's'} · {course.cohort_count} cohort{Number(course.cohort_count) === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <Link href={`/merchant/${merchantUsername}/bundles/${course.id}/course`}>
                                            <Button variant="outline" className="rounded-xl">
                                                Course Manager <ChevronRight className="ml-2 h-4 w-4" />
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
                                                            <p className="text-sm font-black text-indigo-950">{cohort.name || 'Cohort'}</p>
                                                            <p className="mt-1 text-xs font-semibold text-indigo-800">{formatDate(cohort.starts_at)} · {cohort.status}</p>
                                                        </div>
                                                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-indigo-700">
                                                            {cohort.enrolled_count}{cohort.capacity ? `/${cohort.capacity}` : ''} enrolled
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(course.students || []).length === 0 ? (
                                        <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                                            No matching students for this course.
                                        </div>
                                    ) : (
                                        <div className="divide-y rounded-2xl border">
                                            {course.students.map((student) => (
                                                <StudentRow key={`${course.id}-${student.id}`} student={student} />
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

function StudentRow({ student }) {
    const totalLessons = Number(student.total_lessons || 0);
    const completedLessons = Number(student.completed_lessons || 0);
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return (
        <div className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-foreground">{student.name || 'Student'}</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">{student.status || 'active'}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{student.source}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{student.phone_number || 'No phone'}{student.email ? ` · ${student.email}` : ''}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {student.cohort?.name ? `${student.cohort.name} · ` : ''}Enrolled {formatDate(student.enrolled_at)}
                    </p>
                </div>
                <div className="min-w-[240px]">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                        <span>Progress</span>
                        <span>{completedLessons}/{totalLessons} lessons</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatDate(value) {
    if (!value) return 'No date';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
        return value;
    }
}
