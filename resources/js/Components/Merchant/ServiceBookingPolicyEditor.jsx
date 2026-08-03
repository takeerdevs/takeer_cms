import React from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

export default function ServiceBookingPolicyEditor({
    serviceDurationValue,
    setServiceDurationValue,
    serviceDurationUnit,
    setServiceDurationUnit,
    serviceDurationPresets,
    serviceDurationMinutes,
    serviceBookingType,
    setServiceBookingType,
    serviceDepositAmount,
    setServiceDepositAmount,
    showServiceDepositInfo,
    setShowServiceDepositInfo,
    serviceDetails,
    updateServiceDetail,
}) {
    const { copy } = useLocale();
    return (
        <div className="space-y-3 rounded-2xl border p-3 sm:p-4">
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy('Booking policy', 'Sera ya booking')}</label>
                <p className="mt-1 text-xs text-muted-foreground">
                    {copy('Standard for every service. Choose whether customers request first, wait for your confirmation, or book/pay instantly.', 'Kawaida kwa kila huduma. Chagua kama wateja waombe kwanza, wasubiri uthibitisho wako, au wa-book/lipie moja kwa moja.')}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{copy('Service duration', 'Muda wa huduma')}</span>
                        <p className="text-[10px] text-muted-foreground">{copy('How long does one booking/session usually take? Used to create booking slots.', 'Booking/session moja huchukua muda gani? Hii hutumika kutengeneza slots za booking.')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            type="number"
                            min="1"
                            placeholder={copy('E.g. 1', 'Mf. 1')}
                            value={serviceDurationValue}
                            onChange={(e) => setServiceDurationValue(e.target.value)}
                            className="h-11 font-bold"
                        />
                        <select
                            className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                            value={serviceDurationUnit}
                            onChange={(e) => setServiceDurationUnit(e.target.value)}
                        >
                            <option value="minutes">{copy('Minutes', 'Dakika')}</option>
                            <option value="hours">{copy('Hours', 'Masaa')}</option>
                            <option value="days">{copy('Days', 'Siku')}</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {serviceDurationPresets.map((preset) => {
                            const selected = String(serviceDurationValue) === String(preset.value) && serviceDurationUnit === preset.unit;
                            return (
                                <button
                                    key={`${preset.label}-${preset.value}-${preset.unit}`}
                                    type="button"
                                    onClick={() => {
                                        setServiceDurationValue(String(preset.value));
                                        setServiceDurationUnit(preset.unit);
                                    }}
                                    className={`min-h-9 rounded-lg border px-2 text-[10px] font-black transition-colors ${selected
                                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                                        : 'border-border bg-background text-muted-foreground hover:border-purple-300'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                    {serviceDurationMinutes && (
                        <p className="text-[10px] font-semibold text-purple-700">
                            {copy('Saved as', 'Imehifadhiwa kama')} {Number(serviceDurationMinutes).toLocaleString()} {copy('minutes.', 'dakika.')}
                        </p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{copy('Booking confirmation flow', 'Mtiririko wa uthibitisho wa booking')}</span>
                    <select
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                        value={serviceBookingType}
                        onChange={(e) => setServiceBookingType(e.target.value)}
                    >
                        <option value="request">{copy('Request first', 'Ombi kwanza')}</option>
                        <option value="manual_confirm">{copy('Manual confirm', 'Uthibitisho wa manual')}</option>
                        <option value="instant">{copy('Instant', 'Moja kwa moja')}</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{copy('Advance / deposit', 'Advance / deposit')}</span>
                        <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-purple-200 bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100"
                            onClick={() => setShowServiceDepositInfo((value) => !value)}
                            aria-label={copy('Show advance deposit explanation', 'Onyesha maelezo ya advance deposit')}
                            aria-expanded={showServiceDepositInfo}
                        >
                            <Info className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <Input
                        type="number"
                        placeholder={copy('E.g. 30000', 'Mf. 30000')}
                        value={serviceDepositAmount}
                        onChange={(e) => setServiceDepositAmount(e.target.value)}
                        className="h-11 font-bold"
                    />
                    {showServiceDepositInfo && (
                        <p className="rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2 text-[10px] leading-snug text-purple-800">
                            {copy('Optional amount customer pays now to secure the service. It becomes the checkout amount for this listing and should be treated as advance paid toward the service.', 'Ni kiasi cha hiari ambacho mteja analipa sasa kuthibitisha huduma. Kinakuwa kiasi cha checkout na kihesabiwe kama advance ya huduma.')}
                        </p>
                    )}
                </div>
                <label className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{copy('Buffer after booking', 'Muda wa ziada baada ya booking')}</span>
                    <Input
                        type="number"
                        min="0"
                        placeholder="15"
                        value={serviceDetails.buffer_minutes ?? ''}
                        onChange={(e) => updateServiceDetail('buffer_minutes', e.target.value)}
                        className="h-11 font-bold"
                    />
                </label>
                <label className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{copy('Capacity per slot', 'Uwezo kwa slot')}</span>
                    <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={serviceDetails.capacity ?? ''}
                        onChange={(e) => updateServiceDetail('capacity', e.target.value)}
                        className="h-11 font-bold"
                    />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{copy('Preparation notes', 'Maelezo ya maandalizi')}</span>
                    <Input
                        placeholder={copy('Arrive 10 minutes early, bring documents...', 'Fika dakika 10 mapema, leta nyaraka...')}
                        value={serviceDetails.preparation_notes || ''}
                        onChange={(e) => updateServiceDetail('preparation_notes', e.target.value)}
                        className="h-11 font-bold"
                    />
                </label>
            </div>
        </div>
    );
}
