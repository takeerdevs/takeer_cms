import React from 'react';
import { MapPin, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { RepeatableTextList } from '@/Components/Merchant/ServiceModuleCreateFields';

export default function ServiceIntakeFormEditor({
    serviceClientRequirements,
    setServiceClientRequirements,
    automaticCustomerLocationField,
    serviceIntakeForm,
    intakeFieldTypes,
    addServiceIntakeField,
    updateServiceIntakeField,
    removeServiceIntakeField,
}) {
    return (
        <div className="rounded-2xl border p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taarifa unazohitaji kutoka kwa mteja</label>
                    <p className="text-xs text-muted-foreground mt-1">Build a simple form that customers fill before sending a request.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addServiceIntakeField}>
                    <Plus className="h-4 w-4 mr-1" /> Add field
                </Button>
            </div>
            <Textarea
                placeholder="Fallback instructions, e.g. picha za tatizo, address, preferred date..."
                value={serviceClientRequirements}
                onChange={(e) => setServiceClientRequirements(e.target.value)}
                className="min-h-[86px] text-sm"
            />
            {automaticCustomerLocationField && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-3 h-11 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-900 flex items-center justify-between">
                            <span>Map location</span>
                            <MapPin className="h-4 w-4 text-emerald-700" />
                        </div>
                        <Input
                            className="md:col-span-5 h-11 border-emerald-200 bg-white font-semibold text-emerald-900"
                            value={automaticCustomerLocationField.label}
                            disabled
                            readOnly
                        />
                        <Input
                            className="md:col-span-3 h-11 border-emerald-200 bg-white text-emerald-900"
                            value={automaticCustomerLocationField.placeholder}
                            disabled
                            readOnly
                        />
                        <div className="md:col-span-1 h-11 rounded-xl border border-emerald-200 bg-white text-emerald-700 flex items-center justify-center">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-800">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={Boolean(automaticCustomerLocationField.required)} readOnly disabled />
                            Required
                        </label>
                        <span className="rounded-full bg-white/80 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            Locked system field
                        </span>
                        <span className="text-emerald-700">
                            Added from service location type
                        </span>
                    </div>
                </div>
            )}
            {serviceIntakeForm.length > 0 && (
                <div className="space-y-2">
                    {serviceIntakeForm.map((field, index) => (
                        <div key={field.id || index} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                <select
                                    className="md:col-span-3 h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                    value={field.type}
                                    onChange={(e) => updateServiceIntakeField(index, { type: e.target.value })}
                                >
                                    {intakeFieldTypes.map((type) => (
                                        <option key={type.key} value={type.key}>{type.label}</option>
                                    ))}
                                </select>
                                <Input
                                    className="md:col-span-5 h-11"
                                    placeholder="Question label"
                                    value={field.label || ''}
                                    onChange={(e) => updateServiceIntakeField(index, {
                                        label: e.target.value,
                                        id: field.id?.startsWith('field_')
                                            ? e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || field.id
                                            : field.id,
                                    })}
                                />
                                <Input
                                    className="md:col-span-3 h-11"
                                    placeholder="Placeholder"
                                    value={field.placeholder || ''}
                                    onChange={(e) => updateServiceIntakeField(index, { placeholder: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeServiceIntakeField(index)}
                                    className="md:col-span-1 h-11 rounded-xl border bg-background text-muted-foreground hover:text-red-600"
                                >
                                    <Trash2 className="h-4 w-4 mx-auto" />
                                </button>
                            </div>
                            {field.type === 'select' && (
                                <RepeatableTextList
                                    label="Options"
                                    value={field.options}
                                    onChange={(value) => updateServiceIntakeField(index, { options: value })}
                                    addLabel="Add option"
                                    placeholder="Write one selectable option..."
                                />
                            )}
                            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={Boolean(field.required)}
                                    onChange={(e) => updateServiceIntakeField(index, { required: e.target.checked })}
                                />
                                Required
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
