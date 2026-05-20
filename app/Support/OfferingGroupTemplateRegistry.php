<?php

namespace App\Support;

class OfferingGroupTemplateRegistry
{
    public static function all(): array
    {
        return [
            'menu_board' => [
                'label' => 'Menu board',
                'group_type' => 'menu',
                'description' => 'A food or drinks menu with sections, item choices, add-ons, and multi-item ordering.',
                'default_pricing_mode' => 'sum_children',
                'default_checkout_mode' => 'select_items',
                'default_availability_mode' => 'group_schedule',
                'sections' => ['Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Add-ons'],
                'item_roles' => ['optional', 'add_on', 'required_choice', 'visible_only'],
                'layouts' => ['classic_menu', 'photo_grid', 'price_board', 'room_service'],
            ],
            'service_package' => [
                'label' => 'Service package',
                'group_type' => 'package',
                'description' => 'A package made of included services, optional add-ons, required choices, and request/quote rules.',
                'default_pricing_mode' => 'sum_children',
                'default_checkout_mode' => 'select_items',
                'default_availability_mode' => 'inherit_children',
                'sections' => ['Included', 'Options', 'Add-ons', 'Requirements'],
                'item_roles' => ['included', 'optional', 'add_on', 'required_choice', 'visible_only'],
                'layouts' => ['package', 'catalog_grid', 'price_list'],
            ],
            'itinerary' => [
                'label' => 'Itinerary',
                'group_type' => 'itinerary',
                'description' => 'A day-by-day or step-by-step offering for tours, events, delivery plans, and complex services.',
                'default_pricing_mode' => 'fixed_or_sum',
                'default_checkout_mode' => 'book_group',
                'default_availability_mode' => 'group_schedule',
                'sections' => ['Day 1', 'Day 2', 'Day 3', 'Add-ons'],
                'item_roles' => ['included', 'optional', 'add_on', 'visible_only'],
                'layouts' => ['timeline', 'trip_package', 'schedule'],
            ],
        ];
    }

    public static function keys(): array
    {
        return array_keys(self::all());
    }

    public static function get(?string $key): ?array
    {
        $templates = self::all();

        return $key && isset($templates[$key]) ? $templates[$key] : null;
    }
}
