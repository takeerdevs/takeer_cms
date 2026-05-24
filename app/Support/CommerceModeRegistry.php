<?php

namespace App\Support;

class CommerceModeRegistry
{
    public static function all(): array
    {
        $modes = [
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

        return self::localized($modes);
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

    private static function localized(array $modes): array
    {
        $swahili = [
            'physical_products' => ['label' => 'Bidhaa za Kushikika', 'description' => 'Bidhaa zilizo tayari kuuzwa zenye categories, variants, stock, delivery, na oda.'],
            'services_bookings' => ['label' => 'Huduma / Booking', 'description' => 'Huduma, miadi, reservations, na checkout ya booking.'],
            'digital_products' => ['label' => 'Bidhaa za Digital', 'description' => 'Downloads, files, license keys, access ya digital, na materials za kujifunza.'],
            'food_menu' => ['label' => 'Chakula / Menu', 'description' => 'Menu, add-ons, oda za restaurant, delivery, na reservations.'],
            'courses_learning' => ['label' => 'Kozi / Kujifunza', 'description' => 'Kozi, workshops, cohorts, enrollments, na access ya wanafunzi.'],
            'custom_orders_quotes' => ['label' => 'Oda Maalum / Bei ya Makubaliano', 'description' => 'Mahitaji ya mteja, quotation, kazi za kuagiza, na approvals.'],
            'subscriptions_memberships' => ['label' => 'Subscriptions / Memberships', 'description' => 'Plans za kujirudia, memberships, access, na usimamizi wa members.'],
        ];

        return collect($modes)
            ->map(function (array $mode, string $key) use ($swahili) {
                $english = [
                    'label' => $mode['label'] ?? $key,
                    'description' => $mode['description'] ?? '',
                ];
                $sw = $swahili[$key] ?? $english;

                return [
                    ...$mode,
                    'label' => $sw['label'],
                    'description' => $sw['description'],
                    'translations' => [
                        'sw' => $sw,
                        'en' => $english,
                    ],
                ];
            })
            ->all();
    }
}
