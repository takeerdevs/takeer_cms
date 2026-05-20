export const UPLOAD_MODULES = {
    menu: {
        key: 'menu',
        type: 'physical',
        title: 'Menu Item',
        titlePlaceholder: 'Mf. Pilau ya Kuku',
        mediaLabel: 'Media za Menu Item',
        focusedPhysical: true,
    },
    rooms: {
        key: 'rooms',
        type: 'service',
        title: 'Room / Stay',
        category: 'Accommodation & Stays',
        subcategory: 'Hotel',
        serviceTemplateKey: 'stay',
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
        title: 'Tour Departure',
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
        title: 'Custom Order',
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
        title: 'Appointment',
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
        title: 'Rental / Hire',
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
        title: 'Live Session / Event',
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
};

export const KNOWN_UPLOAD_MODULE_KEYS = Object.keys(UPLOAD_MODULES);

export const getUploadModuleConfig = (key) => UPLOAD_MODULES[key] || null;

export const moduleMatchesStep = (key, step) => UPLOAD_MODULES[key]?.type === step;

export const publishModuleKey = (key, step) => (
    moduleMatchesStep(key, step) ? key : null
);
