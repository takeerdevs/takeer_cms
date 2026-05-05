import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';

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

export default function Privacy() {
    return (
        <AppLayout>
            <Head title="Privacy Policy | Takeer" />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
                    <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>
                    <p className="text-sm leading-7 text-muted-foreground">
                        This Privacy Policy explains how Takeer collects, uses, shares, and protects information across marketplace, content, payments, services, fulfillment, analytics, and merchant tools.
                    </p>
                </div>

                {sections.map((section) => (
                    <section key={section.title} className="space-y-2">
                        <h2 className="text-lg font-black">{section.title}</h2>
                        <p className="text-sm leading-7">{section.body}</p>
                    </section>
                ))}
            </div>
        </AppLayout>
    );
}
