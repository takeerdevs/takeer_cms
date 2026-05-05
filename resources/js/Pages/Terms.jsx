import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';

const sections = [
    {
        title: 'Platform Purpose',
        body: 'Takeer helps creators, personal sellers, merchants, service providers, educators, and businesses publish content, sell products, sell digital goods, offer services, run promotions, accept payments, and manage customer orders. Takeer may act as a marketplace, payments facilitator, discovery platform, and trust-and-safety reviewer, but merchants and sellers remain responsible for what they list, promise, deliver, and communicate.',
    },
    {
        title: 'Accounts, Merchants, and Verification',
        body: 'You must provide accurate account, contact, payout, and merchant information. Some categories, services, fulfillment modes, payout limits, or high-risk listings may require KYC, KYB, identity checks, business verification, credentials, licenses, documents, manual review, or additional approval before publishing, receiving payouts, or continuing to sell.',
    },
    {
        title: 'Listings and Seller Responsibility',
        body: 'You are responsible for the accuracy, legality, availability, quality, pricing, stock, images, descriptions, categories, variants, sellable units, service details, files, links, shipping settings, refund terms, and customer promises in every listing. You must not misrepresent a product, service, supplier relationship, delivery time, origin, brand, license, stock level, or price.',
    },
    {
        title: 'Personal Sellers, Resellers, and Supplier-Sourced Products',
        body: 'Takeer may allow personal sellers, farmers, family producers, artisans, and resellers to sell certain physical products where allowed by platform policy. If you list a supplier-sourced or reseller product, you must have a lawful right and practical ability to supply it, and you may be required to provide supplier name, phone, location, and source notes privately to Takeer for review, support, fraud prevention, dispute handling, and customer protection.',
    },
    {
        title: 'Fulfillment Modes, Preorders, and Group Sales',
        body: 'Products may be sold from own stock, supplier-sourced inventory, made-to-order production, farm harvests, preorders, or group sales. You must clearly state expected availability, preparation time, confirmation time, group sale goals, deadlines, and any fulfillment conditions. Takeer may hold, delay, cancel, refund, or review orders when a product is not ready, a group sale target is not met, fulfillment fails, or customer protection requires it.',
    },
    {
        title: 'Services, Bookings, and Attached Products',
        body: 'Service providers are responsible for service qualifications, credentials, availability, booking rules, intake questions, deliverables, safety, customer communication, and completion evidence. Services may attach products the provider makes, brings, installs, or sells. Regulated, risky, in-person, health, repair, beauty, professional, or location-based services may require extra review, credentials, or restrictions.',
    },
    {
        title: 'Digital Products, Courses, Events, and Access',
        body: 'If you sell digital files, courses, paid media, live events, templates, software, license keys, bundles, subscriptions, or custom digital work, you must have the rights to sell them and must provide usable access as described. Takeer may revoke, delay, or limit digital access to prevent fraud, enforce refund rules, protect intellectual property, or comply with policy.',
    },
    {
        title: 'Payments, SafePay, Fees, Payouts, and Taxes',
        body: 'Payments may be processed by Takeer and third-party payment providers. Takeer may charge platform, payment, SMS, service, subscription, or transaction fees. Funds may be held until payment confirmation, customer receipt, service completion, dispute review, fraud review, payout eligibility, or policy requirements are satisfied. Sellers are responsible for taxes, duties, records, and lawful reporting related to their sales.',
    },
    {
        title: 'Shipping, Pickup, Delivery, and Stock',
        body: 'Sellers must configure accurate shipping profiles, business locations, pickup details, delivery rules, stock quantities, sellable units, variants, and minimum order rules where applicable. If a listing requires physical stock or a business location, Takeer may block publishing or order fulfillment until the required information is provided.',
    },
    {
        title: 'Customer Orders, Refunds, Cancellations, and Disputes',
        body: 'Customers should inspect order details, fulfillment timelines, service requirements, and merchant policies before buying. Takeer may review refund requests, disputes, chargebacks, failed delivery claims, digital access issues, service complaints, receipt confirmation, and suspected fraud. Refund eligibility may depend on product type, payment status, delivery evidence, access usage, service completion, merchant behavior, and platform policy.',
    },
    {
        title: 'Promotions, Attribution, SMS, and Marketing Tools',
        body: 'Merchants may use coupons, referrals, group sales, SMS tools, campaign links, feed cards, product cards, analytics exports, and attribution tools. You must use these tools lawfully, avoid spam or misleading offers, respect customer preferences, and understand that analytics and attribution are estimates based on available signals, callbacks, clicks, orders, devices, and campaign records.',
    },
    {
        title: 'Prohibited and Restricted Activity',
        body: 'Adult content and political content are not allowed. You may not publish illegal, unsafe, counterfeit, infringing, fraudulent, hateful, exploitative, deceptive, or harmful content, products, services, files, or links. Takeer may restrict categories such as regulated goods, medical items, hazardous products, controlled substances, financial products, professional services, or other high-risk listings.',
    },
    {
        title: 'User Content and Intellectual Property',
        body: 'You keep ownership of content you upload, but you grant Takeer a license to host, display, process, promote, translate, analyze, resize, transmit, and use it as needed to operate the platform, support sales, provide previews, run search and discovery, prevent abuse, and improve services. You must only upload content you own or are authorized to use.',
    },
    {
        title: 'Moderation and Enforcement',
        body: 'Takeer may review, hide, limit, remove, reject, edit visibility, suspend, cancel, refund, delay payout, require verification, or terminate content, products, services, orders, payouts, campaigns, or accounts for policy violations, risk, fraud, abuse, legal concerns, poor fulfillment, customer harm, or platform integrity.',
    },
    {
        title: 'Availability, Changes, and Limitation of Liability',
        body: 'Takeer may change features, policies, fees, eligibility rules, payout timing, category restrictions, or product behavior over time. The platform is provided as available, and we are not responsible for losses caused by seller promises, third-party providers, payment networks, outages, user misuse, inaccurate listings, delayed fulfillment, or events outside our reasonable control to the maximum extent permitted by law.',
    },
    {
        title: 'Contact',
        body: 'Questions about these Terms, platform policy, merchant eligibility, disputes, or account issues should be sent to Takeer support through the available support channels in the platform.',
    },
];

export default function Terms() {
    return (
        <AppLayout>
            <Head title="Terms of Service | Takeer" />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
                    <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>
                    <p className="text-sm leading-7 text-muted-foreground">
                        These Terms explain the rules for using Takeer as a customer, creator, personal seller, reseller, merchant, or service provider.
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
