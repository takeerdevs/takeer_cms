<?php

namespace App\Support;

class BusinessOperationRegistry
{
    public static function all(): array
    {
        $operations = [
            'physical_products' => [
                'label' => 'Sells physical products',
                'description' => 'Retail goods, stock, variants, product categories, delivery, and orders.',
                'commerce_modes' => ['physical_products'],
                'modules' => ['products', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'digital_products' => [
                'label' => 'Sells digital products',
                'description' => 'Downloads, files, keys, paid media, digital access, and learning materials.',
                'commerce_modes' => ['digital_products'],
                'modules' => ['digital_products', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'general_services' => [
                'label' => 'Offers services',
                'description' => 'Bookable or enquiry-based services, appointments, scheduling, and service requests.',
                'commerce_modes' => ['services_bookings'],
                'modules' => ['services', 'bookings', 'availability', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'food_menu' => [
                'label' => 'Food / menu business',
                'description' => 'Food, drinks, add-ons, restaurant orders, delivery, and reservations.',
                'commerce_modes' => ['food_menu', 'physical_products'],
                'modules' => ['menu', 'orders', 'reservations', 'delivery', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'custom_orders' => [
                'label' => 'Custom orders / quotes',
                'description' => 'Printing, tailoring, fabrication, creative work, and made-to-order requests.',
                'commerce_modes' => ['custom_orders_quotes'],
                'modules' => ['custom_orders', 'quotes', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'education_training' => [
                'label' => 'Education / training',
                'description' => 'Courses, workshops, cohorts, short courses, enrollments, and learning access.',
                'commerce_modes' => ['courses_learning', 'services_bookings', 'digital_products'],
                'modules' => ['courses', 'workshops', 'enrollments', 'bookings', 'availability', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'accommodation_stays' => [
                'label' => 'Accommodation / stays',
                'description' => 'Rooms, guest houses, motels, hotels, occupancy, booking requests, and guest flow.',
                'commerce_modes' => ['services_bookings', 'food_menu'],
                'modules' => ['rooms', 'bookings', 'availability', 'reservations', 'menu', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'travel_tours' => [
                'label' => 'Travel / tours',
                'description' => 'Trips, tour departures, itineraries, seat capacity, pickup, and travel bookings.',
                'commerce_modes' => ['services_bookings', 'custom_orders_quotes'],
                'modules' => ['tour_departures', 'bookings', 'availability', 'services', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'rentals_hire' => [
                'label' => 'Rentals / hire',
                'description' => 'Equipment, vehicles, spaces, deposits, pickup, return, and hire scheduling.',
                'commerce_modes' => ['services_bookings', 'custom_orders_quotes'],
                'modules' => ['rentals', 'bookings', 'availability', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'subscriptions_memberships' => [
                'label' => 'Subscriptions / memberships',
                'description' => 'Recurring plans, member access, paid communities, and membership management.',
                'commerce_modes' => ['subscriptions_memberships'],
                'modules' => ['subscriptions', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
            'other' => [
                'label' => 'Other / not sure yet',
                'description' => 'Start simple and choose modules from the dashboard later.',
                'commerce_modes' => [],
                'modules' => ['products', 'services', 'orders', 'customers', 'communications', 'reports', 'bookkeeping'],
            ],
        ];

        return collect($operations)
            ->map(fn (array $operation) => [
                ...$operation,
                'commerce_modes' => CommerceModeRegistry::normalize($operation['commerce_modes'] ?? []),
                'modules' => BusinessModuleRegistry::normalize($operation['modules'] ?? []),
            ])
            ->all();
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

    public static function get(?string $primaryOperation, array $operations = []): array
    {
        $all = self::all();
        $primary = is_string($primaryOperation) && isset($all[$primaryOperation])
            ? $primaryOperation
            : null;
        $selected = self::normalize(array_filter([$primary, ...$operations]));

        if ($primary && ! in_array($primary, $selected, true)) {
            array_unshift($selected, $primary);
        }

        $selected = $selected ?: ['other'];
        $labels = collect($selected)->map(fn ($key) => $all[$key]['label'])->values()->all();

        return [
            'primary_operation' => $primary ?: $selected[0],
            'operations' => $selected,
            'operation_labels' => $labels,
            'recommended_modules' => BusinessModuleRegistry::normalize(
                collect($selected)->flatMap(fn ($key) => $all[$key]['modules'] ?? [])->all()
            ),
            'recommended_commerce_modes' => CommerceModeRegistry::normalize(
                collect($selected)->flatMap(fn ($key) => $all[$key]['commerce_modes'] ?? [])->all()
            ),
        ];
    }
}
