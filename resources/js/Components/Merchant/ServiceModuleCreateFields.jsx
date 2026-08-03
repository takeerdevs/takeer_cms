import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { getUploadModuleConfig } from '@/lib/uploadModules';
import { useLocale } from '@/lib/i18n';

const LABEL_TRANSLATIONS = {
    Duration: ['Duration', 'Muda'],
    'Kipimo cha muda': ['Time unit', 'Kipimo cha muda'],
    'Aina ya chumba': ['Room type', 'Aina ya chumba'],
    'Aina ya kitanda': ['Bed type', 'Aina ya kitanda'],
    'Idadi ya wageni': ['Number of guests', 'Idadi ya wageni'],
    'Vyumba vilivyopo': ['Rooms available', 'Vyumba vilivyopo'],
    Bafu: ['Bathrooms', 'Bafu'],
    'Muda wa kuingia': ['Check-in time', 'Muda wa kuingia'],
    'Muda wa kutoka': ['Check-out time', 'Muda wa kutoka'],
    'Sheria za nyumba': ['House rules', 'Sheria za nyumba'],
    'Sera ya cancellation': ['Cancellation policy', 'Sera ya cancellation'],
    'Mahali pa kwenda': ['Destination', 'Mahali pa kwenda'],
    'Muda wa safari': ['Trip duration', 'Muda wa safari'],
    'Mahali pa kuchukuliwa': ['Pickup point', 'Mahali pa kuchukuliwa'],
    'Mahali pa kushushwa': ['Drop-off point', 'Mahali pa kushushwa'],
    'Viti / ukubwa wa group': ['Seats / group size', 'Viti / ukubwa wa group'],
    'Aina ya safari': ['Trip type', 'Aina ya safari'],
    Vilivyojumuishwa: ['Included', 'Vilivyojumuishwa'],
    Visivyojumuishwa: ['Excluded', 'Visivyojumuishwa'],
    'Mahitaji ya msafiri': ['Traveller requirements', 'Mahitaji ya msafiri'],
    'Maelezo ya customization': ['Customization details', 'Maelezo ya customization'],
    'Muda wa maandalizi': ['Lead time', 'Muda wa maandalizi'],
    'Kima cha chini cha oda': ['Minimum order', 'Kima cha chini cha oda'],
    'Sera ya bei': ['Pricing policy', 'Sera ya bei'],
    'Maelezo ya pickup au delivery': ['Pickup or delivery details', 'Maelezo ya pickup au delivery'],
    'Aina ya miadi': ['Appointment type', 'Aina ya miadi'],
    'Sera ya booking': ['Booking policy', 'Sera ya booking'],
    'Kinachojumuishwa': ['What is included', 'Kinachojumuishwa'],
    'Maandalizi ya mteja': ['Customer preparation', 'Maandalizi ya mteja'],
    'Maswali ya awali': ['Intake questions', 'Maswali ya awali'],
    'Aina ya reservation': ['Reservation type', 'Aina ya reservation'],
    'Aina ya seating': ['Seating type', 'Aina ya seating'],
    'Idadi ya watu': ['Party size', 'Idadi ya watu'],
    'Maelezo ya reservation': ['Reservation details', 'Maelezo ya reservation'],
    'Muda wa mapumziko kabla / baada': ['Buffer before / after', 'Muda wa mapumziko kabla / baada'],
    'Aina ya kukodisha': ['Rental type', 'Aina ya kukodisha'],
    'Idadi iliyopo': ['Available units', 'Idadi iliyopo'],
    'Kipimo cha bei': ['Pricing unit', 'Kipimo cha bei'],
    'Deposit inayoweza kurudishwa': ['Refundable deposit', 'Deposit inayoweza kurudishwa'],
    'Muda wa chini': ['Minimum duration', 'Muda wa chini'],
    'Maelezo ya pickup / kurudisha': ['Pickup / return details', 'Maelezo ya pickup / kurudisha'],
    'Mahitaji ya kukodisha': ['Rental requirements', 'Mahitaji ya kukodisha'],
    'Idadi ya sessions': ['Number of sessions', 'Idadi ya sessions'],
    'Maelezo ya kuanza': ['Starting details', 'Maelezo ya kuanza'],
    'Matokeo ya kujifunza': ['Learning outcomes', 'Matokeo ya kujifunza'],
    Mahitaji: ['Requirements', 'Mahitaji'],
    'Materials zilizojumuishwa': ['Included materials', 'Materials zilizojumuishwa'],
    Capacity: ['Capacity', 'Uwezo'],
    Format: ['Format', 'Format'],
    Level: ['Level', 'Kiwango'],
};

const TEXT_TRANSLATIONS = {
    'These details are specific to this service type.': ['These details are specific to this service type.', 'Maelezo haya ni maalum kwa aina hii ya huduma.'],
    'Kipimo cha muda': ['Time unit', 'Kipimo cha muda'],
    'Ratiba zilizopangwa': ['Scheduled departures', 'Ratiba zilizopangwa'],
    'Safari ya private': ['Private trip', 'Safari ya private'],
    'Tarehe za kuchagua': ['Choose-your-date', 'Tarehe za kuchagua'],
    'Bei baada ya ombi': ['Price after request', 'Bei baada ya ombi'],
    'Deposit kabla ya kazi': ['Deposit before work', 'Deposit kabla ya kazi'],
    'Malipo yote baada ya bei': ['Full payment after quote', 'Malipo yote baada ya bei'],
    Ushauri: ['Consultation', 'Ushauri'],
    'Matibabu / care session': ['Treatment / care session', 'Matibabu / care session'],
    Tathmini: ['Assessment', 'Tathmini'],
    'Booking ya moja kwa moja': ['Instant booking', 'Booking ya moja kwa moja'],
    'Uthibitisho wa manual': ['Manual confirmation', 'Uthibitisho wa manual'],
    'Ombi kwanza': ['Request first', 'Ombi kwanza'],
    Meza: ['Table', 'Meza'],
    'Chumba cha private': ['Private room', 'Chumba cha private'],
    Kiti: ['Seat', 'Kiti'],
    'Ziara / muda wa kuingia': ['Visit / check-in time', 'Ziara / muda wa kuingia'],
    Nyingine: ['Other', 'Nyingine'],
    'Seating ya kawaida': ['Standard seating', 'Seating ya kawaida'],
    Ndani: ['Indoor', 'Ndani'],
    Nje: ['Outdoor', 'Nje'],
    Kusimama: ['Standing', 'Kusimama'],
    'General admission': ['General admission', 'General admission'],
    'Kinachokodishwa': ['What is rented', 'Kinachokodishwa'],
    'Chagua aina ya kitu na idadi inayoweza ku-bookiwa.': ['Choose the item type and the quantity that can be booked.', 'Chagua aina ya kitu na idadi inayoweza ku-bookiwa.'],
    Vifaa: ['Equipment', 'Vifaa'],
    'Gari / usafiri': ['Vehicle / transport', 'Gari / usafiri'],
    'Nyumba / property': ['House / property', 'Nyumba / property'],
    'Vifaa vya tukio': ['Event equipment', 'Vifaa vya tukio'],
    'Bei inahesabiwaje': ['How is the price calculated?', 'Bei inahesabiwaje'],
    'Chagua namna mteja ataelewa bei ya kukodisha.': ['Choose how the customer understands the rental price.', 'Chagua namna mteja ataelewa bei ya kukodisha.'],
    'Kwa saa': ['Per hour', 'Kwa saa'],
    'Kwa siku': ['Per day', 'Kwa siku'],
    'Kwa usiku': ['Per night', 'Kwa usiku'],
    'Kwa wiki': ['Per week', 'Kwa wiki'],
    'Kwa mwezi': ['Per month', 'Kwa mwezi'],
    'Kwa mwaka': ['Per year', 'Kwa mwaka'],
    'Kwa safari': ['Per trip', 'Kwa safari'],
    'Kwa tukio': ['Per event', 'Kwa tukio'],
    'Kiasi cha optional': ['Optional amount', 'Kiasi cha optional'],
    'Muda wa kukodisha': ['Rental duration', 'Muda wa kukodisha'],
    'Weka muda wa chini wa kukodisha.': ['Set the minimum rental duration.', 'Weka muda wa chini wa kukodisha.'],
    Wiki: ['Weeks', 'Wiki'],
    Miezi: ['Months', 'Miezi'],
    Miaka: ['Years', 'Miaka'],
    'Ongeza kinachokuja na kukodisha, kama accessories, setup, au support.': ['Add what comes with the rental, such as accessories, setup, or support.', 'Ongeza kinachokuja na kukodisha, kama accessories, setup, au support.'],
    'Makabidhiano na mahitaji ya mteja': ['Handover and customer requirements', 'Makabidhiano na mahitaji ya mteja'],
    'Eleza pickup, kurudisha, ID, deposit, uharibifu, au sheria za matumizi.': ['Describe pickup, return, ID, deposit, damage, or usage rules.', 'Eleza pickup, kurudisha, ID, deposit, uharibifu, au sheria za matumizi.'],
    'Ana kwa ana': ['In person', 'Ana kwa ana'],
    'Levels zote': ['All levels', 'Levels zote'],
    'Ratiba ya safari': ['Trip itinerary', 'Ratiba ya safari'],
    Siku: ['Day', 'Siku'],
    'Kichwa cha siku': ['Day title', 'Kichwa cha siku'],
    'Stops, chakula, activities...': ['Stops, food, activities...', 'Stops, chakula, activities...'],
    'Siku 3 / usiku 2': ['3 days / 2 nights', 'Siku 3 / usiku 2'],
    'Taarifa masaa 24 kabla': ['Notice 24 hours in advance', 'Taarifa masaa 24 kabla'],
    'Dakika 15 kati ya wateja': ['15 minutes between customers', 'Dakika 15 kati ya wateja'],
    'Mteja ajibu nini kabla ya miadi?': ['What should the customer answer before the appointment?', 'Mteja ajibu nini kabla ya miadi?'],
    'Eleza kitu kilichojumuishwa...': ['Describe one included item...', 'Eleza kitu kilichojumuishwa...'],
    'Eleza kitu kisichojumuishwa...': ['Describe one excluded item...', 'Eleza kitu kisichojumuishwa...'],
    'Eleza matokeo moja ya kujifunza...': ['Describe one learning outcome...', 'Eleza matokeo moja ya kujifunza...'],
    'Eleza hitaji moja...': ['Describe one requirement...', 'Eleza hitaji moja...'],
    'Eleza material au resource moja...': ['Describe one material or resource...', 'Eleza material au resource moja...'],
    'Inaanza cohort ikijaa': ['Starts when the cohort is full', 'Inaanza cohort ikijaa'],
    'Ongeza maelezo...': ['Add details...', 'Ongeza maelezo...'],
    'Standard room': ['Standard room', 'Chumba cha kawaida'],
    'Deluxe room': ['Deluxe room', 'Chumba deluxe'],
    Suite: ['Suite', 'Suite'],
    'Family room': ['Family room', 'Chumba cha familia'],
    'Twin room': ['Twin room', 'Chumba cha vitanda viwili'],
    'Single room': ['Single room', 'Chumba cha mtu mmoja'],
    Apartment: ['Apartment', 'Apartment'],
    Villa: ['Villa', 'Villa'],
    House: ['House', 'Nyumba'],
    'Whole home': ['Whole home', 'Nyumba nzima'],
    Cottage: ['Cottage', 'Cottage'],
    'Guest house': ['Guest house', 'Guest house'],
    'Dorm bed': ['Dorm bed', 'Kitanda cha dorm'],
    'Single bed': ['Single bed', 'Kitanda kimoja'],
    'Double bed': ['Double bed', 'Kitanda cha watu wawili'],
    'Queen bed': ['Queen bed', 'Kitanda queen'],
    'King bed': ['King bed', 'Kitanda king'],
    'Twin beds': ['Twin beds', 'Vitanda viwili'],
    'Bunk beds': ['Bunk beds', 'Vitanda vya ghorofa'],
    'Multiple beds': ['Multiple beds', 'Vitanda vingi'],
    'Wi-Fi': ['Wi-Fi', 'Wi-Fi'],
    'A/C': ['A/C', 'A/C'],
    Breakfast: ['Breakfast', 'Kifungua kinywa'],
    'Private bath': ['Private bath', 'Bafu binafsi'],
    Parking: ['Parking', 'Maegesho'],
    TV: ['TV', 'TV'],
    'Work desk': ['Work desk', 'Dawati la kazi'],
    Pool: ['Pool', 'Bwawa'],
    Available: ['Available', 'Inapatikana'],
    Limited: ['Limited', 'Ina kikomo'],
    Occupied: ['Occupied', 'Imechukuliwa'],
    Maintenance: ['Maintenance', 'Matengenezo'],
};

function translateModuleText(copy, value) {
    const pair = TEXT_TRANSLATIONS[value];
    return pair ? copy(pair[0], pair[1]) : value;
}

function translateFieldLabel(copy, value) {
    const pair = LABEL_TRANSLATIONS[value];
    return pair ? copy(pair[0], pair[1]) : translateModuleText(copy, value);
}

const FieldLabel = ({ children }) => {
    const { copy } = useLocale();
    return <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{translateFieldLabel(copy, children)}</span>;
};

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

const TextField = ({ label, value, onChange, ...props }) => {
    const { copy } = useLocale();
    return (
        <label className="space-y-1.5">
            <FieldLabel>{label}</FieldLabel>
            <Input className="h-11" value={value || ''} onChange={(event) => onChange(event.target.value)} {...props} placeholder={translateModuleText(copy, props.placeholder)} />
        </label>
    );
};

const TextAreaField = ({ label, value, onChange, ...props }) => {
    const { copy } = useLocale();
    return (
        <label className="space-y-1.5">
            <FieldLabel>{label}</FieldLabel>
            <Textarea value={value || ''} onChange={(event) => onChange(event.target.value)} {...props} placeholder={translateModuleText(copy, props.placeholder)} />
        </label>
    );
};

const SectionHeading = ({ title, description }) => {
    const { copy } = useLocale();
    return (
        <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">{translateFieldLabel(copy, title)}</p>
            {description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{translateModuleText(copy, description)}</p>}
        </div>
    );
};

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
    const { copy } = useLocale();
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
                    <Plus className="mr-1 h-3.5 w-3.5" /> {translateModuleText(copy, addLabel)}
                </Button>
            </div>
            <div className="space-y-2">
                {rows.map((row, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_2.75rem]">
                        <Textarea
                            value={row || ''}
                            onChange={(event) => updateRow(index, event.target.value)}
                            placeholder={translateModuleText(copy, placeholder)}
                            className="min-h-20"
                        />
                        <button
                            type="button"
                            className="h-11 rounded-xl border bg-white text-muted-foreground hover:text-red-600 disabled:cursor-default disabled:opacity-30"
                            onClick={() => removeRow(index)}
                            disabled={rows.length === 1 && !row}
                            aria-label={`${copy('Remove', 'Ondoa')} ${translateFieldLabel(copy, label).toLowerCase()}`}
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
    const { copy } = useLocale();
    const moduleConfig = getUploadModuleConfig(moduleKey);

    if (!moduleConfig || moduleConfig.type !== 'service') return null;

    const updateRoom = (key, value) => {
        setRoomDetails((prev) => ({ ...(prev || {}), [key]: value }));
    };
    const durationFields = (
        <div className="grid grid-cols-2 gap-3">
            <TextField label={copy('Duration', 'Muda')} type="number" min="1" value={serviceDurationValue} onChange={setServiceDurationValue} placeholder="1" />
            <SelectField label="Kipimo cha muda" value={serviceDurationUnit} onChange={setServiceDurationUnit}>
                <option value="minutes">{copy('Minutes', 'Dakika')}</option>
                <option value="hours">{copy('Hours', 'Masaa')}</option>
                <option value="days">{copy('Days', 'Siku')}</option>
            </SelectField>
        </div>
    );
    return (
        <div className="rounded-2xl border border-purple-100 bg-white p-3 sm:p-4 space-y-4">
            <div>
                <p className="text-xs font-black uppercase tracking-wider text-purple-700">{copy(moduleConfig.translations?.en?.title || moduleConfig.title, moduleConfig.translations?.sw?.title || moduleConfig.title)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{copy('These details are specific to this service type.', 'Maelezo haya ni maalum kwa aina hii ya huduma.')}</p>
            </div>

            {moduleKey === 'rooms' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Aina ya chumba" value={roomDetails.room_type || 'Standard room'} onChange={(value) => updateRoom('room_type', value)}>
                            {roomTypeOptions.map((option) => <option key={option} value={option}>{translateModuleText(copy, option)}</option>)}
                        </SelectField>
                        <SelectField label="Aina ya kitanda" value={roomDetails.bed_type || 'Double bed'} onChange={(value) => updateRoom('bed_type', value)}>
                            {bedTypeOptions.map((option) => <option key={option} value={option}>{translateModuleText(copy, option)}</option>)}
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
                                    {translateModuleText(copy, option.label)}
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
                                    {translateModuleText(copy, option.label)}
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
                            <option value="scheduled">{translateModuleText(copy, 'Ratiba zilizopangwa')}</option>
                            <option value="private">{translateModuleText(copy, 'Safari ya private')}</option>
                            <option value="custom">{translateModuleText(copy, 'Tarehe za kuchagua')}</option>
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
                            <option value="quote_after_request">{translateModuleText(copy, 'Bei baada ya ombi')}</option>
                            <option value="deposit_before_work">{translateModuleText(copy, 'Deposit kabla ya kazi')}</option>
                            <option value="full_payment_after_quote">{translateModuleText(copy, 'Malipo yote baada ya bei')}</option>
                        </SelectField>
                    </div>
                    <TextAreaField label="Maelezo ya pickup au delivery" value={serviceDetails.pickup_delivery_notes} onChange={(value) => updateServiceDetail('pickup_delivery_notes', value)} className="min-h-20" />
                </div>
            )}

            {moduleKey === 'appointments' && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <SelectField label="Aina ya miadi" value={serviceDetails.appointment_type || 'consultation'} onChange={(value) => updateServiceDetail('appointment_type', value)}>
                            <option value="consultation">{translateModuleText(copy, 'Ushauri')}</option>
                            <option value="treatment">{translateModuleText(copy, 'Matibabu / care session')}</option>
                            <option value="assessment">{translateModuleText(copy, 'Tathmini')}</option>
                            <option value="follow_up">{copy('Follow-up', 'Follow-up')}</option>
                            <option value="home_visit">{copy('Home service', 'Huduma ya nyumbani')}</option>
                            <option value="online_session">{copy('Online session', 'Online session')}</option>
                        </SelectField>
                        <SelectField label="Sera ya booking" value={serviceDetails.appointment_booking_policy || 'manual_confirm'} onChange={(value) => updateServiceDetail('appointment_booking_policy', value)}>
                            <option value="instant">{translateModuleText(copy, 'Booking ya moja kwa moja')}</option>
                            <option value="manual_confirm">{translateModuleText(copy, 'Uthibitisho wa manual')}</option>
                            <option value="request_first">{translateModuleText(copy, 'Ombi kwanza')}</option>
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
                            {RESERVATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{translateModuleText(copy, option.label)}</option>)}
                        </SelectField>
                        <SelectField label="Aina ya seating" value={serviceDetails.seating_type || 'Standard seating'} onChange={(value) => updateServiceDetail('seating_type', value)}>
                            {SEATING_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{translateModuleText(copy, option)}</option>)}
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
                                <option value="equipment">{translateModuleText(copy, 'Vifaa')}</option>
                                <option value="vehicle">{translateModuleText(copy, 'Gari / usafiri')}</option>
                                <option value="space">{copy('Space', 'Space')}</option>
                                <option value="property">{translateModuleText(copy, 'Nyumba / property')}</option>
                                <option value="event_gear">{translateModuleText(copy, 'Vifaa vya tukio')}</option>
                                <option value="costume">{copy('Costume / props', 'Costume / props')}</option>
                                <option value="other">{translateModuleText(copy, 'Nyingine')}</option>
                            </SelectField>
                            <TextField label="Idadi iliyopo" type="number" min="1" value={serviceDetails.available_units ?? 1} onChange={(value) => updateServiceDetail('available_units', value)} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Bei inahesabiwaje" description="Chagua namna mteja ataelewa bei ya kukodisha." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <SelectField label="Kipimo cha bei" value={serviceDetails.rental_unit || 'day'} onChange={(value) => updateServiceDetail('rental_unit', value)}>
                                <option value="hour">{translateModuleText(copy, 'Kwa saa')}</option>
                                <option value="day">{translateModuleText(copy, 'Kwa siku')}</option>
                                <option value="night">{translateModuleText(copy, 'Kwa usiku')}</option>
                                <option value="week">{translateModuleText(copy, 'Kwa wiki')}</option>
                                <option value="month">{translateModuleText(copy, 'Kwa mwezi')}</option>
                                <option value="year">{translateModuleText(copy, 'Kwa mwaka')}</option>
                                <option value="trip">{translateModuleText(copy, 'Kwa safari')}</option>
                                <option value="event">{translateModuleText(copy, 'Kwa tukio')}</option>
                            </SelectField>
                            <TextField label="Deposit inayoweza kurudishwa" type="number" min="0" value={serviceDetails.security_deposit} onChange={(value) => updateServiceDetail('security_deposit', value)} placeholder="Kiasi cha optional" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionHeading title="Muda wa kukodisha" description="Weka muda wa chini wa kukodisha." />
                        <div className="grid gap-3 md:grid-cols-2">
                            <TextField label="Muda wa chini" type="number" min="1" value={serviceDurationValue} onChange={setServiceDurationValue} placeholder="1" />
                            <SelectField label="Kipimo cha muda" value={serviceDurationUnit} onChange={setServiceDurationUnit}>
                                <option value="minutes">{copy('Minutes', 'Dakika')}</option>
                                <option value="hours">{copy('Hours', 'Masaa')}</option>
                                <option value="days">{copy('Days', 'Siku')}</option>
                                <option value="weeks">{translateModuleText(copy, 'Wiki')}</option>
                                <option value="months">{translateModuleText(copy, 'Miezi')}</option>
                                <option value="years">{translateModuleText(copy, 'Miaka')}</option>
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
                            <option value="live_session">{copy('Live session', 'Live session')}</option>
                            <option value="cohort">{copy('Cohort', 'Cohort')}</option>
                            <option value="bootcamp">{copy('Bootcamp', 'Bootcamp')}</option>
                            <option value="webinar">{copy('Webinar', 'Webinar')}</option>
                            <option value="in_person">{translateModuleText(copy, 'Ana kwa ana')}</option>
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
    const { copy } = useLocale();
    const rows = Array.isArray(value) ? value : [];
    const updateRow = (index, updates) => {
        onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...updates } : row));
    };

    return (
        <div className="rounded-xl border bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{translateModuleText(copy, 'Ratiba ya safari')}</p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onChange([...rows, { day: rows.length + 1, title: '', description: '' }])}
                >
                    <Plus className="h-4 w-4 mr-1" /> {translateModuleText(copy, 'Siku')}
                </Button>
            </div>
            {rows.map((day, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <Input className="h-11 md:col-span-2" type="number" min="1" value={day.day || index + 1} onChange={(event) => updateRow(index, { day: event.target.value })} />
                    <Input className="h-11 md:col-span-4" placeholder={translateModuleText(copy, 'Kichwa cha siku')} value={day.title || ''} onChange={(event) => updateRow(index, { title: event.target.value })} />
                    <Input className="h-11 md:col-span-5" placeholder={translateModuleText(copy, 'Stops, chakula, activities...')} value={day.description || ''} onChange={(event) => updateRow(index, { description: event.target.value })} />
                    <button type="button" className="h-11 rounded-xl border bg-white text-muted-foreground hover:text-red-600 md:col-span-1" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
                        <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
