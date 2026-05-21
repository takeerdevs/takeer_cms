<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ServiceCategory;
use Illuminate\Support\Str;

class ServiceTemplateRegistry
{
    public static function all(): array
    {
        return collect(self::keys())
            ->mapWithKeys(fn (string $key) => [$key => self::template($key, null)])
            ->all();
    }

    public static function keys(): array
    {
        return [
            'appointment_or_quote',
            'stay',
            'learning',
            'tour',
            'space_booking',
            'rental',
            'orderable_service',
        ];
    }

    public static function normalizeKeys(array $keys): array
    {
        $valid = self::keys();

        return collect($keys)
            ->filter(fn ($key) => is_string($key) && in_array($key, $valid, true))
            ->unique()
            ->values()
            ->all();
    }

    public static function forCategory(?ServiceCategory $category): array
    {
        $templateKey = $category?->service_template_key ?: self::templateKeyFor($category);
        $payload = self::template($templateKey, $category);

        return array_replace_recursive($payload, $category?->template_config ?: []);
    }

    public static function allowedForCategory(?ServiceCategory $category): array
    {
        if (! $category) {
            return self::all();
        }

        $default = $category->service_template_key ?: self::templateKeyFor($category);
        $keys = self::normalizeKeys($category->allowed_template_keys ?: []);
        $keys = self::normalizeKeys([$default, ...$keys]);

        return collect($keys)
            ->map(fn (string $key) => array_replace_recursive(
                self::template($key, $category),
                ($category->template_config ?: [])[$key] ?? []
            ))
            ->values()
            ->all();
    }

    public static function forProduct(Product $product): array
    {
        $category = $product->relationLoaded('serviceSubcategory') && $product->serviceSubcategory
            ? $product->serviceSubcategory
            : ($product->relationLoaded('serviceCategory') ? $product->serviceCategory : null);

        if (! $category && ($product->service_subcategory_id || $product->service_category_id)) {
            $category = ServiceCategory::query()
                ->find($product->service_subcategory_id ?: $product->service_category_id);
        }
        $category?->loadMissing('parent');

        $payload = self::forCategory($category);
        if ($product->service_template_key && $product->service_template_key !== ($payload['key'] ?? null)) {
            $payload = self::template($product->service_template_key, $category);
        }
        $payload['selected_option_template'] = $category?->option_template;
        $payload['saved_details'] = $product->service_details ?: [];

        return $payload;
    }

    public static function templateKeyForCategory(?ServiceCategory $category): string
    {
        return self::templateKeyFor($category);
    }

    private static function templateKeyFor(?ServiceCategory $category): string
    {
        $text = Str::lower(trim(implode(' ', array_filter([
            $category?->parent?->name,
            $category?->name,
            $category?->slug,
        ]))));

        return match (true) {
            str_contains($text, 'hotel'),
            str_contains($text, 'guest house'),
            str_contains($text, 'lodge'),
            str_contains($text, 'hostel'),
            str_contains($text, 'resort'),
            str_contains($text, 'short stay'),
            str_contains($text, 'serviced apartment'),
            str_contains($text, 'homestay'),
            str_contains($text, 'chalet'),
            str_contains($text, 'accommodation') => 'stay',

            str_contains($text, 'course'),
            str_contains($text, 'training'),
            str_contains($text, 'class'),
            str_contains($text, 'workshop'),
            str_contains($text, 'tutoring'),
            str_contains($text, 'driving school') => 'learning',

            str_contains($text, 'venue'),
            str_contains($text, 'sports booking'),
            str_contains($text, 'recreation venue') => 'space_booking',

            str_contains($text, 'car hire'),
            str_contains($text, 'boat hire'),
            str_contains($text, 'bus/van hire'),
            str_contains($text, 'equipment hire') => 'rental',

            str_contains($text, 'catering'),
            str_contains($text, 'bakery'),
            str_contains($text, 'flower delivery'),
            str_contains($text, 'pharmacy delivery') => 'orderable_service',

            str_contains($text, 'tour'),
            str_contains($text, 'safari'),
            str_contains($text, 'boat trip'),
            str_contains($text, 'holiday package') => 'tour',

            default => 'appointment_or_quote',
        };
    }

    private static function template(string $key, ?ServiceCategory $category): array
    {
        $base = [
            'key' => $key,
            'label' => 'Service',
            'admin_module' => 'service_requests',
            'category_id' => $category?->id,
            'recommended_defaults' => [
                'service_mode' => 'book_appointment',
                'service_scheduling_type' => 'none',
                'service_price_display' => 'starts_from',
                'service_location_type' => 'provider_location',
            ],
            'post_template' => [
                'layout' => 'service_card',
                'media_prompt' => 'Show the actual service result, location, provider, or package.',
                'primary_badges' => ['service_category', 'price_display', 'trust_status'],
                'summary_fields' => ['service_area', 'service_location_type', 'duration_or_availability'],
            ],
            'merchant_fields' => [
                'common' => ['title', 'category', 'price_display', 'service_mode', 'location', 'requirements', 'photos'],
                'specialized' => [],
                'detail_sections' => [],
            ],
            'subtypes' => [
                ['key' => 'none', 'label' => 'Standard service', 'description' => 'Use the normal service creation flow without extra subtype rules.'],
                ['key' => 'appointment', 'label' => 'Appointment', 'description' => 'Customer books or requests time with the provider.'],
                ['key' => 'home_visit', 'label' => 'Home visit', 'description' => 'Provider visits the customer location.'],
                ['key' => 'site_inspection', 'label' => 'Site inspection', 'description' => 'Provider inspects before quoting or starting work.'],
                ['key' => 'emergency_request', 'label' => 'Emergency request', 'description' => 'Urgent request with manual confirmation.'],
                ['key' => 'quote_project', 'label' => 'Quote / project', 'description' => 'Customer requests a custom quote or project scope.'],
            ],
            'buyer_checkout' => [
                'mode' => 'contact_or_pay',
                'required_inputs' => ['customer_name', 'customer_phone'],
                'optional_inputs' => ['message'],
                'pricing_inputs' => [],
            ],
            'availability' => [
                'mode' => 'manual',
                'capacity_source' => 'none',
            ],
        ];

        return match ($key) {
            'stay' => array_replace_recursive($base, [
                'label' => 'Stay / accommodation',
                'admin_module' => 'room_bookings',
                'recommended_defaults' => [
                    'service_mode' => 'pay_now',
                    'service_scheduling_type' => 'none',
                    'service_price_display' => 'nightly',
                    'service_location_type' => 'provider_location',
                ],
                'post_template' => [
                    'layout' => 'stay_rooms',
                    'primary_badges' => ['room_type', 'nightly_price', 'guests', 'availability'],
                    'summary_fields' => ['checkin_checkout', 'service_area', 'provider_location'],
                ],
                'merchant_fields' => [
                    'specialized' => ['room_or_unit_options', 'max_guests', 'checkin_time', 'checkout_time', 'house_rules', 'amenities'],
                    'detail_sections' => ['amenities', 'house_rules'],
                ],
                'subtypes' => [
                    ['key' => 'none', 'label' => 'Standard stay', 'description' => 'Use the normal stay workflow without extra subtype rules.'],
                    ['key' => 'room', 'label' => 'Room', 'description' => 'Single room or suite.'],
                    ['key' => 'apartment', 'label' => 'Apartment / unit', 'description' => 'Entire apartment, house, or serviced unit.'],
                    ['key' => 'bed', 'label' => 'Bed / shared stay', 'description' => 'Hostel bed or shared stay option.'],
                    ['key' => 'homestay', 'label' => 'Homestay', 'description' => 'Hosted stay in a home setting.'],
                ],
                'buyer_checkout' => [
                    'mode' => 'book_or_request',
                    'required_inputs' => ['customer_name', 'customer_phone', 'check_in', 'check_out', 'guests', 'service_option_id'],
                    'optional_inputs' => ['rooms', 'special_requests'],
                    'pricing_inputs' => [
                        'check_in' => 'service_pricing_inputs.start_date',
                        'check_out' => 'service_pricing_inputs.end_date',
                        'guests' => 'service_pricing_inputs.people',
                        'rooms' => 'service_pricing_inputs.quantity',
                    ],
                ],
                'availability' => [
                    'mode' => 'date_range_capacity',
                    'capacity_source' => 'service_options',
                ],
            ]),
            'learning' => array_replace_recursive($base, [
                'label' => 'Education / enrollment',
                'admin_module' => 'enrollments',
                'recommended_defaults' => [
                    'service_mode' => 'book_appointment',
                    'service_scheduling_type' => 'fixed_sessions',
                    'service_price_display' => 'per_session',
                    'service_location_type' => 'hybrid',
                ],
                'post_template' => [
                    'layout' => 'course_outline',
                    'primary_badges' => ['course_level', 'start_date', 'seats_available', 'delivery_mode'],
                    'summary_fields' => ['outcomes', 'schedule', 'requirements'],
                ],
                'merchant_fields' => [
                    'specialized' => ['levels_or_cohorts', 'sessions', 'capacity', 'learning_outcomes', 'materials'],
                    'detail_sections' => ['outcomes', 'requirements', 'certificate'],
                ],
                'subtypes' => [
                    ['key' => 'none', 'label' => 'Standard learning', 'description' => 'Use the normal learning workflow without extra subtype rules.'],
                    ['key' => 'course', 'label' => 'Course', 'description' => 'Structured course or class.'],
                    ['key' => 'tutoring', 'label' => 'Tutoring', 'description' => 'One-on-one or small group tutoring.'],
                    ['key' => 'workshop', 'label' => 'Workshop', 'description' => 'Short practical training session.'],
                    ['key' => 'cohort', 'label' => 'Cohort', 'description' => 'Scheduled cohort with seats and sessions.'],
                    ['key' => 'driving_school', 'label' => 'Driving school', 'description' => 'Driving lessons or road training.'],
                ],
                'buyer_checkout' => [
                    'mode' => 'enroll_or_request',
                    'required_inputs' => ['student_name', 'customer_phone'],
                    'optional_inputs' => ['student_email', 'experience_level', 'goals'],
                    'pricing_inputs' => [
                        'attendees' => 'service_pricing_inputs.people',
                        'session' => 'selected_session_id',
                    ],
                ],
                'availability' => [
                    'mode' => 'session_capacity',
                    'capacity_source' => 'service_sessions',
                ],
            ]),
            'tour' => array_replace_recursive($base, [
                'label' => 'Tour / travel package',
                'admin_module' => 'tour_departures',
                'recommended_defaults' => [
                    'service_mode' => 'pay_now',
                    'service_scheduling_type' => 'fixed_sessions',
                    'service_price_display' => 'per_person',
                    'service_location_type' => 'provider_location',
                ],
                'post_template' => [
                    'layout' => 'itinerary_story',
                    'media_prompt' => 'Show the destination, real stops, vehicle/guide, rooms if included, and activities.',
                    'primary_badges' => ['duration', 'destination', 'departure_dates', 'seats_left'],
                    'summary_fields' => ['itinerary', 'included_items', 'pickup_point', 'requirements'],
                ],
                'merchant_fields' => [
                    'specialized' => ['itinerary_days', 'departures', 'seats', 'pickup_dropoff', 'inclusions', 'exclusions', 'traveler_requirements'],
                    'detail_sections' => ['itinerary', 'included', 'excluded', 'pickup', 'requirements'],
                ],
                'subtypes' => [
                    ['key' => 'none', 'label' => 'Standard tour', 'description' => 'Use the normal tour workflow without extra subtype rules.'],
                    ['key' => 'tour_package', 'label' => 'Tour package', 'description' => 'Packaged trip with itinerary and inclusions.'],
                    ['key' => 'safari', 'label' => 'Safari', 'description' => 'Safari or nature travel package.'],
                    ['key' => 'boat_trip', 'label' => 'Boat trip', 'description' => 'Boat trip or water experience.'],
                    ['key' => 'guided_trip', 'label' => 'Guided trip', 'description' => 'Guide-led destination experience.'],
                ],
                'buyer_checkout' => [
                    'mode' => 'book_tour',
                    'required_inputs' => ['customer_name', 'customer_phone', 'departure', 'adults'],
                    'optional_inputs' => ['children', 'pickup_location', 'traveler_names', 'special_requests'],
                    'pricing_inputs' => [
                        'adults' => 'service_pricing_inputs.people',
                        'departure' => 'selected_session_id',
                    ],
                ],
                'availability' => [
                    'mode' => 'departure_seats',
                    'capacity_source' => 'service_sessions',
                ],
            ]),
            'space_booking', 'rental' => array_replace_recursive($base, [
                'label' => $key === 'rental' ? 'Rental / hire' : 'Venue / space booking',
                'admin_module' => $key === 'rental' ? 'rental_reservations' : 'space_bookings',
                'recommended_defaults' => [
                    'service_mode' => 'pay_now',
                    'service_scheduling_type' => 'none',
                    'service_price_display' => 'daily',
                    'service_location_type' => 'provider_location',
                ],
                'merchant_fields' => [
                    'specialized' => ['bookable_units', 'capacity', 'availability_rules', 'deposit_or_terms'],
                    'detail_sections' => ['terms', 'included', 'requirements'],
                ],
                'subtypes' => $key === 'rental'
                    ? [
                        ['key' => 'none', 'label' => 'Standard rental', 'description' => 'Use the normal rental workflow without extra subtype rules.'],
                        ['key' => 'tools_equipment', 'label' => 'Tools / equipment', 'description' => 'Tools, machines, electronics, or equipment hire.'],
                        ['key' => 'vehicle', 'label' => 'Vehicle', 'description' => 'Cars, vans, motorcycles, boats, or transport units.'],
                        ['key' => 'event_equipment', 'label' => 'Event equipment', 'description' => 'Sound, tents, chairs, lighting, decor, or party gear.'],
                        ['key' => 'space', 'label' => 'Space', 'description' => 'A rentable space managed as a rental item.'],
                        ['key' => 'other', 'label' => 'Other rental', 'description' => 'Another rentable item or unit.'],
                    ]
                    : [
                        ['key' => 'none', 'label' => 'Standard space booking', 'description' => 'Use the normal booking workflow without extra subtype rules.'],
                        ['key' => 'venue', 'label' => 'Venue', 'description' => 'Hall, garden, wedding venue, or event venue.'],
                        ['key' => 'sports_court', 'label' => 'Sports court', 'description' => 'Court, pitch, field, or sports facility.'],
                        ['key' => 'meeting_room', 'label' => 'Meeting room', 'description' => 'Meeting, training, or conference room.'],
                        ['key' => 'recreation_space', 'label' => 'Recreation space', 'description' => 'Recreation or activity space.'],
                    ],
                'buyer_checkout' => [
                    'mode' => 'reserve_or_request',
                    'required_inputs' => ['customer_name', 'customer_phone', 'start_date', 'end_date', 'service_option_id'],
                    'optional_inputs' => ['people', 'notes'],
                    'pricing_inputs' => [
                        'start_date' => 'service_pricing_inputs.start_date',
                        'end_date' => 'service_pricing_inputs.end_date',
                        'people' => 'service_pricing_inputs.people',
                    ],
                ],
                'availability' => [
                    'mode' => 'date_range_capacity',
                    'capacity_source' => 'service_options',
                ],
            ]),
            'orderable_service' => array_replace_recursive($base, [
                'label' => 'Custom order',
                'admin_module' => 'custom_orders',
                'recommended_defaults' => [
                    'service_mode' => 'pay_now',
                    'service_scheduling_type' => 'none',
                    'service_price_display' => 'starts_from',
                    'service_location_type' => 'hybrid',
                ],
                'merchant_fields' => [
                    'specialized' => ['packages', 'quantity_units', 'lead_time', 'delivery_or_pickup_area'],
                    'detail_sections' => ['customization', 'lead_time', 'delivery_pickup'],
                ],
                'subtypes' => [
                    ['key' => 'none', 'label' => 'Standard custom order', 'description' => 'Use the normal custom order workflow without extra subtype rules.'],
                    ['key' => 'catering', 'label' => 'Catering', 'description' => 'Food service, meal prep, or event catering.'],
                    ['key' => 'bakery_cake', 'label' => 'Bakery / cake', 'description' => 'Cakes, baked goods, or custom desserts.'],
                    ['key' => 'printing', 'label' => 'Printing', 'description' => 'Print jobs, branding, merchandise, or custom printing.'],
                    ['key' => 'delivery', 'label' => 'Delivery', 'description' => 'Delivery-led services such as pharmacy or flowers.'],
                    ['key' => 'custom_made', 'label' => 'Custom made item', 'description' => 'Made-to-order item or custom package.'],
                ],
                'buyer_checkout' => [
                    'mode' => 'order_or_request',
                    'required_inputs' => ['customer_name', 'customer_phone', 'quantity'],
                    'optional_inputs' => ['delivery_date', 'notes'],
                    'pricing_inputs' => [
                        'quantity' => 'service_pricing_inputs.quantity',
                    ],
                ],
                'availability' => [
                    'mode' => 'lead_time',
                    'capacity_source' => 'merchant_confirmation',
                ],
            ]),
            default => $base,
        };
    }
}
