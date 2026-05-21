import React, { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { toast, Toaster } from 'sonner';
import { Camera, CheckCircle2, Loader2, MapPin, PackageCheck, Truck, TriangleAlert, UserPlus } from 'lucide-react';
import {
    DeliveryDirectionsButton,
    DeliveryFlowTimeline,
    deliveryCurrentIndex,
    deliveryStatusTextSw,
    deliveryStepsFor,
} from '@/Components/DeliveryFlowTimeline';

export default function RiderDelivery({ token, delivery: initialDelivery }) {
    const [delivery, setDelivery] = useState(initialDelivery);
    const [note, setNote] = useState('');
    const [proof, setProof] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [stageSubmitting, setStageSubmitting] = useState(null);
    const [pin, setPin] = useState('');
    const [pinSubmitting, setPinSubmitting] = useState(false);
    const [completionNote, setCompletionNote] = useState('');
    const [completionProof, setCompletionProof] = useState(null);
    const [issueOpen, setIssueOpen] = useState(false);
    const [issueNote, setIssueNote] = useState('');
    const [issueProof, setIssueProof] = useState(null);
    const [issueSubmitting, setIssueSubmitting] = useState(false);
    const [waitlistOpen, setWaitlistOpen] = useState(false);
    const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
    const [waitlistJoined, setWaitlistJoined] = useState(Boolean(initialDelivery?.rider_waitlist_joined));
    const [waitlistJoinedHere, setWaitlistJoinedHere] = useState(false);
    const [waitlistForm, setWaitlistForm] = useState({
        name: initialDelivery?.delivery_person_name || '',
        phone: initialDelivery?.boda_phone || '',
        city: '',
        main_station: '',
        vehicle_type: 'boda',
    });

    const expiresLabel = useMemo(() => {
        if (!delivery?.expires_at) return null;
        const date = new Date(delivery.expires_at);
        if (Number.isNaN(date.valueOf())) return null;
        return date.toLocaleString('sw-TZ', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }, [delivery?.expires_at]);

    const steps = deliveryStepsFor(delivery?.delivery_type);
    const currentIndex = deliveryCurrentIndex(delivery);
    const activeStep = currentIndex >= 0 ? steps[currentIndex] : null;
    const isDelivered = delivery?.status === 'delivered';
    const isIntercity = delivery?.delivery_type === 'intercity_bus';
    const arrivedIndex = steps.findIndex((step) => step.value === 'arrived');
    const canCompleteLocal = !isIntercity && !isDelivered && arrivedIndex >= 0 && currentIndex >= arrivedIndex;
    const canAddUpdate = Boolean(activeStep) && !isDelivered;
    const completeDeliveryCard = canCompleteLocal ? (
        <form onSubmit={confirmPin} className="mt-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Kamilisha mzigo</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">Weka PIN ya tarakimu 4 kutoka kwa mteja baada ya kumkabidhi mzigo.</p>
            <label className="mt-4 block text-xs font-black uppercase tracking-widest text-emerald-800">
                Ujumbe wa makabidhiano
                <textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="Mf. Nimekabidhi mteja mzigo."
                    className="mt-2 min-h-20 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal"
                />
            </label>
            <label className="mt-4 block rounded-2xl border border-emerald-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-emerald-800">
                <span className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-emerald-700" />
                    Picha/video ya makabidhiano
                </span>
                <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setCompletionProof(e.target.files?.[0] || null)}
                    className="mt-3 block w-full text-xs normal-case tracking-normal"
                />
            </label>
            <div className="mt-3 flex gap-2">
                <input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    className="h-14 min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-white px-4 text-center text-2xl font-black tracking-[0.4em]"
                />
                <button
                    type="submit"
                    disabled={pin.length !== 4 || pinSubmitting}
                    className="flex h-14 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
                >
                    {pinSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Maliza'}
                </button>
            </div>
        </form>
    ) : null;

    async function withLocation(formData) {
        if (!navigator.geolocation) return;

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 60000 });
            });
            formData.append('latitude', position.coords.latitude);
            formData.append('longitude', position.coords.longitude);
        } catch {
            // Location is useful, but the update should not fail if the rider declines it.
        }
    }

    async function saveStage(nextStatus) {
        if (stageSubmitting || isDelivered) return;

        setStageSubmitting(nextStatus);
        const formData = new FormData();
        formData.append('status', nextStatus);
        await withLocation(formData);

        try {
            const res = await axios.post(`/api/rider-deliveries/${token}/status`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setDelivery(res.data.delivery);
            toast.success(res.data.message || 'Status imehifadhiwa.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuhifadhi status.');
        } finally {
            setStageSubmitting(null);
        }
    }

    async function submitStatus(e) {
        e.preventDefault();
        if (submitting || !canAddUpdate) return;

        setSubmitting(true);
        const formData = new FormData();
        formData.append('status', activeStep.value);
        if (note.trim()) formData.append('note', note.trim());
        if (proof) formData.append('proof', proof);
        await withLocation(formData);

        try {
            const res = await axios.post(`/api/rider-deliveries/${token}/status`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setDelivery(res.data.delivery);
            setNote('');
            setProof(null);
            toast.success(res.data.message || 'Taarifa imehifadhiwa.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuhifadhi update.');
        } finally {
            setSubmitting(false);
        }
    }

    async function submitIssue(e) {
        e.preventDefault();
        if (issueSubmitting || isDelivered || !issueNote.trim()) return;

        setIssueSubmitting(true);
        const formData = new FormData();
        formData.append('status', 'issue_reported');
        formData.append('note', issueNote.trim());
        if (issueProof) formData.append('proof', issueProof);
        await withLocation(formData);

        try {
            const res = await axios.post(`/api/rider-deliveries/${token}/status`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setDelivery(res.data.delivery);
            setIssueNote('');
            setIssueProof(null);
            setIssueOpen(false);
            toast.success(res.data.message || 'Tatizo limehifadhiwa.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuhifadhi tatizo.');
        } finally {
            setIssueSubmitting(false);
        }
    }

    async function confirmPin(e) {
        e.preventDefault();
        if (pin.length !== 4 || pinSubmitting || !canCompleteLocal) return;

        setPinSubmitting(true);
        const formData = new FormData();
        formData.append('pin', pin);
        if (completionNote.trim()) formData.append('note', completionNote.trim());
        if (completionProof) formData.append('proof', completionProof);
        await withLocation(formData);

        try {
            const res = await axios.post(`/api/rider-deliveries/${token}/confirm-pin`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setDelivery(res.data.delivery);
            setPin('');
            setCompletionNote('');
            setCompletionProof(null);
            toast.success(res.data.message || 'Mzigo umethibitishwa.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'PIN si sahihi.');
        } finally {
            setPinSubmitting(false);
        }
    }

    async function submitWaitlist(e) {
        e.preventDefault();
        if (waitlistSubmitting || waitlistJoined) return;

        setWaitlistSubmitting(true);
        try {
            const res = await axios.post(`/api/rider-deliveries/${token}/waitlist`, {
                name: waitlistForm.name.trim(),
                phone: waitlistForm.phone.trim(),
                city: waitlistForm.city.trim(),
                main_station: waitlistForm.main_station.trim(),
                vehicle_type: waitlistForm.vehicle_type,
            });
            if (res.data.delivery) {
                setDelivery(res.data.delivery);
            }
            setWaitlistJoined(true);
            setWaitlistJoinedHere(true);
            setWaitlistOpen(false);
            toast.success(res.data.message || 'Umeongezwa kwenye orodha ya kusubiri.');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuongeza kwenye orodha ya kusubiri.');
        } finally {
            setWaitlistSubmitting(false);
        }
    }

    const waitlistCard = isDelivered ? (
        waitlistJoined ? (
            waitlistJoinedHere ? (
                <div className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Kazi za kusafirisha mizigo</p>
                    <p className="mt-2 text-sm font-semibold text-sky-900">
                        Umeingia kwenye orodha. Tutakutafuta kama nafasi za kusafirisha mizigo za Takeer zitafunguka eneo lako.
                    </p>
                </div>
            ) : null
        ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kazi za kusafirisha mizigo</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                            Ungependa kujulishwa kama Takeer itafungua nafasi za kusafirisha mizigo eneo lako? Jiunge kwenye orodha. Tutakujulisha tu kama nafasi zitafunguka.
                        </p>
                    </div>
                </div>

                {!waitlistOpen ? (
                    <button
                        type="button"
                        onClick={() => setWaitlistOpen(true)}
                        className="mt-4 h-12 w-full rounded-2xl border border-sky-100 bg-sky-50 text-xs font-black uppercase tracking-widest text-sky-800"
                    >
                        Jiunge na orodha
                    </button>
                ) : (
                    <form onSubmit={submitWaitlist} className="mt-4 space-y-3">
                        <input
                            value={waitlistForm.name}
                            onChange={(e) => setWaitlistForm((current) => ({ ...current, name: e.target.value }))}
                            placeholder="Jina (si lazima)"
                            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                        />
                        <input
                            value={waitlistForm.phone}
                            onChange={(e) => setWaitlistForm((current) => ({ ...current, phone: e.target.value }))}
                            placeholder="Namba ya simu"
                            inputMode="tel"
                            required
                            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                        />
                        <input
                            value={waitlistForm.main_station}
                            onChange={(e) => setWaitlistForm((current) => ({ ...current, main_station: e.target.value }))}
                            placeholder="Kituo au eneo lako kuu (si lazima)"
                            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                value={waitlistForm.city}
                                onChange={(e) => setWaitlistForm((current) => ({ ...current, city: e.target.value }))}
                                placeholder="Mji (si lazima)"
                                className="h-12 min-w-0 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                            />
                            <select
                                value={waitlistForm.vehicle_type}
                                onChange={(e) => setWaitlistForm((current) => ({ ...current, vehicle_type: e.target.value }))}
                                className="h-12 min-w-0 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                            >
                                <option value="boda">Boda</option>
                                <option value="bajaj">Bajaji</option>
                                <option value="car">Gari ndogo</option>
                                <option value="van">Van</option>
                                <option value="walking">Kwa miguu</option>
                                <option value="other">Nyingine</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setWaitlistOpen(false)}
                                className="h-12 flex-1 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600"
                            >
                                Sio sasa
                            </button>
                            <button
                                type="submit"
                                disabled={waitlistSubmitting}
                                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-sky-700 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
                            >
                                {waitlistSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Jiunge'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        )
    ) : null;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-950">
            <Head title="Taarifa za Mzigo | Takeer" />
            <Toaster richColors position="top-center" />

            <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-white shadow-xl">
                <section className="bg-sky-700 px-6 pb-8 pt-10 text-white">
                    <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                            <Truck className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-100">Takeer Usafirishaji</p>
                            <h1 className="mt-1 text-3xl font-black leading-none">Taarifa ya Mzigo</h1>
                        </div>
                    </div>
                    <p className="mt-5 text-sm font-semibold text-sky-50">
                        {delivery?.merchant_name || 'Duka'} · {delivery?.order_public_id ? `#${delivery.order_public_id}` : 'Oda'}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <DeliveryDirectionsButton routeUrl={delivery?.route_url} label="Ramani" className="bg-white text-sky-800 shadow-none hover:bg-sky-50" />
                        {delivery?.delivery_person_name && (
                            <span className="inline-flex h-11 items-center justify-center rounded-2xl bg-white/10 px-4 text-xs font-black uppercase tracking-widest text-white">
                                {delivery.delivery_person_name}
                            </span>
                        )}
                        {delivery?.boda_phone && (
                            <a href={`tel:${delivery.boda_phone}`} className="inline-flex h-11 items-center justify-center rounded-2xl bg-white/10 px-4 text-xs font-black uppercase tracking-widest text-white">
                                Piga simu
                            </a>
                        )}
                    </div>
                </section>

                <section className="flex-1 space-y-4 px-5 py-5">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mzigo</p>
                        <p className="mt-1 text-xl font-black">{delivery?.title || 'Oda ya usafirishaji'}</p>
                        <p className="mt-2 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-sky-700">
                            {deliveryStatusTextSw(delivery?.status)}
                        </p>
                        {delivery?.physical_address && (
                            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-slate-600">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                {delivery.physical_address}
                            </p>
                        )}
                        {expiresLabel && (
                            <p className="mt-3 text-xs font-bold text-slate-500">Linki inaisha {expiresLabel}</p>
                        )}
                    </div>

                    {!isDelivered ? (
                        <>
                            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Badili hatua</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Bonyeza hatua inayofuata kuhifadhi mara moja. Ujumbe na picha/video vitawekwa kwenye hatua ya mwisho iliyokamilika.
                                </p>
                                <DeliveryFlowTimeline
                                    delivery={delivery}
                                    selectable
                                    riderLabels
                                    selectedStatus={stageSubmitting}
                                    onSelectStatus={saveStage}
                                    disabledStatuses={['delivered']}
                                    renderAfterStep={(step) => step.value === 'arrived' ? completeDeliveryCard : null}
                                    swahili
                                    className="mt-3 border-slate-100 bg-slate-50/60 shadow-none"
                                />
                                {!issueOpen ? (
                                    <button
                                        type="button"
                                        onClick={() => setIssueOpen(true)}
                                        disabled={Boolean(stageSubmitting)}
                                        className="mt-3 h-11 w-full rounded-2xl border border-amber-100 bg-white px-4 text-left text-sm font-black text-amber-700 disabled:opacity-60"
                                    >
                                        Kuna tatizo
                                    </button>
                                ) : (
                                    <form onSubmit={submitIssue} className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Eleza tatizo</p>
                                        <textarea
                                            value={issueNote}
                                            onChange={(e) => setIssueNote(e.target.value)}
                                            placeholder="Mf. Mteja hapokei simu, au nimepata pancha."
                                            className="mt-2 min-h-24 w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold"
                                            required
                                        />
                                        <label className="mt-3 block rounded-2xl border border-amber-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-amber-800">
                                            <span className="flex items-center gap-2">
                                                <Camera className="h-4 w-4" />
                                                Picha/video kama ipo
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*,video/*"
                                                onChange={(e) => setIssueProof(e.target.files?.[0] || null)}
                                                className="mt-3 block w-full text-xs normal-case tracking-normal"
                                            />
                                        </label>
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIssueOpen(false);
                                                    setIssueNote('');
                                                    setIssueProof(null);
                                                }}
                                                className="h-11 flex-1 rounded-2xl border border-amber-200 bg-white text-xs font-black uppercase tracking-widest text-amber-800"
                                            >
                                                Funga
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={issueSubmitting || !issueNote.trim()}
                                                className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-amber-600 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
                                            >
                                                {issueSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Tuma tatizo'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            <form onSubmit={submitStatus} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {activeStep ? `Ongeza taarifa kwenye: ${deliveryStatusTextSw(activeStep.value)}` : 'Ongeza taarifa'}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    {activeStep ? 'Tumia hapa kuweka ujumbe wa ziada au picha/video kwenye hatua iliyokamilika sasa.' : 'Kamilisha hatua ya kwanza kabla ya kuweka ujumbe au picha/video.'}
                                </p>
                                <label className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">
                                    Ujumbe
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        disabled={!canAddUpdate}
                                        placeholder="Mf. Nimefika getini, nasubiri mteja."
                                        className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal disabled:bg-slate-50 disabled:text-slate-400"
                                    />
                                </label>
                                <label className="mt-4 block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-black uppercase tracking-widest text-slate-500">
                                    <span className="flex items-center gap-2">
                                        <Camera className="h-4 w-4 text-sky-700" />
                                        Picha/video ya ushahidi
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*,video/*"
                                        disabled={!canAddUpdate}
                                        onChange={(e) => setProof(e.target.files?.[0] || null)}
                                        className="mt-3 block w-full text-xs normal-case tracking-normal disabled:opacity-50"
                                    />
                                </label>
                                <button
                                    type="submit"
                                    disabled={submitting || !canAddUpdate}
                                    className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-sky-700 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-sky-900/20 disabled:opacity-60"
                                >
                                    {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackageCheck className="mr-2 h-5 w-5" />}
                                    Hifadhi taarifa
                                </button>
                            </form>

                            {isIntercity && (
                                <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Mzigo wa basi</p>
                                    <p className="mt-1 text-sm font-semibold text-amber-900">
                                        Mzigo wa kwenda mkoa hautumii PIN ya mteja hapa. Weka taarifa ukifika terminal, kisha uthibitisho wa risiti au kuchukuliwa terminal utakamilisha makabidhiano.
                                    </p>
                                </div>
                            )}

                        </>
                    ) : (
                        <>
                            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                                <p className="mt-3 text-xl font-black text-emerald-900">Mzigo umekamilika</p>
                                <p className="mt-1 text-sm font-semibold text-emerald-800">Hakuna taarifa nyingine zinazohitajika kwa mzigo huu.</p>
                            </div>
                            {waitlistCard}
                        </>
                    )}

                    <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-800">
                            <TriangleAlert className="h-4 w-4" />
                            Linki ya dereva
                        </p>
                        <p className="mt-2 text-sm font-semibold text-amber-900">
                            Linki hii ni ya muda mfupi. Itumie kwa mzigo huu tu.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
