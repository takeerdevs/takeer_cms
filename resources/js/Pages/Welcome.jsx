import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ShoppingBag, ArrowRight, ShieldCheck, Zap, ShieldCheckIcon } from 'lucide-react';

export default function Welcome({ auth }) {
    return (
        <AppLayout>
            <Head title="Karibu | Takeer" />

            <div className="flex flex-col gap-6 p-4 md:p-8 max-w-2xl mx-auto pb-24">

                {/* Hero / Header Section */}
                <section className="space-y-4 pt-4">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
                        Biashara Inayojali Usalama Wako.
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                        Nunua au Uza kwa haraka na uhakika. Tumia <b>ujuzi wako</b> kujipatia kipato cha ziada, <b>Mitandao ni fursa!</b>. Bidhaa halisi ikiwa na alama ya <ShieldCheckIcon className="mr-0 h-5 w-5 inline text-brand-600" /> inamaanisha pesa yako ipo salama, itashikiliwa hadi utakapothibitisha umepokea bidhaa.
                        <div className="text-lg font-semibold text-foreground mt-4">Kwa wauzaji: Uza bidhaa za kawaida au za kidijitali & huduma papo hapo. Bidhaa halisi, muuzaji anatumiwa pesa baada ya uthibitisho mteja kapata bidhaa yake papo hapo. Kwa wauzaji wa bidhaa za kidigitali, muuzaji atatoa pesa wakati wowote kiwango cha kutoa cha chini kikitimia, kiwango cha chini kutoa kinaanzia Tsh: 25,000/=.</div>
                        <div className="text-lg font-semibold text-foreground mt-2">Rahisi. Salama. Uhakika.</div>
                    </p>

                    {!auth?.user && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <Button
                                size="lg"
                                className="w-full sm:w-auto h-12 rounded-xl text-md font-semibold glass-card border-brand-500/20 text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                                onClick={() => router.visit('/feed')}
                            >
                                <ShoppingBag className="mr-2 h-5 w-5" />
                                Anza Kununua
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto h-12 rounded-xl text-md"
                                onClick={() => router.visit('/merchant/register')}
                            >
                                Anzisha Biashara Yako (Bure)
                            </Button>
                        </div>
                    )}
                </section>

                {/* Features Grid */}
                <section className="grid sm:grid-cols-2 gap-4 mt-4">
                    <Card className="glass-card border-none bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="pb-2">
                            <div className="h-10 w-10 rounded-lg bg-brand-100/50 flex items-center justify-center mb-4 border border-brand-200/50 text-brand-600">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <CardTitle>Escrow Salama</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Pesa yako inahifadhiwa Takeer mpaka utakapothibitisha kupokea mzigo wako kupitia namba ya siri (PIN).
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-none bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="pb-2">
                            <div className="h-10 w-10 rounded-lg bg-amber-100/50 flex items-center justify-center mb-4 border border-amber-200/50 text-amber-600">
                                <Zap className="h-5 w-5" />
                            </div>
                            <CardTitle>Malipo ya Haraka</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Lipa kwa M-Pesa, Tigo Pesa, au Airtel Money kwa kugusa mara moja (1-Tap Checkout).
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Dummy Feed Banner */}
                <section className="mt-6">
                    <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl"></div>
                        <div className="space-y-2 relative z-10 w-full">
                            <h3 className="text-xl font-bold">Pata unachohitaji haraka 👀</h3>
                            <p className="text-sm text-muted-foreground">Pitia Feed yetu au bofya Tafuta kuona bidhaa kutoka kwa wauzaji wetu.</p>
                        </div>
                        <Button
                            className="w-full sm:w-auto shrink-0 relative z-10 rounded-full pl-6 pr-4 h-12"
                            onClick={() => router.visit('/feed')}
                        >
                            Enda kwenye Feed
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </section>

            </div>
        </AppLayout>
    );
}
