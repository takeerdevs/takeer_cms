import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Bell, CalendarClock, ChevronRight, Loader2, Mail, MessageSquare, Phone, RefreshCw, Search, Send, UserRound, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const SEGMENTS = [
    { value: 'all', label: 'All contacts' },
    { value: 'needs_reply', label: 'Needs reply' },
    { value: 'orders', label: 'Orders' },
    // Booking communications remain supported by the backend but are hidden
    // from the launch UI with the service-provider workflow.
    { value: 'learning', label: 'Learning' },
    { value: 'members', label: 'Members' },
];

const CHANNELS = [
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Call note' },
    { value: 'in_person', label: 'In-person note' },
];

export default function Communications({ merchantUsername }) {
    const { copy } = useLocale();
    const segmentLabels = {
        all: copy('All contacts', 'Mawasiliano yote'),
        needs_reply: copy('Needs reply', 'Zinahitaji jibu'),
        orders: copy('Orders', 'Oda'),
        learning: copy('Learning', 'Mafunzo'),
        members: copy('Members', 'Wanachama'),
    };
    const channelLabels = {
        sms: 'SMS',
        whatsapp: 'WhatsApp',
        email: copy('Email', 'Barua pepe'),
        call: copy('Call note', 'Maelezo ya simu'),
        in_person: copy('In-person note', 'Maelezo ya ana kwa ana'),
    };
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({ summary: {}, templates: [], contacts: [], followups: [], logs: [] });
    const [filters, setFilters] = useState({ q: '', segment: 'all' });
    const [draft, setDraft] = useState({
        channel: 'sms',
        recipient: '',
        subject: '',
        message: '',
        contact_key: '',
        template_key: '',
        context_type: '',
        context_id: '',
    });

    const loadCommunications = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.q.trim()) params.set('q', filters.q.trim());
            if (filters.segment !== 'all') params.set('segment', filters.segment);
            const response = await axios.get(`/merchant/${merchantUsername}/communications/api?${params.toString()}`);
            setData(response.data || { summary: {}, templates: [], contacts: [], followups: [], logs: [] });
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load communications.', 'Imeshindikana kupakia mawasiliano.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(loadCommunications, 250);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.q, filters.segment, merchantUsername]);

    const contacts = useMemo(() => data.contacts || [], [data.contacts]);
    const templates = useMemo(() => data.templates || [], [data.templates]);

    const selectContact = (contact, followup = null) => {
        const recipient = draft.channel === 'email'
            ? contact.email || contact.phone || ''
            : contact.phone || contact.email || '';

        setDraft((prev) => ({
            ...prev,
            recipient,
            contact_key: contact.key,
            context_type: followup?.context_type || '',
            context_id: followup?.context_id || '',
            message: prev.message.replace('{{customer_name}}', contact.name || copy('there', 'hapo')),
        }));
    };

    const applyTemplate = (template) => {
        const selectedContact = contacts.find((contact) => contact.key === draft.contact_key);
        setDraft((prev) => ({
            ...prev,
            channel: template.channel || prev.channel,
            subject: template.subject || '',
            template_key: template.key,
            recipient: selectedContact
                ? (template.channel === 'email' ? selectedContact.email || selectedContact.phone || '' : selectedContact.phone || selectedContact.email || '')
                : prev.recipient,
            message: (template.message || '').replace('{{customer_name}}', selectedContact?.name || copy('there', 'hapo')),
        }));
    };

    const submitDraft = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/communications/api`, {
                ...draft,
                context_id: draft.context_id ? Number(draft.context_id) : null,
            });
            toast.success(copy('Message prepared in the communication log.', 'Ujumbe umeandaliwa kwenye kumbukumbu ya mawasiliano.'));
            setDraft({
                channel: 'sms',
                recipient: '',
                subject: '',
                message: '',
                contact_key: '',
                template_key: '',
                context_type: '',
                context_id: '',
            });
            loadCommunications();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to prepare message.', 'Imeshindikana kuandaa ujumbe.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout>
            <Head title={`${copy('Communications', 'Mawasiliano')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Operations', 'Uendeshaji')}</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">{copy('Communications', 'Mawasiliano')}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            {copy('Prepare customer follow-ups across orders, enrollments, memberships, and customer messages.', 'Andaa ufuatiliaji wa wateja kwenye oda, usajili, uanachama na ujumbe wa wateja.')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={loadCommunications} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {copy('Refresh', 'Onyesha upya')}
                        </Button>
                        <Button asChild>
                            <Link href={`/merchant/${merchantUsername}/customers`}>
                                {copy('Customers', 'Wateja')}
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <MetricCard icon={Users} label={copy('Contacts', 'Mawasiliano')} value={data.summary?.contacts ?? 0} />
                    <MetricCard icon={Bell} label={copy('Need reply', 'Zinahitaji jibu')} value={data.summary?.needs_reply ?? 0} />
                    <MetricCard icon={MessageSquare} label={copy('Prepared', 'Zilizoandaliwa')} value={data.summary?.pending_messages ?? 0} />
                    <MetricCard icon={Send} label={copy('Sent', 'Zimetumwa')} value={data.summary?.sent_messages ?? 0} />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-9" placeholder={copy('Search contact name, phone, or email...', 'Tafuta jina la mawasiliano, simu au barua pepe...')} value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
                                </div>
                                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.segment} onChange={(event) => setFilters((prev) => ({ ...prev, segment: event.target.value }))}>
                                    {SEGMENTS.map((segment) => <option key={segment.value} value={segment.value}>{segmentLabels[segment.value] || segment.label}</option>)}
                                </select>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{copy('Follow-up queue', 'Foleni ya Ufuatiliaji')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {loading ? (
                                    <EmptyState icon={Loader2} title={copy('Loading follow-ups...', 'Inapakia ufuatiliaji...')} spin />
                                ) : data.followups?.length ? (
                                    data.followups.map((followup) => (
                                        <div key={`${followup.key}-${followup.contact?.key}`} className="rounded-lg border border-border p-3">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-black">{followup.title}</h3>
                                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${followup.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>{followup.priority === 'high' ? copy('High', 'Juu') : followup.priority === 'medium' ? copy('Medium', 'Wastani') : followup.priority || copy('Normal', 'Kawaida')}</span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">{followup.description}</p>
                                                    <p className="mt-2 text-sm font-semibold">{followup.contact?.name || followup.contact?.phone || followup.contact?.email || copy('Customer', 'Mteja')}</p>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => selectContact(followup.contact, followup)}>
                                                    {copy('Prepare', 'Andaa')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <EmptyState icon={Bell} title={copy('No urgent follow-ups', 'Hakuna ufuatiliaji wa haraka')} text={copy('Pending customer work will appear here when orders, memberships, or classes need attention.', 'Kazi za wateja zinazosubiri zitaonekana hapa oda, uanachama au madarasa yanapohitaji uangalizi.')} />
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{copy('Contacts', 'Mawasiliano')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {contacts.length ? contacts.map((contact) => (
                                    <ContactRow key={contact.key} contact={contact} onSelect={() => selectContact(contact)} copy={copy} />
                                )) : (
                                    <EmptyState icon={UserRound} title={copy('No contacts found', 'Hakuna mawasiliano yaliyopatikana')} text={copy('Contacts appear after orders, enrollments, subscriptions, or customer messages.', 'Mawasiliano yataonekana baada ya oda, usajili, uanachama au ujumbe wa wateja.')} />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>{copy('Prepare message', 'Andaa ujumbe')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-3" onSubmit={submitDraft}>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="space-y-1 text-sm font-semibold">
                                            <span>{copy('Channel', 'Njia')}</span>
                                            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.channel} onChange={(event) => setDraft((prev) => ({ ...prev, channel: event.target.value }))}>
                                                {CHANNELS.map((channel) => <option key={channel.value} value={channel.value}>{channelLabels[channel.value] || channel.label}</option>)}
                                            </select>
                                        </label>
                                        <label className="space-y-1 text-sm font-semibold">
                                            <span>{copy('Recipient', 'Mpokeaji')}</span>
                                            <Input value={draft.recipient} onChange={(event) => setDraft((prev) => ({ ...prev, recipient: event.target.value }))} placeholder={copy('Phone, email, or note target', 'Simu, barua pepe au mlengwa wa maelezo')} required />
                                        </label>
                                    </div>
                                    <label className="space-y-1 text-sm font-semibold">
                                        <span>{copy('Subject', 'Mada')}</span>
                                        <Input value={draft.subject} onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))} placeholder={copy('Optional subject', 'Mada ya hiari')} />
                                    </label>
                                    <label className="space-y-1 text-sm font-semibold">
                                        <span>{copy('Message', 'Ujumbe')}</span>
                                        <textarea className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={draft.message} onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))} placeholder={copy('Write the follow-up message...', 'Andika ujumbe wa ufuatiliaji...')} required />
                                    </label>
                                    <Button type="submit" className="w-full" disabled={saving}>
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        {copy('Save to communication log', 'Hifadhi kwenye kumbukumbu ya mawasiliano')}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{copy('Templates', 'Violezo')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {templates.map((template) => (
                                    <button key={template.key} type="button" onClick={() => applyTemplate(template)} className="w-full rounded-lg border border-border p-3 text-left transition hover:bg-muted/50">
                                        <p className="font-bold">{template.label}</p>
                                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.message}</p>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{copy('Recent log', 'Kumbukumbu za hivi karibuni')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(data.logs || []).slice(0, 8).map((log) => (
                                    <div key={log.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-bold">{log.recipient || copy('Recipient', 'Mpokeaji')}</p>
                                            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold uppercase text-muted-foreground">{log.channel}</span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-muted-foreground">{log.message}</p>
                                    </div>
                                ))}
                                {!data.logs?.length && <EmptyState icon={MessageSquare} title={copy('No messages logged', 'Hakuna ujumbe ulihifadhiwa')} text={copy('Prepared messages and manual follow-up notes will appear here.', 'Ujumbe ulioandaliwa na maelezo ya ufuatiliaji yataonekana hapa.')} />}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function MetricCard({ icon: Icon, label, value }) {
    return (
        <Card>
            <CardContent className="p-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-2xl font-black">{value}</p>
            </CardContent>
        </Card>
    );
}

function ContactRow({ contact, onSelect, copy }) {
    return (
        <div className="rounded-lg border border-border p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <h3 className="truncate font-black">{contact.name || contact.phone || contact.email || copy('Customer', 'Mteja')}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {contact.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                        {contact.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatDate(contact.last_activity_at, copy)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {(contact.sources || []).map((source) => (
                            <span key={source} className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase text-brand-700">{sourceLabel(source)}</span>
                        ))}
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={onSelect}>{copy('Prepare', 'Andaa')}</Button>
            </div>
        </div>
    );
}

function EmptyState({ icon: Icon, title, text, spin = false }) {
    return (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
            <Icon className={`h-8 w-8 text-muted-foreground ${spin ? 'animate-spin' : ''}`} />
            <p className="mt-3 font-bold">{title}</p>
            {text && <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
        </div>
    );
}

function sourceLabel(source) {
    return {
        orders: 'Orders',
        service_requests: 'Bookings',
        subscriptions: 'Members',
        enrollments: 'Learning',
    }[source] || source;
}

function formatDate(value, copy = (english) => english) {
    if (!value) return copy('N/A', 'Haipo');
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
