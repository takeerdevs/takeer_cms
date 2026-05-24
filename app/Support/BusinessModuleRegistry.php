<?php

namespace App\Support;

class BusinessModuleRegistry
{
    private const SYSTEM_MODULES = ['retail_ops'];

    public static function all(): array
    {
        $modules = [
            'products' => [
                'label' => 'Products',
                'description' => 'Sell ready-made physical items with inventory and orders.',
                'group' => 'Commerce',
                'permissions' => ['products.view', 'products.create', 'products.update', 'orders.view'],
            ],
            'orders' => [
                'label' => 'Orders',
                'description' => 'Manage customer purchases, confirmations, fulfillment, and order status.',
                'group' => 'Commerce',
                'permissions' => ['orders.view', 'orders.update'],
            ],
            'reports' => [
                'label' => 'Reports / overview',
                'description' => 'Review revenue, catalog, bookings, customers, team, and bookkeeping health.',
                'group' => 'Operations',
                'permissions' => ['dashboard.view', 'orders.view', 'bookkeeping.view'],
            ],
            'customers' => [
                'label' => 'Customers / CRM',
                'description' => 'View buyers, booking customers, students, members, and repeat customers.',
                'group' => 'Growth',
                'permissions' => ['orders.view', 'marketing.view', 'retail.customers'],
            ],
            'communications' => [
                'label' => 'Communications',
                'description' => 'Prepare follow-ups, reminders, updates, and customer contact logs.',
                'group' => 'Growth',
                'permissions' => ['marketing.view', 'marketing.update', 'orders.view', 'services.view'],
            ],
            'digital_products' => [
                'label' => 'Digital products',
                'description' => 'Sell files, downloads, license keys, and digital materials.',
                'group' => 'Commerce',
                'permissions' => ['digital_products.view', 'digital_products.create', 'digital_products.update'],
            ],
            'services' => [
                'label' => 'Services',
                'description' => 'List bookable or enquiry-based services.',
                'group' => 'Services',
                'permissions' => ['services.view', 'services.create', 'services.update'],
            ],
            'custom_orders' => [
                'label' => 'Custom orders',
                'description' => 'Collect customer requirements before quoting or accepting an order.',
                'group' => 'Services',
                'permissions' => ['services.view', 'services.create', 'orders.view'],
            ],
            'quotes' => [
                'label' => 'Quotes',
                'description' => 'Prepare custom prices for work that varies by customer request.',
                'group' => 'Services',
                'permissions' => ['services.view', 'orders.update'],
            ],
            'bookings' => [
                'label' => 'Bookings',
                'description' => 'Accept date, time, guest, attendee, or unit reservations.',
                'group' => 'Scheduling',
                'permissions' => ['services.schedule', 'orders.view'],
            ],
            'availability' => [
                'label' => 'Availability',
                'description' => 'Define booking windows, slots, capacity, buffers, and fixed sessions.',
                'group' => 'Scheduling',
                'permissions' => ['services.view', 'services.schedule'],
            ],
            'appointments' => [
                'label' => 'Appointments',
                'description' => 'Manage appointment slots for personal care and professional work.',
                'group' => 'Scheduling',
                'permissions' => ['services.schedule', 'orders.view'],
            ],
            'rooms' => [
                'label' => 'Rooms',
                'description' => 'Manage room types, capacity, availability, and occupied dates.',
                'group' => 'Accommodation',
                'permissions' => ['services.view', 'services.create', 'services.schedule'],
            ],
            'menu' => [
                'label' => 'Menu',
                'description' => 'Publish food, drinks, add-ons, and menu pricing.',
                'group' => 'Food',
                'permissions' => ['products.view', 'products.create', 'products.update', 'orders.view'],
            ],
            'reservations' => [
                'label' => 'Reservations',
                'description' => 'Accept table, venue, or visit reservations.',
                'group' => 'Food',
                'permissions' => ['services.schedule', 'orders.view'],
            ],
            'rentals' => [
                'label' => 'Rentals / hire',
                'description' => 'Manage rentable equipment, vehicles, spaces, deposits, and hire terms.',
                'group' => 'Scheduling',
                'permissions' => ['services.view', 'services.create', 'services.schedule', 'orders.view'],
            ],
            'delivery' => [
                'label' => 'Delivery',
                'description' => 'Support local delivery flows and dispatch-ready orders.',
                'group' => 'Fulfillment',
                'permissions' => ['orders.dispatch', 'orders.view'],
            ],
            'courses' => [
                'label' => 'Courses / curriculum',
                'description' => 'Create structured learning offers with lessons or materials.',
                'group' => 'Education',
                'permissions' => ['bundles.view', 'bundles.create', 'bundles.manage_course'],
            ],
            'workshops' => [
                'label' => 'Live sessions',
                'description' => 'Run dated sessions, cohorts, bootcamps, and short events.',
                'group' => 'Education',
                'permissions' => ['services.view', 'services.create', 'services.schedule'],
            ],
            'enrollments' => [
                'label' => 'Enrollments',
                'description' => 'Track students, applicants, attendees, and enrollment status.',
                'group' => 'Education',
                'permissions' => ['bundles.view', 'bundles.manage_course', 'orders.view'],
            ],
            'subscriptions' => [
                'label' => 'Subscriptions',
                'description' => 'Sell recurring memberships, learning access, or service plans.',
                'group' => 'Commerce',
                'permissions' => ['subscriptions.view', 'subscriptions.create', 'subscriptions.manage_members'],
            ],
            'tour_departures' => [
                'label' => 'Tour departures',
                'description' => 'Manage itineraries, dates, group sizes, and trip availability.',
                'group' => 'Travel',
                'permissions' => ['services.view', 'services.create', 'services.schedule'],
            ],
            'retail_ops' => [
                'label' => 'Retail ops / POS',
                'description' => 'Use POS, inventory, staff PINs, transfers, and in-store controls.',
                'group' => 'Operations',
                'requires_approval' => true,
                'permissions' => ['retail.dashboard', 'retail.pos', 'retail.inventory'],
            ],
            'bookkeeping' => [
                'label' => 'Bookkeeping',
                'description' => 'Record transactions, expenses, reports, tax support, and audit packs.',
                'group' => 'Operations',
                'permissions' => ['bookkeeping.view', 'bookkeeping.create', 'bookkeeping.update'],
            ],
            'marketing' => [
                'label' => 'Marketing',
                'description' => 'Run campaigns, coupons, SMS, referrals, and customer communication.',
                'group' => 'Growth',
                'permissions' => ['marketing.view', 'marketing.create', 'marketing.update'],
            ],
            'team' => [
                'label' => 'Team',
                'description' => 'Invite staff and manage role-based access.',
                'group' => 'Operations',
                'permissions' => ['team.view', 'team.create', 'team.update', 'team.reset_pin', 'team.clear_devices'],
            ],
        ];

        return self::localized($modules);
    }

    public static function keys(): array
    {
        return array_keys(self::all());
    }

    public static function configurableKeys(): array
    {
        return array_values(array_diff(self::keys(), self::SYSTEM_MODULES));
    }

    public static function configurable(): array
    {
        return self::only(self::configurableKeys());
    }

    public static function only(array $keys): array
    {
        $modules = self::all();

        return collect($keys)
            ->filter(fn (string $key) => isset($modules[$key]))
            ->mapWithKeys(fn (string $key) => [$key => $modules[$key]])
            ->all();
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

    public static function normalizeConfigurable(array $keys): array
    {
        $valid = self::configurableKeys();

        return collect($keys)
            ->filter(fn ($key) => is_string($key) && in_array($key, $valid, true))
            ->unique()
            ->values()
            ->all();
    }

    private static function localized(array $modules): array
    {
        $swahili = self::swahiliCopy();

        return collect($modules)
            ->map(function (array $module, string $key) use ($swahili) {
                $english = [
                    'label' => $module['label'] ?? $key,
                    'description' => $module['description'] ?? '',
                ];
                $sw = $swahili[$key] ?? $english;

                return [
                    ...$module,
                    'label' => $sw['label'],
                    'description' => $sw['description'],
                    'group' => self::swahiliGroup($module['group'] ?? 'Other'),
                    'translations' => [
                        'sw' => $sw,
                        'en' => $english,
                    ],
                ];
            })
            ->all();
    }

    private static function swahiliGroup(string $group): string
    {
        return [
            'Commerce' => 'Mauzo',
            'Operations' => 'Uendeshaji',
            'Growth' => 'Ukuaji',
            'Services' => 'Huduma',
            'Scheduling' => 'Ratiba',
            'Accommodation' => 'Malazi',
            'Food' => 'Chakula',
            'Fulfillment' => 'Ufikishaji',
            'Education' => 'Elimu',
            'Travel' => 'Safari',
            'Other' => 'Nyingine',
        ][$group] ?? $group;
    }

    private static function swahiliCopy(): array
    {
        return [
            'products' => ['label' => 'Bidhaa', 'description' => 'Uza bidhaa za kushikika zenye stock, variants, na oda.'],
            'orders' => ['label' => 'Oda', 'description' => 'Simamia manunuzi, uthibitisho, maandalizi, delivery, na status za oda.'],
            'reports' => ['label' => 'Ripoti / Muhtasari', 'description' => 'Angalia mapato, catalog, booking, wateja, timu, na afya ya bookkeeping.'],
            'customers' => ['label' => 'Wateja / CRM', 'description' => 'Angalia wanunuzi, wateja wa booking, wanafunzi, members, na wateja wanaorudi.'],
            'communications' => ['label' => 'Mawasiliano', 'description' => 'Andaa follow-up, reminders, updates, na kumbukumbu za mawasiliano ya wateja.'],
            'digital_products' => ['label' => 'Bidhaa za Digital', 'description' => 'Uza files, downloads, license keys, na materials za digital.'],
            'services' => ['label' => 'Huduma', 'description' => 'Weka huduma za ku-book au huduma zinazohitaji maulizo kwanza.'],
            'custom_orders' => ['label' => 'Oda Maalum', 'description' => 'Kusanya mahitaji ya mteja kabla ya kutoa bei au kukubali kazi.'],
            'quotes' => ['label' => 'Bei ya Makubaliano', 'description' => 'Andaa bei maalum kwa kazi inayobadilika kulingana na ombi la mteja.'],
            'bookings' => ['label' => 'Booking', 'description' => 'Pokea booking za tarehe, muda, wageni, washiriki, au vitu.'],
            'availability' => ['label' => 'Ratiba', 'description' => 'Weka muda wa booking, slots, capacity, buffer, na sessions za tarehe maalum.'],
            'appointments' => ['label' => 'Miadi', 'description' => 'Simamia slots za miadi kwa huduma za personal care na kazi za kitaalamu.'],
            'rooms' => ['label' => 'Vyumba / Malazi', 'description' => 'Simamia aina za vyumba, uwezo wa wageni, availability, na tarehe zilizokaliwa.'],
            'menu' => ['label' => 'Menu', 'description' => 'Chapisha vyakula, vinywaji, add-ons, na bei za menu.'],
            'reservations' => ['label' => 'Reservation', 'description' => 'Pokea reservation za meza, venue, au ziara.'],
            'rentals' => ['label' => 'Kupangisha / Kukodisha', 'description' => 'Simamia vifaa, magari, spaces, deposits, na masharti ya kukodisha.'],
            'delivery' => ['label' => 'Delivery', 'description' => 'Tumia mtiririko wa local delivery na oda zilizo tayari kutumwa.'],
            'courses' => ['label' => 'Kozi / Mtaala', 'description' => 'Tengeneza huduma za kujifunza zenye masomo au materials.'],
            'workshops' => ['label' => 'Darasa / Tukio la Live', 'description' => 'Endesha sessions za tarehe maalum, cohorts, bootcamps, na matukio mafupi.'],
            'enrollments' => ['label' => 'Usajili', 'description' => 'Fuatilia wanafunzi, waombaji, washiriki, na status za enrollment.'],
            'subscriptions' => ['label' => 'Subscriptions', 'description' => 'Uza memberships, access ya kujifunza, au service plans za kujirudia.'],
            'tour_departures' => ['label' => 'Safari / Ratiba ya Tour', 'description' => 'Simamia itinerary, tarehe, ukubwa wa group, na availability ya safari.'],
            'retail_ops' => ['label' => 'Retail / POS', 'description' => 'Tumia POS, inventory, staff PINs, transfers, na controls za dukani.'],
            'bookkeeping' => ['label' => 'Bookkeeping', 'description' => 'Rekodi miamala, matumizi, ripoti, tax support, na audit packs.'],
            'marketing' => ['label' => 'Masoko', 'description' => 'Endesha campaigns, coupons, SMS, referrals, na mawasiliano ya wateja.'],
            'team' => ['label' => 'Timu', 'description' => 'Alika staff na simamia ruhusa zao kulingana na role.'],
        ];
    }
}
