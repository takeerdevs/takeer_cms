import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { getUploadModuleConfig } from '@/lib/uploadModules';

const FieldLabel = ({ children }) => (
    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{children}</span>
);

const SelectField = ({ label, value, onChange, children }) => (
    <label className="space-y-1.5">
        <FieldLabel>{label}</FieldLabel>
        <select
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        >
            {children}
        </select>
    </label>
);

const TextField = ({ label, value, onChange, ...props }) => (
    <label className="space-y-1.5">
        <FieldLabel>{label}</FieldLabel>
        <Input className="h-11" value={value || ''} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
);

const TextAreaField = ({ label, value, onChange, ...props }) => (
    <label className="space-y-1.5">
        <FieldLabel>{label}</FieldLabel>
        <Textarea value={value || ''} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
);

const SectionHeading = ({ title, description }) => (
    <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">{title}</p>
        {description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{description}</p>}
    </div>
);

const RESERVATION_TYPE_OPTIONS = [
    { value: 'table', label: 'Meza' },
    { value: 'private_room', label: 'Chumba cha private' },
    { value: 'venue', label: 'Venue' },
    { value: 'seat', label: 'Kiti' },
    { value: 'booth', label: 'Booth' },
    { value: 'visit', label: 'Ziara / muda wa kuingia' },
    { value: 'other', label: 'Nyingine' },
];

const SEATING_TYPE_OPTIONS = [
    'Seating ya kawaida',
    'Ndani',
    'Nje',
    'VIP',
    'Private',
    'Counter',
    'Kusimama',
    'General admission',
];

export function RepeatableTextList({ label, value, onChange, addLabel = 'Ongeza', placeholder = 'Ongeza maelezo...' }) {
    const rows = Array.isArray(value) && value.length > 0 ? value : [''];
    const updateRow = (index, nextValue) => {
        onChange(rows.map((row, rowIndex) => rowIndex === index ? nextValue : row));
    };
    const removeRow = (index) => {
        const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
        onChange(nextRows.length > 0 ? nextRows : ['']);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <FieldLabel>{label}</FieldLabel>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl px-2 text-xs font-black" onClick={() => onChange([...rows, ''])}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
                </Button>
            </div>
            <div className="space-y-2">
                {rows.map((row, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_2.75rem]">
                        <Textarea
                            value={row || ''}
                            onChange={(event) => updateRow(index, event.target.value)}
                            placeholder={placeholder}
                            className="min-h-20"
                        />
                        <button
                            type="button"
                            className="h-11 rounded-xl border bg-white text-muted-foreground hover:text-red-600 disabled:cursor-default disabled:opacity-30"
                            onClick={() => removeRow(index)}
                            disabled={rows.length === 1 && !row}
                            aria-label={`Ondoa ${label.toLowerCase()}`}
                        >
                            <Trash2 className="mx-auto h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ServiceModuleCreateFields({
    moduleKey,
    roomDetails,
    setRoomDetails,
    serviceDetails,
    updateServiceDetail,
    serviceDurationValue,
    setServiceDurationValue,
    serviceDurationUnit,
    setServiceDurationUnit,
    roomTypeOptions,
    bedTypeOptions,
    roomAmenityOptions,
    roomAvailabilityOptions,
    roomBookingPolicyOptions,
}) {
    const moduleConfig = getUploadModuleConfig(moduleKey);

    if (!moduleConfig || moduleConfig.type !== 'service') return null;

    const updateRoom = (key, value) => {
        setRoomDetails((prev) => ({ ...(prev || {}), [key]: value }));
    };
    const durationFields = (
        <div className="grid grid-cols-2 gap-3">
            <TextField label="Duration" type="number" min="1" value={serviceDurationValue} onChange={setServiceDurationValue} placeholder="1" />
            <SelectField label="Kipimo cha muda" value={serviceDurationUnit} onChange={setServiceDurationUnit}>
                <option value="minutes">Dakika</option>
                <option value="hours">Masaa</option>
                <option value="days">Siku</option>
            </SelectField>
        </div>
    );
    return (
        <div className="rounded-2xl border border-purple-100 bg-white p-3 sm:p-4 space-y-4">
            <div>
                <p className="text-xs font-black uppercase tracking-wider text-purple-700">{moduleConfig.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Maelezo haya ni maalum kwa aina hii ya huduma.</p>
            </div>

            {moduleKey === 'rooms' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Aina ya chumba" value={roomDetails.room_type || 'Standard room'} onChange={(value) => updateRoom('room_type', value)}>
                            {roomTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SelectField>
                        <SelectField label="Aina ya kitanda" value={roomDetails.bed_type || 'Double bed'} onChange={(value) => updateRoom('bed_type', value)}>
                            {bedTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SelectField>
                        <TextField label="Idadi ya wageni" type="number" min="1" value={roomDetails.max_guests} onChange={(value) => updateRoom('max_guests', value)} />
                        <TextField label="Vyumba vilivyopo" type="number" min="1" value={roomDetails.room_count} onChange={(value) => updateRoom('room_count', value)} />
                        <TextField label="Bafu" type="number" min="0" value={roomDetails.bathrooms} onChange={(value) => updateRoom('bathrooms', value)} />
                        <TextField label="Muda wa kuingia" type="time" value={roomDetails.checkin_time} onChange={(value) => updateRoom('checkin_time', value)} />
                        <TextField label="Muda wa kutoka" type="time" value={roomDetails.checkout_time} onChange={(value) => updateRoom('checkout_time', value)} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {roomAmenityOptions.map((option) => {
                            const selected = (roomDetails.amenities || []).includes(option.key);
                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => updateRoom('amenities', selected ? (roomDetails.amenities || []).filter((item) => item !== option.key) : [...(roomDetails.amenities || []), option.key])}
                                    className={`min-h-10 rounded-xl border px-3 text-xs font-black ${selected ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 text-muted-foreground'}`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {roomAvailabilityOptions.map((option) => {
                            const selected = (roomDetails.availability || []).includes(option.key);
                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => updateRoom('availability', selected ? (roomDetails.availability || []).filter((item) => item !== option.key) : [...(roomDetails.availability || []), option.key])}
                                    className={`min-h-10 rounded-xl border px-3 text-xs font-black ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-muted-foreground'}`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <TextAreaField label="Sheria za nyumba" value={serviceDetails.house_rules} onChange={(value) => updateServiceDetail('house_rules', value)} className="min-h-24" />
                    <TextAreaField label="Sera ya cancellation" value={serviceDetails.cancellation_policy} onChange={(value) => updateServiceDetail('cancellation_policy', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'tour_departures' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Mahali pa kwenda" value={serviceDetails.destination} onChange={(value) => updateServiceDetail('destination', value)} placeholder="Serengeti + Ngorongoro" />
                        <TextField label="Muda wa safari" value={serviceDetails.duration_label} onChange={(value) => updateServiceDetail('duration_label', value)} placeholder="Siku 3 / usiku 2" />
                        <TextField label="Mahali pa kuchukuliwa" value={serviceDetails.pickup_point} onChange={(value) => updateServiceDetail('pickup_point', value)} />
                        <TextField label="Mahali pa kushushwa" value={serviceDetails.dropoff_point} onChange={(value) => updateServiceDetail('dropoff_point', value)} />
                        <TextField label="Viti / ukubwa wa group" type="number" min="1" value={serviceDetails.group_size} onChange={(value) => updateServiceDetail('group_size', value)} />
                        <SelectField label="Aina ya safari" value={serviceDetails.departure_type || 'scheduled'} onChange={(value) => updateServiceDetail('departure_type', value)}>
                            <option value="scheduled">Ratiba zilizopangwa</option>
                            <option value="private">Safari ya private</option>
                            <option value="custom">Tarehe za kuchagua</option>
                        </SelectField>
                    </div>
                    <ItineraryEditor value={serviceDetails.itinerary || []} onChange={(value) => updateServiceDetail('itinerary', value)} />
                    <RepeatableTextList label="Vilivyojumuishwa" value={serviceDetails.included} onChange={(value) => updateServiceDetail('included', value)} addLabel="Ongeza" placeholder="Eleza kitu kilichojumuishwa..." />
                    <RepeatableTextList label="Visivyojumuishwa" value={serviceDetails.excluded} onChange={(value) => updateServiceDetail('excluded', value)} addLabel="Ongeza" placeholder="Eleza kitu kisichojumuishwa..." />
                    <TextAreaField label="Mahitaji ya msafiri" value={serviceDetails.requirements} onChange={(value) => updateServiceDetail('requirements', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'custom_orders' && (
                <div className="space-y-3">
                    <TextAreaField label="Maelezo ya customization" value={serviceDetails.customization_notes} onChange={(value) => updateServiceDetail('customization_notes', value)} className="min-h-24" />
                    <div className="grid gap-3 md:grid-cols-3">
                        <TextField label="Muda wa maandalizi" value={serviceDetails.lead_time} onChange={(value) => updateServiceDetail('lead_time', value)} placeholder="Taarifa masaa 24 kabla" />
                        <TextField label="Kima cha chini cha oda" type="number" min="1" value={serviceDetails.minimum_order} onChange={(value) => updateServiceDetail('minimum_order', value)} />
                        <SelectField label="Sera ya bei" value={serviceDetails.quote_policy || 'quote_after_request'} onChange={(value) => updateServiceDetail('quote_policy', value)}>
                            <option value="quote_after_request">Bei baada ya ombi</option>
                            <option value="deposit_before_work">Deposit kabla ya kazi</option>
                            <option value="full_payment_after_quote">Malipo yote baada ya bei</option>
                        </SelectField>
                    </div>
                    <TextAreaField label="Maelezo ya pickup au delivery" value={serviceDetails.pickup_delivery_notes} onChange={(value) => updateServiceDetail('pickup_delivery_notes', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'appointments' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Aina ya miadi" value={serviceDetails.appointment_type || 'consultation'} onChange={(value) => updateServiceDetail('appointment_type', value)}>
                            <option value="consultation">Ushauri</option>
                            <option value="treatment">Matibabu / care session</option>
                            <option value="assessment">Tathmini</option>
                            <option value="follow_up">Follow-up</option>
                            <option value="home_visit">Huduma ya nyumbani</option>
                            <option value="online_session">Online session</option>
                        </SelectField>
                        <SelectField label="Sera ya booking" value={serviceDetails.appointment_booking_policy || 'manual_confirm'} onChange={(value) => updateServiceDetail('appointment_booking_policy', value)}>
                            <option value="instant">Booking ya moja kwa moja</option>
                            <option value="manual_confirm">Uthibitisho wa manual</option>
                            <option value="request_first">Ombi kwanza</option>
                        </SelectField>
                    </div>
                    {durationFields}
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Muda wa mapumziko kabla / baada" value={serviceDetails.appointment_buffer} onChange={(value) => updateServiceDetail('appointment_buffer', value)} placeholder="Dakika 15 kati ya wateja" />
                        <TextField label="Capacity" type="number" min="1" value={serviceDetails.appointment_capacity || 1} onChange={(value) => updateServiceDetail('appointment_capacity', value)} />
                    </div>
                    <TextAreaField label="Kinachojumuishwa" value={serviceDetails.appointment_includes} onChange={(value) => updateServiceDetail('appointment_includes', value)} className="min-h-24" />
                    <TextAreaField label="Maandalizi ya mteja" value={serviceDetails.client_preparation} onChange={(value) => updateServiceDetail('client_preparation', value)} className="min-h-20" />
                    <RepeatableTextList label="Maswali ya awali" value={serviceDetails.intake_questions} onChange={(value) => updateServiceDetail('intake_questions', value)} addLabel="Ongeza swali" placeholder="Mteja ajibu nini kabla ya miadi?" />
                </div>
            )}

            {moduleKey === 'reservations' && (
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Aina ya reservation" value={serviceDetails.reservation_type || 'table'} onChange={(value) => updateServiceDetail('reservation_type', value)}>
                            {RESERVATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </SelectField>
                        <SelectField label="Aina ya seating" value={serviceDetails.seating_type || 'Standard seating'} onChange={(value) => updateServiceDetail('seating_type', value)}>
                            {SEATING_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SelectField>
                    </div>
                    {durationFields}
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Idadi ya watu" type="number" min="1" value={serviceDetails.party_size_limit} onChange={(value) => updateServiceDetail('party_size_limit', value)} />
                    </div>
                    <TextAreaField label="Maelezo ya reservation" value={serviceDetails.reservation_notes} onChange={(value) => updateServiceDetail('reservation_notes', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'rentals' && (
                <div className="space-y-5">
                    <div className="space-y-3">
                        <SectionHeading title="Kinachokodishwa" description="Chagua aina ya kitu na idadi inayoweza ku-bookiwa." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <SelectField label="Aina ya kukodisha" value={serviceDetails.rental_type || 'equipment'} onChange={(value) => updateServiceDetail('rental_type', value)}>
                                <option value="equipment">Vifaa</option>
                                <option value="vehicle">Gari / usafiri</option>
                                <option value="space">Space</option>
                                <option value="property">Nyumba / property</option>
                                <option value="event_gear">Vifaa vya tukio</option>
                                <option value="costume">Costume / props</option>
                                <option value="other">Nyingine</option>
                            </SelectField>
                            <TextField label="Idadi iliyopo" type="number" min="1" value={serviceDetails.available_units ?? 1} onChange={(value) => updateServiceDetail('available_units', value)} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Bei inahesabiwaje" description="Chagua namna mteja ataelewa bei ya kukodisha." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <SelectField label="Kipimo cha bei" value={serviceDetails.rental_unit || 'day'} onChange={(value) => updateServiceDetail('rental_unit', value)}>
                                <option value="hour">Kwa saa</option>
                                <option value="day">Kwa siku</option>
                                <option value="night">Kwa usiku</option>
                                <option value="week">Kwa wiki</option>
                                <option value="month">Kwa mwezi</option>
                                <option value="year">Kwa mwaka</option>
                                <option value="trip">Kwa safari</option>
                                <option value="event">Kwa tukio</option>
                            </SelectField>
                            <TextField label="Deposit inayoweza kurudishwa" type="number" min="0" value={serviceDetails.security_deposit} onChange={(value) => updateServiceDetail('security_deposit', value)} placeholder="Kiasi cha optional" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Muda wa kukodisha" description="Weka muda wa chini wa kukodisha." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <TextField label="Muda wa chini" type="number" min="1" value={serviceDurationValue} onChange={setServiceDurationValue} placeholder="1" />
                            <SelectField label="Kipimo cha muda" value={serviceDurationUnit} onChange={setServiceDurationUnit}>
                                <option value="minutes">Dakika</option>
                                <option value="hours">Masaa</option>
                                <option value="days">Siku</option>
                                <option value="weeks">Wiki</option>
                                <option value="months">Miezi</option>
                                <option value="years">Miaka</option>
                            </SelectField>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Vilivyojumuishwa" description="Ongeza kinachokuja na kukodisha, kama accessories, setup, au support." />
                        <RepeatableTextList label="Vilivyojumuishwa" value={serviceDetails.included_items} onChange={(value) => updateServiceDetail('included_items', value)} addLabel="Ongeza" placeholder="Eleza kitu kilichojumuishwa..." />
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Makabidhiano na mahitaji ya mteja" description="Eleza pickup, kurudisha, ID, deposit, uharibifu, au sheria za matumizi." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <TextAreaField label="Maelezo ya pickup / kurudisha" value={serviceDetails.pickup_return_notes} onChange={(value) => updateServiceDetail('pickup_return_notes', value)} className="min-h-24" />
                            <TextAreaField label="Mahitaji ya kukodisha" value={serviceDetails.rental_requirements} onChange={(value) => updateServiceDetail('rental_requirements', value)} className="min-h-24" />
                        </div>
                    </div>
                </div>
            )}

            {moduleKey === 'workshops' && (
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                        <SelectField label="Format" value={serviceDetails.workshop_format || 'live_session'} onChange={(value) => updateServiceDetail('workshop_format', value)}>
                            <option value="live_session">Live session</option>
                            <option value="cohort">Cohort</option>
                            <option value="bootcamp">Bootcamp</option>
                            <option value="webinar">Webinar</option>
                            <option value="in_person">Ana kwa ana</option>
                        </SelectField>
                        <TextField label="Idadi ya sessions" type="number" min="1" value={serviceDetails.session_count ?? 1} onChange={(value) => updateServiceDetail('session_count', value)} />
                        <TextField label="Capacity" type="number" min="1" value={serviceDetails.workshop_capacity} onChange={(value) => updateServiceDetail('workshop_capacity', value)} />
                    </div>
                    {durationFields}
                    <div className="grid gap-3 md:grid-cols-1">
                        <TextField label="Level" value={serviceDetails.workshop_level || 'Levels zote'} onChange={(value) => updateServiceDetail('workshop_level', value)} />
                    </div>
                    <TextField label="Maelezo ya kuanza" value={serviceDetails.workshop_start_note} onChange={(value) => updateServiceDetail('workshop_start_note', value)} placeholder="Inaanza cohort ikijaa" />
                    <RepeatableTextList label="Matokeo ya kujifunza" value={serviceDetails.outcomes || serviceDetails.learning_outcomes} onChange={(value) => {
                        updateServiceDetail('outcomes', value);
                        updateServiceDetail('learning_outcomes', value);
                    }} addLabel="Ongeza" placeholder="Eleza matokeo moja ya kujifunza..." />
                    <RepeatableTextList label="Mahitaji" value={serviceDetails.requirements || serviceDetails.workshop_requirements} onChange={(value) => {
                        updateServiceDetail('requirements', value);
                        updateServiceDetail('workshop_requirements', value);
                    }} addLabel="Ongeza" placeholder="Eleza hitaji moja..." />
                    <RepeatableTextList label="Materials zilizojumuishwa" value={serviceDetails.materials_included} onChange={(value) => updateServiceDetail('materials_included', value)} addLabel="Ongeza" placeholder="Eleza material au resource moja..." />
                </div>
            )}
        </div>
    );
}

function ItineraryEditor({ value, onChange }) {
    const rows = Array.isArray(value) ? value : [];
    const updateRow = (index, updates) => {
        onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...updates } : row));
    };

    return (
        <div className="rounded-xl border bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Ratiba ya safari</p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onChange([...rows, { day: rows.length + 1, title: '', description: '' }])}
                >
                    <Plus className="h-4 w-4 mr-1" /> Siku
                </Button>
            </div>
            {rows.map((day, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <Input className="h-11 md:col-span-2" type="number" min="1" value={day.day || index + 1} onChange={(event) => updateRow(index, { day: event.target.value })} />
                    <Input className="h-11 md:col-span-4" placeholder="Kichwa cha siku" value={day.title || ''} onChange={(event) => updateRow(index, { title: event.target.value })} />
                    <Input className="h-11 md:col-span-5" placeholder="Stops, chakula, activities..." value={day.description || ''} onChange={(event) => updateRow(index, { description: event.target.value })} />
                    <button type="button" className="h-11 rounded-xl border bg-white text-muted-foreground hover:text-red-600 md:col-span-1" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
                        <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
