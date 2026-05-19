import React, { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';

export default function ServiceRequestModal({
    product,
    open,
    onOpenChange,
    requestType,
    modulePayload = {},
    title = 'Send request',
    submitLabel = 'Send request',
    messagePlaceholder = 'Add details, preferred options, questions, or special instructions...',
}) {
    const { auth } = usePage().props;
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        customer_name: auth?.user?.name || '',
        customer_phone: auth?.user?.phone_number || '',
        customer_email: auth?.user?.email || '',
        preferred_date: '',
        preferred_time: '',
        location_text: '',
        message: '',
    });

    if (!open) return null;

    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const submit = async (event) => {
        event.preventDefault();

        if (!form.customer_name.trim()) {
            toast.error('Please enter your name.');
            return;
        }

        if (!form.customer_phone.trim() && !form.customer_email.trim()) {
            toast.error('Please enter a phone number or email.');
            return;
        }

        setSubmitting(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const bearerToken = localStorage.getItem('takeer_token');
            const headers = {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': token || '',
            };

            if (bearerToken) {
                headers.Authorization = `Bearer ${bearerToken}`;
            }

            const response = await fetch('/api/service-requests', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    product_id: product.id,
                    request_type: requestType,
                    module_payload: modulePayload,
                    ...form,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request could not be sent.');
            }

            toast.success(data.message || 'Request sent.');
            onOpenChange(false);
        } catch (error) {
            toast.error(error.message || 'Request could not be sent.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-brand-700">{title}</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">{product?.title}</h2>
                    </div>
                    <button type="button" onClick={() => onOpenChange(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Name</span>
                        <Input value={form.customer_name} onChange={(event) => update('customer_name', event.target.value)} className="h-11" required />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Phone</span>
                        <Input value={form.customer_phone} onChange={(event) => update('customer_phone', event.target.value)} className="h-11" />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email</span>
                        <Input type="email" value={form.customer_email} onChange={(event) => update('customer_email', event.target.value)} className="h-11" />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Preferred date</span>
                        <Input type="date" value={form.preferred_date} onChange={(event) => update('preferred_date', event.target.value)} className="h-11" />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Preferred time</span>
                        <Input type="time" value={form.preferred_time} onChange={(event) => update('preferred_time', event.target.value)} className="h-11" />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Location or pickup note</span>
                        <Input value={form.location_text} onChange={(event) => update('location_text', event.target.value)} className="h-11" placeholder="Area, venue, pickup point, or address" />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Details</span>
                        <Textarea value={form.message} onChange={(event) => update('message', event.target.value)} className="min-h-28" placeholder={messagePlaceholder} />
                    </label>
                </div>

                <div className="mt-5 flex gap-2">
                    <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl font-black" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" className="h-12 flex-1 rounded-xl font-black" disabled={submitting}>
                        {submitting ? 'Sending...' : submitLabel}
                    </Button>
                </div>
            </form>
        </div>
    );
}
