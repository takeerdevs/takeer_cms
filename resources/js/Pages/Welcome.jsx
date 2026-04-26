import AppLayout from '@/Layouts/AppLayout';
import { Head, router, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    ShoppingBag, ArrowRight, ShieldCheck, Zap,
    User, Store, CheckCircle2, ChevronRight,
    Globe, Lock, Sparkles, TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";

export default function Welcome({ auth }) {
    const heroImage = "/images/welcome/hero.png";

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    return (
        <AppLayout>
            <Head title="Uza na Ununue kwa Usalama | Takeer" />

            <div className="relative min-h-screen overflow-hidden bg-background">
                {/* ── Dynamic Background ── */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/10 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                    {/* ── Hero Section ── */}
                    <section className="pt-16 pb-24 md:pt-24 md:pb-32 grid lg:grid-cols-2 gap-12 items-center">
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="space-y-8"
                        >
                            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800">
                                <Sparkles className="h-4 w-4 text-brand-600" />
                                <span className="text-xs font-bold text-brand-700 dark:text-brand-400 uppercase tracking-widest">New: Multi-Profile Identity</span>
                            </motion.div>

                            <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-black text-foreground tracking-tighter leading-[1.1]">
                                Uza na Ununue <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-orange-500">
                                    kwa Usalama
                                </span> <br />
                                Popote Pale.
                            </motion.h1>

                            <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
                                Jukwaa Maalum linalounganisha wauzaji binafsi na biashara kubwa kwenye mfumo mmoja salama wa Escrow.
                            </motion.p>

                            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 pt-4">
                                {!auth?.user ? (
                                    <>
                                        <Button
                                            size="lg"
                                            className="h-14 px-8 rounded-2xl text-lg font-bold bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-600/20 active:scale-95 transition-all"
                                            onClick={() => router.visit('/merchant/register')}
                                        >
                                            Fungua Akaunti (Bure)
                                            <ChevronRight className="ml-2 h-5 w-5" />
                                        </Button>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="h-14 px-8 rounded-2xl text-lg font-bold border-2 hover:bg-muted active:scale-95 transition-all"
                                            onClick={() => router.visit('/feed')}
                                        >
                                            Anza Kununua
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="lg"
                                        className="h-14 px-8 rounded-2xl text-lg font-bold bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-600/20 active:scale-95 transition-all"
                                        onClick={() => router.visit('/profile')}
                                    >
                                        Nenda Kwenye Profile
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                )}
                            </motion.div>

                            <motion.div variants={itemVariants} className="flex items-center gap-6 pt-6">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                                            <img src={`https://i.pravatar.cc/100?u=${i}`} alt="" />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    <span className="text-foreground font-bold">10,000+</span> tayari wanatumia Takeer
                                </p>
                            </motion.div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="relative hidden lg:block"
                        >
                            <div className="absolute inset-0 bg-brand-500/20 blur-[100px] rounded-full" />
                            <div className="relative z-10 p-8 glass-card border-white/20 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden group">
                                <img
                                    src={heroImage}
                                    alt="Takeer Ecosystem"
                                    className="w-full h-auto rounded-[2rem] transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                            </div>

                            {/* Floating Stats */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-6 -right-6 p-4 glass-card rounded-2xl shadow-xl z-20 border-white/20"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Growth</p>
                                        <p className="text-xl font-black text-foreground">+142%</p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </section>

                    {/* ── Account Types Section ── */}
                    <section className="py-24 border-t border-border/50">
                        <div className="text-center space-y-4 mb-16">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Chagua Jinsi ya Kuanza</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                Tumeunda mfumo unaokua na wewe. Anza kama mtu binafsi, kisha ongeza biashara zako kadiri unavyokua.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <motion.div
                                whileHover={{ y: -10 }}
                                className="p-8 rounded-[2.5rem] bg-gradient-to-br from-white to-brand-50 dark:from-card dark:to-brand-950/20 border border-brand-100 dark:border-brand-900/50 shadow-xl relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-12 bg-brand-500/5 rounded-full -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-150" />

                                <div className="h-16 w-16 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 mb-8">
                                    <User className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-black mb-4">Akaunti ya Binafsi</h3>
                                <p className="text-muted-foreground mb-8 leading-relaxed">
                                    Akaunti ya kuanzia kwa kila mtumiaji. Uza bidhaa za kidijitali, huduma, na bidhaa za kawaida ukitumia wasifu wako wa binafsi. Inafaa kwa wataalamu (freelancers) na wauziaji wa mara moja.
                                </p>
                                <ul className="space-y-3 mb-8">
                                    {['Selling enabled by default', 'Escrow protection', 'Digital & Physical products', 'Instant Payouts'].map(feat => (
                                        <li key={feat} className="flex items-center gap-3 text-sm font-bold text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-brand-500" /> {feat}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>

                            <motion.div
                                whileHover={{ y: -10 }}
                                className="p-8 rounded-[2.5rem] bg-gradient-to-br from-white to-blue-50 dark:from-card dark:to-blue-950/20 border border-blue-100 dark:border-blue-900/50 shadow-xl relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-12 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-150" />

                                <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 mb-8">
                                    <Store className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-black mb-4">Akaunti ya Biashara</h3>
                                <p className="text-muted-foreground mb-8 leading-relaxed">
                                    Peleka biashara yako ngazi nyingine. Unda wasifu maalum wa biashara uliothibitishwa (KYC). Inafaa kwa maduka, makampuni, na taasisi zinazohitaji sifa za kitaalamu zaidi.
                                </p>
                                <ul className="space-y-3 mb-8">
                                    {['Multi-Location support', 'Professional branding', 'Team management', 'Advanced analytics'].map(feat => (
                                        <li key={feat} className="flex items-center gap-3 text-sm font-bold text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-blue-500" /> {feat}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>
                    </section>

                    {/* ── Features & Trust ── */}
                    <section className="py-24 grid md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <h4 className="text-xl font-black tracking-tight">Escrow Salama</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Pesa yako inashikiliwa salama mpaka mteja atakapothibitisha kupokea bidhaa. Hakuna kutapeliwa tena.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                                <Globe className="h-6 w-6" />
                            </div>
                            <h4 className="text-xl font-black tracking-tight">Popote Pale</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Uza bidhaa zako kupitia Link moja tu kwenye Bio ya Instagram, WhatsApp, au Facebook.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-600">
                                <Lock className="h-6 w-6" />
                            </div>
                            <h4 className="text-xl font-black tracking-tight">Faragha ya Hali ya Juu</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Data zako na miamala yako inalindwa kwa encryption ya kiwango cha juu cha kibenki.
                            </p>
                        </div>
                    </section>

                    {/* ── Final CTA ── */}
                    <section className="pb-32">
                        <div className="p-8 md:p-16 rounded-[3rem] bg-brand-600 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[50%] h-full bg-white/10 skew-x-[-20deg] transition-transform duration-1000 group-hover:translate-x-20" />
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white">
                                <div className="space-y-4 text-center md:text-left">
                                    <h3 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">Uko tayari kuanza <br /> safari yako?</h3>
                                    <p className="text-brand-100 text-lg opacity-90 font-medium">Jiunge na mamia ya wauzaji wanaofurahia soko huru na salama.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                    <Button
                                        className="h-16 px-10 rounded-2xl bg-white text-brand-600 hover:bg-brand-50 text-xl font-black shadow-xl"
                                        onClick={() => router.visit('/merchant/register')}
                                    >
                                        Jiunge Sasa
                                    </Button>
                                    <Button
                                        className="h-16 px-10 rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white text-xl font-black transition-all"
                                        onClick={() => router.visit('/feed')}
                                    >
                                        Gundua Bidhaa
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </AppLayout>
    );
}
