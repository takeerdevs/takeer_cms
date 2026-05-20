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
    { value: 'table', label: 'Table' },
    { value: 'private_room', label: 'Private room' },
    { value: 'venue', label: 'Venue' },
    { value: 'seat', label: 'Seat' },
    { value: 'booth', label: 'Booth' },
    { value: 'visit', label: 'Visit / entry slot' },
    { value: 'other', label: 'Other' },
];

const SEATING_TYPE_OPTIONS = [
    'Standard seating',
    'Indoor seating',
    'Outdoor seating',
    'VIP seating',
    'Private seating',
    'Counter seating',
    'Standing room',
    'General admission',
];

export function RepeatableTextList({ label, value, onChange, addLabel = 'Add item', placeholder = 'Add details...' }) {
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
                            aria-label={`Remove ${label.toLowerCase()} item`}
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
            <SelectField label="Unit" value={serviceDurationUnit} onChange={setServiceDurationUnit}>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
            </SelectField>
        </div>
    );

    return (
        <div className="rounded-2xl border border-purple-100 bg-white p-3 sm:p-4 space-y-4">
            <div>
                <p className="text-xs font-black uppercase tracking-wider text-purple-700">{moduleConfig.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Fields here are specific to this module and are saved as module details.</p>
            </div>

            {moduleKey === 'rooms' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Room type" value={roomDetails.room_type || 'Standard room'} onChange={(value) => updateRoom('room_type', value)}>
                            {roomTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SelectField>
                        <SelectField label="Bed type" value={roomDetails.bed_type || 'Double bed'} onChange={(value) => updateRoom('bed_type', value)}>
                            {bedTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SelectField>
                        <TextField label="Max guests" type="number" min="1" value={roomDetails.max_guests} onChange={(value) => updateRoom('max_guests', value)} />
                        <TextField label="Rooms available" type="number" min="1" value={roomDetails.room_count} onChange={(value) => updateRoom('room_count', value)} />
                        <TextField label="Bathrooms" type="number" min="0" value={roomDetails.bathrooms} onChange={(value) => updateRoom('bathrooms', value)} />
                        <SelectField label="Booking policy" value={roomDetails.booking_policy || 'manual_confirm'} onChange={(value) => updateRoom('booking_policy', value)}>
                            {roomBookingPolicyOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                        </SelectField>
                        <TextField label="Check-in" type="time" value={roomDetails.checkin_time} onChange={(value) => updateRoom('checkin_time', value)} />
                        <TextField label="Checkout" type="time" value={roomDetails.checkout_time} onChange={(value) => updateRoom('checkout_time', value)} />
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
                    <TextAreaField label="House rules" value={serviceDetails.house_rules} onChange={(value) => updateServiceDetail('house_rules', value)} className="min-h-24" />
                    <TextAreaField label="Cancellation policy" value={serviceDetails.cancellation_policy} onChange={(value) => updateServiceDetail('cancellation_policy', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'tour_departures' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Destination" value={serviceDetails.destination} onChange={(value) => updateServiceDetail('destination', value)} placeholder="Serengeti + Ngorongoro" />
                        <TextField label="Duration label" value={serviceDetails.duration_label} onChange={(value) => updateServiceDetail('duration_label', value)} placeholder="3 days / 2 nights" />
                        <TextField label="Pickup point" value={serviceDetails.pickup_point} onChange={(value) => updateServiceDetail('pickup_point', value)} />
                        <TextField label="Drop-off point" value={serviceDetails.dropoff_point} onChange={(value) => updateServiceDetail('dropoff_point', value)} />
                        <TextField label="Seats / group size" type="number" min="1" value={serviceDetails.group_size} onChange={(value) => updateServiceDetail('group_size', value)} />
                        <SelectField label="Departure type" value={serviceDetails.departure_type || 'scheduled'} onChange={(value) => updateServiceDetail('departure_type', value)}>
                            <option value="scheduled">Scheduled departures</option>
                            <option value="private">Private trips</option>
                            <option value="custom">Custom dates</option>
                        </SelectField>
                    </div>
                    <ItineraryEditor value={serviceDetails.itinerary || []} onChange={(value) => updateServiceDetail('itinerary', value)} />
                    <RepeatableTextList label="Included items" value={serviceDetails.included} onChange={(value) => updateServiceDetail('included', value)} addLabel="Add included item" placeholder="Describe one included item..." />
                    <RepeatableTextList label="Excluded items" value={serviceDetails.excluded} onChange={(value) => updateServiceDetail('excluded', value)} addLabel="Add excluded item" placeholder="Describe one excluded item..." />
                    <TextAreaField label="Traveler requirements" value={serviceDetails.requirements} onChange={(value) => updateServiceDetail('requirements', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'custom_orders' && (
                <div className="space-y-3">
                    <TextAreaField label="Customization details" value={serviceDetails.customization_notes} onChange={(value) => updateServiceDetail('customization_notes', value)} className="min-h-24" />
                    <div className="grid gap-3 md:grid-cols-3">
                        <TextField label="Lead time" value={serviceDetails.lead_time} onChange={(value) => updateServiceDetail('lead_time', value)} placeholder="24 hours notice" />
                        <TextField label="Minimum order" type="number" min="1" value={serviceDetails.minimum_order} onChange={(value) => updateServiceDetail('minimum_order', value)} />
                        <SelectField label="Quote policy" value={serviceDetails.quote_policy || 'quote_after_request'} onChange={(value) => updateServiceDetail('quote_policy', value)}>
                            <option value="quote_after_request">Quote after request</option>
                            <option value="deposit_before_work">Deposit before work</option>
                            <option value="full_payment_after_quote">Full payment after quote</option>
                        </SelectField>
                    </div>
                    <TextAreaField label="Pickup or delivery notes" value={serviceDetails.pickup_delivery_notes} onChange={(value) => updateServiceDetail('pickup_delivery_notes', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'appointments' && (
                <div className="space-y-3">
                    {durationFields}
                    <div className="grid gap-3 md:grid-cols-3">
                        <TextField label="Buffer minutes" type="number" min="0" value={serviceDetails.buffer_minutes ?? 15} onChange={(value) => updateServiceDetail('buffer_minutes', value)} />
                        <TextField label="Capacity per slot" type="number" min="1" value={serviceDetails.capacity ?? 1} onChange={(value) => updateServiceDetail('capacity', value)} />
                        <SelectField label="Booking policy" value={serviceDetails.booking_policy || 'manual_confirm'} onChange={(value) => updateServiceDetail('booking_policy', value)}>
                            <option value="manual_confirm">Manual confirm</option>
                            <option value="instant">Instant</option>
                            <option value="request">Request first</option>
                        </SelectField>
                    </div>
                    <TextAreaField label="Preparation notes" value={serviceDetails.preparation_notes} onChange={(value) => updateServiceDetail('preparation_notes', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'reservations' && (
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Reservation type" value={serviceDetails.reservation_type || 'table'} onChange={(value) => updateServiceDetail('reservation_type', value)}>
                            {RESERVATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </SelectField>
                        <SelectField label="Seating type" value={serviceDetails.seating_type || 'Standard seating'} onChange={(value) => updateServiceDetail('seating_type', value)}>
                            {SEATING_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SelectField>
                    </div>
                    {durationFields}
                    <div className="grid gap-3 md:grid-cols-3">
                        <TextField label="Party size limit" type="number" min="1" value={serviceDetails.party_size_limit} onChange={(value) => updateServiceDetail('party_size_limit', value)} />
                        <SelectField label="Policy" value={serviceDetails.reservation_policy || 'manual_confirm'} onChange={(value) => updateServiceDetail('reservation_policy', value)}>
                            <option value="manual_confirm">Manual confirm</option>
                            <option value="instant">Instant</option>
                            <option value="request_first">Request first</option>
                        </SelectField>
                        <TextField
                            label="Reservation deposit (TZS)"
                            type="number"
                            min="0"
                            value={serviceDetails.deposit_amount ?? serviceDetails.deposit_note}
                            onChange={(value) => {
                                updateServiceDetail('deposit_amount', value);
                                updateServiceDetail('deposit_note', value);
                            }}
                            placeholder="Optional"
                        />
                    </div>
                    <TextAreaField label="Reservation notes" value={serviceDetails.reservation_notes} onChange={(value) => updateServiceDetail('reservation_notes', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'rentals' && (
                <div className="space-y-5">
                    <div className="space-y-3">
                        <SectionHeading title="What is being rented" description="Classify the rental and tell us how many units can be booked." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <SelectField label="Rental type" value={serviceDetails.rental_type || 'equipment'} onChange={(value) => updateServiceDetail('rental_type', value)}>
                                <option value="equipment">Equipment</option>
                                <option value="vehicle">Vehicle</option>
                                <option value="space">Space</option>
                                <option value="property">Property / house</option>
                                <option value="event_gear">Event gear</option>
                                <option value="costume">Costume / props</option>
                                <option value="other">Other</option>
                            </SelectField>
                            <TextField label="Available units" type="number" min="1" value={serviceDetails.available_units ?? 1} onChange={(value) => updateServiceDetail('available_units', value)} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Pricing basis" description="Choose how the price should be understood by customers." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <SelectField label="Price unit" value={serviceDetails.rental_unit || 'day'} onChange={(value) => updateServiceDetail('rental_unit', value)}>
                                <option value="hour">Per hour</option>
                                <option value="day">Per day</option>
                                <option value="night">Per night</option>
                                <option value="week">Per week</option>
                                <option value="month">Per month</option>
                                <option value="year">Per year</option>
                                <option value="trip">Per trip</option>
                                <option value="event">Per event</option>
                            </SelectField>
                            <TextField label="Security deposit" type="number" min="0" value={serviceDetails.security_deposit} onChange={(value) => updateServiceDetail('security_deposit', value)} placeholder="Optional" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Booking rules" description="Set the minimum rental period and how bookings are accepted." />
                        <div className="grid gap-3 md:grid-cols-3">
                            <TextField label="Minimum duration" type="number" min="1" value={serviceDurationValue} onChange={setServiceDurationValue} placeholder="1" />
                            <SelectField label="Duration unit" value={serviceDurationUnit} onChange={setServiceDurationUnit}>
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="weeks">Weeks</option>
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                            </SelectField>
                            <SelectField label="Rental policy" value={serviceDetails.rental_policy || 'manual_confirm'} onChange={(value) => updateServiceDetail('rental_policy', value)}>
                                <option value="manual_confirm">Manual confirm</option>
                                <option value="instant">Instant</option>
                                <option value="request_first">Request first</option>
                            </SelectField>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Included items" description="Add anything that comes with the rental, such as accessories, setup, or support." />
                        <RepeatableTextList label="Included items" value={serviceDetails.included_items} onChange={(value) => updateServiceDetail('included_items', value)} addLabel="Add included item" placeholder="Describe one included rental item..." />
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Handover and renter requirements" description="Explain pickup, return, ID, deposit, damage, or usage rules." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <TextAreaField label="Pickup / return notes" value={serviceDetails.pickup_return_notes} onChange={(value) => updateServiceDetail('pickup_return_notes', value)} className="min-h-24" />
                            <TextAreaField label="Rental requirements" value={serviceDetails.rental_requirements} onChange={(value) => updateServiceDetail('rental_requirements', value)} className="min-h-24" />
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
                            <option value="in_person">In person</option>
                        </SelectField>
                        <TextField label="Session count" type="number" min="1" value={serviceDetails.session_count ?? 1} onChange={(value) => updateServiceDetail('session_count', value)} />
                        <TextField label="Capacity" type="number" min="1" value={serviceDetails.workshop_capacity} onChange={(value) => updateServiceDetail('workshop_capacity', value)} />
                    </div>
                    {durationFields}
                    <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Level" value={serviceDetails.workshop_level || 'All levels'} onChange={(value) => updateServiceDetail('workshop_level', value)} />
                        <SelectField label="Enrollment policy" value={serviceDetails.enrollment_policy || 'manual_confirm'} onChange={(value) => updateServiceDetail('enrollment_policy', value)}>
                            <option value="manual_confirm">Manual confirm</option>
                            <option value="instant">Instant</option>
                            <option value="application">Application first</option>
                        </SelectField>
                    </div>
                    <TextField label="Start note" value={serviceDetails.workshop_start_note} onChange={(value) => updateServiceDetail('workshop_start_note', value)} placeholder="Starts when cohort is full" />
                    <RepeatableTextList label="Learning outcomes" value={serviceDetails.outcomes || serviceDetails.learning_outcomes} onChange={(value) => {
                        updateServiceDetail('outcomes', value);
                        updateServiceDetail('learning_outcomes', value);
                    }} addLabel="Add outcome" placeholder="Describe one learning outcome..." />
                    <RepeatableTextList label="Requirements" value={serviceDetails.requirements || serviceDetails.workshop_requirements} onChange={(value) => {
                        updateServiceDetail('requirements', value);
                        updateServiceDetail('workshop_requirements', value);
                    }} addLabel="Add requirement" placeholder="Describe one requirement..." />
                    <RepeatableTextList label="Materials included" value={serviceDetails.materials_included} onChange={(value) => updateServiceDetail('materials_included', value)} addLabel="Add material" placeholder="Describe one material or resource..." />
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
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Itinerary</p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onChange([...rows, { day: rows.length + 1, title: '', description: '' }])}
                >
                    <Plus className="h-4 w-4 mr-1" /> Day
                </Button>
            </div>
            {rows.map((day, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <Input className="h-11 md:col-span-2" type="number" min="1" value={day.day || index + 1} onChange={(event) => updateRow(index, { day: event.target.value })} />
                    <Input className="h-11 md:col-span-4" placeholder="Day title" value={day.title || ''} onChange={(event) => updateRow(index, { title: event.target.value })} />
                    <Input className="h-11 md:col-span-5" placeholder="Stops, meals, activities..." value={day.description || ''} onChange={(event) => updateRow(index, { description: event.target.value })} />
                    <button type="button" className="h-11 rounded-xl border bg-white text-muted-foreground hover:text-red-600 md:col-span-1" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
                        <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
