<?php

namespace Database\Seeders;

use App\Models\ServiceCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ServiceCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            'Health & Wellness' => ['Doctor appointment', 'Clinic service', 'Therapy', 'Physiotherapy', 'Nutrition', 'Home care', 'Telemedicine', 'Pharmacy Delivery'],
            'Beauty & Personal Care' => ['Barber', 'Salon', 'Spa', 'Massage', 'Makeup', 'Nails', 'Skincare', 'Tattoo & Piercing'],
            'Home & Repairs' => ['Handyman', 'Plumbing', 'Electrical', 'Appliance repair', 'Carpentry', 'Painting', 'Construction', 'Solar Installation', 'Locksmith', 'Interior Design'],
            'Cleaning & Domestic' => ['Home cleaning', 'Office cleaning', 'Laundry', 'Pest control', 'Domestic help', 'Deep cleaning', 'Window Cleaning', 'Industrial Cleaning', 'Waste Removal'],
            'Gardening & Outdoor' => ['Landscaping', 'Gardening', 'Pool Maintenance', 'Fencing', 'Tree Trimming', 'Outdoor Lighting'],
            'Automotive & Garage' => ['Garage service', 'Mechanic', 'Car wash', 'Vehicle inspection', 'Towing', 'Tyre service', 'Auto electrician', 'Mobile Mechanic', 'Auto Import/Export', 'Car Maintenance'],
            'Accommodation & Stays' => ['Hotel', 'Guest house', 'Lodge', 'Short stay', 'Serviced apartment', 'Hostel', 'Resort', 'Homestay', 'Chalet'],
            'Transport & Hire' => ['Car hire', 'Boat hire', 'Driver service', 'Airport transfer', 'Bus/van hire', 'Equipment hire', 'Courier', 'Taxi Service', 'Limousine Service'],
            'Moving & Logistics' => ['House moving', 'Office moving', 'Packing', 'Truck hire', 'Storage', 'Cargo delivery', 'Furniture moving'],
            'Education & Training' => ['Course', 'Tutoring', 'Workshop', 'Professional training', 'Driving school', 'Language class', 'Online class', 'Music Lessons'],
            'Professional Services' => ['Consulting', 'Legal', 'Accounting', 'Business registration', 'Tax service', 'Insurance', 'Translation', 'Security Services'],
            'Technology & Digital' => ['IT Support', 'Web Development', 'App Development', 'Software Installation', 'Cybersecurity', 'Internet Service', 'CCTV & Smart Home'],
            'Creative & Media' => ['Graphic design', 'Video production', 'Music studio', 'Printing', 'Marketing', 'Content creation', 'Branding', 'Photography', 'Videography'],
            'Events & Hospitality' => ['Catering', 'Venue', 'Decoration', 'MC/DJ', 'Event planning', 'Wedding Venue', 'Party Venue', 'Flower Delivery'],
            'Food & Custom Orders' => ['Bakery', 'Cake order', 'Meal prep', 'Custom gift', 'Custom printing'],
            'Pets & Animals' => ['Veterinary', 'Pet Grooming', 'Dog Walking', 'Pet Sitting', 'Animal Training'],
            'Agriculture & Field Services' => ['Farm consultation', 'Irrigation', 'Soil testing', 'Field survey', 'Pest spraying', 'Livestock Management'],
            'Property & Survey' => ['Land survey', 'Valuation', 'Inspection', 'Real estate service', 'Architecture', 'Property management'],
            'Funeral & Medical Emergency' => ['Morgue service', 'Funeral service', 'Ambulance', 'Emergency Medical Response', 'Burial preparation'],
            'Travel & Recreation' => ['Tour package', 'Safari', 'Boat trip', 'Sports booking', 'Recreation venue', 'Tour guide', 'Holiday Packages'],
            'Other' => ['Other'],
        ];

        foreach ($categories as $index => $nameAndChildren) {
            $name = is_string($index) ? $index : (string) $nameAndChildren['name'];
            $children = is_array($nameAndChildren) ? $nameAndChildren : [];

            $parent = $this->upsertCategory(
                $name,
                null,
                array_search($name, array_keys($categories), true) + 1,
                null,
                null,
                $this->trustPolicyFor($name)
            );

            foreach ($children as $childIndex => $childName) {
                $this->upsertCategory(
                    $childName,
                    $parent->id,
                    $childIndex + 1,
                    $this->optionTemplateFor($name, $childName),
                    $this->serviceTemplateKeyFor($name, $childName),
                    $this->trustPolicyFor($name, $childName)
                );
            }
        }
    }

    private function upsertCategory(
        string $name,
        ?int $parentId,
        int $sortOrder,
        ?array $optionTemplate = null,
        ?string $serviceTemplateKey = null,
        array $trustPolicy = []
    ): ServiceCategory
    {
        return ServiceCategory::updateOrCreate(
            ['slug' => Str::slug($parentId ? "{$parentId}-{$name}" : $name)],
            [
                'parent_id' => $parentId,
                'name' => $name,
                'is_active' => true,
                'sort_order' => $sortOrder,
                'option_template' => $optionTemplate,
                'service_template_key' => $serviceTemplateKey,
                'risk_level' => $trustPolicy['risk_level'] ?? 'standard',
                'required_documents' => $trustPolicy['required_documents'] ?? [],
                'requires_manual_review' => (bool) ($trustPolicy['requires_manual_review'] ?? false),
                'payout_hold_days' => (int) ($trustPolicy['payout_hold_days'] ?? 3),
                'max_first_quote_amount' => $trustPolicy['max_first_quote_amount'] ?? null,
            ]
        );
    }

    private function serviceTemplateKeyFor(string $parentName, string $childName): string
    {
        $key = Str::lower("{$parentName} {$childName}");

        if (str_contains($key, 'accommodation') || str_contains($key, 'hotel') || str_contains($key, 'guest house') || str_contains($key, 'lodge') || str_contains($key, 'hostel') || str_contains($key, 'resort') || str_contains($key, 'short stay') || str_contains($key, 'serviced apartment') || str_contains($key, 'homestay') || str_contains($key, 'chalet')) {
            return 'stay';
        }

        if (str_contains($key, 'tour') || str_contains($key, 'safari') || str_contains($key, 'boat trip') || str_contains($key, 'holiday package')) {
            return 'tour';
        }

        if (str_contains($key, 'course') || str_contains($key, 'training') || str_contains($key, 'class') || str_contains($key, 'workshop') || str_contains($key, 'tutoring') || str_contains($key, 'driving school')) {
            return 'learning';
        }

        if (str_contains($key, 'venue') || str_contains($key, 'recreation venue') || str_contains($key, 'sports booking')) {
            return 'space_booking';
        }

        if (str_contains($key, 'car hire') || str_contains($key, 'boat hire') || str_contains($key, 'bus/van hire') || str_contains($key, 'equipment hire')) {
            return 'rental';
        }

        if (str_contains($key, 'catering') || str_contains($key, 'bakery') || str_contains($key, 'cake') || str_contains($key, 'meal prep') || str_contains($key, 'custom gift') || str_contains($key, 'printing') || str_contains($key, 'flower delivery') || str_contains($key, 'pharmacy delivery')) {
            return 'orderable_service';
        }

        return 'appointment_or_quote';
    }

    private function trustPolicyFor(string $parentName, ?string $childName = null): array
    {
        $key = Str::lower(trim($parentName . ' ' . ($childName ?? '')));

        $regulated = [
            'doctor', 'clinic', 'therapy', 'physiotherapy', 'home care', 'telemedicine',
            'nutrition', 'pharmacy', 'veterinary', 'ambulance', 'emergency medical',
            'morgue', 'burial',
        ];

        foreach ($regulated as $term) {
            if (str_contains($key, $term)) {
                return $this->regulatedPolicy();
            }
        }

        $licensed = [
            'legal', 'accounting', 'tax service', 'insurance', 'security services',
            'land survey', 'valuation', 'architecture', 'vehicle inspection',
            'driving school', 'driver service', 'taxi', 'airport transfer',
            'bus/van hire', 'car hire', 'boat hire', 'construction', 'electrical',
            'solar installation', 'locksmith', 'pest control', 'cybersecurity',
            'internet service', 'cctv',
        ];

        foreach ($licensed as $term) {
            if (str_contains($key, $term)) {
                return [
                    'risk_level' => 'elevated',
                    'required_documents' => ['identity', 'business_license'],
                    'requires_manual_review' => true,
                    'payout_hold_days' => 5,
                    'max_first_quote_amount' => 500000,
                ];
            }
        }

        $businessProof = [
            'hotel', 'guest house', 'lodge', 'serviced apartment', 'hostel', 'resort',
            'tour package', 'safari', 'tour guide', 'holiday packages', 'real estate',
            'property management', 'equipment hire', 'truck hire', 'cargo delivery',
            'auto import',
        ];

        foreach ($businessProof as $term) {
            if (str_contains($key, $term)) {
                return [
                    'risk_level' => 'elevated',
                    'required_documents' => ['identity', 'business_license'],
                    'requires_manual_review' => true,
                    'payout_hold_days' => 5,
                    'max_first_quote_amount' => 1000000,
                ];
            }
        }

        return [
            'risk_level' => 'standard',
            'required_documents' => ['identity'],
            'requires_manual_review' => false,
            'payout_hold_days' => 3,
            'max_first_quote_amount' => null,
        ];
    }

    private function regulatedPolicy(): array
    {
        return [
            'risk_level' => 'regulated',
            'required_documents' => ['identity', 'professional_license'],
            'requires_manual_review' => true,
            'payout_hold_days' => 7,
            'max_first_quote_amount' => 250000,
        ];
    }

    private function optionTemplateFor(string $parentName, string $childName): array
    {
        $key = Str::lower("{$parentName} {$childName}");

        if (str_contains($key, 'accommodation') || str_contains($key, 'hotel') || str_contains($key, 'guest house') || str_contains($key, 'lodge') || str_contains($key, 'hostel') || str_contains($key, 'resort') || str_contains($key, 'short stay') || str_contains($key, 'serviced apartment')) {
            return $this->template(
                'Room / stay type',
                'Create rooms, apartments, beds, or stay packages customers can choose before booking.',
                ['Standard Room', 'Deluxe Room', 'Family Room', 'Apartment'],
                capacity: true,
                maxGuests: true,
                durationMinutes: false,
                checkinTime: true,
                checkoutTime: true,
            );
        }

        if (str_contains($key, 'venue') || str_contains($key, 'recreation venue') || str_contains($key, 'sports booking')) {
            return $this->template(
                'Venue / space',
                'Create bookable spaces such as halls, gardens, courts, rooms, or grounds.',
                ['Main Hall', 'Garden Area', 'Conference Room', 'Football Pitch'],
                capacity: true,
                maxGuests: true,
                durationMinutes: true,
                checkinTime: true,
                checkoutTime: true,
            );
        }

        if (str_contains($key, 'car hire') || str_contains($key, 'boat hire') || str_contains($key, 'bus/van hire')) {
            return $this->template(
                'Vehicle / vessel',
                'Create vehicles, boats, or transport units customers can reserve.',
                ['Sedan', 'SUV', 'Van', 'Boat A'],
                capacity: true,
                maxGuests: true,
                durationMinutes: false,
                checkinTime: true,
                checkoutTime: true,
            );
        }

        if (str_contains($key, 'equipment hire')) {
            return $this->template(
                'Equipment unit',
                'Create equipment units customers can hire or reserve.',
                ['Generator', 'Camera Kit', 'Sound System', 'Projector'],
                capacity: true,
                maxGuests: false,
                durationMinutes: false,
                checkinTime: true,
                checkoutTime: true,
            );
        }

        if (str_contains($key, 'internet service')) {
            return $this->template(
                'Internet plan / speed bundle',
                'Create internet bundles customers can choose, such as speed tiers, monthly plans, installation packages, or router add-ons.',
                ['2 Mbps', '10 Mbps', '20 Mbps Unlimited', 'Installation + Router'],
                capacity: false,
                maxGuests: false,
                durationMinutes: false,
                checkinTime: false,
                checkoutTime: false,
                placeholder: '10 Mbps Unlimited',
                descriptionPlaceholder: 'Monthly plan, fair usage, installation fee, or router details',
                defaultPriceDisplay: 'monthly',
                capacityType: false,
            );
        }

        if (str_contains($key, 'airport transfer') || str_contains($key, 'driver service') || str_contains($key, 'courier') || str_contains($key, 'taxi') || str_contains($key, 'limousine') || str_contains($key, 'pharmacy delivery') || str_contains($key, 'flower delivery')) {
            return $this->template(
                'Trip / route option',
                'Create trip types, routes, or delivery options customers can book.',
                ['Airport Pickup', 'City Drop-off', 'Same-day Delivery', 'Express Delivery'],
                capacity: true,
                maxGuests: (str_contains($key, 'courier') || str_contains($key, 'delivery')) ? false : true,
                durationMinutes: true,
                checkinTime: false,
                checkoutTime: false,
            );
        }

        if (str_contains($key, 'course') || str_contains($key, 'training') || str_contains($key, 'class') || str_contains($key, 'workshop') || str_contains($key, 'tutoring') || str_contains($key, 'driving school')) {
            return $this->template(
                'Class / training option',
                'Create class levels, cohorts, sessions, or training packages.',
                ['Beginner Class', 'Private Session', 'Weekend Workshop', 'Online Class'],
                capacity: true,
                maxGuests: false,
                durationMinutes: true,
                checkinTime: false,
                checkoutTime: false,
            );
        }

        if (str_contains($key, 'barber') || str_contains($key, 'salon') || str_contains($key, 'spa') || str_contains($key, 'massage') || str_contains($key, 'makeup') || str_contains($key, 'nails') || str_contains($key, 'skincare')) {
            return $this->appointmentTemplate('Beauty service', ['Haircut', 'Shave', 'Full Massage', 'Makeup Session']);
        }

        if (str_contains($key, 'doctor') || str_contains($key, 'clinic') || str_contains($key, 'therapy') || str_contains($key, 'physiotherapy') || str_contains($key, 'telemedicine') || str_contains($key, 'nutrition')) {
            return $this->appointmentTemplate('Consultation type', ['General Consultation', 'Specialist Review', 'Follow-up', 'Home Visit']);
        }

        if (str_contains($key, 'cleaning') || str_contains($key, 'pest') || str_contains($key, 'laundry') || str_contains($key, 'domestic') || str_contains($key, 'window cleaning') || str_contains($key, 'waste removal')) {
            return $this->packageTemplate('Cleaning / domestic package', ['Studio Cleaning', 'Deep Cleaning', 'Office Package', 'Laundry Bundle']);
        }

        if (str_contains($key, 'plumbing') || str_contains($key, 'electrical') || str_contains($key, 'repair') || str_contains($key, 'carpentry') || str_contains($key, 'painting') || str_contains($key, 'construction') || str_contains($key, 'solar') || str_contains($key, 'locksmith') || str_contains($key, 'interior design')) {
            return $this->packageTemplate('Repair / site service', ['Inspection Visit', 'Emergency Visit', 'Installation', 'Full Job']);
        }

        if (str_contains($key, 'garage') || str_contains($key, 'mechanic') || str_contains($key, 'car wash') || str_contains($key, 'vehicle inspection') || str_contains($key, 'towing') || str_contains($key, 'tyre') || str_contains($key, 'auto electrician') || str_contains($key, 'car maintenance') || str_contains($key, 'auto import')) {
            return $this->appointmentTemplate('Vehicle service', ['Diagnosis', 'Full Service', 'Car Wash', 'Towing']);
        }

        if (str_contains($key, 'moving') || str_contains($key, 'packing') || str_contains($key, 'truck hire') || str_contains($key, 'storage') || str_contains($key, 'cargo') || str_contains($key, 'furniture')) {
            return $this->template(
                'Move / logistics option',
                'Create moving packages, truck sizes, storage units, or delivery options.',
                ['Small Truck', 'Home Move', 'Office Move', 'Storage Unit'],
                capacity: true,
                maxGuests: false,
                durationMinutes: true,
                checkinTime: false,
                checkoutTime: false,
            );
        }

        if (str_contains($key, 'consulting') || str_contains($key, 'legal') || str_contains($key, 'accounting') || str_contains($key, 'it support') || str_contains($key, 'business registration') || str_contains($key, 'tax service') || str_contains($key, 'design consultation') || str_contains($key, 'insurance') || str_contains($key, 'translation') || str_contains($key, 'security services')) {
            return $this->appointmentTemplate('Professional service', ['Consultation', 'Document Review', 'Setup Package', 'Advisory Session']);
        }

        if (str_contains($key, 'catering')) {
            return $this->template(
                'Catering package',
                'Create menu packages customers can choose for events or gatherings.',
                ['Breakfast Package', 'Lunch Buffet', 'Wedding Menu', 'Corporate Package'],
                capacity: false,
                maxGuests: true,
                durationMinutes: false,
                checkinTime: false,
                checkoutTime: false,
            );
        }

        if (str_contains($key, 'bakery') || str_contains($key, 'cake') || str_contains($key, 'meal prep') || str_contains($key, 'custom gift')) {
            return $this->template(
                'Custom order option',
                'Create orderable sizes, flavors, bundles, or custom packages.',
                ['Birthday Cake', 'Cupcake Box', 'Meal Package', 'Gift Package'],
                capacity: false,
                maxGuests: false,
                durationMinutes: false,
                checkinTime: false,
                checkoutTime: false,
                placeholder: 'Birthday Cake',
                descriptionPlaceholder: 'Size, flavor, customization, lead time, or pickup details',
                defaultPriceDisplay: 'starts_from',
                capacityType: false,
            );
        }

        if (str_contains($key, 'decoration') || str_contains($key, 'photography') || str_contains($key, 'videography') || str_contains($key, 'mc/dj') || str_contains($key, 'event planning')) {
            return $this->packageTemplate('Event package', ['Basic Package', 'Full Day Package', 'Wedding Package', 'Corporate Package']);
        }

        if (str_contains($key, 'survey') || str_contains($key, 'valuation') || str_contains($key, 'inspection') || str_contains($key, 'real estate') || str_contains($key, 'architecture') || str_contains($key, 'property management')) {
            return $this->packageTemplate('Property service package', ['Site Visit', 'Full Inspection', 'Valuation Report', 'Survey Package']);
        }

        if (str_contains($key, 'morgue') || str_contains($key, 'funeral') || str_contains($key, 'ambulance') || str_contains($key, 'rescue') || str_contains($key, 'burial')) {
            return $this->packageTemplate('Care / emergency option', ['Standard Service', 'Transport Service', 'Full Package', 'Urgent Support']);
        }

        if (str_contains($key, 'graphic design') || str_contains($key, 'video production') || str_contains($key, 'music studio') || str_contains($key, 'printing') || str_contains($key, 'marketing') || str_contains($key, 'content creation') || str_contains($key, 'branding') || str_contains($key, 'web development') || str_contains($key, 'app development') || str_contains($key, 'software installation') || str_contains($key, 'cybersecurity') || str_contains($key, 'cctv') || str_contains($key, 'smart home')) {
            return $this->packageTemplate('Creative package', ['Basic Package', 'Studio Session', 'Campaign Package', 'Premium Package']);
        }

        if (str_contains($key, 'gardening') || str_contains($key, 'landscaping') || str_contains($key, 'pool maintenance') || str_contains($key, 'fencing') || str_contains($key, 'tree trimming') || str_contains($key, 'outdoor lighting')) {
            return $this->packageTemplate('Outdoor service package', ['Garden Maintenance', 'Pool Visit', 'Fence Installation', 'Landscape Package']);
        }

        if (str_contains($key, 'farm') || str_contains($key, 'veterinary') || str_contains($key, 'irrigation') || str_contains($key, 'soil') || str_contains($key, 'field') || str_contains($key, 'pest spraying') || str_contains($key, 'livestock') || str_contains($key, 'pet grooming') || str_contains($key, 'dog walking') || str_contains($key, 'pet sitting') || str_contains($key, 'animal training')) {
            return $this->packageTemplate('Field service package', ['Farm Visit', 'Soil Test', 'Spraying Package', 'Consultation']);
        }

        if (str_contains($key, 'tour') || str_contains($key, 'safari') || str_contains($key, 'trip') || str_contains($key, 'sports booking')) {
            return $this->template(
                'Tour / experience',
                'Create trips, sessions, packages, or group experiences.',
                ['Half-day Tour', 'Full Safari', 'Boat Trip', 'City Tour'],
                capacity: true,
                maxGuests: true,
                durationMinutes: true,
                checkinTime: false,
                checkoutTime: false,
            );
        }

        return $this->packageTemplate('Service option', ['Basic Package', 'Standard Package', 'Premium Package']);
    }

    private function appointmentTemplate(string $label, array $examples): array
    {
        return $this->template(
            $label,
            'Create appointment or session types customers can choose before booking.',
            $examples,
            capacity: false,
            maxGuests: false,
            durationMinutes: true,
            checkinTime: false,
            checkoutTime: false,
        );
    }

    private function packageTemplate(string $label, array $examples): array
    {
        return $this->template(
            $label,
            'Create packages or service levels customers can choose before booking.',
            $examples,
            capacity: false,
            maxGuests: false,
            durationMinutes: true,
            checkinTime: false,
            checkoutTime: false,
            placeholder: $examples[1] ?? $examples[0] ?? 'Standard Package',
            descriptionPlaceholder: 'What is included in this package',
            capacityType: false,
        );
    }

    private function template(
        string $label,
        string $description,
        array $examples,
        bool $capacity,
        bool $maxGuests,
        bool $durationMinutes,
        bool $checkinTime,
        bool $checkoutTime,
        ?string $placeholder = null,
        ?string $descriptionPlaceholder = null,
        ?string $defaultPriceDisplay = null,
        ?string $defaultCapacityType = null,
        ?bool $capacityType = null,
    ): array {
        $template = [
            'label' => $label,
            'description' => $description,
            'examples' => $examples,
            'placeholder' => $placeholder ?: ($examples[0] ?? $label),
            'description_placeholder' => $descriptionPlaceholder ?: 'What is included in this option',
            'fields' => [
                'capacity_type' => $capacityType ?? $capacity,
                'capacity' => $capacity,
                'max_guests' => $maxGuests,
                'duration_minutes' => $durationMinutes,
                'checkin_time' => $checkinTime,
                'checkout_time' => $checkoutTime,
            ],
        ];

        if ($defaultPriceDisplay) {
            $template['default_price_display'] = $defaultPriceDisplay;
        }

        if ($defaultCapacityType) {
            $template['default_capacity_type'] = $defaultCapacityType;
        }

        return $template;
    }
}
