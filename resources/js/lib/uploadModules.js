export const UPLOAD_MODULES = {
    menu: {
        key: 'menu',
        type: 'physical',
        title: 'Chakula / Kinywaji',
        translations: {
            sw: { title: 'Chakula / Kinywaji' },
            en: { title: 'Menu Item' },
        },
        titlePlaceholder: 'Mf. Pilau ya Kuku',
        mediaLabel: 'Media za Menu Item',
        focusedPhysical: true,
    },
    rooms: {
        key: 'rooms',
        type: 'service',
        title: 'Chumba / Malazi',
        translations: {
            sw: { title: 'Chumba / Malazi' },
            en: { title: 'Room / Stay' },
        },
        category: 'Accommodation & Stays',
        subcategory: 'Hotel',
        serviceTemplateKey: 'stay',
        serviceSubtypeKey: 'room',
        defaults: {
            servicePriceDisplay: 'nightly',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'none',
        },
    },
    tour_departures: {
        key: 'tour_departures',
        type: 'service',
        title: 'Safari / Ratiba ya Tour',
        translations: {
            sw: { title: 'Safari / Ratiba ya Tour' },
            en: { title: 'Tour Departure' },
        },
        category: 'Travel & Recreation',
        subcategory: 'Tour package',
        serviceTemplateKey: 'tour',
        defaults: {
            servicePriceDisplay: 'per_person',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'fixed_sessions',
        },
    },
    custom_orders: {
        key: 'custom_orders',
        type: 'service',
        title: 'Oda ya Kuagiza Maalum',
        translations: {
            sw: { title: 'Oda ya Kuagiza Maalum' },
            en: { title: 'Custom Order' },
        },
        category: 'Other',
        subcategory: 'Other',
        serviceTemplateKey: 'orderable_service',
        defaults: {
            servicePriceDisplay: 'quote_only',
            serviceMode: 'request_quote',
            serviceBookingType: 'request',
            serviceSchedulingType: 'none',
        },
    },
    appointments: {
        key: 'appointments',
        type: 'service',
        title: 'Miadi',
        translations: {
            sw: { title: 'Miadi' },
            en: { title: 'Appointment' },
        },
        category: 'Professional Services',
        subcategory: 'Consulting',
        serviceTemplateKey: 'appointment_or_quote',
        defaults: {
            servicePriceDisplay: 'starts_from',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'recurring',
            serviceDurationValue: '60',
            serviceDurationUnit: 'minutes',
        },
    },
    reservations: {
        key: 'reservations',
        type: 'service',
        title: 'Reservation',
        translations: {
            sw: { title: 'Reservation' },
            en: { title: 'Reservation' },
        },
        category: 'Events & Hospitality',
        subcategory: 'Venue',
        serviceTemplateKey: 'space_booking',
        defaults: {
            servicePriceDisplay: 'hidden',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'recurring',
            serviceDurationValue: '90',
            serviceDurationUnit: 'minutes',
        },
    },
    rentals: {
        key: 'rentals',
        type: 'service',
        title: 'Kupangisha / Kukodisha',
        translations: {
            sw: { title: 'Kupangisha / Kukodisha' },
            en: { title: 'Rental / Hire' },
        },
        category: 'Transport & Hire',
        subcategory: 'Equipment hire',
        serviceTemplateKey: 'rental',
        defaults: {
            servicePriceDisplay: 'daily',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'recurring',
            serviceDurationValue: '1',
            serviceDurationUnit: 'days',
        },
    },
    workshops: {
        key: 'workshops',
        type: 'service',
        title: 'Darasa / Tukio la Live',
        translations: {
            sw: { title: 'Darasa / Tukio la Live' },
            en: { title: 'Live Session / Event' },
        },
        category: 'Education & Training',
        subcategory: 'Workshop',
        serviceTemplateKey: 'learning',
        defaults: {
            servicePriceDisplay: 'per_session',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'fixed_sessions',
            serviceDurationValue: '2',
            serviceDurationUnit: 'hours',
        },
    },
    forwarders: {
        key: 'forwarders',
        type: 'service',
        title: 'Forwarder / Import Logistics',
        translations: {
            sw: { title: 'Forwarder / Import Logistics' },
            en: { title: 'Forwarder / Import Logistics' },
        },
        category: 'Transport & Hire',
        subcategory: 'Import logistics',
        serviceTemplateKey: 'orderable_service',
        defaults: {
            servicePriceDisplay: 'quote_only',
            serviceMode: 'request_quote',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'none',
        },
    },
};

export const KNOWN_UPLOAD_MODULE_KEYS = Object.keys(UPLOAD_MODULES);

export const getUploadModuleConfig = (key, locale = 'sw') => {
    const config = UPLOAD_MODULES[key] || null;
    if (!config) return null;

    const localized = config.translations?.[locale] || config.translations?.sw || {};
    return { ...config, ...localized };
};

export const moduleMatchesStep = (key, step) => UPLOAD_MODULES[key]?.type === step;

export const publishModuleKey = (key, step) => (
    moduleMatchesStep(key, step) ? key : null
);
