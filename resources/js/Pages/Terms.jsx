import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { useLocale } from '@/lib/i18n';

const sections = [
    {
        title: 'Platform Purpose and Payment Boundary',
        body: 'Takeer is a marketplace and commerce technology platform. It connects buyers with independent sellers, coordinates orders and fulfillment, and provides customer-protection workflows. Takeer is not a bank, payment service provider, electronic-money issuer, deposit-taker, or custodian of buyer or seller funds. Licensed payment service providers process collections, refunds, settlement, and seller payouts under their own terms and approved products.',
    },
    {
        title: 'Accounts, Merchants, and Verification',
        body: 'You must provide accurate account, contact, merchant, and provider-onboarding information. Some categories, services, fulfillment modes, payout eligibility, or high-risk listings may require KYC, KYB, identity checks, business verification, credentials, licenses, documents, manual review, or provider approval before publishing or receiving a provider payout.',
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
        title: 'Payments, PSP Settlement, Fees, Payouts, and Taxes',
        body: 'Payments are processed by the licensed payment service provider shown at checkout. The provider controls the approved collection and settlement structure, executes refunds, and pays verified seller beneficiaries. Takeer may charge disclosed marketplace, service, subscription, or transaction fees through an approved provider split or settlement arrangement. Amounts shown in Takeer are order-specific commerce and provider-status reports, not a wallet, deposit, stored-value balance, or transferable money claim against Takeer. Sellers are responsible for taxes, duties, records, and lawful reporting related to their sales.',
    },
    {
        title: 'Shipping, Pickup, Delivery, and Stock',
        body: 'Sellers must configure accurate shipping profiles, business locations, pickup details, delivery rules, stock quantities, sellable units, variants, and minimum order rules where applicable. If a listing requires physical stock or a business location, Takeer may block publishing or order fulfillment until the required information is provided.',
    },
    {
        title: 'Customer Orders, Refunds, Cancellations, and Disputes',
        body: 'Customers should inspect order details, fulfillment timelines, service requirements, and merchant policies before buying. Takeer may review refund requests, disputes, chargebacks, failed delivery claims, digital access issues, service complaints, receipt confirmation, and suspected fraud. Takeer may decide marketplace eligibility and send an instruction, but the licensed provider executes the refund or reversal. Refund eligibility may depend on product type, provider payment status, delivery evidence, access usage, service completion, merchant behavior, and platform policy.',
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
        body: 'Takeer may change features, policies, fees, eligibility rules, provider payout timing, category restrictions, or product behavior over time. The platform is provided as available, and we are not responsible for losses caused by seller promises, licensed providers, payment networks, outages, user misuse, inaccurate listings, delayed fulfillment, or events outside our reasonable control to the maximum extent permitted by law.',
    },
    {
        title: 'Contact',
        body: 'Questions about these Terms, platform policy, merchant eligibility, disputes, or account issues should be sent to Takeer support through the available support channels in the platform.',
    },
];

const swSections = [
    { title: 'Madhumuni ya Jukwaa na Mipaka ya Malipo', body: 'Takeer ni jukwaa la marketplace na teknolojia ya biashara. Inaunganisha wanunuzi na wauzaji huru, inaratibu oda na utimilizaji, na hutoa workflows za ulinzi wa wateja. Takeer si benki, PSP, mtoaji wa fedha za kielektroniki, mpokeaji wa amana, wala mshikilia fedha za wanunuzi au wauzaji. PSP wenye leseni hushughulikia makusanyo, refunds, settlement, na payouts chini ya masharti na bidhaa zao zilizoidhinishwa.' },
    { title: 'Akaunti, Wafanyabiashara na Uthibitishaji', body: 'Lazima utoe taarifa sahihi za akaunti, mawasiliano, biashara, na onboarding ya provider. Makundi, huduma, aina za utimilizaji, eligibility ya payout, au matangazo yenye hatari kubwa yanaweza kuhitaji KYC, KYB, identity checks, uthibitishaji wa biashara, credentials, leseni, nyaraka, manual review, au approval ya provider kabla ya kuchapisha au kupokea payout.' },
    { title: 'Matangazo na Wajibu wa Muuzaji', body: 'Unawajibika kwa usahihi, uhalali, upatikanaji, ubora, bei, stock, picha, maelezo, categories, variants, units, maelezo ya huduma, files, links, settings za shipping, masharti ya refund, na ahadi kwa wateja kwenye kila tangazo. Usipotoshe kuhusu bidhaa, huduma, uhusiano wa supplier, muda wa delivery, asili, brand, leseni, stock, au bei.' },
    { title: 'Wauzaji Binafsi, Resellers na Bidhaa za Supplier', body: 'Takeer inaweza kuruhusu wauzaji binafsi, wakulima, wazalishaji wa familia, artisans, na resellers kuuza bidhaa fulani halisi pale sera ya jukwaa inaporuhusu. Ukiweka bidhaa ya supplier au reseller, lazima uwe na haki halali na uwezo wa kuisupply; unaweza kuhitajika kutoa jina, simu, eneo, na maelezo ya chanzo kwa Takeer kwa review, support, kuzuia fraud, kushughulikia migogoro, na kulinda wateja.' },
    { title: 'Aina za Utimilizaji, Preorders na Group Sales', body: 'Bidhaa zinaweza kuuzwa kutoka stock yako, inventory ya supplier, uzalishaji baada ya oda, mavuno, preorder, au group sale. Lazima ueleze upatikanaji unaotarajiwa, muda wa maandalizi, muda wa uthibitisho, malengo ya group sale, deadlines, na masharti ya utimilizaji. Takeer inaweza kushikilia, kuchelewesha, kughairi, kurefund, au kukagua oda ikiwa bidhaa haiko tayari, lengo la group sale halijafikiwa, utimilizaji umeshindwa, au ulinzi wa mteja unahitaji hivyo.' },
    { title: 'Huduma, Bookings na Bidhaa Zinazoambatana', body: 'Watoa huduma wanawajibika kwa qualifications, credentials, availability, booking rules, maswali ya awali, deliverables, usalama, mawasiliano na mteja, na ushahidi wa kukamilika. Huduma zinaweza kuambatana na bidhaa anayotengeneza, kuleta, kufunga, au kuuza provider. Huduma zinazodhibitiwa, zenye hatari, za ana kwa ana, afya, repair, beauty, kitaalamu, au za eneo maalum zinaweza kuhitaji review, credentials, au restrictions.' },
    { title: 'Bidhaa za Kidigitali, Courses, Events na Access', body: 'Ukiuza files za kidigitali, courses, paid media, events, templates, software, license keys, bundles, subscriptions, au kazi maalum ya kidigitali, lazima uwe na haki ya kuziuza na utoe access inayofanya kazi kama ulivyoeleza. Takeer inaweza kuondoa, kuchelewesha, au kuweka mipaka ya access kuzuia fraud, kutekeleza sera za refund, kulinda intellectual property, au kutii sera.' },
    { title: 'Malipo, PSP Settlement, Ada, Payouts na Kodi', body: 'Malipo huchakatwa na PSP mwenye leseni aliyeonyeshwa checkout. Provider anadhibiti muundo wa makusanyo na settlement, anatekeleza refunds, na huwalipa beneficiaries wa wauzaji waliothibitishwa. Takeer inaweza kutoza ada zilizoonyeshwa za marketplace, huduma, subscription, au transaction kupitia split au settlement arrangement iliyoidhinishwa. Kiasi kinachoonekana Takeer ni rekodi ya oda na status ya provider, si wallet, amana, stored-value balance, au dai la fedha linaloweza kuhamishwa dhidi ya Takeer. Wauzaji wanawajibika kwa kodi, duties, records, na reporting halali ya mauzo yao.' },
    { title: 'Shipping, Pickup, Delivery na Stock', body: 'Wauzaji lazima waweke profiles sahihi za shipping, maeneo ya biashara, taarifa za pickup, sheria za delivery, stock, units, variants, na minimum order inapohitajika. Tangazo likihitaji stock halisi au eneo la biashara, Takeer inaweza kuzuia kuchapisha au kutimiza oda mpaka taarifa hizo zitolewe.' },
    { title: 'Oda za Wateja, Refunds, Cancellations na Migogoro', body: 'Wateja wanapaswa kukagua maelezo ya oda, muda wa utimilizaji, mahitaji ya huduma, na sera za merchant kabla ya kununua. Takeer inaweza kukagua refund requests, migogoro, chargebacks, delivery iliyoshindikana, digital access issues, malalamiko ya huduma, uthibitisho wa kupokea, na fraud inayoshukiwa. Takeer inaweza kuamua eligibility ya marketplace na kutuma instruction, lakini provider mwenye leseni ndiye anayetekeleza refund au reversal. Eligibility ya refund inaweza kutegemea aina ya bidhaa, payment status ya provider, ushahidi wa delivery, matumizi ya access, kukamilika kwa huduma, tabia ya merchant, na sera ya jukwaa.' },
    { title: 'Promotions, Attribution, SMS na Marketing Tools', body: 'Merchants wanaweza kutumia coupons, referrals, group sales, SMS tools, campaign links, feed cards, product cards, analytics exports, na attribution tools. Lazima utumie tools hizi kihalali, uepuke spam au offers za kupotosha, uheshimu mapendeleo ya wateja, na uelewe kuwa analytics na attribution ni makadirio kutoka signals, callbacks, clicks, orders, devices, na records za kampeni.' },
    { title: 'Shughuli Zilizokatazwa na Zilizozuiwa', body: 'Maudhui ya watu wazima na kisiasa hayaruhusiwi. Usichapishe content, bidhaa, huduma, files, au links zisizo halali, zisizo salama, bandia, zinazokiuka haki, za ulaghai, za chuki, za unyonyaji, za udanganyifu, au zenye madhara. Takeer inaweza kuzuia categories kama bidhaa zinazodhibitiwa, medical items, bidhaa hatarishi, controlled substances, financial products, professional services, au listings nyingine zenye hatari kubwa.' },
    { title: 'Content ya Mtumiaji na Intellectual Property', body: 'Unaendelea kumiliki content unayopakia, lakini unaipa Takeer leseni ya kuhost, kuonyesha, kuchakata, kutangaza, kutafsiri, kuchambua, kubadilisha ukubwa, kutuma, na kuitumia inavyohitajika kuendesha jukwaa, kusaidia mauzo, kutoa previews, kuendesha search na discovery, kuzuia abuse, na kuboresha huduma. Pakia content unayomiliki au umeidhinishwa kutumia pekee.' },
    { title: 'Moderation na Utekelezaji', body: 'Takeer inaweza kukagua, kuficha, kuweka mipaka, kuondoa, kukataa, kubadilisha visibility, kususpend, kughairi, kurefund, kuchelewesha payout, kuhitaji verification, au kusitisha content, bidhaa, huduma, oda, payouts, campaigns, au akaunti kwa ukiukaji wa sera, risk, fraud, abuse, masuala ya kisheria, utimilizaji duni, madhara kwa mteja, au kulinda uadilifu wa jukwaa.' },
    { title: 'Upatikanaji, Mabadiliko na Kikomo cha Dhima', body: 'Takeer inaweza kubadilisha features, policies, fees, eligibility rules, muda wa provider payout, category restrictions, au tabia ya bidhaa. Jukwaa hutolewa kama lilivyo, na kwa kiwango kinachoruhusiwa na sheria hatuwajibiki kwa hasara zinazosababishwa na ahadi za muuzaji, providers wenye leseni, payment networks, outages, matumizi mabaya, matangazo yasiyo sahihi, utimilizaji uliochelewa, au matukio yaliyo nje ya uwezo wetu wa kawaida.' },
    { title: 'Mawasiliano', body: 'Maswali kuhusu Terms hizi, sera za jukwaa, eligibility ya merchant, migogoro, au akaunti yatumwe kwa Takeer Support kupitia njia za support zinazopatikana ndani ya jukwaa.' },
];

export default function Terms() {
    const { locale, t } = useLocale();
    const localizedSections = locale === 'sw' ? swSections : sections;
    return (
        <AppLayout>
            <Head title={`${t('legal.terms')} | Takeer`} />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">{t('legal.terms')}</h1>
                    <p className="text-sm text-muted-foreground">{t('common.version')} 2026-08-03</p>
                    <p className="text-sm leading-7 text-muted-foreground">
                        {t('legal.termsDescription')}
                    </p>
                    <p className="text-sm leading-7 text-muted-foreground">
                        {locale === 'sw' ? 'Takeer inaendeshwa na Avly Tech Group Limited, kampuni iliyosajiliwa Tanzania.' : 'Takeer is operated by Avly Tech Group Limited, a company incorporated in Tanzania.'}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2 text-xs font-black text-brand-700">
                        <Link href="/legal" className="underline">{t('common.legalCenter')}</Link>
                        <Link href="/legal/buyer-terms" className="underline">{t('legal.documents.buyer-terms.title')}</Link>
                        <Link href="/legal/merchant-marketplace-agreement" className="underline">{t('legal.documents.merchant-marketplace-agreement.title')}</Link>
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
