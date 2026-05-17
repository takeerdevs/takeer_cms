import { usePage } from '@inertiajs/react';

export function hasMerchantPermission(permissions = [], permission) {
    if (!permission) return true;
    if (permissions.includes('*') || permissions.includes(permission)) return true;

    const [resource] = permission.split('.');
    return permissions.includes(`${resource}.*`);
}

export function useMerchantPermissions(explicitUsername = null) {
    const page = usePage();
    const props = page.props || {};
    const merchants = props.auth?.user?.merchant_profiles || [];
    const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
    const usernameFromPath = pathParts[1] === 'merchant' ? pathParts[2] : null;
    const activeUsername = explicitUsername
        || props.merchantUsername
        || props.activeMerchant?.username
        || props.merchant?.username
        || usernameFromPath;

    const merchant = merchants.find((item) => item.username === activeUsername)
        || merchants.find((item) => item.id === props.activeMerchant?.id)
        || merchants.find((item) => item.is_default)
        || merchants[0]
        || null;

    const permissions = props.activeMerchantAccess?.permissions
        || props.activeMerchant?.permissions
        || merchant?.permissions
        || [];

    const can = (permission) => hasMerchantPermission(permissions, permission);
    const canAny = (items = []) => items.some((permission) => can(permission));
    const canAll = (items = []) => items.every((permission) => can(permission));

    return {
        merchant,
        permissions,
        can,
        canAny,
        canAll,
        isOwner: merchant?.access_type === 'owner' || permissions.includes('*'),
    };
}
