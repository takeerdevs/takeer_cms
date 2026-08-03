import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';

function ShippingProfileSelect({
    shippingProfiles,
    selectedShippingProfileId,
    setSelectedShippingProfileId,
}) {
    const { copy } = useLocale();
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy('Shipping Profile (Template)', 'Profile ya usafirishaji (Template)')}</label>
            <select
                className="h-12 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold text-brand-700"
                value={selectedShippingProfileId}
                onChange={(e) => setSelectedShippingProfileId(e.target.value)}
            >
                <option value="">{copy('Choose a shipping profile...', 'Chagua profile ya usafirishaji...')}</option>
                {shippingProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                        {profile.name} {profile.is_default ? `(${copy('Default', 'Kawaida')})` : ''}
                    </option>
                ))}
            </select>
            <p className="text-[10px] italic text-muted-foreground">{copy('These templates are configured in Settings > Shipping Profiles.', 'Templates hizi zimewekwa kwenye Settings > Shipping Profiles.')}</p>
        </div>
    );
}

export default function PhysicalPublishPanel({
    children,
    boxed = true,
    title = 'Bei & Usafirishaji',
    subtitle = 'Hakiki bei na template ya usafirishaji kabla ya kuweka bidhaa sokoni.',
    summary = null,
    showShippingProfile = true,
    shippingProfiles,
    selectedShippingProfileId,
    setSelectedShippingProfileId,
    deliveryPromiseOverride = null,
    faqEditor = null,
    onPublish,
    disabledReason,
}) {
    const content = (
        <>
            {summary}
            {showShippingProfile && (
                <ShippingProfileSelect
                    shippingProfiles={shippingProfiles}
                    selectedShippingProfileId={selectedShippingProfileId}
                    setSelectedShippingProfileId={setSelectedShippingProfileId}
                />
            )}
            {deliveryPromiseOverride}
            {children}
        </>
    );

    return (
        <>
            {boxed ? (
                <div className="space-y-4 rounded-2xl border border-brand-100 bg-white p-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-slate-700">{title === 'Bei & Usafirishaji' ? copy('Price & shipping', 'Bei & Usafirishaji') : title}</p>
                        {subtitle && <p className="text-xs text-slate-500">{subtitle === 'Hakiki bei na template ya usafirishaji kabla ya kuweka bidhaa sokoni.' ? copy('Review the price and shipping template before publishing the product.', subtitle) : subtitle}</p>}
                    </div>
                    {content}
                </div>
            ) : (
                content
            )}

            {faqEditor}
            <Button
                className="h-14 w-full rounded-xl bg-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
                onClick={onPublish}
                disabled={Boolean(disabledReason)}
            >
                {copy('Publish to shop', 'Weka sokoni')} <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            {disabledReason && (
                <p className="text-center text-xs font-semibold text-slate-500">{disabledReason}</p>
            )}
        </>
    );
}
