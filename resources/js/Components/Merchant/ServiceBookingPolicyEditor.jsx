import React from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/Components/ui/Input';

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
    return (
        <div className="space-y-3 rounded-2xl border p-3 sm:p-4">
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking policy</label>
                <p className="mt-1 text-xs text-muted-foreground">
                    Standard for every service. Choose whether customers request first, wait for your confirmation, or book/pay instantly.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service duration</span>
                        <p className="text-[10px] text-muted-foreground">How long does one booking/session usually take? Used to create booking slots.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            type="number"
                            min="1"
                            placeholder="Mf. 1"
                            value={serviceDurationValue}
                            onChange={(e) => setServiceDurationValue(e.target.value)}
                            className="h-11 font-bold"
                        />
                        <select
                            className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                            value={serviceDurationUnit}
                            onChange={(e) => setServiceDurationUnit(e.target.value)}
                        >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
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
                            Saved as {Number(serviceDurationMinutes).toLocaleString()} minutes.
                        </p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booking Confirmation flow</span>
                    <select
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                        value={serviceBookingType}
                        onChange={(e) => setServiceBookingType(e.target.value)}
                    >
                        <option value="request">Request First</option>
                        <option value="manual_confirm">Manual Confirm</option>
                        <option value="instant">Instant</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Advance / deposit</span>
                        <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-purple-200 bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100"
                            onClick={() => setShowServiceDepositInfo((value) => !value)}
                            aria-label="Show advance deposit explanation"
                            aria-expanded={showServiceDepositInfo}
                        >
                            <Info className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <Input
                        type="number"
                        placeholder="Mf. 30000"
                        value={serviceDepositAmount}
                        onChange={(e) => setServiceDepositAmount(e.target.value)}
                        className="h-11 font-bold"
                    />
                    {showServiceDepositInfo && (
                        <p className="rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2 text-[10px] leading-snug text-purple-800">
                            Optional amount customer pays now to secure the service. It becomes the checkout amount for this listing and should be treated as advance paid toward the service.
                        </p>
                    )}
                </div>
                <label className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Buffer after booking</span>
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capacity per slot</span>
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preparation notes</span>
                    <Input
                        placeholder="Arrive 10 minutes early, bring documents..."
                        value={serviceDetails.preparation_notes || ''}
                        onChange={(e) => updateServiceDetail('preparation_notes', e.target.value)}
                        className="h-11 font-bold"
                    />
                </label>
            </div>
        </div>
    );
}
