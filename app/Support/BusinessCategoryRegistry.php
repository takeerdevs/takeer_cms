<?php

namespace App\Support;

class BusinessCategoryRegistry
{
    public static function all(): array
    {
        $categories = [
            'retail_shop' => [
                'label' => 'Retail shop',
                'commerce_modes' => ['physical_products'],
                'modules' => ['products', 'retail_ops', 'customers', 'communications', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['physical_product', 'bundle', 'custom_order'],
                'subcategories' => [
                    'general_store' => ['label' => 'General store'],
                    'fashion' => ['label' => 'Fashion / clothing'],
                    'electronics' => ['label' => 'Electronics'],
                    'beauty_products' => ['label' => 'Beauty products'],
                    'grocery' => ['label' => 'Grocery / food shop'],
                ],
            ],
            'education_training' => [
                'label' => 'Education & training',
                'commerce_modes' => ['courses_learning', 'digital_products', 'subscriptions_memberships'],
                'modules' => ['courses', 'enrollments', 'availability', 'customers', 'communications', 'services', 'subscriptions', 'digital_products', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['course', 'short_course', 'workshop', 'cohort', 'private_lesson', 'subscription_plan', 'digital_material'],
                'subcategories' => [
                    'professional_training' => ['label' => 'Professional training'],
                    'short_courses' => ['label' => 'Short courses', 'commerce_modes' => ['courses_learning', 'digital_products'], 'modules' => ['courses', 'workshops', 'enrollments', 'communications', 'digital_products', 'bookkeeping', 'marketing']],
                    'school_or_academy' => ['label' => 'School / academy', 'commerce_modes' => ['courses_learning', 'subscriptions_memberships', 'digital_products'], 'modules' => ['courses', 'enrollments', 'subscriptions', 'communications', 'digital_products', 'bookkeeping', 'marketing', 'team']],
                    'tutoring' => ['label' => 'Tutoring', 'commerce_modes' => ['services_bookings', 'courses_learning', 'digital_products'], 'modules' => ['services', 'bookings', 'availability', 'courses', 'communications', 'digital_products', 'bookkeeping', 'marketing']],
                    'workshops' => ['label' => 'Workshops', 'commerce_modes' => ['courses_learning', 'services_bookings'], 'modules' => ['workshops', 'bookings', 'availability', 'enrollments', 'communications', 'digital_products', 'bookkeeping', 'marketing']],
                ],
            ],
            'printing_services' => [
                'label' => 'Printing services',
                'commerce_modes' => ['custom_orders_quotes', 'physical_products', 'services_bookings'],
                'modules' => ['custom_orders', 'services', 'quotes', 'products', 'customers', 'communications', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['print_product', 'custom_print_order', 'design_service', 'bulk_quote'],
                'subcategories' => [
                    'document_printing' => ['label' => 'Document printing'],
                    'business_branding' => ['label' => 'Business cards / branding'],
                    'large_format' => ['label' => 'Banners / large format'],
                    'apparel_printing' => ['label' => 'T-shirt / apparel printing'],
                    'packaging_labels' => ['label' => 'Packaging / labels'],
                ],
            ],
            'accommodation_stays' => [
                'label' => 'Accommodation & stays',
                'commerce_modes' => ['services_bookings'],
                'modules' => ['rooms', 'bookings', 'availability', 'customers', 'communications', 'services', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['room_type', 'apartment', 'stay_package', 'long_stay'],
                'subcategories' => [
                    'hotel' => ['label' => 'Hotel', 'commerce_modes' => ['services_bookings', 'food_menu'], 'modules' => ['rooms', 'bookings', 'availability', 'menu', 'services', 'communications', 'bookkeeping', 'marketing', 'team']],
                    'motel' => ['label' => 'Motel', 'commerce_modes' => ['services_bookings', 'food_menu'], 'modules' => ['rooms', 'bookings', 'availability', 'menu', 'services', 'communications', 'bookkeeping', 'marketing']],
                    'guest_house' => ['label' => 'Guest house', 'modules' => ['rooms', 'bookings', 'availability', 'services', 'communications', 'bookkeeping', 'marketing']],
                    'lodge' => ['label' => 'Lodge', 'commerce_modes' => ['services_bookings', 'food_menu'], 'modules' => ['rooms', 'bookings', 'availability', 'menu', 'tour_departures', 'services', 'communications', 'bookkeeping', 'marketing']],
                    'serviced_apartment' => ['label' => 'Serviced apartment'],
                    'hostel' => ['label' => 'Hostel'],
                ],
            ],
            'travel_tours' => [
                'label' => 'Travel & tours',
                'commerce_modes' => ['services_bookings', 'custom_orders_quotes'],
                'modules' => ['tour_departures', 'bookings', 'availability', 'rentals', 'customers', 'communications', 'services', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['tour_package', 'safari', 'boat_trip', 'private_trip', 'holiday_package', 'vehicle_hire'],
                'subcategories' => [
                    'tour_operator' => ['label' => 'Tour operator'],
                    'safari' => ['label' => 'Safari'],
                    'boat_trips' => ['label' => 'Boat trips', 'modules' => ['tour_departures', 'rentals', 'bookings', 'availability', 'services', 'communications', 'bookkeeping', 'marketing']],
                    'vehicle_hire' => ['label' => 'Vehicle hire', 'commerce_modes' => ['services_bookings', 'custom_orders_quotes'], 'modules' => ['rentals', 'bookings', 'availability', 'services', 'quotes', 'communications', 'bookkeeping', 'marketing']],
                    'holiday_packages' => ['label' => 'Holiday packages'],
                    'local_experiences' => ['label' => 'Local experiences'],
                ],
            ],
            'rentals_hire' => [
                'label' => 'Rentals & hire',
                'commerce_modes' => ['services_bookings', 'custom_orders_quotes', 'physical_products'],
                'modules' => ['rentals', 'bookings', 'availability', 'services', 'quotes', 'products', 'customers', 'communications', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['equipment_hire', 'vehicle_hire', 'event_equipment', 'space_hire', 'rental_package'],
                'subcategories' => [
                    'equipment_hire' => ['label' => 'Equipment hire'],
                    'car_hire' => ['label' => 'Car hire'],
                    'event_equipment' => ['label' => 'Event equipment'],
                    'space_hire' => ['label' => 'Space / venue hire'],
                    'costume_or_props' => ['label' => 'Costumes / props'],
                    'other' => ['label' => 'Other rentals'],
                ],
            ],
            'food_custom_orders' => [
                'label' => 'Food & custom orders',
                'commerce_modes' => ['food_menu', 'custom_orders_quotes', 'physical_products'],
                'modules' => ['menu', 'custom_orders', 'products', 'customers', 'communications', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['custom_order', 'catering_package', 'made_to_order_product', 'event_food'],
                'subcategories' => [
                    'restaurant' => ['label' => 'Restaurant', 'commerce_modes' => ['food_menu'], 'modules' => ['menu', 'orders', 'reservations', 'availability', 'delivery', 'communications', 'bookkeeping', 'marketing', 'team']],
                    'bakery' => ['label' => 'Bakery'],
                    'cakes' => ['label' => 'Cakes'],
                    'catering' => ['label' => 'Catering', 'commerce_modes' => ['food_menu', 'custom_orders_quotes', 'services_bookings'], 'modules' => ['menu', 'custom_orders', 'quotes', 'bookings', 'availability', 'delivery', 'communications', 'bookkeeping', 'marketing']],
                    'meal_prep' => ['label' => 'Meal prep', 'commerce_modes' => ['food_menu', 'subscriptions_memberships'], 'modules' => ['menu', 'subscriptions', 'delivery', 'communications', 'bookkeeping', 'marketing']],
                    'custom_gifts' => ['label' => 'Custom gifts'],
                ],
            ],
            'professional_services' => [
                'label' => 'Professional services',
                'commerce_modes' => ['services_bookings', 'custom_orders_quotes'],
                'modules' => ['services', 'quotes', 'bookings', 'availability', 'customers', 'communications', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['consultation', 'project_quote', 'retainer', 'document_service'],
                'subcategories' => [
                    'consulting' => ['label' => 'Consulting'],
                    'legal' => ['label' => 'Legal'],
                    'accounting_tax' => ['label' => 'Accounting / tax'],
                    'business_registration' => ['label' => 'Business registration'],
                    'it_support' => ['label' => 'IT support'],
                ],
            ],
            'beauty_personal_care' => [
                'label' => 'Beauty & personal care',
                'commerce_modes' => ['services_bookings', 'physical_products'],
                'modules' => ['appointments', 'availability', 'services', 'products', 'customers', 'communications', 'team', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['appointment', 'package', 'product', 'membership'],
                'subcategories' => [
                    'salon' => ['label' => 'Salon'],
                    'barber' => ['label' => 'Barber'],
                    'spa' => ['label' => 'Spa'],
                    'makeup' => ['label' => 'Makeup'],
                    'nails' => ['label' => 'Nails'],
                ],
            ],
            'other' => [
                'label' => 'Other business',
                'commerce_modes' => ['physical_products', 'services_bookings'],
                'modules' => ['products', 'services', 'digital_products', 'customers', 'communications', 'reports', 'bookkeeping', 'marketing'],
                'offer_types' => ['physical_product', 'digital_product', 'service', 'booking', 'custom_order', 'enquiry'],
                'subcategories' => [
                    'other' => ['label' => 'Other'],
                ],
            ],
        ];

        foreach ($categories as $key => $category) {
            $categories[$key]['modules'] = BusinessModuleRegistry::normalize($category['modules'] ?? []);
            $categories[$key]['commerce_modes'] = CommerceModeRegistry::normalize($category['commerce_modes'] ?? []);
            $categories[$key]['recommended_modules'] = $categories[$key]['modules'];
            $categories[$key]['recommended_commerce_modes'] = $categories[$key]['commerce_modes'];
            $categories[$key]['available_modules'] = BusinessModuleRegistry::keys();

            foreach ($category['subcategories'] ?? [] as $subcategoryKey => $subcategory) {
                if (isset($subcategory['modules'])) {
                    $categories[$key]['subcategories'][$subcategoryKey]['modules'] = BusinessModuleRegistry::normalize($subcategory['modules']);
                }
                if (isset($subcategory['commerce_modes'])) {
                    $categories[$key]['subcategories'][$subcategoryKey]['commerce_modes'] = CommerceModeRegistry::normalize($subcategory['commerce_modes']);
                }
            }

            if ($key !== 'other') {
                $categories[$key]['subcategories']['other'] = ['label' => 'Other'];
            }
        }

        return $categories;
    }

    public static function get(?string $categoryKey, ?string $subcategoryKey = null): ?array
    {
        $category = self::all()[$categoryKey] ?? null;
        if (! $category) {
            return null;
        }

        $subcategory = $subcategoryKey ? ($category['subcategories'][$subcategoryKey] ?? null) : null;
        $recommendedCommerceModes = CommerceModeRegistry::normalize($subcategory['commerce_modes'] ?? $category['recommended_commerce_modes'] ?? $category['commerce_modes']);
        $recommendedModules = BusinessModuleRegistry::normalize($subcategory['modules'] ?? $category['recommended_modules'] ?? $category['modules']);

        return [
            'key' => $categoryKey,
            'label' => $category['label'],
            'subcategory_key' => $subcategoryKey,
            'subcategory_label' => $subcategory['label'] ?? null,
            'modules' => $recommendedModules,
            'recommended_modules' => $recommendedModules,
            'commerce_modes' => $recommendedCommerceModes,
            'recommended_commerce_modes' => $recommendedCommerceModes,
            'available_modules' => $category['available_modules'] ?? BusinessModuleRegistry::keys(),
            'offer_types' => $category['offer_types'],
            'subcategories' => $category['subcategories'],
        ];
    }

    public static function modulesFor(?string $categoryKey, ?string $subcategoryKey = null): array
    {
        return self::get($categoryKey, $subcategoryKey)['modules'] ?? [];
    }
}
