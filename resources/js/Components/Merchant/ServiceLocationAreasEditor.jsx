import React from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

export default function ServiceLocationAreasEditor({
    serviceLocationOptions,
    serviceLocationType,
    setServiceLocationType,
    serviceProviderLocation,
    setServiceProviderLocation,
    setServiceProviderLocationPickerOpen,
    serviceAreaList,
    serviceAreasHelperText,
    serviceAreaDraft,
    setServiceAreaDraft,
    addServiceArea,
    removeServiceArea,
}) {
    const { copy } = useLocale();
    const hasProviderLocationFields = ['provider_location', 'customer_location', 'hybrid'].includes(serviceLocationType);

    return (
        <div className="grid grid-cols-1 gap-4">
            <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Where is the service provided?', 'Huduma inatolewa wapi?')}</label>
                <div className="grid grid-cols-2 gap-2">
                    {serviceLocationOptions.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setServiceLocationType(option.key)}
                            className={`min-h-11 px-2 rounded-xl text-xs font-bold border transition-all ${serviceLocationType === option.key
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-background text-muted-foreground border-border hover:border-purple-300'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {hasProviderLocationFields && (
                    <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                            {serviceLocationType === 'customer_location' ? copy('Service base for Near me', 'Base ya huduma kwa Near me') : copy('Provider venue', 'Eneo la provider')}
                        </p>
                        {serviceProviderLocation?.address ? (
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{serviceProviderLocation.address}</p>
                                {serviceProviderLocation.extraDetails && (
                                    <p className="text-xs text-muted-foreground">{serviceProviderLocation.extraDetails}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {serviceLocationType === 'customer_location'
                                    ? copy('Add your service base or main coverage point so nearby customers can discover you.', 'Ongeza base ya huduma au sehemu kuu ya coverage ili wateja wa karibu wakupate.')
                                    : copy('Add where customers should come for this service.', 'Ongeza mahali ambapo wateja waje kwa huduma hii.')}
                            </p>
                        )}
                        <Input
                            placeholder={serviceLocationType === 'customer_location' ? 'Base name, e.g. Mikocheni coverage base' : 'Venue name, e.g. Main Clinic, Studio A'}
                            value={serviceProviderLocation?.name || ''}
                            onChange={(e) => setServiceProviderLocation((prev) => ({
                                ...(prev || {}),
                                name: e.target.value,
                            }))}
                            className="h-10 text-sm"
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-xl flex-1"
                                onClick={() => setServiceProviderLocationPickerOpen(true)}
                            >
                                <MapPin className="h-4 w-4 mr-1" /> {serviceLocationType === 'customer_location' ? copy('Pick base', 'Chagua base') : copy('Pick venue', 'Chagua eneo')}
                            </Button>
                            {serviceProviderLocation?.address && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl"
                                    onClick={() => setServiceProviderLocation(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div className="col-span-full w-full rounded-2xl border p-3 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{copy('Service areas', 'Maeneo ya huduma')}</label>
                        <p className="text-xs text-muted-foreground mt-1">{serviceAreasHelperText}</p>
                    </div>
                    {serviceAreaList.length > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 w-max">
                            {serviceAreaList.length} {copy(serviceAreaList.length === 1 ? 'area' : 'areas', serviceAreaList.length === 1 ? 'eneo' : 'maeneo')}
                        </span>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder={copy('Dar es Salaam, Mwanza, Online...', 'Dar es Salaam, Mwanza, Mtandaoni...')}
                        value={serviceAreaDraft}
                        onChange={(e) => setServiceAreaDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addServiceArea();
                            }
                        }}
                        className="h-11 text-sm"
                    />
                    <Button type="button" variant="outline" className="h-11 rounded-xl sm:w-32" onClick={addServiceArea}>
                        <Plus className="h-4 w-4 mr-1" /> {copy('Add', 'Ongeza')}
                    </Button>
                </div>
                {serviceAreaList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {serviceAreaList.map((area) => (
                            <span key={area} className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 text-[11px] font-bold">
                                {area}
                                <button type="button" onClick={() => removeServiceArea(area)} className="rounded-full hover:bg-purple-100">
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
