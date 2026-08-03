import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { CalendarClock, ChevronRight, Loader2, Plus, RefreshCw, Save, Settings2, Trash2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const WEEKDAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
];

const defaultRules = () => [1, 2, 3, 4, 5].map((weekday) => ({
    local_id: `rule-${weekday}`,
    weekday,
    start_time: '09:00',
    end_time: '17:00',
    slot_interval_minutes: 60,
    buffer_minutes: 0,
    capacity_type: 'limited',
    capacity: 1,
    is_active: true,
}));

const normalizeRules = (rules = []) => (rules.length ? rules : defaultRules()).map((rule, index) => ({
    local_id: rule.id || rule.local_id || `rule-${Date.now()}-${index}`,
    weekday: Number(rule.weekday || 1),
    start_time: String(rule.start_time || '09:00').slice(0, 5),
    end_time: String(rule.end_time || '17:00').slice(0, 5),
    slot_interval_minutes: Number(rule.slot_interval_minutes || 60),
    buffer_minutes: Number(rule.buffer_minutes || 0),
    capacity_type: rule.capacity_type || rule.metadata?.capacity_type || 'limited',
    capacity: Number(rule.capacity || 1),
    is_active: rule.is_active !== false,
}));

const normalizeSessions = (sessions = []) => sessions.map((session, index) => ({
    local_id: session.id || `session-${Date.now()}-${index}`,
    title: session.title || '',
    starts_at: session.starts_at ? session.starts_at.slice(0, 16) : '',
    ends_at: session.ends_at ? session.ends_at.slice(0, 16) : '',
    location_text: session.location_text || '',
    capacity: session.capacity ?? '',
    price_override: session.price_override ?? '',
    registration_deadline: session.registration_deadline ? session.registration_deadline.slice(0, 16) : '',
    status: session.status || 'open',
}));

export default function Availability({ merchantUsername, merchantTimezone = 'Africa/Dar_es_Salaam' }) {
    const { copy } = useLocale();
    const [products, setProducts] = useState([]);
    const [productId, setProductId] = useState('');
    const [timezone, setTimezone] = useState(merchantTimezone);
    const [rules, setRules] = useState(defaultRules());
    const [sessions, setSessions] = useState([]);
    const [integration, setIntegration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selectedProduct = useMemo(() => products.find((product) => String(product.id) === String(productId)), [products, productId]);
    const schedulingType = selectedProduct?.service_scheduling_type || 'recurring';
    const fixedSessions = productId && schedulingType === 'fixed_sessions';
    const disabledBySetup = productId && ['none', 'external'].includes(schedulingType);

    const loadProducts = async () => {
        const response = await axios.get(`/merchant/${merchantUsername}/products/api?type=service`);
        setProducts(response.data?.data || []);
    };

    const loadRules = async (nextProductId = productId) => {
        const params = new URLSearchParams();
        if (nextProductId) params.set('product_id', nextProductId);
        const response = await axios.get(`/merchant/${merchantUsername}/service-scheduling/api${params.toString() ? `?${params.toString()}` : ''}`);
        setIntegration(response.data?.integration || null);
        setRules(normalizeRules(response.data?.availability_rules || []));
        setTimezone(response.data?.availability_rules?.[0]?.timezone || response.data?.integration?.settings?.timezone || merchantTimezone);
    };

    const loadSessions = async (nextProductId = productId) => {
        if (!nextProductId) {
            setSessions([]);
            return;
        }
        const response = await axios.get(`/merchant/${merchantUsername}/service-sessions/api?product_id=${nextProductId}`);
        setSessions(normalizeSessions(response.data?.sessions || []));
    };

    const load = async (nextProductId = productId) => {
        setLoading(true);
        try {
            await loadProducts();
            if (nextProductId && products.find((product) => String(product.id) === String(nextProductId))?.service_scheduling_type === 'fixed_sessions') {
                await loadSessions(nextProductId);
            } else {
                await loadRules(nextProductId);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load availability.', 'Imeshindikana kupakia upatikanaji.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [merchantUsername]);

    useEffect(() => {
        if (loading) return;
        if (fixedSessions) {
            loadSessions(productId);
        } else {
            loadRules(productId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, schedulingType]);

    const updateRule = (index, updates) => {
        setRules((prev) => prev.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...updates } : rule)));
    };

    const addRule = () => {
        setRules((prev) => [...prev, {
            local_id: `rule-${Date.now()}`,
            weekday: 1,
            start_time: '09:00',
            end_time: '17:00',
            slot_interval_minutes: 60,
            buffer_minutes: 0,
            capacity_type: 'limited',
            capacity: 1,
            is_active: true,
        }]);
    };

    const saveRules = async (nextRules = rules) => {
        setSaving(true);
        try {
            const cleaned = nextRules
                .filter((rule) => rule.start_time && rule.end_time && rule.start_time < rule.end_time)
                .map((rule) => ({
                    weekday: Number(rule.weekday),
                    start_time: rule.start_time,
                    end_time: rule.end_time,
                    slot_interval_minutes: Number(rule.slot_interval_minutes || 60),
                    buffer_minutes: Number(rule.buffer_minutes || 0),
                    capacity_type: rule.capacity_type || 'limited',
                    capacity: Number(rule.capacity || 1),
                    is_active: Boolean(rule.is_active),
                }));

            if (!cleaned.length) {
                toast.error(copy('Add at least one valid availability window.', 'Ongeza angalau muda mmoja halali wa upatikanaji.'));
                return;
            }

            const response = await axios.put(`/merchant/${merchantUsername}/service-scheduling/api`, {
                product_id: productId ? Number(productId) : null,
                timezone,
                rules: cleaned,
            });
            setIntegration(response.data?.integration || integration);
            setRules(normalizeRules(response.data?.availability_rules || cleaned));
            toast.success(response.data?.message || copy('Availability saved.', 'Upatikanaji umehifadhiwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save availability.', 'Imeshindikana kuhifadhi upatikanaji.'));
        } finally {
            setSaving(false);
        }
    };

    const addSession = () => {
        setSessions((prev) => [...prev, {
            local_id: `session-${Date.now()}`,
            title: '',
            starts_at: '',
            ends_at: '',
            location_text: '',
            capacity: '',
            price_override: '',
            registration_deadline: '',
            status: 'open',
        }]);
    };

    const updateSession = (index, updates) => {
        setSessions((prev) => prev.map((session, sessionIndex) => (sessionIndex === index ? { ...session, ...updates } : session)));
    };

    const saveSessions = async () => {
        if (!productId) return;
        setSaving(true);
        try {
            const payload = sessions
                .filter((session) => session.starts_at)
                .map((session) => ({
                    title: session.title || null,
                    starts_at: session.starts_at,
                    ends_at: session.ends_at || null,
                    timezone,
                    location_text: session.location_text || null,
                    capacity: session.capacity === '' ? null : Number(session.capacity),
                    price_override: session.price_override === '' ? null : Number(session.price_override),
                    registration_deadline: session.registration_deadline || null,
                    status: session.status || 'open',
                }));

            if (!payload.length) {
                toast.error(copy('Add at least one session with a start date.', 'Ongeza angalau kipindi kimoja chenye tarehe ya kuanza.'));
                return;
            }

            const response = await axios.put(`/merchant/${merchantUsername}/service-sessions/api`, {
                product_id: Number(productId),
                sessions: payload,
            });
            setSessions(normalizeSessions(response.data?.sessions || []));
            toast.success(response.data?.message || copy('Sessions saved.', 'Vipindi vimehifadhiwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save sessions.', 'Imeshindikana kuhifadhi vipindi.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout>
            <Head title={`${copy('Availability', 'Upatikanaji')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Scheduling', 'Ratiba')}</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">{copy('Availability', 'Upatikanaji')}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy('Set when customers can book recurring appointments, rooms, rentals, reservations, tours, workshops, or fixed sessions.', 'Weka muda ambao wateja wanaweza kuweka booking za miadi, vyumba, ukodishaji, reservations, tours, workshops au vipindi maalum.')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => load(productId)} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {copy('Refresh', 'Onyesha upya')}
                        </Button>
                        <Button asChild>
                            <Link href={`/merchant/${merchantUsername}/bookings`}>
                                {copy('Booking Calendar', 'Kalenda ya Booking')}
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="grid gap-3 p-4 md:grid-cols-[1.5fr_1fr_1fr]">
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Service', 'Huduma')}</span>
                            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}>
                                <option value="">{copy('Default schedule for services', 'Ratiba chaguo-msingi ya huduma')}</option>
                                {products.map((product) => (
                                    <option key={product.id} value={String(product.id)}>{product.title} - {serviceModeLabel(product.service_scheduling_type, copy)}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Timezone', 'Ukanda wa muda')}</span>
                            <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                        </label>
                        <div className="rounded-lg border border-border px-3 py-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Calendar sync', 'Usawazishaji wa kalenda')}</p>
                            <p className="mt-1 text-sm font-semibold capitalize">{integration?.status || 'pending'}</p>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card>
                        <CardContent className="flex min-h-64 flex-col items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                            <p className="mt-3 text-sm text-muted-foreground">{copy('Loading availability...', 'Inapakia upatikanaji...')}</p>
                        </CardContent>
                    </Card>
                ) : disabledBySetup ? (
                    <Card>
                        <CardContent className="p-6">
                            <Settings2 className="h-8 w-8 text-muted-foreground" />
                            <h2 className="mt-3 text-lg font-black">{copy('This service does not use Takeer scheduling', 'Huduma hii haitumii ratiba ya Takeer')}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{copy('Change the service scheduling style from its setup page to manage availability here.', 'Badilisha aina ya ratiba kwenye ukurasa wa usanidi wa huduma ili kusimamia upatikanaji hapa.')}</p>
                        </CardContent>
                    </Card>
                ) : fixedSessions ? (
                    <FixedSessions sessions={sessions} setSessions={setSessions} updateSession={updateSession} addSession={addSession} saving={saving} saveSessions={saveSessions} copy={copy} />
                ) : (
                    <WeeklyAvailability rules={rules} setRules={setRules} updateRule={updateRule} addRule={addRule} saving={saving} saveRules={saveRules} copy={copy} />
                )}
            </div>
        </AppLayout>
    );
}

function WeeklyAvailability({ rules, setRules, updateRule, addRule, saving, saveRules, copy }) {
    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <CardTitle>{copy('Weekly Booking Windows', 'Muda wa Booking za Kila Wiki')}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{copy('These windows power customer-facing booking slots.', 'Muda huu hutengeneza nafasi za booking zinazoonekana kwa wateja.')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setRules(defaultRules())}>{copy('Weekdays', 'Siku za Wiki')}</Button>
                    <Button variant="outline" onClick={addRule}><Plus className="mr-2 h-4 w-4" />{copy('Add window', 'Ongeza muda')}</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {rules.map((rule, index) => {
                    const invalid = rule.start_time >= rule.end_time;
                    return (
                        <div key={rule.local_id || index} className="rounded-lg border border-border p-3">
                            <div className="grid gap-3 md:grid-cols-[130px_1fr_1fr_1fr_1fr_1fr_44px]">
                                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={rule.weekday} onChange={(event) => updateRule(index, { weekday: Number(event.target.value) })}>
                                    {WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{weekdayLabel(day.value, copy)}</option>)}
                                </select>
                                <Input type="time" value={rule.start_time} onChange={(event) => updateRule(index, { start_time: event.target.value })} />
                                <Input type="time" value={rule.end_time} onChange={(event) => updateRule(index, { end_time: event.target.value })} />
                                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={rule.slot_interval_minutes} onChange={(event) => updateRule(index, { slot_interval_minutes: Number(event.target.value) })}>
                                    {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes}m slot</option>)}
                                </select>
                                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={rule.buffer_minutes} onChange={(event) => updateRule(index, { buffer_minutes: Number(event.target.value) })}>
                                    {[0, 5, 10, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes}m buffer</option>)}
                                </select>
                                <Input type="number" min="1" value={rule.capacity} onChange={(event) => updateRule(index, { capacity: Number(event.target.value || 1) })} />
                                <Button variant="outline" size="icon" onClick={() => setRules((prev) => prev.filter((_, ruleIndex) => ruleIndex !== index))}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            {invalid && <p className="mt-2 text-xs font-semibold text-red-600">{copy('End time must be after start time.', 'Muda wa mwisho lazima uwe baada ya muda wa kuanza.')}</p>}
                        </div>
                    );
                })}
                <Button className="w-full" onClick={() => saveRules()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {copy('Save Availability', 'Hifadhi Upatikanaji')}
                </Button>
            </CardContent>
        </Card>
    );
}

function FixedSessions({ sessions, setSessions, updateSession, addSession, saving, saveSessions, copy }) {
    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <CardTitle>{copy('Fixed Sessions', 'Vipindi Maalum')}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{copy('Use this for classes, workshops, tours, events, and dated availability.', 'Tumia hii kwa madarasa, workshops, tours, matukio na upatikanaji wenye tarehe.')}</p>
                </div>
                <Button variant="outline" onClick={addSession}><Plus className="mr-2 h-4 w-4" />{copy('Add session', 'Ongeza kipindi')}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {sessions.length === 0 && (
                    <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{copy('No sessions yet. Add a date customers can book.', 'Hakuna vipindi bado. Ongeza tarehe ambayo wateja wanaweza kuweka booking.')}</div>
                )}
                {sessions.map((session, index) => (
                    <div key={session.local_id || index} className="rounded-lg border border-border p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <Input placeholder={copy('Session title', 'Kichwa cha kipindi')} value={session.title} onChange={(event) => updateSession(index, { title: event.target.value })} />
                            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={session.status} onChange={(event) => updateSession(index, { status: event.target.value })}>
                                <option value="open">{copy('Open', 'Wazi')}</option>
                                <option value="draft">{copy('Draft', 'Rasimu')}</option>
                                <option value="full">{copy('Full', 'Imejaa')}</option>
                                <option value="closed">{copy('Closed', 'Imefungwa')}</option>
                                <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                            </select>
                            <Input type="datetime-local" value={session.starts_at} onChange={(event) => updateSession(index, { starts_at: event.target.value })} />
                            <Input type="datetime-local" value={session.ends_at} onChange={(event) => updateSession(index, { ends_at: event.target.value })} />
                            <Input type="number" min="1" placeholder={copy('Capacity, blank unlimited', 'Uwezo, acha wazi bila kikomo')} value={session.capacity} onChange={(event) => updateSession(index, { capacity: event.target.value })} />
                            <Input type="number" min="0" placeholder={copy('Price override', 'Bei maalum')} value={session.price_override} onChange={(event) => updateSession(index, { price_override: event.target.value })} />
                            <Input className="md:col-span-2" placeholder={copy('Location or online link', 'Eneo au linki ya mtandaoni')} value={session.location_text} onChange={(event) => updateSession(index, { location_text: event.target.value })} />
                            <Input className="md:col-span-2" type="datetime-local" value={session.registration_deadline} onChange={(event) => updateSession(index, { registration_deadline: event.target.value })} />
                        </div>
                        <div className="mt-3 flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => setSessions((prev) => prev.filter((_, sessionIndex) => sessionIndex !== index))}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {copy('Remove', 'Ondoa')}
                            </Button>
                        </div>
                    </div>
                ))}
                <Button className="w-full" onClick={saveSessions} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                    {copy('Save Sessions', 'Hifadhi Vipindi')}
                </Button>
            </CardContent>
        </Card>
    );
}

function weekdayLabel(value, copy) {
    const labels = {
        1: ['Monday', 'Jumatatu'], 2: ['Tuesday', 'Jumanne'], 3: ['Wednesday', 'Jumatano'],
        4: ['Thursday', 'Alhamisi'], 5: ['Friday', 'Ijumaa'], 6: ['Saturday', 'Jumamosi'], 7: ['Sunday', 'Jumapili'],
    };
    const [english, swahili] = labels[value] || ['', ''];
    return copy(english, swahili);
}

function serviceModeLabel(value, copy) {
    if (value === 'fixed_sessions') return copy('Fixed sessions', 'Vipindi maalum');
    if (value === 'external') return copy('External booking', 'Booking ya nje');
    if (value === 'none') return copy('No scheduling', 'Hakuna ratiba');
    return copy('Recurring appointments', 'Miadi inayojirudia');
}
