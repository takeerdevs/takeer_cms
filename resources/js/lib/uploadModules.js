export const UPLOAD_MODULES = {
    menu: {
        key: 'menu',
        type: 'physical',
        title: 'Menu Item',
        titlePlaceholder: 'Mf. Pilau ya Kuku',
        mediaLabel: 'Media za Menu Item',
        focusedPhysical: true,
    },
    rooms: { key: 'rooms', type: 'service' },
    tour_departures: { key: 'tour_departures', type: 'service' },
    custom_orders: { key: 'custom_orders', type: 'service' },
    appointments: { key: 'appointments', type: 'service' },
    reservations: { key: 'reservations', type: 'service' },
    rentals: { key: 'rentals', type: 'service' },
    workshops: { key: 'workshops', type: 'service' },
};

export const KNOWN_UPLOAD_MODULE_KEYS = Object.keys(UPLOAD_MODULES);

export const getUploadModuleConfig = (key) => UPLOAD_MODULES[key] || null;

export const moduleMatchesStep = (key, step) => UPLOAD_MODULES[key]?.type === step;

export const publishModuleKey = (key, step) => (
    moduleMatchesStep(key, step) ? key : null
);
