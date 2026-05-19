<?php

namespace App\Support;

class CommerceModeRegistry
{
    public static function all(): array
    {
        return [
            'physical_products' => [
                'label' => 'Physical products',
                'description' => 'Ready-made goods with categories, variants, stock, delivery, and orders.',
                'modules' => ['products', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'services_bookings' => [
                'label' => 'Services / bookings',
                'description' => 'Services, appointments, reservations, and booking-style checkout.',
                'modules' => ['services', 'bookings', 'availability', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'digital_products' => [
                'label' => 'Digital products',
                'description' => 'Downloads, files, license keys, digital access, and learning materials.',
                'modules' => ['digital_products', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'food_menu' => [
                'label' => 'Food / menu items',
                'description' => 'Menus, add-ons, restaurant orders, delivery, and reservations.',
                'modules' => ['menu', 'orders', 'customers', 'communications', 'reports', 'delivery', 'reservations', 'bookkeeping'],
            ],
            'courses_learning' => [
                'label' => 'Courses / learning',
                'description' => 'Courses, workshops, cohorts, enrollments, and student access.',
                'modules' => ['courses', 'workshops', 'enrollments', 'customers', 'communications', 'reports', 'digital_products', 'bookkeeping'],
            ],
            'custom_orders_quotes' => [
                'label' => 'Custom orders / quotes',
                'description' => 'Customer requirements, quotation, made-to-order work, and approvals.',
                'modules' => ['custom_orders', 'quotes', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'subscriptions_memberships' => [
                'label' => 'Subscriptions / memberships',
                'description' => 'Recurring plans, memberships, access, and member management.',
                'modules' => ['subscriptions', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
        ];
    }

    public static function keys(): array
    {
        return array_keys(self::all());
    }

    public static function normalize(array $keys): array
    {
        $valid = self::keys();

        return collect($keys)
            ->filter(fn ($key) => is_string($key) && in_array($key, $valid, true))
            ->unique()
            ->values()
            ->all();
    }

    public static function modulesFor(array $keys): array
    {
        $modes = self::all();

        return BusinessModuleRegistry::normalize(
            collect(self::normalize($keys))
                ->flatMap(fn (string $key) => $modes[$key]['modules'] ?? [])
                ->all()
        );
    }
}
