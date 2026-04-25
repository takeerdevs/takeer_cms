import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { 
    Play, Lock, FileText, ChevronRight, ChevronDown, 
    ArrowLeft, CheckCircle2, Layout, Info, Globe,
    ChevronLeft, Menu, X, PlayCircle, ExternalLink,
    CheckCircle, Circle, Loader2
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { toast } from 'sonner';
import axios from 'axios';

export default function CoursePlayer({ product, course, hasFullAccess }) {
    const [activeLesson, setActiveLesson] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [expandedModules, setExpandedModules] = useState({});
    const [localCurriculum, setLocalCurriculum] = useState(course.curriculum);
    const [isToggling, setIsToggling] = useState(false);

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

    const toggleModule = (id) => {
        setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleLessonCompletion = async (lessonId) => {
        if (isToggling) return;
        setIsToggling(true);
        try {
            const res = await axios.post(`/course/lesson/${lessonId}/complete`);
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

    // Calculate progress
    const allLessons = localCurriculum.flatMap(m => m.lessons);
    const totalLessons = allLessons.length;
    const completedLessonsCount = allLessons.filter(l => l.is_completed).length;
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
            <Head title={`${product.title} - Course Player`} />

            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href={`/${product.merchant.username}`} className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="font-black text-sm lg:text-base line-clamp-1">{product.title}</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{product.merchant.display_name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!hasFullAccess && (
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs rounded-lg shadow-lg shadow-indigo-500/20">
                            Buy Full Course
                        </Button>
                    )}
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="lg:hidden h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center"
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
                
                {/* Sidebar (Curriculum) */}
                <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0'} fixed lg:relative z-40 inset-0 lg:inset-auto lg:flex bg-slate-900 border-r border-white/5 w-80 shrink-0 transition-all duration-300 overflow-y-auto`}>
                    <div className="p-4 space-y-6 w-full">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="font-black text-xs uppercase tracking-widest text-slate-500">Course Curriculum</h2>
                                {isSidebarOpen && <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden"><X className="h-4 w-4" /></button>}
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                    <span className="text-slate-400">Progress</span>
                                    <span className="text-indigo-400">{progressPercentage}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out" 
                                        style={{ width: `${progressPercentage}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-tighter">
                                    {completedLessonsCount} of {totalLessons} lessons completed
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 pb-8">
                            {localCurriculum.map((module, mIdx) => (
                                <div key={module.id} className="space-y-1">
                                    <button 
                                        onClick={() => toggleModule(module.id)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="h-6 w-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-[10px]">
                                            {mIdx + 1}
                                        </div>
                                        <span className="flex-1 text-left text-sm font-bold group-hover:text-white transition-colors">{module.title}</span>
                                        {expandedModules[module.id] ? <ChevronDown className="h-4 w-4 opacity-40" /> : <ChevronRight className="h-4 w-4 opacity-40" />}
                                    </button>

                                    {expandedModules[module.id] && (
                                        <div className="ml-9 space-y-1 py-1">
                                            {module.lessons.map((lesson) => (
                                                <button
                                                    key={lesson.id}
                                                    onClick={() => !lesson.is_locked && setActiveLesson(lesson)}
                                                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-xs transition-all group ${
                                                        activeLesson?.id === lesson.id 
                                                            ? 'bg-indigo-500/20 text-indigo-300 font-bold' 
                                                            : lesson.is_locked 
                                                                ? 'opacity-40 cursor-not-allowed' 
                                                                : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                                >
                                                    <div className="shrink-0">
                                                        {lesson.is_locked ? (
                                                            <Lock className="h-3.5 w-3.5" />
                                                        ) : lesson.is_completed ? (
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                                                        ) : (
                                                            <PlayCircle className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                                                        )}
                                                    </div>
                                                    <span className="flex-1 text-left line-clamp-1">{lesson.title}</span>
                                                    {lesson.is_preview && !hasFullAccess && (
                                                        <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-black uppercase">Free</span>
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
                <main className="flex-1 bg-slate-950 overflow-y-auto relative">
                    {activeLesson ? (
                        <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-8">
                            
                            {/* Player Wrapper */}
                            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 relative group">
                                {activeLesson.is_locked ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl z-10 p-6 text-center">
                                        <div className="h-16 w-16 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                                            <Lock className="h-8 w-8 text-indigo-400" />
                                        </div>
                                        <h3 className="text-2xl font-black text-white mb-2">Somo Limerekodiwa (Locked)</h3>
                                        <p className="text-slate-400 max-w-sm mb-8 font-medium">
                                            Nunua kozi hii kamili ili upate ufikiaji wa masomo yote na ujifunze kwa undani zaidi.
                                        </p>
                                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 px-10 rounded-2xl shadow-xl shadow-indigo-500/20 transform transition active:scale-95">
                                            UNLOCK FULL COURSE
                                        </Button>
                                    </div>
                                ) : activeLesson.type === 'video' ? (
                                    <video 
                                        key={activeLesson.id}
                                        src={activeLesson.content_url} 
                                        controls 
                                        className="w-full h-full object-cover"
                                        poster={product.image_url}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-center p-12">
                                        <FileText className="h-16 w-16 text-indigo-400 mb-6" />
                                        <h3 className="text-xl font-bold mb-4">Lesson Resources</h3>
                                        <a 
                                            href={activeLesson.content_url} 
                                            target="_blank" 
                                            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-2xl font-bold transition-all border border-white/10"
                                        >
                                            <ExternalLink className="h-4 w-4" /> Fungua Faili la Somo
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Content Info */}
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                                Now Playing
                                            </span>
                                            {activeLesson.is_preview && (
                                                <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-500">
                                                    Free Preview
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-white">{activeLesson.title}</h2>
                                    </div>

                                    {!activeLesson.is_locked && (
                                        <Button 
                                            onClick={() => toggleLessonCompletion(activeLesson.id)}
                                            disabled={isToggling}
                                            className={`h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                                                activeLesson.is_completed 
                                                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' 
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
                                            }`}
                                        >
                                            {isToggling ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : activeLesson.is_completed ? (
                                                <><CheckCircle className="h-4 w-4 mr-2" /> Completed</>
                                            ) : (
                                                <><Circle className="h-4 w-4 mr-2" /> Mark as Complete</>
                                            )}
                                        </Button>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 py-4 border-y border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                            <Layout className="h-4 w-4 text-indigo-400" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">Lesson {allLessons.findIndex(l => l.id === activeLesson.id) + 1} of {totalLessons}</span>
                                    </div>
                                    <div className="h-1 w-1 bg-slate-700 rounded-full" />
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                            <Info className="h-4 w-4 text-indigo-400" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">Takeer Certified High-Ticket Content</span>
                                    </div>
                                </div>
                                
                                {activeLesson.body && (
                                    <div className="prose prose-invert prose-indigo max-w-none">
                                        <p className="text-lg leading-relaxed text-slate-300">
                                            {activeLesson.body}
                                        </p>
                                    </div>
                                )}

                                {!activeLesson.body && (
                                    <div className="p-8 rounded-3xl bg-white/5 border border-white/5 text-center space-y-3">
                                        <h4 className="font-bold">Maelezo ya ziada</h4>
                                        <p className="text-sm text-slate-400 max-w-lg mx-auto">
                                            Tazama video ya somo hili na kisha endelea kwenye somo linalofuata kwenye orodha ya upande wa kushoto.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center p-12 text-center">
                            <div className="space-y-4 max-w-sm">
                                <div className="h-20 w-20 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto mb-8 animate-pulse">
                                    <Layout className="h-10 w-10 text-slate-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400">Tayarisha Somo lako...</h3>
                                <p className="text-sm text-slate-500">Chagua somo kutoka kwenye curriculum ili uanze kujifunza.</p>
                            </div>
                        </div>
                    )}
                </main>

            </div>
        </div>
    );
}
