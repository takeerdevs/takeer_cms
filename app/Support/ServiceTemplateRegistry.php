<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ServiceCategory;
use Illuminate\Support\Str;

class ServiceTemplateRegistry
{
    public static function forCategory(?ServiceCategory $category): array
    {
        $templateKey = $category?->service_template_key ?: self::templateKeyFor($category);
        $payload = self::template($templateKey, $category);

        return array_replace_recursive($payload, $category?->template_config ?: []);
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
