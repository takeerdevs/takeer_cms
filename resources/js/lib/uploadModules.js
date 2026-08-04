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
        titlePlaceholder: 'Mf. Chumba cha watu wawili kwa usiku 1',
        englishTitlePlaceholder: 'E.g. double room for 1 night',
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
        titlePlaceholder: 'Mf. Safari ya siku 3 ya Serengeti',
        englishTitlePlaceholder: 'E.g. 3-day Serengeti safari',
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
        titlePlaceholder: 'Mf. Keki ya birthday iliyotengenezwa kwa oda',
        englishTitlePlaceholder: 'E.g. custom birthday cake',
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
        titlePlaceholder: 'Mf. Ushauri wa biashara wa saa 1',
        englishTitlePlaceholder: 'E.g. 1-hour business consultation',
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
        titlePlaceholder: 'Mf. Ukumbi wa harusi wa watu 100',
        englishTitlePlaceholder: 'E.g. wedding venue for 100 guests',
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
        titlePlaceholder: 'Mf. Kukodisha Toyota Noah kwa siku 1',
        englishTitlePlaceholder: 'E.g. Toyota Noah rental for 1 day',
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
        titlePlaceholder: 'Mf. Darasa la ujasiriamali la siku 2',
        englishTitlePlaceholder: 'E.g. 2-day entrepreneurship workshop',
        defaults: {
            servicePriceDisplay: 'per_session',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'fixed_sessions',
            serviceDurationValue: '2',
            serviceDurationUnit: 'hours',
        },
    },
    online_live_events: {
        key: 'online_live_events',
        type: 'service',
        title: 'Online Live Event',
        translations: {
            sw: { title: 'Online Live Event' },
            en: { title: 'Online Live Event' },
        },
        category: 'Education & Training',
        subcategory: 'Workshop',
        serviceTemplateKey: 'learning',
        titlePlaceholder: 'Mf. Webinar ya masoko ya kidijitali',
        englishTitlePlaceholder: 'E.g. digital marketing webinar',
        defaults: {
            servicePriceDisplay: 'per_session',
            serviceMode: 'book_appointment',
            serviceBookingType: 'manual_confirm',
            serviceSchedulingType: 'fixed_sessions',
            serviceDurationValue: '90',
            serviceDurationUnit: 'minutes',
            serviceLocationType: 'remote',
            serviceDetails: {
                workshop_format: 'live_session',
                delivery_channel: 'online_live_event',
            },
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
        titlePlaceholder: 'Mf. Usafirishaji wa mzigo Dar es Salaam hadi Dubai',
        englishTitlePlaceholder: 'E.g. Dar es Salaam to Dubai cargo forwarding',
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
