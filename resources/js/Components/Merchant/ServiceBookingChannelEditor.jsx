import React from 'react';
import { Calendar, ExternalLink, MessageCircle, Phone } from 'lucide-react';
import { Input } from '@/Components/ui/Input';

export default function ServiceBookingChannelEditor({
    serviceBookingMode,
    setServiceBookingMode,
    serviceBookingProvider,
    setServiceBookingProvider,
    serviceContactType,
    setServiceContactType,
    serviceContactValue,
    setServiceContactValue,
    url,
    setUrl,
}) {
    return (
        <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
            <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Namna ya kushughulika na wateja</label>
                <p className="text-xs text-muted-foreground mt-1">
                    Chagua sehemu ambayo booking/request zitasimamiwa baada ya mteja kuonyesha interest.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setServiceBookingMode('takeer');
                        setServiceBookingProvider('manual');
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${serviceBookingMode === 'takeer'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-border text-muted-foreground hover:border-purple-200'
                        }`}
                >
                    <Calendar className="h-5 w-5 shrink-0" />
                    <span>
                        <span className="block text-sm font-black">Takeer Booking</span>
                        <span className="block text-[11px]">Slots, requests, calendar, na customers ndani ya Takeer</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setServiceBookingMode('internal');
                        setServiceBookingProvider('manual');
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${serviceBookingMode === 'internal'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-border text-muted-foreground hover:border-purple-200'
                        }`}
                >
                    <Phone className="h-5 w-5 shrink-0" />
                    <span>
                        <span className="block text-sm font-black">Simu/WhatsApp</span>
                        <span className="block text-[11px]">Mteja awasiliane au apange nawe moja kwa moja</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setServiceBookingMode('external');
                        setServiceBookingProvider('external');
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${serviceBookingMode === 'external'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-border text-muted-foreground hover:border-purple-200'
                        }`}
                >
                    <ExternalLink className="h-5 w-5 shrink-0" />
                    <span>
                        <span className="block text-sm font-black">Link ya Booking</span>
                        <span className="block text-[11px]">Calendly, Google Forms, WhatsApp link, website</span>
                    </span>
                </button>
            </div>

            {serviceBookingMode === 'takeer' && (
                <div className="animate-in fade-in rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                    <p className="font-black">Takeer itasimamia booking/request dashboard.</p>
                    <p className="text-xs mt-1 text-emerald-800">
                        Wateja watajaza form, kuchagua slot inapowezekana, na request itaonekana kwenye merchant calendar. Google Calendar itaweza kusync baadaye ukishaunganisha.
                    </p>
                </div>
            )}

            {serviceBookingMode === 'internal' && (
                <div className="animate-in fade-in space-y-3">
                    <div className="flex gap-2">
                        {[
                            { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                            { key: 'phone', label: 'Simu', icon: Phone },
                        ].map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setServiceContactType(key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all ${serviceContactType === key
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-background text-muted-foreground border-border hover:border-purple-300'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />{label}
                            </button>
                        ))}
                    </div>
                    <Input
                        type="tel"
                        placeholder="+255 7XX XXX XXX"
                        value={serviceContactValue}
                        onChange={e => setServiceContactValue(e.target.value)}
                        className="h-12 text-lg font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Takeer itatumia hii kama njia kuu ya mteja kuanza mazungumzo au kupanga miadi.
                    </p>
                </div>
            )}

            {serviceBookingMode === 'external' && (
                <div className="animate-in fade-in space-y-1.5">
                    <Input
                        placeholder="https://calendly.com/jina-lako"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        className="h-12 font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Inaweza kuwa Calendly, Google Forms, WhatsApp link, website yako, au booking system nyingine.
                    </p>
                </div>
            )}

            {serviceBookingProvider === 'google_calendar' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    Google Calendar integration iko kwenye foundation, lakini OAuth bado haijaunganishwa. Kwa sasa tumia Manual au External link.
                </div>
            )}
        </div>
    );
}
