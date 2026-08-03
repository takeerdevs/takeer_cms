import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { useLocale } from '@/lib/i18n';

const sections = [
    {
        title: 'Information We Collect',
        body: 'We collect information you provide directly, including account details, phone numbers, merchant profiles, personal profiles, payout details, verification documents, service credentials, business information, support messages, product listings, posts, media, digital files, service intake forms, booking details, supplier/source details, shipping locations, and customer order information.',
    },
    {
        title: 'Location and Country Signals',
        body: 'We may use IP address and network information to estimate country or region for localization, fraud prevention, payments, discovery, and compliance. We only request precise device location when a feature needs it, such as customer-selected near-me search or location-based discovery. Merchants may add business, pickup, service, farm, or stock locations that can be used for search, fulfillment, trust, and customer guidance.',
    },
    {
        title: 'Payments, Orders, and Fulfillment Data',
        body: 'We collect and process order records, cart details, payment status, transaction IDs, payment callbacks, payout records, refund and dispute records, pickup or delivery details, receipt confirmation, stock movement, fulfillment mode, preorder or group sale status, service completion evidence, digital access records, and related customer support history.',
    },
    {
        title: 'Private Supplier, Reseller, and Review Data',
        body: 'For supplier-sourced, reseller, preorder, group sale, farm harvest, made-to-order, or high-risk listings, we may collect private supplier names, phone numbers, locations, source notes, documents, review decisions, moderation notes, risk signals, and communication history. This information is primarily used by Takeer for verification, support, fraud prevention, dispute handling, and platform safety and is not meant to be public unless separately disclosed.',
    },
    {
        title: 'Services, Bookings, and Intake Data',
        body: 'For services, we may collect appointment preferences, selected service options, intake answers, uploaded intake files, participant details, calendar-related scheduling data, provider availability, session capacity, service credentials, delivery notes, completion records, and notification history. Do not submit sensitive information unless it is necessary for the requested service.',
    },
    {
        title: 'Digital Products and Access Data',
        body: 'For digital products, courses, paid media, software, license keys, bundles, subscriptions, live events, and custom digital work, we may process file access, entitlement status, download or stream activity, release records, license key validation, device or activation signals, subscription access, and refund-locking evidence needed to provide and protect digital access.',
    },
    {
        title: 'Device, Usage, Analytics, and Attribution',
        body: 'We collect device, browser, log, cookie, session, referral, campaign, search, click, feed card, product detail, checkout, order, SMS callback, and attribution signals. We may use these signals to measure marketing performance, improve discovery, prevent abuse, understand cross-device customer journeys, attribute sales, produce merchant analytics, and generate exports. Attribution may be probabilistic or incomplete.',
    },
    {
        title: 'Communications and Notifications',
        body: 'We process messages, SMS delivery and callback data, email or platform notifications, WhatsApp or phone contact choices, service reminders, order updates, payment links, campaign messages, customer support conversations, and merchant-customer communication records where needed to operate the platform and protect users.',
    },
    {
        title: 'How We Use Information',
        body: 'We use information to create accounts, publish content, process payments, manage payouts, run checkout, deliver digital access, schedule services, show search results, personalize country and language experiences, provide analytics, operate promotions, prevent spam and fraud, moderate content, enforce policy, resolve disputes, provide support, improve the platform, and comply with legal or payment-provider requirements.',
    },
    {
        title: 'How We Share Information',
        body: 'We may share information with payment providers, payout partners, SMS and communication providers, hosting and storage providers, analytics and security vendors, calendar or integration providers you connect, merchants involved in an order or service request, customers where needed for fulfillment, administrators and reviewers, professional advisers, regulators, or law enforcement where required or appropriate.',
    },
    {
        title: 'Merchant and Customer Visibility',
        body: 'Public listings may show profile names, merchant names, product details, service details, media, approximate locations, shipping or pickup options, availability, prices, reviews, and other information you choose to publish. Order participants may see information needed to complete the transaction, such as customer contact details, delivery or pickup information, service requirements, and order status.',
    },
    {
        title: 'Retention',
        body: 'We keep information for as long as needed to operate Takeer, provide access, meet accounting, tax, payment, fraud-prevention, dispute, safety, legal, and support obligations, and maintain business records. Some records, such as transactions, disputes, payouts, verification decisions, and digital access evidence, may be retained even after account closure where permitted or required.',
    },
    {
        title: 'Your Choices and Rights',
        body: 'You may update many account, profile, listing, location, and merchant settings in the platform. You can request access, correction, export, or deletion of applicable personal data by contacting support. Some requests may be limited where we need to keep records for payments, fraud prevention, safety, disputes, legal compliance, or legitimate platform operations.',
    },
    {
        title: 'Security',
        body: 'We use reasonable technical and organizational measures to protect information, but no system is completely secure. You are responsible for keeping your account credentials, devices, payout access, license keys, service credentials, and connected integrations secure.',
    },
    {
        title: 'Children',
        body: 'Takeer is not intended for children who are not legally able to use marketplace, payment, or merchant services. Users must have the legal capacity required to create accounts, make purchases, publish listings, or receive payouts.',
    },
    {
        title: 'Changes and Contact',
        body: 'We may update this Privacy Policy as Takeer changes. If changes are material, we may provide notice through the platform or other reasonable means. Questions or privacy requests should be sent to Takeer support through the available support channels in the platform.',
    },
];

const swSections = [
    {
        title: 'Taarifa Tunazokusanya',
        body: 'Tunakusanya taarifa unazotoa moja kwa moja, zikiwemo taarifa za akaunti, namba za simu, wasifu wa merchant, wasifu binafsi, taarifa za malipo ya payout, nyaraka za uthibitishaji, credentials za huduma, taarifa za biashara, ujumbe wa support, listings za bidhaa, posts, media, files za kidigitali, fomu za huduma, booking details, taarifa za supplier au chanzo, maeneo ya usafirishaji, na taarifa za oda za wateja.',
    },
    {
        title: 'Eneo na Viashiria vya Nchi',
        body: 'Tunaweza kutumia IP address na taarifa za mtandao kukadiria nchi au eneo kwa localization, kuzuia fraud, malipo, discovery, na compliance. Tunaomba precise device location tu pale feature inapoihitaji, kama near-me search iliyochaguliwa na mteja au discovery ya eneo. Merchants wanaweza kuongeza maeneo ya biashara, pickup, huduma, shamba, au stock yanayoweza kutumika kwa search, utimilizaji, trust, na maelekezo kwa mteja.',
    },
    {
        title: 'Taarifa za Malipo, Oda na Utimilizaji',
        body: 'Tunakusanya na kuchakata records za oda, cart details, payment status, transaction IDs, payment callbacks, payout records, refund na dispute records, taarifa za pickup au delivery, uthibitisho wa kupokea, movement ya stock, fulfillment mode, preorder au group sale status, ushahidi wa kukamilika kwa huduma, records za access ya kidigitali, na historia ya support inayohusiana.',
    },
    {
        title: 'Taarifa Binafsi za Supplier, Reseller na Review',
        body: 'Kwa listings za supplier, reseller, preorder, group sale, mavuno, made-to-order, au listings zenye risk kubwa, tunaweza kukusanya majina ya supplier, namba za simu, maeneo, source notes, nyaraka, maamuzi ya review, moderation notes, risk signals, na historia ya mawasiliano. Taarifa hizi hutumiwa hasa na Takeer kwa verification, support, kuzuia fraud, kushughulikia migogoro, na usalama wa jukwaa; hazikusudiwi kuwa za umma isipokuwa zimetangazwa tofauti.',
    },
    {
        title: 'Taarifa za Huduma, Bookings na Intake',
        body: 'Kwa huduma, tunaweza kukusanya mapendeleo ya appointment, service options zilizochaguliwa, majibu ya intake, files za intake ulizopakia, taarifa za washiriki, data ya kupanga ratiba, availability ya provider, uwezo wa session, service credentials, delivery notes, records za kukamilika, na historia ya notifications. Usitume taarifa nyeti isipokuwa ni muhimu kwa huduma uliyoomba.',
    },
    {
        title: 'Bidhaa za Kidigitali na Taarifa za Access',
        body: 'Kwa bidhaa za kidigitali, courses, paid media, software, license keys, bundles, subscriptions, live events, na kazi maalum za kidigitali, tunaweza kuchakata file access, entitlement status, download au stream activity, release records, uthibitishaji wa license key, device au activation signals, subscription access, na ushahidi unaohitajika kutoa na kulinda access ya kidigitali.',
    },
    {
        title: 'Kifaa, Matumizi, Analytics na Attribution',
        body: 'Tunakusanya viashiria vya kifaa, browser, logs, cookies, session, referral, campaign, search, clicks, feed cards, product details, checkout, oda, SMS callbacks, na attribution. Tunaweza kutumia viashiria hivi kupima marketing, kuboresha discovery, kuzuia matumizi mabaya, kuelewa safari za wateja kwenye vifaa tofauti, kuhusisha mauzo, kutoa merchant analytics, na kutengeneza exports. Attribution inaweza kuwa ya makadirio au kutokamilika.',
    },
    {
        title: 'Mawasiliano na Notifications',
        body: 'Tunachakata messages, SMS delivery na callback data, email au platform notifications, chaguo za WhatsApp au simu, service reminders, order updates, payment links, campaign messages, mazungumzo ya customer support, na records za mawasiliano kati ya customer na merchant pale inapohitajika kuendesha jukwaa na kulinda watumiaji.',
    },
    {
        title: 'Jinsi Tunavyotumia Taarifa',
        body: 'Tunatumia taarifa kuunda akaunti, kuchapisha content, kuchakata malipo, kusimamia payouts, kuendesha checkout, kutoa access ya kidigitali, kupanga huduma, kuonyesha search results, kubinafsisha nchi na lugha, kutoa analytics, kuendesha promotions, kuzuia spam na fraud, kusimamia content, kutekeleza sera, kutatua migogoro, kutoa support, kuboresha jukwaa, na kutimiza masharti ya kisheria au payment provider.',
    },
    {
        title: 'Jinsi Tunavyoshirikisha Taarifa',
        body: 'Tunaweza kushirikisha taarifa na payment providers, washirika wa payout, SMS na communication providers, hosting na storage providers, analytics na security vendors, calendar au integrations unazounganisha, merchants wanaohusika kwenye oda au ombi la huduma, wateja pale inapohitajika kwa utimilizaji, administrators na reviewers, washauri wa kitaalamu, regulators, au vyombo vya sheria pale inapohitajika au inapofaa.',
    },
    {
        title: 'Taarifa Zinazoonekana kwa Merchants na Wateja',
        body: 'Public listings zinaweza kuonyesha majina ya wasifu, majina ya merchants, maelezo ya bidhaa na huduma, media, maeneo ya makadirio, chaguo za shipping au pickup, availability, bei, reviews, na taarifa nyingine unazochagua kuchapisha. Washiriki wa oda wanaweza kuona taarifa zinazohitajika kukamilisha transaction, kama mawasiliano ya customer, delivery au pickup information, mahitaji ya huduma, na order status.',
    },
    {
        title: 'Uhifadhi wa Taarifa',
        body: 'Tunahifadhi taarifa kwa muda unaohitajika kuendesha Takeer, kutoa access, kutimiza majukumu ya accounting, kodi, malipo, kuzuia fraud, migogoro, usalama, sheria, na support, na kuhifadhi records za biashara. Baadhi ya records, kama transactions, disputes, payouts, verification decisions, na ushahidi wa digital access, zinaweza kuhifadhiwa hata baada ya akaunti kufungwa pale inaporuhusiwa au kuhitajika.',
    },
    {
        title: 'Chaguo na Haki Zako',
        body: 'Unaweza kusasisha settings nyingi za akaunti, wasifu, listing, eneo, na merchant ndani ya jukwaa. Unaweza kuomba access, correction, export, au deletion ya personal data inayohusika kwa kuwasiliana na support. Baadhi ya maombi yanaweza kupunguzwa pale tunapohitaji kuhifadhi records kwa malipo, kuzuia fraud, usalama, migogoro, compliance ya kisheria, au uendeshaji halali wa jukwaa.',
    },
    {
        title: 'Usalama',
        body: 'Tunatumia hatua za kiufundi na kiutawala zinazofaa kulinda taarifa, lakini hakuna mfumo ulio salama kabisa. Unawajibika kulinda credentials za akaunti, vifaa, access ya payout, license keys, service credentials, na integrations zilizounganishwa.',
    },
    {
        title: 'Watoto',
        body: 'Takeer haikusudiwi kwa watoto ambao hawana uwezo wa kisheria wa kutumia marketplace, payment, au merchant services. Watumiaji lazima wawe na uwezo wa kisheria unaohitajika kuunda akaunti, kununua, kuchapisha listings, au kupokea payouts.',
    },
    {
        title: 'Mabadiliko na Mawasiliano',
        body: 'Tunaweza kusasisha Privacy Policy hii kadri Takeer inavyobadilika. Ikiwa mabadiliko ni makubwa, tunaweza kutoa taarifa kupitia jukwaa au njia nyingine inayofaa. Maswali au maombi kuhusu faragha yatumwe kwa Takeer Support kupitia njia za support zinazopatikana ndani ya jukwaa.',
    },
];

export default function Privacy() {
    const { locale, t } = useLocale();
    const localizedSections = locale === 'sw' ? swSections : sections;

    return (
        <AppLayout>
            <Head title={`${t('legal.privacy')} | Takeer`} />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">{t('legal.privacy')}</h1>
                    <p className="text-sm text-muted-foreground">{t('legal.privacyLastUpdated')}</p>
                    <p className="text-sm leading-7 text-muted-foreground">
                        {t('legal.privacyIntro')}
                    </p>
                    <p className="text-sm leading-7 text-muted-foreground">
                        {locale === 'sw' ? 'Takeer inaendeshwa na Avly Tech Group Limited, kampuni iliyosajiliwa Tanzania.' : 'Takeer is operated by Avly Tech Group Limited, a company incorporated in Tanzania.'}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2 text-xs font-black text-brand-700">
                        <Link href="/legal" className="underline">{t('common.legalCenter')}</Link>
                        <Link href="/legal/privacy-notice" className="underline">{t('legal.documents.privacy-notice.title')}</Link>
                    </div>
                </div>

                {localizedSections.map((section) => (
                    <section key={section.title} className="space-y-2">
                        <h2 className="text-lg font-black">{section.title}</h2>
                        <p className="text-sm leading-7">{section.body}</p>
                    </section>
                ))}
            </div>
        </AppLayout>
    );
}
