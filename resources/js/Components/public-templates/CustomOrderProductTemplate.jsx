import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,
    Clock3,
    ClipboardList,
    Minus,
    Package,
    PenLine,
    Plus,
    ShieldCheck,
    Store,
    Truck,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import ServiceRequestModal from './ServiceRequestModal';

export default function CustomOrderProductTemplate({ product }) {
    const [quantity, setQuantity] = useState(Number(product?.module_details?.minimum_order || 1));
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || product?.service_details || {};
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const image = product?.images?.[0]?.image_url || product?.images?.[0]?.thumbnail_url || product?.image_url;
    const minimumOrder = Number(details.minimum_order || 1);
    const unitPrice = Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = unitPrice * quantity;
    const quotePolicy = String(details.quote_policy || 'quote_after_request').replace(/_/g, ' ');

    const openQuoteRequest = () => {
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-[#fbfaf7] pb-28 text-slate-950">
                <section className="relative min-h-[440px] overflow-hidden bg-slate-950 text-white">
                    {image ? (
                        <img src={image} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#a855f7,#111827_58%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
                    <div className="relative z-10 mx-auto flex min-h-[440px] max-w-5xl flex-col justify-between p-4 md:p-8">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="max-w-4xl">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <PenLine className="h-3.5 w-3.5" />
                                    Custom order
                                </span>
                                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur capitalize">
                                    {quotePolicy}
                                </span>
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                {details.lead_time && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{details.lead_time}</span>}
                                {minimumOrder > 1 && <span className="inline-flex items-center gap-1.5"><Package className="h-4 w-4" />Minimum {minimumOrder}</span>}
                                {merchant?.display_name && <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4" />{merchant.display_name}</span>}
                            </div>
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">About this custom order</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'Share your requirements and the merchant will confirm the quote, timeline, and fulfillment details.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={ClipboardList} label="Quote flow" value={quotePolicy} />
                                <Stat icon={Clock3} label="Lead time" value={details.lead_time || 'After request'} />
                                <Stat icon={Package} label="Minimum" value={minimumOrder > 1 ? minimumOrder : 'None'} />
                            </div>
                        </section>

                        {details.customization_notes && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">What to specify</h2>
                                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.customization_notes}</p>
                            </section>
                        )}

                        {details.pickup_delivery_notes && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <div className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-slate-500" />
                                    <h2 className="text-lg font-black">Pickup or delivery</h2>
                                </div>
                                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.pickup_delivery_notes}</p>
                            </section>
                        )}

                        <section className="rounded-2xl bg-purple-50 p-5 text-purple-950 ring-1 ring-purple-100">
                            <h2 className="text-lg font-black">How this request works</h2>
                            <div className="mt-4 space-y-3">
                                {['Send your quantity and request details.', 'Merchant confirms price, timeline, and pickup or delivery.', 'Payment and fulfillment are handled through Takeer once confirmed.'].map((step, index) => (
                                    <div key={step} className="flex gap-3 text-sm font-semibold">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black">{index + 1}</span>
                                        <span className="pt-1">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {merchantSlug && (
                            <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                                        <Store className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-black">{merchant?.display_name || 'Custom order provider'}</p>
                                        <p className="text-sm text-slate-500">View more from this business</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Link>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">{unitPrice > 0 ? 'Starting price' : 'Quote request'}</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">{unitPrice > 0 ? `TZS ${unitPrice.toLocaleString()}` : 'Confirm quote'}</p>
                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setQuantity((value) => Math.max(minimumOrder, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Minus className="h-4 w-4" />
                                </button>
                                <div className="text-center">
                                    <p className="text-lg font-black">{quantity}</p>
                                    <p className="text-[11px] font-bold uppercase text-slate-500">quantity</p>
                                </div>
                                <button type="button" onClick={() => setQuantity((value) => Math.min(100000, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            {minimumOrder > 1 && <p className="mt-2 text-xs font-semibold text-slate-500">Minimum order quantity is {minimumOrder}.</p>}
                            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-white/70">Estimated total</span>
                                    <span className="text-xl font-black">{total > 0 ? `TZS ${Number(total).toLocaleString()}` : 'TBC'}</span>
                                </div>
                            </div>
                            <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" onClick={openQuoteRequest}>
                                <Zap className="mr-2 h-5 w-5" />
                                Request quote
                            </Button>
                        </section>

                        <section className="rounded-2xl bg-emerald-50 p-4 text-emerald-950 ring-1 ring-emerald-100">
                            <div className="flex gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Custom order protected</p>
                                    <p className="mt-1 text-sm text-emerald-900/75">Confirm scope, price, delivery terms, and revisions before work starts.</p>
                                </div>
                            </div>
                        </section>
                    </aside>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
                    <div className="mx-auto flex max-w-5xl items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase text-slate-500">Estimated total</p>
                            <p className="truncate text-lg font-black text-brand-700">{total > 0 ? `TZS ${Number(total).toLocaleString()}` : 'TBC'}</p>
                        </div>
                        <Button className="h-12 rounded-xl font-black" onClick={openQuoteRequest}>
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Request
                        </Button>
                    </div>
                </div>
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="custom_order_request"
                    title="Request custom order"
                    submitLabel="Send quote request"
                    modulePayload={{
                        custom_order_quantity: quantity,
                        custom_order_quote_policy: details.quote_policy || 'quote_after_request',
                    }}
                    messagePlaceholder="Describe size, colors, wording, files, delivery date, budget, or any special details..."
                />
            </div>
        </AppLayout>
    );
}

function Stat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4">
            <Icon className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="text-base font-black capitalize">{value}</p>
        </div>
    );
}
