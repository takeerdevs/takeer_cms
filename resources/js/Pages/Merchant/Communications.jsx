import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Bell, CalendarClock, ChevronRight, Loader2, Mail, MessageSquare, Phone, RefreshCw, Search, Send, UserRound, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const SEGMENTS = [
    { value: 'all', label: 'All contacts' },
    { value: 'needs_reply', label: 'Needs reply' },
    { value: 'orders', label: 'Orders' },
    { value: 'bookings', label: 'Bookings' },
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
            toast.error(error.response?.data?.message || 'Failed to load communications.');
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
            message: prev.message.replace('{{customer_name}}', contact.name || 'there'),
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
            message: (template.message || '').replace('{{customer_name}}', selectedContact?.name || 'there'),
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
            toast.success('Message prepared in the communication log.');
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
            toast.error(error.response?.data?.message || 'Failed to prepare message.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout>
            <Head title="Communications | Takeer" />
            <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Operations</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Communications</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Prepare customer follow-ups across orders, bookings, enrollments, memberships, and service requests.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={loadCommunications} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                        <Button asChild>
                            <Link href={`/merchant/${merchantUsername}/customers`}>
                                Customers
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <MetricCard icon={Users} label="Contacts" value={data.summary?.contacts ?? 0} />
                    <MetricCard icon={Bell} label="Need reply" value={data.summary?.needs_reply ?? 0} />
                    <MetricCard icon={MessageSquare} label="Prepared" value={data.summary?.pending_messages ?? 0} />
                    <MetricCard icon={Send} label="Sent" value={data.summary?.sent_messages ?? 0} />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-9" placeholder="Search contact name, phone, or email..." value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
                                </div>
                                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.segment} onChange={(event) => setFilters((prev) => ({ ...prev, segment: event.target.value }))}>
                                    {SEGMENTS.map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
                                </select>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Follow-up queue</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {loading ? (
                                    <EmptyState icon={Loader2} title="Loading follow-ups..." spin />
                                ) : data.followups?.length ? (
                                    data.followups.map((followup) => (
                                        <div key={`${followup.key}-${followup.contact?.key}`} className="rounded-lg border border-border p-3">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-black">{followup.title}</h3>
                                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${followup.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>{followup.priority}</span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">{followup.description}</p>
                                                    <p className="mt-2 text-sm font-semibold">{followup.contact?.name || followup.contact?.phone || followup.contact?.email || 'Customer'}</p>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => selectContact(followup.contact, followup)}>
                                                    Prepare
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <EmptyState icon={Bell} title="No urgent follow-ups" text="Pending customer work will appear here when orders, bookings, memberships, or classes need attention." />
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Contacts</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {contacts.length ? contacts.map((contact) => (
                                    <ContactRow key={contact.key} contact={contact} onSelect={() => selectContact(contact)} />
                                )) : (
                                    <EmptyState icon={UserRound} title="No contacts found" text="Contacts appear after orders, bookings, enrollments, subscriptions, or service requests." />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Prepare message</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-3" onSubmit={submitDraft}>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="space-y-1 text-sm font-semibold">
                                            <span>Channel</span>
                                            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.channel} onChange={(event) => setDraft((prev) => ({ ...prev, channel: event.target.value }))}>
                                                {CHANNELS.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
                                            </select>
                                        </label>
                                        <label className="space-y-1 text-sm font-semibold">
                                            <span>Recipient</span>
                                            <Input value={draft.recipient} onChange={(event) => setDraft((prev) => ({ ...prev, recipient: event.target.value }))} placeholder="Phone, email, or note target" required />
                                        </label>
                                    </div>
                                    <label className="space-y-1 text-sm font-semibold">
                                        <span>Subject</span>
                                        <Input value={draft.subject} onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))} placeholder="Optional subject" />
                                    </label>
                                    <label className="space-y-1 text-sm font-semibold">
                                        <span>Message</span>
                                        <textarea className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={draft.message} onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))} placeholder="Write the follow-up message..." required />
                                    </label>
                                    <Button type="submit" className="w-full" disabled={saving}>
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Save to communication log
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Templates</CardTitle>
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
                                <CardTitle>Recent log</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(data.logs || []).slice(0, 8).map((log) => (
                                    <div key={log.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-bold">{log.recipient || 'Recipient'}</p>
                                            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold uppercase text-muted-foreground">{log.channel}</span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-muted-foreground">{log.message}</p>
                                    </div>
                                ))}
                                {!data.logs?.length && <EmptyState icon={MessageSquare} title="No messages logged" text="Prepared messages and manual follow-up notes will appear here." />}
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

function ContactRow({ contact, onSelect }) {
    return (
        <div className="rounded-lg border border-border p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <h3 className="truncate font-black">{contact.name || contact.phone || contact.email || 'Customer'}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {contact.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                        {contact.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatDate(contact.last_activity_at)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {(contact.sources || []).map((source) => (
                            <span key={source} className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase text-brand-700">{sourceLabel(source)}</span>
                        ))}
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={onSelect}>Prepare</Button>
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

function formatDate(value) {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
