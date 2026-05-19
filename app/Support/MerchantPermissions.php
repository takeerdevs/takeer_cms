<?php

namespace App\Support;

use App\Models\Merchant;
use App\Models\MerchantStaff;
use App\Models\User;
use Illuminate\Support\Collection;

class MerchantPermissions
{
    public const OWNER_ROLE = 'OWNER';

    public static function registry(): array
    {
        return [
            'dashboard' => [
                'label' => 'Dashboard',
                'actions' => ['view'],
            ],
            'products' => [
                'label' => 'Physical products',
                'actions' => ['view', 'create', 'update', 'delete', 'publish', 'manage_stock'],
            ],
            'digital_products' => [
                'label' => 'Digital products',
                'actions' => ['view', 'create', 'update', 'delete', 'publish', 'manage_keys'],
            ],
            'services' => [
                'label' => 'Services',
                'actions' => ['view', 'create', 'update', 'delete', 'schedule'],
            ],
            'posts' => [
                'label' => 'Posts',
                'actions' => ['view', 'create', 'update', 'delete', 'publish'],
            ],
            'bundles' => [
                'label' => 'Bundles and courses',
                'actions' => ['view', 'create', 'update', 'delete', 'manage_course'],
            ],
            'subscriptions' => [
                'label' => 'Subscriptions',
                'actions' => ['view', 'create', 'update', 'delete', 'manage_members'],
            ],
            'orders' => [
                'label' => 'Orders',
                'actions' => ['view', 'update', 'dispatch', 'verify_pickup', 'refund', 'export'],
            ],
            'wallet' => [
                'label' => 'Wallet',
                'actions' => ['view', 'withdraw', 'ledger'],
            ],
            'bookkeeping' => [
                'label' => 'Bookkeeping',
                'actions' => ['view', 'create', 'update', 'delete', 'void', 'review', 'reconcile', 'export', 'lock_period'],
            ],
            'team' => [
                'label' => 'Team',
                'actions' => ['view', 'create', 'update', 'delete', 'reset_pin', 'clear_devices'],
            ],
            'settings' => [
                'label' => 'Business settings',
                'actions' => ['view', 'update'],
            ],
            'marketing' => [
                'label' => 'Marketing',
                'actions' => ['view', 'create', 'update', 'delete', 'send_sms', 'connect_channels'],
            ],
            'retail' => [
                'label' => 'Retail/POS',
                'actions' => ['dashboard', 'pos', 'sale', 'void_sale', 'approve_sale', 'inventory', 'transfers', 'settings', 'customers', 'outstanding'],
            ],
            'kyc' => [
                'label' => 'Verification and credentials',
                'actions' => ['view', 'update'],
            ],
        ];
    }

    public static function all(): array
    {
        return collect(self::registry())
            ->flatMap(fn (array $group, string $resource) => collect($group['actions'])
                ->map(fn (string $action) => "{$resource}.{$action}"))
            ->values()
            ->all();
    }

    public static function presets(): array
    {
        return [
            self::OWNER_ROLE => ['*'],
            'MANAGER' => [
                'dashboard.view',
                'products.view',
                'products.create',
                'products.update',
                'products.publish',
                'digital_products.view',
                'digital_products.create',
                'digital_products.update',
                'digital_products.publish',
                'services.view',
                'services.create',
                'services.update',
                'posts.view',
                'posts.create',
                'posts.update',
                'posts.publish',
                'bundles.view',
                'bundles.create',
                'bundles.update',
                'subscriptions.view',
                'subscriptions.create',
                'subscriptions.update',
                'subscriptions.manage_members',
                'orders.view',
                'orders.update',
                'orders.dispatch',
                'orders.verify_pickup',
                'wallet.view',
                'wallet.ledger',
                'bookkeeping.view',
                'bookkeeping.create',
                'bookkeeping.update',
                'bookkeeping.review',
                'bookkeeping.reconcile',
                'bookkeeping.export',
                'team.view',
                'team.create',
                'team.update',
                'team.reset_pin',
                'team.clear_devices',
                'settings.view',
                'settings.update',
                'marketing.view',
                'marketing.create',
                'marketing.update',
                'retail.dashboard',
                'retail.pos',
                'retail.sale',
                'retail.void_sale',
                'retail.approve_sale',
                'retail.inventory',
                'retail.transfers',
                'retail.settings',
                'retail.customers',
                'retail.outstanding',
                'kyc.view',
            ],
            'CASHIER' => [
                'orders.view',
                'orders.verify_pickup',
                'retail.pos',
                'retail.sale',
                'retail.customers',
                'retail.outstanding',
            ],
            'STOREKEEPER' => [
                'products.view',
                'products.manage_stock',
                'orders.view',
                'orders.verify_pickup',
                'retail.inventory',
                'retail.transfers',
                'retail.customers',
                'retail.pos',
            ],
            'RECEPTIONIST' => [
                'dashboard.view',
                'services.view',
                'services.schedule',
                'orders.view',
                'orders.update',
                'retail.customers',
            ],
            'BOOKING_MANAGER' => [
                'dashboard.view',
                'services.view',
                'services.create',
                'services.update',
                'services.schedule',
                'orders.view',
                'orders.update',
                'retail.customers',
            ],
            'INSTRUCTOR' => [
                'dashboard.view',
                'bundles.view',
                'bundles.manage_course',
                'services.view',
                'services.schedule',
                'orders.view',
            ],
            'FULFILLMENT' => [
                'dashboard.view',
                'products.view',
                'orders.view',
                'orders.update',
                'orders.dispatch',
                'orders.verify_pickup',
                'retail.inventory',
                'retail.transfers',
            ],
            'ACCOUNTANT' => [
                'dashboard.view',
                'orders.view',
                'wallet.view',
                'wallet.ledger',
                'bookkeeping.view',
                'bookkeeping.create',
                'bookkeeping.update',
                'bookkeeping.review',
                'bookkeeping.reconcile',
                'bookkeeping.export',
            ],
            'MARKETER' => [
                'dashboard.view',
                'posts.view',
                'posts.create',
                'posts.update',
                'posts.publish',
                'marketing.view',
                'marketing.create',
                'marketing.update',
                'marketing.send_sms',
                'marketing.connect_channels',
            ],
            'CONTENT_MANAGER' => [
                'dashboard.view',
                'products.view',
                'digital_products.view',
                'digital_products.create',
                'digital_products.update',
                'digital_products.publish',
                'posts.view',
                'posts.create',
                'posts.update',
                'posts.publish',
                'bundles.view',
                'bundles.create',
                'bundles.update',
                'subscriptions.view',
                'subscriptions.create',
                'subscriptions.update',
            ],
            'SUPPORT' => [
                'dashboard.view',
                'orders.view',
                'orders.update',
                'orders.verify_pickup',
                'services.view',
                'retail.customers',
                'retail.outstanding',
            ],
        ];
    }

    public static function staffFor(User $user, Merchant $merchant): ?MerchantStaff
    {
        return MerchantStaff::query()
            ->where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();
    }

    public static function permissionsForStaff(MerchantStaff $staff): array
    {
        $rawPermissions = $staff->permissions;

        $permissions = collect(is_array($rawPermissions) ? $rawPermissions : [])
            ->filter(fn ($permission) => is_string($permission) && $permission !== '')
            ->values()
            ->unique();

        if (! (bool) ($staff->dashboard_access_enabled ?? false)) {
            $permissions = $permissions->filter(fn (string $permission) => str_starts_with($permission, 'retail.'));
        }

        if (! (bool) ($staff->pos_access_enabled ?? true)) {
            $permissions = $permissions->reject(fn (string $permission) => str_starts_with($permission, 'retail.'));
        }

        return $permissions->values()->all();
    }

    public static function permissionsFor(User $user, Merchant $merchant): array
    {
        if ((int) $merchant->user_id === (int) $user->id) {
            return ['*'];
        }

        $staff = self::staffFor($user, $merchant);

        return $staff ? self::permissionsForStaff($staff) : [];
    }

    public static function can(User $user, Merchant $merchant, string $permission): bool
    {
        $permissions = self::permissionsFor($user, $merchant);

        return in_array('*', $permissions, true)
            || in_array($permission, $permissions, true)
            || self::matchesWildcard($permissions, $permission);
    }

    public static function accessibleMerchantsFor(User $user): Collection
    {
        $owned = $user->merchantProfiles()->with(['kyc', 'locations'])->get();
        $staffMerchantIds = MerchantStaff::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->pluck('merchant_id');

        if ($staffMerchantIds->isEmpty()) {
            return $owned;
        }

        $staffMerchants = Merchant::query()
            ->with(['kyc', 'locations'])
            ->whereIn('id', $staffMerchantIds)
            ->get();

        return $owned->concat($staffMerchants)
            ->unique('id')
            ->values();
    }

    public static function accessSummary(User $user, Merchant $merchant): array
    {
        if ((int) $merchant->user_id === (int) $user->id) {
            return [
                'access_type' => 'owner',
                'role' => self::OWNER_ROLE,
                'permissions' => ['*'],
            ];
        }

        $staff = self::staffFor($user, $merchant);

        return [
            'access_type' => $staff ? 'staff' : 'none',
            'role' => $staff ? strtoupper((string) $staff->role) : null,
            'staff_id' => $staff?->id,
            'job_title' => $staff?->job_title,
            'display_name' => $staff?->display_name,
            'permissions' => $staff ? self::permissionsForStaff($staff) : [],
            'dashboard_access_enabled' => (bool) ($staff?->dashboard_access_enabled ?? false),
            'pos_access_enabled' => (bool) ($staff?->pos_access_enabled ?? true),
            'assigned_location_id' => $staff?->assigned_location_id,
            'assigned_location_name' => $staff?->location?->name,
        ];
    }

    public static function assignedLocationIdFor(User $user, Merchant $merchant): ?int
    {
        if ((int) $merchant->user_id === (int) $user->id) {
            return null;
        }

        $staff = self::staffFor($user, $merchant);
        $locationId = (int) ($staff?->assigned_location_id ?? 0);

        return $locationId > 0 ? $locationId : null;
    }

    public static function canAccessLocation(User $user, Merchant $merchant, ?int $locationId): bool
    {
        $assignedLocationId = self::assignedLocationIdFor($user, $merchant);

        return $assignedLocationId === null
            || (int) $locationId === $assignedLocationId;
    }

    private static function matchesWildcard(array $permissions, string $permission): bool
    {
        [$resource] = explode('.', $permission, 2);

        return in_array("{$resource}.*", $permissions, true);
    }
}
