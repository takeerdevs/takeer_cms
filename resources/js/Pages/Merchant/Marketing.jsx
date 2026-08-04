import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import {
    BadgePercent,
    BarChart3,
    ChevronRight,
    Copy,
    ExternalLink,
    FileDown,
    Info,
    Instagram,
    Link2,
    Megaphone,
    MessageSquareText,
    MousePointerClick,
    Plus,
    RadioTower,
    Save,
    Send,
    TrendingUp,
    Trash2,
    Users,
    Loader2,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useMerchantPermissions } from '@/lib/merchantPermissions';
import { useLocale } from '@/lib/i18n';

const emptyCoupon = {
    id: null,
    code: '',
    name: '',
    description: '',
    discount_type: 'percent',
    discount_value: '',
    minimum_order_amount: '',
    maximum_discount_amount: '',
    applies_to_type: 'all',
    applies_to_id: '',
    usage_limit: '',
    usage_limit_per_customer: '',
    starts_at: '',
    ends_at: '',
    status: 'active',
};

const emptySmsForm = {
    name: '',
    audience_type: 'all_customers',
    audience_ref_id: '',
    message: '',
    send_mode: 'draft',
    scheduled_at: '',
};

const emptyAbandonedAutomation = {
    is_enabled: false,
    delay_minutes: 60,
    max_age_days: 7,
    coupon_code: '',
    message: 'Habari! Uliacha checkout bila kukamilisha. Rudi Takeer ukamilishe order yako.',
};

const emptyReferralForm = {
    id: null,
    code: '',
    label: '',
    target_type: 'storefront',
    target_id: '',
    reward_type: 'none',
    reward_value: '',
    starts_at: '',
    ends_at: '',
    status: 'active',
};

const emptyGroupSaleForm = {
    id: null,
    product_id: '',
    title: '',
    description: '',
    campaign_price: '',
    regular_price: '',
    goal_quantity: '',
    starts_at: '',
    ends_at: '',
    status: 'draft',
    allow_sms_updates: true,
};

const emptySocialAccountForm = {
    platform: 'instagram',
    provider_account_id: '',
    username: '',
    display_name: '',
    account_type: 'creator',
};

const emptySocialDmForm = {
    id: null,
    social_account_id: '',
    name: '',
    platform: 'instagram',
    post_provider_id: '',
    post_url: '',
    trigger_keywords: 'link',
    match_mode: 'contains',
    destination_type: 'storefront',
    destination_id: '',
    destination_url: '',
    dm_message: 'Here is the link you asked for:\n\n{{link}}',
    public_reply_message: 'Sent you the link.',
    starts_at: '',
    ends_at: '',
    status: 'active',
};

const emptySocialDmTest = {
    account_id: '',
    post_id: '',
    comment_text: 'link',
    commenter_username: 'preview_user',
};

const emptyWhatsappAccountForm = {
    phone_number_id: '',
    business_account_id: '',
    display_phone_number: '',
    verified_name: '',
    access_token: '',
};

const emptyWhatsappForm = {
    id: null,
    whatsapp_account_id: '',
    name: '',
    trigger_keywords: 'catalog, products, price',
    match_mode: 'contains',
    destination_type: 'storefront',
    destination_id: '',
    destination_url: '',
    response_message: 'Thanks for messaging. Shop securely on Takeer here:\n\n{{link}}',
    starts_at: '',
    ends_at: '',
    status: 'active',
};

const emptyWhatsappTest = {
    account_id: '',
    message_text: 'catalog',
    from_phone: '255700000000',
    profile_name: 'Preview Buyer',
};

const emptyWhatsappBroadcast = {
    message: 'Habari! Tuna update mpya dukani:\n\n{{link}}',
    destination_type: 'storefront',
    destination_id: '',
    destination_url: '',
};

const toolCards = [
    {
        key: 'coupons',
        title: 'Promo codes',
        description: 'Create launch discounts, limited drops, and creator-specific sales codes.',
        icon: BadgePercent,
        status: 'Live',
    },
    {
        key: 'sms',
        title: 'SMS campaigns',
        description: 'Sell SMS packages to merchants so they can notify customers about launches and updates.',
        icon: MessageSquareText,
        status: 'Live',
    },
    {
        key: 'group-sales',
        title: 'Group-sale broadcasts',
        description: 'Drive subscribers into limited group buys, pre-orders, and member-backed drops.',
        icon: Users,
        status: 'Live',
    },
    {
        key: 'referrals',
        title: 'Referral links',
        description: 'Track creator, affiliate, and customer referrals back to products and storefronts.',
        icon: RadioTower,
        status: 'Live',
    },
    {
        key: 'social-dms',
        title: 'Comment-to-DM',
        description: 'Turn Instagram or Facebook comments into tracked checkout and offer links.',
        icon: Instagram,
        status: 'Beta',
    },
    {
        key: 'whatsapp',
        title: 'WhatsApp-powered store',
        description: 'Reply to buyer keywords with tracked Takeer links while checkout stays on Takeer.',
        icon: MessageSquareText,
        status: 'Beta',
    },
];

const sectionMeta = {
    overview: {
        title: 'Marketing',
        description: 'Choose a focused growth tool for promotions, customer messages, referrals, group sales, or analytics.',
    },
    coupons: {
        title: 'Promo Codes',
        description: 'Create and manage discount codes for launches, campaigns, and customer offers.',
    },
    sms: {
        title: 'SMS Campaigns',
        description: 'Buy credits, send customer broadcasts, and manage checkout recovery messages.',
    },
    referrals: {
        title: 'Referral Links',
        description: 'Create trackable links for social bio traffic, affiliates, and creator partners.',
    },
    'group-sales': {
        title: 'Group Sales',
        description: 'Validate demand with reservation campaigns before stocking or releasing an offer.',
    },
    'social-dms': {
        title: 'Comment-to-DM',
        description: 'Send tracked Takeer links when followers comment trigger words on social posts.',
    },
    whatsapp: {
        title: 'WhatsApp Store',
        description: 'Use WhatsApp as the sales conversation layer while Takeer handles checkout and fulfillment.',
    },
    analytics: {
        title: 'Marketing Analytics',
        description: 'Review campaign performance and export finance, product, campaign, and order reports.',
    },
};

const sectionTabs = [
    ['overview', 'Overview'],
    ['coupons', 'Promo codes'],
    ['sms', 'SMS'],
    ['referrals', 'Referrals'],
    ['group-sales', 'Group sales'],
    ['social-dms', 'Social DMs'],
    ['whatsapp', 'WhatsApp'],
    ['analytics', 'Analytics'],
];

const MARKETING_TRANSLATIONS = {
    Marketing: 'Masoko', Overview: 'Muhtasari', 'Promo codes': 'Misimbo ya ofa', SMS: 'SMS', Referrals: 'Rufaa', 'Group sales': 'Mauzo ya kundi', 'Social DMs': 'DM za mitandao', WhatsApp: 'WhatsApp', Analytics: 'Uchambuzi', 'Promo Codes': 'Misimbo ya ofa', 'SMS Campaigns': 'Kampeni za SMS', 'Referral Links': 'Viungo vya referral', 'Group Sales': 'Mauzo ya kundi', 'Comment-to-DM': 'Comment-to-DM', 'WhatsApp Store': 'Duka la WhatsApp', 'Marketing Analytics': 'Uchambuzi wa masoko', 'SMS campaigns': 'Kampeni za SMS', 'Group-sale broadcasts': 'Matangazo ya mauzo ya kundi', 'WhatsApp-powered store': 'Duka linalotumia WhatsApp', Live: 'Moja kwa moja', Beta: 'Beta',
    'Choose a focused growth tool for promotions, customer messages, referrals, group sales, or analytics.': 'Chagua zana ya ukuaji kwa matangazo, ujumbe wa wateja, referrals, mauzo ya kundi au uchambuzi.', 'Create launch discounts, limited drops, and creator-specific sales codes.': 'Unda punguzo za uzinduzi, matoleo machache na misimbo maalum ya watayarishi.', 'Sell SMS packages to merchants so they can notify customers about launches and updates.': 'Uza vifurushi vya SMS kwa merchants ili wawajulishe wateja kuhusu uzinduzi na updates.', 'Drive subscribers into limited group buys, pre-orders, and member-backed drops.': 'Elekeza subscribers kwenye manunuzi ya kundi, pre-orders na matoleo yanayoungwa mkono na wanachama.', 'Track creator, affiliate, and customer referrals back to products and storefronts.': 'Fuatilia referrals za watayarishi, affiliates na wateja hadi bidhaa na storefronts.', 'Turn Instagram or Facebook comments into tracked checkout and offer links.': 'Geuza comments za Instagram au Facebook kuwa links zinazofuatiliwa za checkout na ofa.', 'Reply to buyer keywords with tracked Takeer links while checkout stays on Takeer.': 'Jibu keywords za wanunuzi kwa links za Takeer zinazofuatiliwa huku checkout ikibaki Takeer.',
    'Create and manage discount codes for launches, campaigns, and customer offers.': 'Unda na simamia misimbo ya punguzo kwa uzinduzi, kampeni na ofa za wateja.', 'Buy credits, send customer broadcasts, and manage checkout recovery messages.': 'Nunua salio, tuma matangazo kwa wateja na simamia ujumbe wa kurejesha checkout.', 'Create trackable links for social bio traffic, affiliates, and creator partners.': 'Unda links zinazofuatiliwa kwa traffic ya social bio, affiliates na washirika wa watayarishi.', 'Validate demand with reservation campaigns before stocking or releasing an offer.': 'Pima mahitaji kwa kampeni za kuweka nafasi kabla ya kuweka stock au kutoa ofa.', 'Send tracked Takeer links when followers comment trigger words on social posts.': 'Tuma links za Takeer zinazofuatiliwa followers wanapocomment maneno ya trigger kwenye posts.', 'Use WhatsApp as the sales conversation layer while Takeer handles checkout and fulfillment.': 'Tumia WhatsApp kwa mazungumzo ya mauzo huku Takeer ikishughulikia checkout na fulfillment.', 'Review campaign performance and export finance, product, campaign, and order reports.': 'Kagua utendaji wa kampeni na export ripoti za fedha, bidhaa, kampeni na orders.', 'For': 'Kwa', Code: 'Msimbo', Name: 'Jina', Description: 'Maelezo', 'Discount type': 'Aina ya punguzo', Percent: 'Asilimia', 'Fixed amount': 'Kiasi maalum', 'Discount %': 'Punguzo %', 'Discount amount': 'Kiasi cha punguzo', 'New coupon': 'Kuponi mpya', 'Create coupon': 'Unda kuponi', 'Edit coupon': 'Hariri kuponi', 'Coupons': 'Kuponi', 'Group-sale campaigns': 'Kampeni za mauzo ya kundi', 'Referral links': 'Viungo vya referral', 'Connected accounts': 'Akaunti zilizounganishwa', 'Campaigns and test': 'Kampeni na test', 'WhatsApp Cloud API': 'WhatsApp Cloud API', 'Automations and test': 'Automations na test', 'Follower WhatsApp broadcast': 'Matangazo ya WhatsApp kwa followers', 'SMS packages preview': 'Muonekano wa vifurushi vya SMS', 'Abandoned checkout recovery': 'Urejeshaji wa checkout iliyoachwa', 'SMS campaign': 'Kampeni ya SMS', 'SMS campaign history': 'Historia ya kampeni za SMS', 'Download CSV reports': 'Pakua ripoti za CSV', 'Sales funnel and campaign performance': 'Funnel ya mauzo na utendaji wa kampeni', 'Creator analytics': 'Uchambuzi wa creator', 'Paid orders': 'Orders zilizolipwa', 'Clear range': 'Futa kipindi', From: 'Kuanzia', To: 'Hadi', Edit: 'Hariri', Delete: 'Futa', Cancel: 'Ghairi', Save: 'Hifadhi', Send: 'Tuma', 'Send now': 'Tuma sasa', 'Save draft': 'Hifadhi draft', Schedule: 'Panga', Active: 'Hai', Paused: 'Imesitishwa', Expired: 'Imeisha', Draft: 'Draft', 'Choose account...': 'Chagua akaunti...', 'Choose target...': 'Chagua lengwa...', 'Any connected account': 'Akaunti yoyote iliyounganishwa', 'Any connected WhatsApp account': 'Akaunti yoyote ya WhatsApp iliyounganishwa', 'Contains word': 'Ina neno', 'Exact comment': 'Comment kamili', 'Exact message': 'Ujumbe kamili', Storefront: 'Storefront', Product: 'Bidhaa', 'Product/service/download': 'Bidhaa/huduma/download', Bundle: 'Bundle', 'Bundle/course': 'Bundle/course', Membership: 'Uanachama', 'Premium post': 'Post maalum', 'Content item': 'Kipengele cha content', 'Custom URL': 'URL maalum', 'SMS credits': 'Salio la SMS', Estimate: 'Makadirio', 'No SMS campaigns yet': 'Hakuna kampeni za SMS bado', 'No WhatsApp automations yet': 'Hakuna automations za WhatsApp bado', 'No Comment-to-DM campaigns yet': 'Hakuna kampeni za Comment-to-DM bado', 'No coupons yet.': 'Hakuna kuponi bado.', 'No referral links yet.': 'Hakuna links za referral bado.', 'No group-sale campaigns yet.': 'Hakuna kampeni za mauzo ya kundi bado',
};

const MARKETING_EXTRA_TRANSLATIONS = {
    'Revenue statement': 'Taarifa ya mapato', 'Paid orders, payout state, gross, fees, and net amount.': 'Orders zilizolipwa, hali ya payout, gross, fees na kiasi halisi.', 'Campaign report': 'Ripoti ya kampeni', 'Coupons, referrals, group sales, SMS, and recovery activity.': 'Kuponi, referrals, mauzo ya kundi, SMS na shughuli za recovery.', 'Product performance': 'Utendaji wa bidhaa', 'Views, orders, gross revenue, released, and pending revenue.': 'Views, orders, mapato ghafi, yaliyotolewa na mapato yanayosubiri.', 'Order report': 'Ripoti ya order', 'Buyer, item, discount, source, gateway, and tracking fields.': 'Buyer, item, punguzo, chanzo, gateway na fields za ufuatiliaji.', 'Analytics exports': 'Uhamishaji wa analytics', Export: 'Export', 'No attributed sales yet.': 'Hakuna mauzo yaliyohusishwa bado.', 'Conversion signals': 'Ishara za conversion', 'Top movers': 'Vinavyofanya vizuri', Products: 'Bidhaa', 'No product sales yet.': 'Hakuna mauzo ya bidhaa bado.', 'No referral conversions yet.': 'Hakuna conversions za referral bado.', 'No coupon redemptions yet.': 'Hakuna matumizi ya kuponi bado.', 'Known buyers': 'Wanunuzi wanaojulikana', 'Known orders': 'Orders zinazojulikana', 'Order coverage': 'Coverage ya orders', 'Linked sessions': 'Sessions zilizounganishwa', Sent: 'Zilizotumwa', Views: 'Views', Orders: 'Orders', Tracking: 'Ufuatiliaji', conversions: 'conversions', redemptions: 'matumizi', 'Allow SMS update opt-in': 'Ruhusu kujiunga na updates za SMS', 'Joiners can opt into progress and deadline messages.': 'Wanaojiunga wanaweza kuchagua ujumbe wa maendeleo na deadline.', 'Recent referred orders': 'Orders za referral za hivi karibuni', 'No referral links yet': 'Hakuna links za referral bado', 'Create one for an Instagram bio, affiliate, or customer ambassador.': 'Unda moja kwa Instagram bio, affiliate au balozi wa mteja.', 'Connected accounts': 'Akaunti zilizounganishwa', 'Connect Meta to import posts/reels and send real private replies after permissions are approved.': 'Unganisha Meta kuingiza posts/reels na kutuma majibu binafsi baada ya ruhusa kukubaliwa.', 'Meta connection': 'Muunganisho wa Meta', 'Recent posts/reels': 'Posts/reels za hivi karibuni', 'Import from the selected Meta account and click a post to attach this trigger.': 'Ingiza kutoka akaunti ya Meta iliyochaguliwa na bonyeza post kuambatanisha trigger hii.', 'No Comment-to-DM campaigns yet': 'Hakuna kampeni za Comment-to-DM bado', 'Create one trigger for a specific post or all posts.': 'Unda trigger moja kwa post maalum au posts zote.', 'WhatsApp Cloud API': 'WhatsApp Cloud API', 'Webhook URL:': 'URL ya webhook:', 'Merchant onboarding': 'Usajili wa merchant', 'Follower WhatsApp broadcast': 'Tangazo la WhatsApp kwa followers', 'Send a simulated WhatsApp update to followers who allow WhatsApp notifications.': 'Tuma update ya WhatsApp ya simulation kwa followers wanaoruhusu notifications za WhatsApp.', 'SMS packages preview': 'Muonekano wa vifurushi vya SMS', 'Buy SMS credits for customer broadcasts, launch alerts, and group-sale updates.': 'Nunua salio la SMS kwa matangazo ya wateja, alerts za uzinduzi na updates za mauzo ya kundi.', 'Available SMS credits': 'Salio la SMS linalopatikana', 'SMS consent and provider status': 'Ridhaa ya SMS na hali ya provider', 'No SMS campaigns yet': 'Hakuna kampeni za SMS bado', 'Create one above to test the workflow.': 'Unda moja hapo juu kujaribu workflow.',
};

const MARKETING_UI_TRANSLATIONS = {
    Page: 'Ukurasa',
    'Use in SMS': 'Tumia kwenye SMS',
    Edit: 'Hariri',
    'Starts at': 'Inaanza',
    Deadline: 'Mwisho',
    'Save referral link': 'Hifadhi kiungo cha referral',
    Cancel: 'Ghairi',
    Landing: 'Ukurasa wa kutua',
    'Mark paid': 'Weka imelipwa',
    Void: 'Batili',
    'Connect with Meta': 'Unganisha na Meta',
    'Add META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI, and META_WEBHOOK_VERIFY_TOKEN to enable OAuth.': 'Ongeza META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI na META_WEBHOOK_VERIFY_TOKEN ili kuwezesha OAuth.',
    Platform: 'Jukwaa',
    'Account ID': 'ID ya akaunti',
    'Meta IG user ID or Page ID.': 'ID ya mtumiaji wa Meta IG au ID ya Page.',
    Username: 'Jina la mtumiaji',
    'Display name': 'Jina la kuonyesha',
    Connect: 'Unganisha',
    'Connect one Instagram or Facebook professional account to create trigger campaigns.': 'Unganisha akaunti moja ya kitaalamu ya Instagram au Facebook ili kuunda kampeni za trigger.',
    Manual: 'Mwongozo',
    'Live': 'Moja kwa moja',
    'Last webhook': 'Webhook ya mwisho',
    'Edit trigger campaign': 'Hariri kampeni ya trigger',
    'Create trigger campaign': 'Unda kampeni ya trigger',
    'Campaign name': 'Jina la kampeni',
    Account: 'Akaunti',
    Status: 'Hali',
    'Post/Reel scope': 'Wigo wa Post/Reel',
    'Leave blank for all posts, or import recent posts below and select one.': 'Acha wazi kwa posts zote, au ingiza posts za hivi karibuni hapa chini na uchague moja.',
    'Post URL': 'URL ya Post',
    'Optional reference for the creator until recent-post import is connected.': 'Rejea ya hiari kwa creator hadi uingizaji wa posts za hivi karibuni uunganishwe.',
    'Import posts': 'Ingiza posts',
    'Save trigger': 'Hifadhi trigger',
    Simulate: 'Jaribu kwa simulation',
    'Edit WhatsApp automation': 'Hariri automation ya WhatsApp',
    'Create WhatsApp automation': 'Unda automation ya WhatsApp',
    'Connect WhatsApp Business': 'Unganisha WhatsApp Business',
    'Connect a WhatsApp phone number ID, then create keyword automations.': 'Unganisha ID ya namba ya simu ya WhatsApp, kisha unda automations za maneno muhimu.',
    'Send to WhatsApp followers': 'Tuma kwa followers wa WhatsApp',
    Destination: 'Lengwa',
    'Target offer': 'Ofa lengwa',
    'Custom URL': 'URL maalum',
    'Broadcast message': 'Ujumbe wa tangazo',
    'Use {{link}} where the tracked Takeer link should appear.': 'Tumia {{link}} mahali ambapo kiungo cha Takeer kinachofuatiliwa kinapaswa kuonekana.',
    'Add credits': 'Ongeza salio',
    Active: 'Hai',
    Off: 'Imezimwa',
    'Send after': 'Tuma baada ya',
    'Minutes after checkout starts. Minimum 30.': 'Dakika baada ya checkout kuanza. Kiwango cha chini ni 30.',
    'Lookback days': 'Siku za kuangalia nyuma',
    'How far back eligible abandoned checkouts are considered.': 'Ni siku ngapi zilizopita za checkout zilizoachwa zinapaswa kuzingatiwa.',
    'Coupon code': 'Msimbo wa kuponi',
    'Optional. Must be one of this merchant\'s coupons.': 'Si lazima. Lazima uwe miongoni mwa kuponi za merchant huyu.',
    'Recovery message': 'Ujumbe wa kurejesha',
    'Keep it short. Coupon code is appended automatically if not already included.': 'Uwe mfupi. Msimbo wa kuponi huongezwa moja kwa moja kama haujawekwa.',
    'Sent recoveries:': 'Ujumbe wa kurejesha uliotumwa:',
    'Save automation': 'Hifadhi automation',
    Simulated: 'Simulation',
    'Send only to customers who have a relationship with this business or opted into updates. Real provider sending is not connected yet, so Send now and scheduled sends record simulated delivery logs.': 'Tuma kwa wateja wenye uhusiano na biashara hii au waliojiunga na updates pekee. Utumaji halisi wa provider bado haujaunganishwa, hivyo kutuma sasa na kutuma kwa ratiba huweka kumbukumbu za simulation.',
    Audience: 'Hadhira',
    'Choose the exact product or subscription plan on the right.': 'Chagua bidhaa au mpango wa subscription sahihi upande wa kulia.',
    'Choose who should receive this SMS.': 'Chagua watakaopokea SMS hii.',
    'SMS message': 'Ujumbe wa SMS',
    'One credit usually covers 160 characters. Longer messages use more credits per recipient.': 'Salio moja kwa kawaida linatosha herufi 160. Ujumbe mrefu hutumia salio zaidi kwa kila mpokeaji.',
    'Send mode': 'Njia ya kutuma',
    'Schedule time': 'Muda wa ratiba',
    'Only used when Send mode is Schedule.': 'Hutumika tu njia ya kutuma ikiwa ni Ratiba.',
    'Estimate cost': 'Kadiria gharama',
    'Simulate send': 'Jaribu kutuma kwa simulation',
    'Save campaign': 'Hifadhi kampeni',
    'Draft, scheduled, and simulated campaign results.': 'Matokeo ya kampeni za rasimu, zilizopangwa na za simulation.',
    'New product launch': 'Uzinduzi wa bidhaa mpya',
    'Ends at': 'Inaisha',
    Label: 'Lebo',
    'Internal name, for example Zuchu IG bio or Partner A.': 'Jina la ndani, kwa mfano Zuchu IG bio au Partner A.',
    'Optional. Leave blank and Takeer will generate one.': 'Si lazima. Acha wazi na Takeer itaunda moja.',
    'Storefront works best for social bio links. Pick an offer for a focused campaign.': 'Storefront inafaa zaidi kwa viungo vya social bio. Chagua ofa kwa kampeni maalum.',
    'Not needed for storefront links.': 'Haihitajiki kwa viungo vya storefront.',
    'Choose the exact page this link opens.': 'Chagua ukurasa sahihi ambao kiungo hiki kinafungua.',
    'Reward type': 'Aina ya zawadi',
    'Optional affiliate commission calculated on each referred sale. Tracking works even with no reward.': 'Commission ya affiliate ya hiari inayokokotolewa kwa kila mauzo yaliyorejelewa. Ufuatiliaji hufanya kazi hata bila zawadi.',
    'Reward %': 'Zawadi %',
    'Reward amount': 'Kiasi cha zawadi',
    'Percent is taken from the paid order total. Fixed amount is capped at the order total.': 'Asilimia huchukuliwa kutoka jumla ya order iliyolipwa. Kiasi maalum hakiwezi kuzidi jumla ya order.',
    Pending: 'Inasubiri',
    Paid: 'Imelipwa',
    'Phone number ID': 'ID ya namba ya simu',
    'Business ID': 'ID ya biashara',
    Phone: 'Simu',
    Name: 'Jina',
    'Trigger words': 'Maneno ya trigger',
    'Comma-separated, e.g. link, price, ebook.': 'Tenganisha kwa koma, kwa mfano link, price, ebook.',
    'Comma-separated, e.g. catalog, price, service.': 'Tenganisha kwa koma, kwa mfano catalog, price, service.',
    'Match mode': 'Njia ya kulinganisha',
    'Not needed for storefront.': 'Haihitajiki kwa storefront.',
    'Paste a full URL on the right.': 'Bandika URL kamili upande wa kulia.',
    'Choose the exact Takeer offer.': 'Chagua ofa sahihi ya Takeer.',
    'Only used when Destination is Custom URL.': 'Hutumika tu Lengwa likiwa URL maalum.',
    'DM message': 'Ujumbe wa DM',
    'Public reply': 'Jibu la umma',
    'Active triggers': 'Triggers hai',
    'DM attempts': 'Majaribio ya DM',
    'Tracked clicks': 'Mibofyo inayofuatiliwa',
    Connected: 'Imeunganishwa',
    'Post ID': 'ID ya Post',
    Comment: 'Comment',
    'Configured': 'Imesanidiwa',
    'Needs credentials': 'Inahitaji vitambulisho',
    'Buyer phone': 'Simu ya mnunuzi',
    Message: 'Ujumbe',
    Accounts: 'Akaunti',
    'Internal name, for example New handbag drop or Webinar reminder.': 'Jina la ndani, kwa mfano uzinduzi wa handbag mpya au ukumbusho wa webinar.',
    From: 'Kuanzia',
    To: 'Hadi',
    recipients: 'wapokeaji',
    credits: 'salio',
};

function marketingCopy(translate, english, swahili = MARKETING_TRANSLATIONS[english] || MARKETING_EXTRA_TRANSLATIONS[english] || MARKETING_UI_TRANSLATIONS[english] || english) {
    return translate(english, MARKETING_TRANSLATIONS[english] || MARKETING_EXTRA_TRANSLATIONS[english] || MARKETING_UI_TRANSLATIONS[english] || swahili);
}

export default function MerchantMarketing({ merchantUsername = '', merchantName = '', section = 'overview' }) {
    const { copy } = useLocale();
    const { can } = useMerchantPermissions(merchantUsername);
    const canCreateMarketing = can('marketing.create');
    const canUpdateMarketing = can('marketing.update');
    const canDeleteMarketing = can('marketing.delete');
    const canSendSms = can('marketing.send_sms');
    const canConnectChannels = can('marketing.connect_channels');
    const canManageMarketing = canCreateMarketing || canUpdateMarketing || canDeleteMarketing;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [summary, setSummary] = useState({});
    const [analytics, setAnalytics] = useState({});
    const [coupons, setCoupons] = useState([]);
    const [smsPackages, setSmsPackages] = useState([]);
    const [smsBalance, setSmsBalance] = useState({ credits: 0, lifetime_purchased: 0, lifetime_used: 0 });
    const [smsCampaigns, setSmsCampaigns] = useState([]);
    const [abandonedAutomation, setAbandonedAutomation] = useState(emptyAbandonedAutomation);
    const [smsAudiences, setSmsAudiences] = useState([]);
    const [smsTargets, setSmsTargets] = useState({ products: [], subscription_plans: [] });
    const [marketingTargets, setMarketingTargets] = useState({ products: [], bundles: [], subscription_plans: [], posts: [], content_items: [] });
    const [referralLinks, setReferralLinks] = useState([]);
    const [referralForm, setReferralForm] = useState(emptyReferralForm);
    const [groupSales, setGroupSales] = useState([]);
    const [groupSaleForm, setGroupSaleForm] = useState(emptyGroupSaleForm);
    const [socialAccounts, setSocialAccounts] = useState([]);
    const [socialAccountForm, setSocialAccountForm] = useState(emptySocialAccountForm);
    const [socialDmCampaigns, setSocialDmCampaigns] = useState([]);
    const [socialDmForm, setSocialDmForm] = useState(emptySocialDmForm);
    const [socialDmTest, setSocialDmTest] = useState(emptySocialDmTest);
    const [socialDmTestResult, setSocialDmTestResult] = useState(null);
    const [metaConnector, setMetaConnector] = useState({ configured: false, login_type: 'instagram', webhook_url: '' });
    const [recentSocialMedia, setRecentSocialMedia] = useState([]);
    const [mediaBusy, setMediaBusy] = useState(false);
    const [whatsappConnector, setWhatsappConnector] = useState({ configured: false, webhook_url: '' });
    const [whatsappAccounts, setWhatsappAccounts] = useState([]);
    const [whatsappAccountForm, setWhatsappAccountForm] = useState(emptyWhatsappAccountForm);
    const [whatsappAutomations, setWhatsappAutomations] = useState([]);
    const [whatsappForm, setWhatsappForm] = useState(emptyWhatsappForm);
    const [whatsappTest, setWhatsappTest] = useState(emptyWhatsappTest);
    const [whatsappTestResult, setWhatsappTestResult] = useState(null);
    const [whatsappBroadcast, setWhatsappBroadcast] = useState(emptyWhatsappBroadcast);
    const [manualWhatsappSetupOpen, setManualWhatsappSetupOpen] = useState(false);
    const [smsForm, setSmsForm] = useState(emptySmsForm);
    const [smsEstimate, setSmsEstimate] = useState(null);
    const [smsBusy, setSmsBusy] = useState(false);
    const [form, setForm] = useState(emptyCoupon);

    useEffect(() => {
        loadMarketing();
    }, [merchantUsername]);

    const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.status === 'active'), [coupons]);

    async function loadMarketing() {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/marketing/api`);
            setSummary(res.data?.summary || {});
            setAnalytics(res.data?.analytics || {});
            setCoupons(res.data?.coupons || []);
            setSmsBalance(res.data?.sms_balance || { credits: 0, lifetime_purchased: 0, lifetime_used: 0 });
            setAbandonedAutomation({ ...emptyAbandonedAutomation, ...(res.data?.abandoned_checkout_automation || {}) });
            setSmsCampaigns(res.data?.sms_campaigns || []);
            setSmsAudiences(res.data?.sms_audiences || []);
            setSmsTargets(res.data?.sms_targets || { products: [], subscription_plans: [] });
            setMarketingTargets(res.data?.marketing_targets || { products: [], bundles: [], subscription_plans: [], posts: [], content_items: [] });
            setSmsPackages(res.data?.sms_packages || []);
            setReferralLinks(res.data?.referral_links || []);
            setGroupSales(res.data?.group_sales || []);
            setSocialAccounts(res.data?.social_accounts || []);
            setSocialDmCampaigns(res.data?.social_dm_campaigns || []);
            setMetaConnector(res.data?.meta_connector || { configured: false, login_type: 'instagram', webhook_url: '' });
            setWhatsappConnector(res.data?.whatsapp_connector || { configured: false, webhook_url: '' });
            setWhatsappAccounts(res.data?.whatsapp_accounts || []);
            setWhatsappAutomations(res.data?.whatsapp_automations || []);
        } catch (error) {
            toast.error(copy('Failed to load marketing tools.', 'Imeshindikana kupakia zana za masoko.'));
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setForm(emptyCoupon);
    }

    function resetReferralForm() {
        setReferralForm(emptyReferralForm);
    }

    function resetGroupSaleForm() {
        setGroupSaleForm(emptyGroupSaleForm);
    }

    function resetSocialDmForm() {
        setSocialDmForm(emptySocialDmForm);
    }

    function resetWhatsappForm() {
        setWhatsappForm(emptyWhatsappForm);
    }

    function editCoupon(coupon) {
        if (!canUpdateMarketing) return;
        setForm({
            ...emptyCoupon,
            ...coupon,
            discount_value: coupon.discount_value ?? '',
            minimum_order_amount: coupon.minimum_order_amount ?? '',
            maximum_discount_amount: coupon.maximum_discount_amount ?? '',
            applies_to_id: coupon.applies_to_id ?? '',
            usage_limit: coupon.usage_limit ?? '',
            usage_limit_per_customer: coupon.usage_limit_per_customer ?? '',
            starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : '',
            ends_at: coupon.ends_at ? coupon.ends_at.slice(0, 16) : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function saveCoupon() {
        if (form.id ? !canUpdateMarketing : !canCreateMarketing) return;
        setSaving(true);
        try {
            const payload = {
                ...form,
                code: String(form.code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                discount_value: Number(form.discount_value || 0),
                minimum_order_amount: form.minimum_order_amount === '' ? null : Number(form.minimum_order_amount),
                maximum_discount_amount: form.maximum_discount_amount === '' ? null : Number(form.maximum_discount_amount),
                applies_to_id: form.applies_to_type === 'all' || form.applies_to_id === '' ? null : Number(form.applies_to_id),
                usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
                usage_limit_per_customer: form.usage_limit_per_customer === '' ? null : Number(form.usage_limit_per_customer),
                starts_at: form.starts_at || null,
                ends_at: form.ends_at || null,
            };

            if (!payload.code || payload.discount_value <= 0) {
                toast.error(copy('Enter a valid code and discount.', 'Weka code na discount sahihi.'));
                return;
            }

            if (form.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/coupons/${form.id}/api`, payload);
                toast.success(copy('Coupon updated.', 'Coupon imesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/coupons/api`, payload);
                toast.success(copy('Coupon created.', 'Coupon imeundwa.'));
            }

            resetForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save coupon.', 'Imeshindwa kuhifadhi coupon.'));
        } finally {
            setSaving(false);
        }
    }

    async function deleteCoupon(couponId) {
        if (!canDeleteMarketing) return;
        if (!window.confirm(copy('Delete this coupon?', 'Futa coupon hii?'))) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/coupons/${couponId}/api`);
            setCoupons((current) => current.filter((coupon) => coupon.id !== couponId));
            toast.success(copy('Coupon deleted.', 'Coupon imefutwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to delete coupon.', 'Imeshindwa kufuta coupon.'));
        }
    }

    async function copyCode(code) {
        await navigator.clipboard?.writeText(code);
        toast.success(copy('Coupon code copied.', 'Coupon code imenakiliwa.'));
    }

    async function copyText(text, message = copy('Copied.', 'Imenakiliwa.')) {
        await navigator.clipboard?.writeText(text);
        toast.success(message);
    }

    function insertCouponIntoSms(coupon) {
        if (!canSendSms) return;
        const message = smsForm.message.trim();
        const snippet = `Use code ${coupon.code} kupata ${discountLabel(coupon, copy)}.`;
        setSmsForm((current) => ({
            ...current,
            message: message ? `${message}\n${snippet}` : snippet,
        }));
        toast.success(copy('Coupon added to SMS.', 'Coupon imeongezwa kwenye SMS.'));
    }

    async function buySmsPackage(packageId) {
        if (!canSendSms) return;
        setSmsBusy(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/sms/packages/api`, { package_id: packageId });
            setSmsBalance(res.data?.sms_balance || smsBalance);
            setSummary((current) => ({ ...current, sms_credits: res.data?.sms_balance?.credits ?? current.sms_credits }));
            toast.success(copy('SMS credits added.', 'SMS credits zimeongezwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to add SMS credits.', 'Imeshindwa kuongeza SMS credits.'));
        } finally {
            setSmsBusy(false);
        }
    }

    async function estimateSmsCampaign() {
        if (!canSendSms) return;
        setSmsBusy(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/sms/estimate/api`, {
                audience_type: smsForm.audience_type,
                audience_ref_id: smsForm.audience_ref_id ? Number(smsForm.audience_ref_id) : null,
                message: smsForm.message,
            });
            setSmsEstimate(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to estimate the audience.', 'Imeshindwa kukadiria audience.'));
        } finally {
            setSmsBusy(false);
        }
    }

    async function saveSmsCampaign(sendMode = smsForm.send_mode) {
        if (!canSendSms) return;
        setSmsBusy(true);
        try {
            const payload = {
                ...smsForm,
                send_mode: sendMode,
                audience_ref_id: smsForm.audience_ref_id ? Number(smsForm.audience_ref_id) : null,
                scheduled_at: sendMode === 'schedule' ? smsForm.scheduled_at : null,
            };
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/sms/campaigns/api`, payload);
            setSmsCampaigns((current) => [res.data?.campaign, ...current].filter(Boolean));
            setSmsBalance(res.data?.sms_balance || smsBalance);
            setSmsForm(emptySmsForm);
            setSmsEstimate(null);
            toast.success(res.data?.message || copy('SMS campaign saved.', 'Kampeni ya SMS imehifadhiwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save SMS campaign.', 'Imeshindwa kuhifadhi SMS campaign.'));
        } finally {
            setSmsBusy(false);
        }
    }

    async function saveAbandonedAutomation() {
        if (!canSendSms && !canUpdateMarketing) return;
        setSmsBusy(true);
        try {
            const payload = {
                ...abandonedAutomation,
                delay_minutes: Number(abandonedAutomation.delay_minutes || 60),
                max_age_days: Number(abandonedAutomation.max_age_days || 7),
                coupon_code: abandonedAutomation.coupon_code || null,
            };
            const res = await axios.put(`/merchant/${merchantUsername}/marketing/abandoned-checkout-automation/api`, payload);
            setAbandonedAutomation({ ...emptyAbandonedAutomation, ...(res.data?.automation || {}) });
            toast.success(copy('Abandoned checkout automation saved.', 'Automation ya checkout iliyoachwa imehifadhiwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save automation.', 'Imeshindwa kuhifadhi automation.'));
        } finally {
            setSmsBusy(false);
        }
    }

    function editReferral(link) {
        if (!canUpdateMarketing) return;
        setReferralForm({
            ...emptyReferralForm,
            ...link,
            target_id: link.target_id ?? '',
            reward_value: link.reward_value ?? '',
            starts_at: link.starts_at ? link.starts_at.slice(0, 16) : '',
            ends_at: link.ends_at ? link.ends_at.slice(0, 16) : '',
        });
    }

    async function saveReferralLink() {
        if (referralForm.id ? !canUpdateMarketing : !canCreateMarketing) return;
        setSaving(true);
        try {
            const payload = {
                ...referralForm,
                code: String(referralForm.code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                target_id: referralForm.target_type === 'storefront' || referralForm.target_id === '' ? null : Number(referralForm.target_id),
                reward_value: referralForm.reward_type === 'none' || referralForm.reward_value === '' ? 0 : Number(referralForm.reward_value),
                starts_at: referralForm.starts_at || null,
                ends_at: referralForm.ends_at || null,
            };

            if (referralForm.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/referrals/${referralForm.id}/api`, payload);
                toast.success(copy('Referral link updated.', 'Referral link imesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/referrals/api`, payload);
                toast.success(copy('Referral link created.', 'Referral link imeundwa.'));
            }

            resetReferralForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save referral link.', 'Imeshindwa kuhifadhi referral link.'));
        } finally {
            setSaving(false);
        }
    }

    async function deleteReferralLink(linkId) {
        if (!canDeleteMarketing) return;
        if (!window.confirm(copy('Delete this referral link?', 'Futa referral link hii?'))) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/referrals/${linkId}/api`);
            setReferralLinks((current) => current.filter((link) => link.id !== linkId));
            toast.success(copy('Referral link deleted.', 'Referral link imefutwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to delete referral link.', 'Imeshindwa kufuta referral link.'));
        }
    }

    async function settleReferralCommissions(link, status = 'paid') {
        if (!canUpdateMarketing) return;
        const amount = Number(link.commission_pending || 0);
        if (amount <= 0) {
            toast.info(copy('No pending referral commission for this link.', 'Hakuna commission ya referral inayosubiri kwa link hii.'));
            return;
        }

        const label = status === 'paid' ? 'mark as paid' : 'void';
        if (!window.confirm(copy(`${label} TZS ${amount.toLocaleString()} for ${link.label || link.code}?`, `${label} TZS ${amount.toLocaleString()} kwa ${link.label || link.code}?`))) return;

        setSaving(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/marketing/referrals/${link.id}/commissions/api`, { status });
            toast.success(status === 'paid' ? copy('Referral commission marked as paid.', 'Commission ya referral imelipwa.') : copy('Referral commission voided.', 'Commission ya referral imebatilishwa.'));
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to update commission.', 'Imeshindwa kusasisha commission.'));
        } finally {
            setSaving(false);
        }
    }

    function editGroupSale(campaign) {
        if (!canUpdateMarketing) return;
        setGroupSaleForm({
            ...emptyGroupSaleForm,
            ...campaign,
            product_id: campaign.product_id ?? '',
            campaign_price: campaign.campaign_price ?? '',
            regular_price: campaign.regular_price ?? '',
            goal_quantity: campaign.goal_quantity ?? '',
            starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
            ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
        });
    }

    async function saveGroupSale() {
        if (groupSaleForm.id ? !canUpdateMarketing : !canCreateMarketing) return;
        setSaving(true);
        try {
            const payload = {
                ...groupSaleForm,
                product_id: Number(groupSaleForm.product_id),
                campaign_price: Number(groupSaleForm.campaign_price || 0),
                regular_price: groupSaleForm.regular_price === '' ? null : Number(groupSaleForm.regular_price),
                goal_quantity: Number(groupSaleForm.goal_quantity || 0),
                starts_at: groupSaleForm.starts_at || null,
                ends_at: groupSaleForm.ends_at || null,
                allow_sms_updates: Boolean(groupSaleForm.allow_sms_updates),
            };

            if (!payload.product_id || !payload.title || payload.campaign_price < 0 || payload.goal_quantity < 2 || !payload.ends_at) {
                toast.error(copy('Choose a product, title, price, target quantity, and deadline.', 'Chagua bidhaa, title, bei, target quantity, na deadline.'));
                return;
            }

            if (groupSaleForm.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/group-sales/${groupSaleForm.id}/api`, payload);
                toast.success(copy('Group-sale campaign updated.', 'Group-sale campaign imesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/group-sales/api`, payload);
                toast.success(copy('Group-sale campaign created.', 'Group-sale campaign imeundwa.'));
            }

            resetGroupSaleForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save group-sale campaign.', 'Imeshindwa kuhifadhi group-sale campaign.'));
        } finally {
            setSaving(false);
        }
    }

    async function deleteGroupSale(campaignId) {
        if (!canDeleteMarketing) return;
        if (!window.confirm(copy('Delete this group-sale campaign?', 'Futa group-sale campaign hii?'))) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/group-sales/${campaignId}/api`);
            setGroupSales((current) => current.filter((campaign) => campaign.id !== campaignId));
            toast.success(copy('Group-sale campaign deleted.', 'Group-sale campaign imefutwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to delete group-sale campaign.', 'Imeshindwa kufuta group-sale campaign.'));
        }
    }

    function editSocialDmCampaign(campaign) {
        if (!canUpdateMarketing) return;
        setSocialDmForm({
            ...emptySocialDmForm,
            ...campaign,
            social_account_id: campaign.social_account_id ?? '',
            destination_id: campaign.destination_id ?? '',
            trigger_keywords: (campaign.trigger_keywords || []).join(', '),
            starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
            ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function connectSocialAccount() {
        if (!canConnectChannels) return;
        setSaving(true);
        try {
            const payload = {
                ...socialAccountForm,
                provider_account_id: socialAccountForm.provider_account_id.trim(),
                username: socialAccountForm.username.trim() || null,
                display_name: socialAccountForm.display_name.trim() || null,
            };
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/social-accounts/api`, payload);
            setSocialAccounts((current) => [res.data?.account, ...current.filter((account) => account.id !== res.data?.account?.id)].filter(Boolean));
            setSocialAccountForm(emptySocialAccountForm);
            setSocialDmTest((current) => ({ ...current, account_id: res.data?.account?.id || current.account_id }));
            toast.success(copy('Social account connected.', 'Social account imeunganishwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to connect social account.', 'Imeshindwa kuunganisha account ya social.'));
        } finally {
            setSaving(false);
        }
    }

    function connectMetaAccount() {
        if (!canConnectChannels) return;
        window.location.assign(`/merchant/${merchantUsername}/marketing/social-accounts/meta/connect`);
    }

    async function importRecentSocialMedia(accountId = socialDmForm.social_account_id) {
        if (!accountId) {
            toast.error(copy('Choose a connected account first.', 'Chagua account iliyounganishwa kwanza.'));
            return;
        }

        setMediaBusy(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/marketing/social-accounts/${accountId}/media/api`);
            setRecentSocialMedia(res.data?.media || []);
            toast.success(copy('Recent posts imported.', 'Machapisho ya hivi karibuni yameingizwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to import recent posts.', 'Imeshindwa kuingiza posts za hivi karibuni.'));
        } finally {
            setMediaBusy(false);
        }
    }

    function selectSocialMedia(media) {
        setSocialDmForm((prev) => ({
            ...prev,
            post_provider_id: media.id || '',
            post_url: media.permalink || '',
        }));
        setSocialDmTest((prev) => ({
            ...prev,
            post_id: media.id || prev.post_id,
        }));
        toast.success(copy('Post selected for this trigger.', 'Post imechaguliwa kwa trigger hii.'));
    }

    async function saveSocialDmCampaign() {
        if (socialDmForm.id ? !canUpdateMarketing : !canCreateMarketing) return;
        setSaving(true);
        try {
            const payload = {
                ...socialDmForm,
                social_account_id: socialDmForm.social_account_id ? Number(socialDmForm.social_account_id) : null,
                trigger_keywords: String(socialDmForm.trigger_keywords || '')
                    .split(',')
                    .map((keyword) => keyword.trim())
                    .filter(Boolean),
                destination_id: socialDmForm.destination_type === 'storefront' || socialDmForm.destination_type === 'custom_url' || socialDmForm.destination_id === ''
                    ? null
                    : Number(socialDmForm.destination_id),
                destination_url: socialDmForm.destination_type === 'custom_url' ? socialDmForm.destination_url : null,
                post_provider_id: socialDmForm.post_provider_id || null,
                post_url: socialDmForm.post_url || null,
                starts_at: socialDmForm.starts_at || null,
                ends_at: socialDmForm.ends_at || null,
            };

            if (payload.trigger_keywords.length === 0 || !payload.name || !payload.dm_message) {
                toast.error(copy('Add a campaign name, trigger word, and DM message.', 'Ongeza jina la campaign, trigger word, na ujumbe wa DM.'));
                return;
            }

            if (socialDmForm.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/social-dms/${socialDmForm.id}/api`, payload);
                toast.success(copy('Comment-to-DM campaign updated.', 'Comment-to-DM campaign imesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/social-dms/api`, payload);
                toast.success(copy('Comment-to-DM campaign created.', 'Comment-to-DM campaign imeundwa.'));
            }

            resetSocialDmForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save Comment-to-DM campaign.', 'Imeshindwa kuhifadhi kampeni ya Comment-to-DM.'));
        } finally {
            setSaving(false);
        }
    }

    async function deleteSocialDmCampaign(campaignId) {
        if (!canDeleteMarketing) return;
        if (!window.confirm(copy('Delete this Comment-to-DM campaign?', 'Futa kampeni hii ya Comment-to-DM?'))) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/social-dms/${campaignId}/api`);
            setSocialDmCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId));
            toast.success(copy('Comment-to-DM campaign deleted.', 'Comment-to-DM campaign imefutwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to delete Comment-to-DM campaign.', 'Imeshindwa kufuta kampeni ya Comment-to-DM.'));
        }
    }

    async function simulateSocialDmComment() {
        setSaving(true);
        try {
            const payload = {
                ...socialDmTest,
                account_id: Number(socialDmTest.account_id),
            };
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/social-dms/simulate-comment/api`, payload);
            setSocialDmTestResult(res.data?.event || null);
            await loadMarketing();
            toast.success(copy('Comment simulation processed.', 'Comment simulation imefanyiwa kazi.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to simulate comment.', 'Imeshindwa kuiga comment.'));
        } finally {
            setSaving(false);
        }
    }

    function editWhatsappAutomation(automation) {
        if (!canUpdateMarketing) return;
        setWhatsappForm({
            ...emptyWhatsappForm,
            ...automation,
            whatsapp_account_id: automation.whatsapp_account_id ?? '',
            destination_id: automation.destination_id ?? '',
            trigger_keywords: (automation.trigger_keywords || []).join(', '),
            starts_at: automation.starts_at ? automation.starts_at.slice(0, 16) : '',
            ends_at: automation.ends_at ? automation.ends_at.slice(0, 16) : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function connectWhatsappAccount() {
        if (!canConnectChannels) return;
        setSaving(true);
        try {
            const payload = {
                ...whatsappAccountForm,
                access_token: whatsappAccountForm.access_token || null,
                business_account_id: whatsappAccountForm.business_account_id || null,
                display_phone_number: whatsappAccountForm.display_phone_number || null,
                verified_name: whatsappAccountForm.verified_name || null,
            };
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/whatsapp/accounts/api`, payload);
            setWhatsappAccounts((current) => [res.data?.account, ...current.filter((account) => account.id !== res.data?.account?.id)].filter(Boolean));
            setWhatsappAccountForm(emptyWhatsappAccountForm);
            setWhatsappTest((current) => ({ ...current, account_id: res.data?.account?.id || current.account_id }));
            toast.success(copy('WhatsApp account connected.', 'WhatsApp account imeunganishwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to connect WhatsApp account.', 'Imeshindwa kuunganisha account ya WhatsApp.'));
        } finally {
            setSaving(false);
        }
    }

    function ensureFacebookSdk() {
        return new Promise((resolve, reject) => {
            if (window.FB) {
                resolve(window.FB);
                return;
            }

            window.fbAsyncInit = function () {
                window.FB.init({
                    appId: whatsappConnector.app_id,
                    cookie: true,
                    xfbml: false,
                    version: whatsappConnector.graph_version || 'v24.0',
                });
                resolve(window.FB);
            };

            if (document.getElementById('facebook-jssdk')) return;
            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    async function startWhatsappEmbeddedSignup() {
        if (!canConnectChannels) return;
        if (!whatsappConnector.embedded_signup_configured) {
            toast.error(copy('Add the Meta app ID, secret, and WhatsApp configuration ID first.', 'Ongeza Meta app ID, secret, na WhatsApp configuration ID kwanza.'));
            return;
        }

        setSaving(true);
        let sessionInfo = {};
        const messageListener = (event) => {
            if (!String(event.origin || '').endsWith('facebook.com')) return;
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data?.type === 'WA_EMBEDDED_SIGNUP') {
                    sessionInfo = data.data || {};
                }
            } catch (_) {
                // Ignore non-JSON SDK messages.
            }
        };

        try {
            window.addEventListener('message', messageListener);
            const FB = await ensureFacebookSdk();
            FB.login(async (response) => {
                try {
                    const code = response?.authResponse?.code;
                    if (!code) {
                        toast.error(copy('WhatsApp signup was cancelled or did not return an auth code.', 'Usajili wa WhatsApp umeghairiwa au haukurudisha auth code.'));
                        return;
                    }

                    const res = await axios.post(`/merchant/${merchantUsername}/marketing/whatsapp/embedded-signup/api`, {
                        code,
                        phone_number_id: sessionInfo.phone_number_id,
                        waba_id: sessionInfo.waba_id,
                        session_info: sessionInfo,
                    });
                    setWhatsappAccounts((current) => [res.data?.account, ...current.filter((account) => account.id !== res.data?.account?.id)].filter(Boolean));
                    setWhatsappTest((current) => ({ ...current, account_id: res.data?.account?.id || current.account_id }));
                    toast.success(copy('WhatsApp Business connected.', 'WhatsApp Business imeunganishwa.'));
                    await loadMarketing();
                } catch (error) {
                    toast.error(error.response?.data?.message || copy('Failed to complete WhatsApp signup.', 'Imeshindwa kukamilisha usajili wa WhatsApp.'));
                } finally {
                    setSaving(false);
                    window.removeEventListener('message', messageListener);
                }
            }, {
                config_id: whatsappConnector.configuration_id,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    sessionInfoVersion: '3',
                },
            });
        } catch (error) {
            setSaving(false);
            window.removeEventListener('message', messageListener);
            toast.error(copy('Failed to load Meta signup.', 'Imeshindwa kupakia usajili wa Meta.'));
        }
    }

    async function saveWhatsappAutomation() {
        if (whatsappForm.id ? !canUpdateMarketing : !canCreateMarketing) return;
        setSaving(true);
        try {
            const payload = {
                ...whatsappForm,
                whatsapp_account_id: whatsappForm.whatsapp_account_id ? Number(whatsappForm.whatsapp_account_id) : null,
                trigger_keywords: String(whatsappForm.trigger_keywords || '').split(',').map((keyword) => keyword.trim()).filter(Boolean),
                destination_id: whatsappForm.destination_type === 'storefront' || whatsappForm.destination_type === 'custom_url' || whatsappForm.destination_id === ''
                    ? null
                    : Number(whatsappForm.destination_id),
                destination_url: whatsappForm.destination_type === 'custom_url' ? whatsappForm.destination_url : null,
                starts_at: whatsappForm.starts_at || null,
                ends_at: whatsappForm.ends_at || null,
            };

            if (payload.trigger_keywords.length === 0 || !payload.name || !payload.response_message) {
                toast.error(copy('Add a name, trigger word, and response message.', 'Ongeza jina, trigger word, na ujumbe wa majibu.'));
                return;
            }

            if (whatsappForm.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/whatsapp/automations/${whatsappForm.id}/api`, payload);
                toast.success(copy('WhatsApp automation updated.', 'WhatsApp automation imesasishwa.'));
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/whatsapp/automations/api`, payload);
                toast.success(copy('WhatsApp automation created.', 'WhatsApp automation imeundwa.'));
            }

            resetWhatsappForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to save WhatsApp automation.', 'Imeshindwa kuhifadhi automation ya WhatsApp.'));
        } finally {
            setSaving(false);
        }
    }

    async function sendWhatsappFollowerBroadcast() {
        if (!canCreateMarketing) return;
        setSaving(true);
        try {
            const payload = {
                ...whatsappBroadcast,
                destination_id: ['storefront', 'custom_url'].includes(whatsappBroadcast.destination_type) || whatsappBroadcast.destination_id === ''
                    ? null
                    : Number(whatsappBroadcast.destination_id),
                destination_url: whatsappBroadcast.destination_type === 'custom_url' ? whatsappBroadcast.destination_url : null,
            };

            const res = await axios.post(`/merchant/${merchantUsername}/marketing/whatsapp/follower-broadcasts/api`, payload);
            toast.success(res.data?.message || copy('WhatsApp follower broadcast queued.', 'Tangazo la WhatsApp kwa followers limepangwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to queue WhatsApp follower broadcast.', 'Imeshindwa kupanga tangazo la WhatsApp kwa followers.'));
        } finally {
            setSaving(false);
        }
    }

    async function deleteWhatsappAutomation(automationId) {
        if (!canDeleteMarketing) return;
        if (!window.confirm(copy('Delete this WhatsApp automation?', 'Futa automation hii ya WhatsApp?'))) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/whatsapp/automations/${automationId}/api`);
            setWhatsappAutomations((current) => current.filter((automation) => automation.id !== automationId));
            toast.success(copy('WhatsApp automation deleted.', 'WhatsApp automation imefutwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to delete WhatsApp automation.', 'Imeshindwa kufuta automation ya WhatsApp.'));
        }
    }

    async function simulateWhatsappMessage() {
        setSaving(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/whatsapp/simulate-message/api`, {
                ...whatsappTest,
                account_id: Number(whatsappTest.account_id),
            });
            setWhatsappTestResult(res.data?.event || null);
            await loadMarketing();
            toast.success(copy('WhatsApp simulation processed.', 'WhatsApp simulation imefanyiwa kazi.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to simulate WhatsApp message.', 'Imeshindwa kuiga ujumbe wa WhatsApp.'));
        } finally {
            setSaving(false);
        }
    }

    const smsCharacters = smsForm.message.length;
    const smsSegments = Math.max(1, Math.ceil(smsCharacters / 160));
    const selectedAudience = smsAudiences.find((audience) => audience.type === smsForm.audience_type);
    const targetOptions = smsForm.audience_type === 'product_buyers'
        ? smsTargets.products || []
        : smsForm.audience_type === 'subscription_members'
            ? smsTargets.subscription_plans || []
            : [];
    const referralTargetOptions = {
        product: marketingTargets.products || [],
        bundle: marketingTargets.bundles || [],
        subscription_plan: marketingTargets.subscription_plans || [],
        post: marketingTargets.posts || [],
        content_item: marketingTargets.content_items || [],
    }[referralForm.target_type] || [];
    const productTargetOptions = marketingTargets.products || [];
    const socialDmTargetOptions = {
        product: marketingTargets.products || [],
        bundle: marketingTargets.bundles || [],
        subscription_plan: marketingTargets.subscription_plans || [],
        post: marketingTargets.posts || [],
        content_item: marketingTargets.content_items || [],
    }[socialDmForm.destination_type] || [];
    const whatsappTargetOptions = {
        product: marketingTargets.products || [],
        bundle: marketingTargets.bundles || [],
        subscription_plan: marketingTargets.subscription_plans || [],
        post: marketingTargets.posts || [],
        content_item: marketingTargets.content_items || [],
    }[whatsappForm.destination_type] || [];
    const whatsappBroadcastTargetOptions = {
        product: marketingTargets.products || [],
        bundle: marketingTargets.bundles || [],
        subscription_plan: marketingTargets.subscription_plans || [],
        post: marketingTargets.posts || [],
        content_item: marketingTargets.content_items || [],
    }[whatsappBroadcast.destination_type] || [];
    const visibleSectionTabs = sectionTabs.filter(([key]) => {
        if (key === 'overview' || key === 'analytics') return true;
        if (key === 'sms') return canSendSms || canManageMarketing;
        if (key === 'social-dms' || key === 'whatsapp') return canConnectChannels || canManageMarketing;
        return canManageMarketing;
    });
    const visibleSectionKeys = new Set(visibleSectionTabs.map(([key]) => key));
    const visibleToolCards = toolCards.filter((card) => visibleSectionKeys.has(card.key));
    const activeSection = sectionMeta[section] && visibleSectionKeys.has(section) ? section : 'overview';
    const activeMeta = sectionMeta[activeSection];
    const localizedSectionTitle = {
        overview: copy('Overview', 'Muhtasari'),
        coupons: copy('Promo codes', 'Misimbo ya ofa'),
        sms: 'SMS',
        referrals: copy('Referrals', 'Rufaa'),
        'group-sales': copy('Group sales', 'Mauzo ya kundi'),
        'social-dms': copy('Social DMs', 'DM za mitandao'),
        whatsapp: 'WhatsApp',
        analytics: copy('Analytics', 'Uchambuzi'),
    }[activeSection] || marketingCopy(copy, activeMeta.title);
    const marketingBaseUrl = `/merchant/${merchantUsername}/marketing`;

    if (loading) {
        return (
            <AppLayout>
                <Head title={`${copy('Marketing', 'Masoko')} | Takeer`} />
                <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">{copy('Loading marketing tools...', 'Inapakia zana za masoko...')}</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${localizedSectionTitle} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">{localizedSectionTitle}</h1>
                        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                            {marketingCopy(copy, activeMeta.description)} {merchantName || merchantUsername ? `${copy('For', 'Kwa')} ${merchantName || merchantUsername}.` : ''}
                        </p>
                    </div>
                    <Button className={`rounded-2xl font-black ${activeSection === 'coupons' && canCreateMarketing ? '' : 'hidden'}`} onClick={resetForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        {copy('New coupon', 'Kuponi mpya')}
                    </Button>
                </div>

                <MarketingSectionNav baseUrl={marketingBaseUrl} activeSection={activeSection} tabs={visibleSectionTabs} />

                <div className={`${activeSection === 'overview' ? 'grid' : 'hidden'} gap-3 grid-cols-2 md:grid-cols-4`}>
                    <Metric label={copy('Active coupons', 'Kuponi hai')} value={summary.active_coupons ?? activeCoupons.length} />
                    <Metric label={copy('Redemptions', 'Matumizi')} value={summary.coupon_redemptions ?? 0} />
                    <Metric label={copy('Referral sales', 'Mauzo ya rufaa')} value={summary.referral_conversions ?? 0} />
                    <Metric label={copy('SMS credits', 'Salio la SMS')} value={Number(summary.sms_credits || 0).toLocaleString()} />
                </div>

                <div className={`${activeSection === 'overview' ? 'grid' : 'hidden'} gap-4 md:grid-cols-4`}>
                    {visibleToolCards.map(({ key, title, description, icon: Icon, status }) => (
                        <Link key={title} href={`${marketingBaseUrl}/${key}`} className="block">
                            <Card className="h-full rounded-[24px] border-brand-100/70 transition hover:border-brand-300 hover:shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="h-11 w-11 rounded-2xl bg-brand-50 flex items-center justify-center">
                                            <Icon className="h-5 w-5 text-brand-600" />
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                            {marketingCopy(copy, status)}
                                        </span>
                                    </div>
                                    <p className="mt-4 font-black">{marketingCopy(copy, title)}</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{marketingCopy(copy, description)}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {activeSection === 'analytics' && <CreatorAnalytics analytics={analytics} />}

                {activeSection === 'analytics' && <AnalyticsExports merchantUsername={merchantUsername} />}

                <div className={`${activeSection === 'overview' || activeSection === 'analytics' ? 'hidden' : 'grid'} gap-5 ${activeSection === 'coupons' ? 'lg:grid-cols-[0.9fr_1.1fr]' : 'lg:grid-cols-1'} items-start`}>
                    {activeSection === 'coupons' && <Card className="rounded-[28px] border-brand-100/70">
                        <CardHeader>
                            <CardTitle className="text-base font-black uppercase tracking-wider">
                                {form.id ? copy('Edit coupon', 'Hariri kuponi') : copy('Create coupon', 'Unda kuponi')}
                            </CardTitle>
                            <CardDescription>{copy('Start with promo codes. SMS and referrals will plug into this page later.', 'Anza na misimbo ya matangazo. SMS na referrals zitaongezwa kwenye ukurasa huu baadaye.')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label={copy('Code', 'Msimbo')}>
                                    <Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="LAUNCH25" className="h-12 rounded-xl font-black" />
                                </Field>
                                <Field label={copy('Name', 'Jina')}>
                                    <Input value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={copy('Launch discount', 'Punguzo la uzinduzi')} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <Field label={copy('Description', 'Maelezo')}>
                                <Textarea value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={copy('Internal note for this campaign...', 'Maelezo ya ndani ya kampeni hii...')} className="min-h-20 rounded-xl" />
                            </Field>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label={copy('Discount type', 'Aina ya punguzo')}>
                                    <select value={form.discount_type} onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                        <option value="percent">{copy('Percent', 'Asilimia')}</option>
                                        <option value="fixed">{copy('Fixed amount', 'Kiasi maalum')}</option>
                                    </select>
                                </Field>
                                <Field label={form.discount_type === 'percent' ? copy('Discount %', 'Punguzo %') : copy('Discount amount', 'Kiasi cha punguzo')}>
                                    <Input type="number" min="0" value={form.discount_value} onChange={(e) => setForm((prev) => ({ ...prev, discount_value: e.target.value }))} placeholder={form.discount_type === 'percent' ? '25' : '5000'} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label={copy('Applies to', 'Inatumika kwa')}>
                                    <select value={form.applies_to_type} onChange={(e) => setForm((prev) => ({ ...prev, applies_to_type: e.target.value, applies_to_id: e.target.value === 'all' ? '' : prev.applies_to_id }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                        <option value="all">{copy('All offers', 'Ofa zote')}</option>
                                        <option value="product">{copy('Product', 'Bidhaa')}</option>
                                        <option value="bundle">{copy('Bundle', 'Kifurushi')}</option>
                                        <option value="subscription_plan">{copy('Subscription plan', 'Mpango wa usajili')}</option>
                                        <option value="post">{copy('Premium post', 'Chapisho la premium')}</option>
                                        <option value="content_item">{copy('Content item', 'Kipengele cha maudhui')}</option>
                                    </select>
                                </Field>
                                <Field label={copy('Offer ID', 'Namba ya ofa')}>
                                    <Input disabled={form.applies_to_type === 'all'} type="number" value={form.applies_to_id || ''} onChange={(e) => setForm((prev) => ({ ...prev, applies_to_id: e.target.value }))} placeholder={form.applies_to_type === 'all' ? copy('Not needed', 'Haihitajiki') : 'ID'} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label={copy('Minimum order', 'Oda ya chini')} hint={copy('Lowest cart total before this code can be used. Leave blank for no minimum.', 'Jumla ndogo ya kikapu kabla ya kutumia msimbo. Acha wazi ikiwa hakuna kiwango cha chini.')}>
                                    <Input type="number" value={form.minimum_order_amount || ''} onChange={(e) => setForm((prev) => ({ ...prev, minimum_order_amount: e.target.value }))} placeholder={copy('Optional', 'Hiari')} className="h-12 rounded-xl" />
                                </Field>
                                <Field label={copy('Max discount', 'Punguzo la juu')} hint={copy('Caps percent discounts so large orders do not discount too much. Leave blank for no cap.', 'Weka kikomo cha punguzo la asilimia ili oda kubwa zisipunguziwe sana. Acha wazi bila kikomo.')}>
                                    <Input type="number" value={form.maximum_discount_amount || ''} onChange={(e) => setForm((prev) => ({ ...prev, maximum_discount_amount: e.target.value }))} placeholder={copy('Optional', 'Hiari')} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label={copy('Total usage limit', 'Kikomo cha matumizi yote')} hint={copy('How many times this code can be used by all customers combined. Leave blank for unlimited.', 'Idadi ya matumizi ya msimbo huu na wateja wote. Acha wazi bila kikomo.')}>
                                    <Input type="number" value={form.usage_limit || ''} onChange={(e) => setForm((prev) => ({ ...prev, usage_limit: e.target.value }))} placeholder={copy('Optional', 'Hiari')} className="h-12 rounded-xl" />
                                </Field>
                                <Field label={copy('Per customer limit', 'Kikomo kwa mteja')} hint={copy('How many times one customer can use this code. Usually 1 for launch offers.', 'Idadi ya matumizi ya mteja mmoja. Mara nyingi ni 1 kwa ofa za uzinduzi.')}>
                                    <Input type="number" value={form.usage_limit_per_customer || ''} onChange={(e) => setForm((prev) => ({ ...prev, usage_limit_per_customer: e.target.value }))} placeholder={copy('Optional', 'Hiari')} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label={copy('Starts at', 'Inaanza')}>
                                    <Input type="datetime-local" value={form.starts_at || ''} onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                </Field>
                                <Field label={copy('Ends at', 'Inaisha')}>
                                    <Input type="datetime-local" value={form.ends_at || ''} onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <Field label={copy('Status', 'Hali')}>
                                <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                    <option value="active">{copy('Active', 'Hai')}</option>
                                    <option value="paused">{copy('Paused', 'Imesitishwa')}</option>
                                    <option value="expired">{copy('Expired', 'Imeisha')}</option>
                                </select>
                            </Field>

                            <div className="flex gap-2">
                                <Button onClick={saveCoupon} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {copy('Save coupon', 'Hifadhi kuponi')}
                                </Button>
                                {form.id && (
                                    <Button variant="outline" onClick={resetForm} className="h-12 rounded-2xl font-black">
                                        {copy('Cancel', 'Ghairi')}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>}

                    <div className="space-y-4">
                        {activeSection === 'coupons' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Coupons', 'Kuponi')}</CardTitle>
                                <CardDescription>{copy('Codes creators can share in posts, storefront bios, SMS campaigns, or social media.', 'Misimbo ambayo watayarishi wanaweza kushiriki kwenye machapisho, bios za storefront, kampeni za SMS au mitandao ya kijamii.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {coupons.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <BadgePercent className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">{copy('No coupons yet', 'Hakuna kuponi bado')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Create your first launch or discount code.', 'Unda msimbo wako wa kwanza wa uzinduzi au punguzo.')}</p>
                                    </div>
                                ) : coupons.map((coupon) => (
                                    <div key={coupon.id} className="rounded-2xl border bg-card px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-lg tracking-wide">{coupon.code}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${coupon.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {marketingStatusLabel(coupon.status, copy)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm font-bold">{coupon.name || discountLabel(coupon, copy)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {discountLabel(coupon, copy)} · {coupon.applies_to_type === 'all' ? copy('All offers', 'Ofa zote') : `${coupon.applies_to_type} #${coupon.applies_to_id}`} · {copy('Used', 'Imetumika')} {coupon.times_used}
                                                    {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}
                                                </p>
                                                {coupon.campaign_url && (
                                                    <p className="mt-2 break-all text-xs font-semibold text-brand-700">{coupon.campaign_url}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyCode(coupon.code)}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                {coupon.campaign_url && (
                                                    <>
                                                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(coupon.campaign_url, copy('Campaign page copied.', 'Ukurasa wa kampeni umenakiliwa.'))}>
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => window.open(coupon.campaign_url, '_blank', 'noopener,noreferrer')}>
                                                            {copy('Page', 'Ukurasa')}
                                                        </Button>
                                                    </>
                                                )}
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => insertCouponIntoSms(coupon)}>
                                                    {copy('Use in SMS', 'Tumia kwenye SMS')}
                                                </Button>
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editCoupon(coupon)}>
                                                    {copy('Edit', 'Hariri')}
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteCoupon(coupon.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'group-sales' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Group-sale campaigns', 'Kampeni za mauzo ya kikundi')}</CardTitle>
                                        <CardDescription>{copy('Validate demand before stocking: buyers reserve, campaign progresses, and you notify them when the target is reached.', 'Pima mahitaji kabla ya kuweka stock: wanunuzi wanaweka nafasi, kampeni inaendelea na unawajulisha lengo likifikiwa.')}</CardDescription>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                        {copy('Live', 'Inaendelea')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <InlineStat label={copy('Active campaigns', 'Kampeni hai')} value={Number(summary.active_group_sales || 0).toLocaleString()} />
                                    <InlineStat label={copy('Reservations', 'Nafasi zilizowekwa')} value={Number(summary.group_sale_reservations || 0).toLocaleString()} />
                                </div>

                                <div className="rounded-2xl border bg-white p-4 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label={copy('Product', 'Bidhaa')} hint={copy('Choose the physical or digital product this campaign is validating.', 'Chagua bidhaa ya kawaida au kidijitali ambayo kampeni hii inapima.')}>
                                            <select value={groupSaleForm.product_id || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, product_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">{copy('Choose product...', 'Chagua bidhaa...')}</option>
                                                {productTargetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label={copy('Campaign title', 'Kichwa cha kampeni')}>
                                            <Input value={groupSaleForm.title || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={copy('Handbag group sale', 'Mauzo ya kikundi ya mkoba')} className="h-12 rounded-xl" />
                                        </Field>
                                    </div>

                                    <Field label={copy('Description', 'Maelezo')} hint={copy('Short public pitch shown on the group-sale page.', 'Ujumbe mfupi wa umma unaoonyeshwa kwenye ukurasa wa mauzo ya kikundi.')}>
                                        <Textarea value={groupSaleForm.description || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={copy('Join before the deadline. If enough people reserve, we release the offer...', 'Jiunge kabla ya mwisho. Watu wa kutosha wakiweka nafasi, tutatoa ofa...')} className="min-h-20 rounded-xl" />
                                    </Field>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Field label={copy('Group price', 'Bei ya kikundi')}>
                                            <Input type="number" min="0" value={groupSaleForm.campaign_price || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, campaign_price: e.target.value }))} placeholder="25000" className="h-12 rounded-xl" />
                                            {productTargetOptions.find((target) => Number(target.id) === Number(groupSaleForm.product_id))?.unit_label && (
                                                <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                                                    {copy('Price is per', 'Bei ni kwa')} {productTargetOptions.find((target) => Number(target.id) === Number(groupSaleForm.product_id))?.unit_label}.
                                                </p>
                                            )}
                                        </Field>
                                        <Field label={copy('Regular price', 'Bei ya kawaida')} hint={copy('Optional comparison price.', 'Bei ya awali, si lazima.')}>
                                            <Input type="number" min="0" value={groupSaleForm.regular_price || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, regular_price: e.target.value }))} placeholder="35000" className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label={copy('Target buyers', 'Walengwa wanunuzi')} hint={copy('Campaign succeeds when reservations reach this number.', 'Kampeni inafanikiwa nafasi zilizowekwa zikifikia idadi hii.')}>
                                            <Input type="number" min="2" value={groupSaleForm.goal_quantity || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, goal_quantity: e.target.value }))} placeholder="100" className="h-12 rounded-xl" />
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Field label="Starts at">
                                            <Input type="datetime-local" value={groupSaleForm.starts_at || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Deadline">
                                            <Input type="datetime-local" value={groupSaleForm.ends_at || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label={copy('Status', 'Hali')}>
                                            <select value={groupSaleForm.status} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="draft">{copy('Draft', 'Rasimu')}</option>
                                                <option value="active">{copy('Active', 'Hai')}</option>
                                                <option value="successful">{copy('Successful', 'Imefanikiwa')}</option>
                                                <option value="expired">{copy('Expired', 'Imeisha')}</option>
                                                <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <label className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-black">{copy('Allow SMS update opt-in', 'Ruhusu kujiunga na updates za SMS')}</p>
                                            <p className="text-xs text-muted-foreground">{copy('Joiners can opt into progress and deadline messages.', 'Wanaojiunga wanaweza kuchagua ujumbe wa maendeleo na deadline.')}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(groupSaleForm.allow_sms_updates)}
                                            onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, allow_sms_updates: e.target.checked }))}
                                            className="h-5 w-5"
                                        />
                                    </label>

                                    <div className="flex gap-2">
                                        <Button onClick={saveGroupSale} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                                            {copy('Save group sale', 'Hifadhi mauzo ya kikundi')}
                                        </Button>
                                        {groupSaleForm.id && (
                                            <Button variant="outline" onClick={resetGroupSaleForm} className="h-12 rounded-2xl font-black">
                                                {copy('Cancel', 'Ghairi')}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {groupSales.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                                        <Users className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">{copy('No group-sale campaigns yet', 'Hakuna kampeni za mauzo ya kikundi bado')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Create a demand campaign for a product launch or pre-order.', 'Unda kampeni ya mahitaji kwa uzinduzi wa bidhaa au pre-order.')}</p>
                                    </div>
                                ) : groupSales.map((campaign) => (
                                    <div key={campaign.id} className="rounded-2xl border bg-white px-4 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black text-lg">{campaign.title}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${campaign.status === 'active' ? 'bg-emerald-50 text-emerald-700' : campaign.status === 'successful' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {marketingStatusLabel(campaign.status, copy)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">{campaign.product_title || copy('Product', 'Bidhaa')} · TZS {Number(campaign.campaign_price || 0).toLocaleString()}{campaign.unit_label ? ` / ${campaign.unit_label}` : ''} · {copy('deadline', 'mwisho')} {campaign.ends_at ? new Date(campaign.ends_at).toLocaleString() : '-'}</p>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <span>{Number(campaign.reserved_quantity || 0).toLocaleString()} / {Number(campaign.goal_quantity || 0).toLocaleString()} {copy('reserved', 'imewekwa nafasi')}</span>
                                                        <span>{campaign.progress_percent || 0}%</span>
                                                    </div>
                                                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Number(campaign.progress_percent || 0))}%` }} />
                                                    </div>
                                                </div>
                                                <p className="mt-2 break-all text-xs font-semibold text-brand-700">{campaign.url}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(campaign.url, copy('Group-sale link copied.', 'Kiungo cha mauzo ya kikundi kimenakiliwa.'))}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => window.open(campaign.url, '_blank', 'noopener,noreferrer')}>
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editGroupSale(campaign)}>
                                                    {copy('Edit', 'Hariri')}
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteGroupSale(campaign.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'referrals' && <Card className="rounded-[28px] border-dashed border-brand-200 bg-brand-50/30">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Referral links', 'Viungo vya referral')}</CardTitle>
                                        <CardDescription>{copy('Share trackable links on Instagram, TikTok, WhatsApp, affiliates, or creator partners.', 'Shiriki viungo vinavyofuatiliwa kwenye Instagram, TikTok, WhatsApp, affiliates au washirika wa watayarishi.')}</CardDescription>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                        {copy('Live', 'Inaendelea')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <InlineStat label={copy('Clicks', 'Mibofyo')} value={Number(summary.referral_clicks || 0).toLocaleString()} />
                                    <InlineStat label={copy('Conversions', 'Mabadiliko')} value={Number(summary.referral_conversions || 0).toLocaleString()} />
                                    <InlineStat label={copy('Revenue', 'Mapato')} value={`TZS ${Number(summary.referral_revenue || 0).toLocaleString()}`} />
                                    <InlineStat label={copy('Pending commissions', 'Tume zinazosubiri')} value={`TZS ${Number(summary.referral_commission_pending || 0).toLocaleString()}`} />
                                    <InlineStat label={copy('Paid commissions', 'Tume zilizolipwa')} value={`TZS ${Number(summary.referral_commission_paid || 0).toLocaleString()}`} />
                                </div>

                                <div className="rounded-2xl border bg-white p-4 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Label" hint="Internal name, for example Zuchu IG bio or Partner A.">
                                            <Input value={referralForm.label || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, label: e.target.value }))} placeholder={copy('Instagram bio link', 'Link ya Instagram bio')} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Code" hint="Optional. Leave blank and Takeer will generate one.">
                                            <Input value={referralForm.code || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="PEPYA-IG" className="h-12 rounded-xl font-black" />
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Destination" hint="Storefront works best for social bio links. Pick an offer for a focused campaign.">
                                            <select value={referralForm.target_type} onChange={(e) => setReferralForm((prev) => ({ ...prev, target_type: e.target.value, target_id: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="storefront">{copy('Storefront', 'Storefront')}</option>
                                                <option value="product">{copy('Product', 'Bidhaa')}</option>
                                                <option value="bundle">{copy('Bundle / Course', 'Bundle / Kozi')}</option>
                                                <option value="subscription_plan">{copy('Membership plan', 'Mpango wa uanachama')}</option>
                                                <option value="post">{copy('Premium post', 'Post maalum')}</option>
                                                <option value="content_item">{copy('Content item', 'Kipengele cha content')}</option>
                                            </select>
                                        </Field>
                                        <Field label="Target offer" hint={referralForm.target_type === 'storefront' ? copy('Not needed for storefront links.', 'Haihitajiki kwa viungo vya storefront.') : copy('Choose the exact page this link opens.', 'Chagua ukurasa sahihi ambao kiungo hiki kinafungua.')}>
                                            {referralForm.target_type === 'storefront' ? (
                                                <Input disabled value={copy('Storefront home', 'Mwanzo wa storefront')} className="h-12 rounded-xl text-muted-foreground" />
                                            ) : (
                                                <select value={referralForm.target_id || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, target_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                    <option value="">{copy('Choose target...', 'Chagua lengwa...')}</option>
                                                    {referralTargetOptions.map((target) => (
                                                        <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Field label="Reward type" hint="Optional affiliate commission calculated on each referred sale. Tracking works even with no reward.">
                                            <select value={referralForm.reward_type} onChange={(e) => setReferralForm((prev) => ({ ...prev, reward_type: e.target.value, reward_value: e.target.value === 'none' ? '' : prev.reward_value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="none">{copy('No reward', 'Hakuna zawadi')}</option>
                                                <option value="percent">{copy('Percent', 'Asilimia')}</option>
                                                <option value="fixed">{copy('Fixed amount', 'Kiasi maalum')}</option>
                                            </select>
                                        </Field>
                                        <Field label={referralForm.reward_type === 'percent' ? 'Reward %' : 'Reward amount'} hint="Percent is taken from the paid order total. Fixed amount is capped at the order total.">
                                            <Input disabled={referralForm.reward_type === 'none'} type="number" min="0" value={referralForm.reward_value || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, reward_value: e.target.value }))} placeholder={referralForm.reward_type === 'none' ? copy('Not needed', 'Haihitajiki') : '10'} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Status">
                                            <select value={referralForm.status} onChange={(e) => setReferralForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="active">{copy('Active', 'Hai')}</option>
                                                <option value="paused">{copy('Paused', 'Imesitishwa')}</option>
                                                <option value="expired">{copy('Expired', 'Imeisha')}</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Starts at">
                                            <Input type="datetime-local" value={referralForm.starts_at || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Ends at">
                                            <Input type="datetime-local" value={referralForm.ends_at || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button onClick={saveReferralLink} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="mr-2 h-4 w-4" />}
                                            {copy('Save referral link', 'Hifadhi kiungo cha referral')}
                                        </Button>
                                        {referralForm.id && (
                                            <Button variant="outline" onClick={resetReferralForm} className="h-12 rounded-2xl font-black">
                                                {copy('Cancel', 'Ghairi')}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {referralLinks.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                                        <RadioTower className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">{copy('No referral links yet', 'Hakuna links za referral bado')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Create one for an Instagram bio, affiliate, or customer ambassador.', 'Unda moja kwa Instagram bio, affiliate au balozi wa mteja.')}</p>
                                    </div>
                                ) : referralLinks.map((link) => (
                                    <div key={link.id} className="rounded-2xl border bg-white px-4 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black text-lg">{link.label || link.code}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${link.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {marketingStatusLabel(link.status, copy)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 break-all text-xs font-semibold text-brand-700">{link.url}</p>
                                                {link.campaign_url && (
                                                    <p className="mt-1 break-all text-xs font-semibold text-emerald-700">{copy('Landing:', 'Ukurasa wa kutua:')} {link.campaign_url}</p>
                                                )}
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {copy('Opens', 'Inafungua')} {targetLabel(link, copy)} · {Number(link.clicks_count || 0).toLocaleString()} {copy('clicks', 'mibofyo')} · {Number(link.conversions_count || 0).toLocaleString()} {copy('sales', 'mauzo')} · TZS {Number(link.revenue_amount || 0).toLocaleString()}
                                                </p>
                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <MiniMoney label="Pending" value={link.commission_pending} tone="amber" />
                                                    <MiniMoney label="Paid" value={link.commission_paid} tone="emerald" />
                                                    <MiniMoney label="Void" value={link.commission_void} tone="slate" />
                                                </div>
                                                {link.commission_orders?.length > 0 && (
                                                    <div className="mt-3 rounded-xl border bg-slate-50/80 p-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Recent referred orders', 'Orders za referral za hivi karibuni')}</p>
                                                        <div className="mt-2 space-y-1.5">
                                                            {link.commission_orders.slice(0, 3).map((order) => (
                                                                <div key={order.id} className="flex items-center justify-between gap-3 text-xs">
                                                                    <span className="min-w-0 truncate font-semibold">
                                                                        #{order.public_id || order.id} · {order.buyer_name || 'Buyer'}
                                                                    </span>
                                                                    <span className="shrink-0 font-black">
                                                                        TZS {Number(order.commission_amount || 0).toLocaleString()} · {order.commission_status || 'tracked'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(link.url, copy('Referral link copied.', 'Kiungo cha referral kimenakiliwa.'))}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                {link.campaign_url && (
                                                    <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => copyText(link.campaign_url, copy('Campaign page copied.', 'Ukurasa wa kampeni umenakiliwa.'))}>
                                                        {copy('Landing', 'Ukurasa wa kutua')}
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}>
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editReferral(link)}>
                                                    {copy('Edit', 'Hariri')}
                                                </Button>
                                                {Number(link.commission_pending || 0) > 0 && (
                                                    <>
                                                        <Button variant="outline" disabled={saving} className="h-9 rounded-xl text-xs font-black text-emerald-700" onClick={() => settleReferralCommissions(link, 'paid')}>
                                                            {copy('Mark paid', 'Weka imelipwa')}
                                                        </Button>
                                                        <Button variant="outline" disabled={saving} className="h-9 rounded-xl text-xs font-black text-amber-700" onClick={() => settleReferralCommissions(link, 'void')}>
                                                            {copy('Void', 'Batili')}
                                                        </Button>
                                                    </>
                                                )}
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteReferralLink(link.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'social-dms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Connected accounts', 'Akaunti zilizounganishwa')}</CardTitle>
                                        <CardDescription>{copy('Connect Meta to import posts/reels and send real private replies after permissions are approved.', 'Unganisha Meta kuingiza posts/reels na kutuma majibu binafsi baada ya ruhusa kukubaliwa.')}</CardDescription>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${metaConnector.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {metaConnector.configured ? copy('OAuth ready', 'OAuth iko tayari') : copy('Needs credentials', 'Inahitaji vitambulisho')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border bg-slate-50/70 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-sm font-black">{copy('Meta connection', 'Muunganisho wa Meta')}</p>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                Webhook URL: <span className="font-bold">{metaConnector.webhook_url || '/api/webhooks/social/comments'}</span>
                                            </p>
                                        </div>
                                        <Button disabled={!metaConnector.configured} onClick={connectMetaAccount} className="h-11 rounded-2xl font-black">
                                            <Instagram className="mr-2 h-4 w-4" />
                                            {copy('Connect with Meta', 'Unganisha na Meta')}
                                        </Button>
                                    </div>
                                    {!metaConnector.configured && (
                                        <p className="mt-3 text-xs font-semibold text-amber-700">
                                            {copy('Add META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI, and META_WEBHOOK_VERIFY_TOKEN to enable OAuth.', 'Ongeza META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI na META_WEBHOOK_VERIFY_TOKEN ili kuwezesha OAuth.')}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-3 md:grid-cols-5">
                                    <Field label="Platform">
                                        <select value={socialAccountForm.platform} onChange={(e) => setSocialAccountForm((prev) => ({ ...prev, platform: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="instagram">Instagram</option>
                                            <option value="facebook">Facebook</option>
                                        </select>
                                    </Field>
                                    <Field label="Account ID" hint="Meta IG user ID or Page ID.">
                                        <Input value={socialAccountForm.provider_account_id} onChange={(e) => setSocialAccountForm((prev) => ({ ...prev, provider_account_id: e.target.value }))} placeholder="1784..." className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Username">
                                        <Input value={socialAccountForm.username} onChange={(e) => setSocialAccountForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="@creator" className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Display name">
                                        <Input value={socialAccountForm.display_name} onChange={(e) => setSocialAccountForm((prev) => ({ ...prev, display_name: e.target.value }))} placeholder={copy('Creator brand', 'Brand ya creator')} className="h-12 rounded-xl" />
                                    </Field>
                                    <div className="flex items-end">
                                        <Button disabled={saving || !socialAccountForm.provider_account_id.trim()} onClick={connectSocialAccount} className="h-12 w-full rounded-2xl font-black">
                                            <Link2 className="mr-2 h-4 w-4" />
                                            {copy('Connect', 'Unganisha')}
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    {socialAccounts.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-5 text-sm font-semibold text-muted-foreground md:col-span-3">
                                            {copy('Connect one Instagram or Facebook professional account to create trigger campaigns.', 'Unganisha akaunti moja ya kitaalamu ya Instagram au Facebook ili kuunda kampeni za trigger.')}
                                        </div>
                                    ) : socialAccounts.map((account) => (
                                        <div key={account.id} className="rounded-2xl border bg-white p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-black">{account.username || account.display_name || account.provider_account_id}</p>
                                                    <p className="text-xs font-semibold text-muted-foreground">{account.platform} · {account.account_type || 'professional'}</p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${account.has_live_token ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {account.has_live_token ? 'Live' : 'Manual'}
                                                </span>
                                            </div>
                                            <p className="mt-3 break-all text-[11px] font-semibold text-muted-foreground">ID: {account.provider_account_id}</p>
                                            {account.last_webhook_at && <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Last webhook {new Date(account.last_webhook_at).toLocaleString()}</p>}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'social-dms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{socialDmForm.id ? 'Edit trigger campaign' : 'Create trigger campaign'}</CardTitle>
                                <CardDescription>{copy('Tell followers what to comment, then Takeer sends the tracked product, checkout, course, service, or bundle link.', 'Waambie followers wa-comment nini, kisha Takeer inatuma link ya bidhaa, checkout, kozi, huduma au bundle inayofuatiliwa.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Campaign name">
                                        <Input value={socialDmForm.name} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ebook Reel DM" className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Account">
                                        <select value={socialDmForm.social_account_id || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, social_account_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="">{copy('Any connected account', 'Akaunti yoyote iliyounganishwa')}</option>
                                            {socialAccounts.map((account) => (
                                                <option key={account.id} value={account.id}>{account.username || account.provider_account_id} · {account.platform}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Status">
                                        <select value={socialDmForm.status} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="draft">{copy('Draft', 'Draft')}</option>
                                            <option value="active">{copy('Active', 'Hai')}</option>
                                            <option value="paused">{copy('Paused', 'Imesitishwa')}</option>
                                            <option value="expired">{copy('Expired', 'Imeisha')}</option>
                                        </select>
                                    </Field>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Post/Reel scope" hint="Leave blank for all posts, or import recent posts below and select one.">
                                        <Input value={socialDmForm.post_provider_id || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, post_provider_id: e.target.value }))} placeholder="Optional Meta media ID" className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Post URL" hint="Optional reference for the creator until recent-post import is connected.">
                                        <Input value={socialDmForm.post_url || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, post_url: e.target.value }))} placeholder="https://instagram.com/reel/..." className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                <div className="rounded-2xl border bg-slate-50/70 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-sm font-black">{copy('Recent posts/reels', 'Posts/reels za hivi karibuni')}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{copy('Import from the selected Meta account and click a post to attach this trigger.', 'Ingiza kutoka akaunti ya Meta iliyochaguliwa na bonyeza post kuambatanisha trigger hii.')}</p>
                                        </div>
                                        <Button variant="outline" disabled={mediaBusy || !socialDmForm.social_account_id} onClick={() => importRecentSocialMedia()} className="h-10 rounded-xl text-xs font-black">
                                            {mediaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="mr-2 h-4 w-4" />}
                                            {copy('Import posts', 'Ingiza posts')}
                                        </Button>
                                    </div>
                                    {recentSocialMedia.length > 0 && (
                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                            {recentSocialMedia.slice(0, 9).map((media) => (
                                                <button
                                                    type="button"
                                                    key={media.id}
                                                    onClick={() => selectSocialMedia(media)}
                                                    className={`rounded-2xl border bg-white p-3 text-left transition hover:border-brand-300 ${socialDmForm.post_provider_id === media.id ? 'border-brand-500 ring-2 ring-brand-100' : ''}`}
                                                >
                                                    {media.thumbnail_url && (
                                                        <img src={media.thumbnail_url} alt="" className="mb-3 aspect-video w-full rounded-xl object-cover" />
                                                    )}
                                                    <p className="text-xs font-black">{media.media_type || 'Media'} · {new Date(media.timestamp || Date.now()).toLocaleDateString()}</p>
                                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{media.caption || media.permalink || media.id}</p>
                                                    <p className="mt-2 text-[10px] font-bold text-slate-500">{Number(media.comments_count || 0).toLocaleString()} comments · {Number(media.like_count || 0).toLocaleString()} likes</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Trigger words" hint="Comma-separated, e.g. link, price, ebook.">
                                        <Input value={socialDmForm.trigger_keywords} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, trigger_keywords: e.target.value }))} className="h-12 rounded-xl font-black" />
                                    </Field>
                                    <Field label="Match mode">
                                        <select value={socialDmForm.match_mode} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, match_mode: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="contains">{copy('Contains word', 'Ina neno')}</option>
                                            <option value="exact">{copy('Exact comment', 'Comment kamili')}</option>
                                        </select>
                                    </Field>
                                    <Field label="Destination">
                                        <select value={socialDmForm.destination_type} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, destination_type: e.target.value, destination_id: '', destination_url: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="storefront">{copy('Storefront', 'Storefront')}</option>
                                            <option value="product">{copy('Product/service/download', 'Bidhaa/huduma/download')}</option>
                                            <option value="bundle">{copy('Bundle/course', 'Bundle/kozi')}</option>
                                            <option value="subscription_plan">{copy('Membership', 'Uanachama')}</option>
                                            <option value="post">{copy('Premium post', 'Post maalum')}</option>
                                            <option value="content_item">{copy('Content item', 'Kipengele cha content')}</option>
                                            <option value="custom_url">{copy('Custom URL', 'URL maalum')}</option>
                                        </select>
                                    </Field>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Target offer" hint={socialDmForm.destination_type === 'storefront' ? 'Not needed for storefront.' : socialDmForm.destination_type === 'custom_url' ? 'Paste a full URL on the right.' : 'Choose the exact Takeer offer.'}>
                                        {['storefront', 'custom_url'].includes(socialDmForm.destination_type) ? (
                                            <Input disabled value={socialDmForm.destination_type === 'storefront' ? copy('Storefront', 'Storefront') : copy('Custom URL', 'URL maalum')} className="h-12 rounded-xl text-muted-foreground" />
                                        ) : (
                                            <select value={socialDmForm.destination_id || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, destination_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">{copy('Choose target...', 'Chagua lengwa...')}</option>
                                                {socialDmTargetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                ))}
                                            </select>
                                        )}
                                    </Field>
                                    <Field label="Custom URL" hint="Only used when Destination is Custom URL.">
                                        <Input disabled={socialDmForm.destination_type !== 'custom_url'} value={socialDmForm.destination_url || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, destination_url: e.target.value }))} placeholder="https://..." className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                <Field label="DM message" hint="Use {{link}} where the tracked Takeer link should appear.">
                                    <Textarea value={socialDmForm.dm_message} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, dm_message: e.target.value }))} className="min-h-28 rounded-xl" maxLength={950} />
                                </Field>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Public reply">
                                        <Input value={socialDmForm.public_reply_message || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, public_reply_message: e.target.value }))} placeholder="Sent you the link." className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Starts at">
                                        <Input type="datetime-local" value={socialDmForm.starts_at || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Ends at">
                                        <Input type="datetime-local" value={socialDmForm.ends_at || ''} onChange={(e) => setSocialDmForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                <div className="flex gap-2">
                                    <Button onClick={saveSocialDmCampaign} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {copy('Save trigger', 'Hifadhi trigger')}
                                    </Button>
                                    {socialDmForm.id && (
                                        <Button variant="outline" onClick={resetSocialDmForm} className="h-12 rounded-2xl font-black">
                                            {copy('Cancel', 'Ghairi')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'social-dms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Campaigns and test', 'Kampeni na test')}</CardTitle>
                                <CardDescription>{copy('Run a simulated comment to confirm matching, message text, and tracked link behavior.', 'Fanya simulation ya comment kuthibitisha matching, ujumbe na tabia ya link inayofuatiliwa.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-4">
                                    <InlineStat label="Active triggers" value={Number(summary.active_social_dm_campaigns || 0).toLocaleString()} />
                                    <InlineStat label="DM attempts" value={Number(summary.social_dm_sent || 0).toLocaleString()} />
                                    <InlineStat label="Tracked clicks" value={Number(summary.social_dm_clicks || 0).toLocaleString()} />
                                    <InlineStat label="Connected" value={Number(socialAccounts.length || 0).toLocaleString()} />
                                </div>

                                <div className="rounded-2xl border bg-slate-50/70 p-4">
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <Field label="Account">
                                            <select value={socialDmTest.account_id || ''} onChange={(e) => setSocialDmTest((prev) => ({ ...prev, account_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">{copy('Choose account...', 'Chagua akaunti...')}</option>
                                                {socialAccounts.map((account) => (
                                                    <option key={account.id} value={account.id}>{account.username || account.provider_account_id}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Post ID">
                                            <Input value={socialDmTest.post_id || ''} onChange={(e) => setSocialDmTest((prev) => ({ ...prev, post_id: e.target.value }))} placeholder={copy('Same as campaign or blank', 'Sawa na campaign au acha wazi')} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Comment">
                                            <Input value={socialDmTest.comment_text} onChange={(e) => setSocialDmTest((prev) => ({ ...prev, comment_text: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <div className="flex items-end">
                                            <Button disabled={saving || !socialDmTest.account_id} onClick={simulateSocialDmComment} className="h-12 w-full rounded-2xl font-black">
                                                <Send className="mr-2 h-4 w-4" />
                                                {copy('Simulate', 'Jaribu kwa simulation')}
                                            </Button>
                                        </div>
                                    </div>
                                    {socialDmTestResult && (
                                        <div className="mt-3 rounded-xl border bg-white p-3 text-xs">
                                            <p className="font-black">{copy('Result:', 'Matokeo:')} {marketingStatusLabel(socialDmTestResult.status || 'processed', copy)}</p>
                                            <p className="mt-1 text-muted-foreground">{copy('Keyword:', 'Keyword:')} {socialDmTestResult.matched_keyword || copy('none', 'hakuna')} · {copy('Comment:', 'Comment:')} {socialDmTestResult.comment_text || copy('none', 'hakuna')}</p>
                                            {socialDmTestResult.destination_url && <p className="mt-1 break-all font-semibold text-brand-700">{socialDmTestResult.destination_url}</p>}
                                        </div>
                                    )}
                                </div>

                                {socialDmCampaigns.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <Instagram className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">{copy('No Comment-to-DM campaigns yet', 'Hakuna kampeni za Comment-to-DM bado')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Create one trigger for a specific post or all posts.', 'Unda trigger moja kwa post maalum au posts zote.')}</p>
                                    </div>
                                ) : socialDmCampaigns.map((campaign) => (
                                    <div key={campaign.id} className="rounded-2xl border bg-white p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black">{campaign.name}</p>
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${campaign.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {marketingStatusLabel(campaign.status, copy)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                    {campaign.social_account_label || campaign.platform} · {copy('comments', 'comments')} "{(campaign.trigger_keywords || []).join(', ')}" · {campaign.match_mode}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {copy('Post', 'Post')} {campaign.post_provider_id || copy('any', 'yoyote')} · {copy('Destination', 'Lengwa')} {campaign.destination_type}{campaign.destination_id ? ` #${campaign.destination_id}` : ''}
                                                </p>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    {Number(campaign.comments_count || 0).toLocaleString()} {copy('comments', 'comments')} · {Number(campaign.matched_count || 0).toLocaleString()} {copy('matched', 'zimefanana')} · {Number(campaign.dm_sent_count || 0).toLocaleString()} {copy('sent', 'zimetumwa')} · {Number(campaign.clicks_count || 0).toLocaleString()} {copy('clicks', 'mibofyo')}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {campaign.destination_url && (
                                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(campaign.destination_url, copy('Destination copied.', 'Lengwa limenakiliwa.'))}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editSocialDmCampaign(campaign)}>
                                                    {copy('Edit', 'Hariri')}
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteSocialDmCampaign(campaign.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'whatsapp' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">{copy('WhatsApp Cloud API', 'WhatsApp Cloud API')}</CardTitle>
                                        <CardDescription>{copy('Webhook URL:', 'URL ya webhook:')} {whatsappConnector.webhook_url || '/api/webhooks/whatsapp'}</CardDescription>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${whatsappConnector.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {whatsappConnector.configured ? copy('Configured', 'Imesanidiwa') : copy('Needs credentials', 'Inahitaji vitambulisho')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border bg-slate-50/70 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-sm font-black">{copy('Merchant onboarding', 'Usajili wa merchant')}</p>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                {copy('Opens Meta Embedded Signup so the merchant can select or create a WhatsApp Business account and phone number.', 'Hufungua Meta Embedded Signup ili merchant aweze kuchagua au kuunda akaunti ya WhatsApp Business na namba ya simu.')}
                                            </p>
                                        </div>
                                        <Button disabled={saving || !whatsappConnector.embedded_signup_configured} onClick={startWhatsappEmbeddedSignup} className="h-12 rounded-2xl font-black">
                                            <MessageSquareText className="mr-2 h-4 w-4" />
                                            {copy('Connect WhatsApp Business', 'Unganisha WhatsApp Business')}
                                        </Button>
                                    </div>
                                    {!whatsappConnector.embedded_signup_configured && (
                                        <p className="mt-3 text-xs font-semibold text-amber-700">
                                            {copy('Requires META_CLIENT_ID, META_CLIENT_SECRET, and WHATSAPP_CLOUD_CONFIGURATION_ID or META_CONFIGURATION_ID.', 'Inahitaji META_CLIENT_ID, META_CLIENT_SECRET, na WHATSAPP_CLOUD_CONFIGURATION_ID au META_CONFIGURATION_ID.')}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setManualWhatsappSetupOpen((open) => !open)}
                                    className="text-xs font-black uppercase tracking-widest text-brand-700"
                                >
                                    {manualWhatsappSetupOpen ? copy('Hide manual setup', 'Ficha usanidi wa mwongozo') : copy('Manual setup / advanced', 'Usanidi wa mwongozo / wa ziada')}
                                </button>

                                {manualWhatsappSetupOpen && <div className="grid gap-3 md:grid-cols-5">
                                    <Field label="Phone number ID">
                                        <Input value={whatsappAccountForm.phone_number_id} onChange={(e) => setWhatsappAccountForm((prev) => ({ ...prev, phone_number_id: e.target.value }))} placeholder="Meta phone number ID" className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Business ID">
                                        <Input value={whatsappAccountForm.business_account_id} onChange={(e) => setWhatsappAccountForm((prev) => ({ ...prev, business_account_id: e.target.value }))} placeholder="Optional WABA ID" className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label={copy('Phone', 'Simu')}>
                                        <Input value={whatsappAccountForm.display_phone_number} onChange={(e) => setWhatsappAccountForm((prev) => ({ ...prev, display_phone_number: e.target.value }))} placeholder="+255..." className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label={copy('Name', 'Jina')}>
                                        <Input value={whatsappAccountForm.verified_name} onChange={(e) => setWhatsappAccountForm((prev) => ({ ...prev, verified_name: e.target.value }))} placeholder={copy('Store name', 'Jina la duka')} className="h-12 rounded-xl" />
                                    </Field>
                                    <div className="flex items-end">
                                        <Button disabled={saving || !whatsappAccountForm.phone_number_id.trim()} onClick={connectWhatsappAccount} className="h-12 w-full rounded-2xl font-black">
                                            <Link2 className="mr-2 h-4 w-4" />
                                            {copy('Connect', 'Unganisha')}
                                        </Button>
                                    </div>
                                </div>}

                                <div className="grid gap-3 md:grid-cols-3">
                                    {whatsappAccounts.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-5 text-sm font-semibold text-muted-foreground md:col-span-3">
                                            {copy('Connect a WhatsApp phone number ID, then create keyword automations.', 'Unganisha ID ya namba ya simu ya WhatsApp, kisha unda automations za maneno muhimu.')}
                                        </div>
                                    ) : whatsappAccounts.map((account) => (
                                        <div key={account.id} className="rounded-2xl border bg-white p-4">
                                            <p className="font-black">{account.verified_name || account.display_phone_number || account.phone_number_id}</p>
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{account.display_phone_number || copy('No phone display', 'Hakuna simu ya kuonyesha')} · {account.has_live_token ? copy('Cloud API token ready', 'Token ya Cloud API iko tayari') : copy('Simulated', 'Simulation')}</p>
                                            <p className="mt-2 break-all text-[11px] text-muted-foreground">Phone number ID: {account.phone_number_id}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'whatsapp' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{whatsappForm.id ? 'Edit WhatsApp automation' : 'Create WhatsApp automation'}</CardTitle>
                                <CardDescription>{copy('Buyer messages a keyword, Takeer replies with a tracked store or checkout link.', 'Buyer anatuma keyword, Takeer inajibu kwa link ya storefront au checkout inayofuatiliwa.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Name">
                                        <Input value={whatsappForm.name} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={copy('Catalog responder', 'Responder wa catalog')} className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Account">
                                        <select value={whatsappForm.whatsapp_account_id || ''} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, whatsapp_account_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="">{copy('Any connected WhatsApp account', 'Akaunti yoyote ya WhatsApp iliyounganishwa')}</option>
                                            {whatsappAccounts.map((account) => (
                                                <option key={account.id} value={account.id}>{account.verified_name || account.display_phone_number || account.phone_number_id}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Status">
                                        <select value={whatsappForm.status} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="draft">{copy('Draft', 'Draft')}</option>
                                            <option value="active">{copy('Active', 'Hai')}</option>
                                            <option value="paused">{copy('Paused', 'Imesitishwa')}</option>
                                            <option value="expired">{copy('Expired', 'Imeisha')}</option>
                                        </select>
                                    </Field>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Trigger words" hint="Comma-separated, e.g. catalog, price, service.">
                                        <Input value={whatsappForm.trigger_keywords} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, trigger_keywords: e.target.value }))} className="h-12 rounded-xl font-black" />
                                    </Field>
                                    <Field label="Match mode">
                                        <select value={whatsappForm.match_mode} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, match_mode: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="contains">{copy('Contains word', 'Ina neno')}</option>
                                            <option value="exact">{copy('Exact message', 'Ujumbe kamili')}</option>
                                        </select>
                                    </Field>
                                    <Field label="Destination">
                                        <select value={whatsappForm.destination_type} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, destination_type: e.target.value, destination_id: '', destination_url: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="storefront">{copy('Storefront', 'Storefront')}</option>
                                            <option value="product">{copy('Product/service/download', 'Bidhaa/huduma/download')}</option>
                                            <option value="bundle">{copy('Bundle/course', 'Bundle/kozi')}</option>
                                            <option value="subscription_plan">{copy('Membership', 'Uanachama')}</option>
                                            <option value="post">{copy('Premium post', 'Post maalum')}</option>
                                            <option value="content_item">{copy('Content item', 'Kipengele cha content')}</option>
                                            <option value="custom_url">{copy('Custom URL', 'URL maalum')}</option>
                                        </select>
                                    </Field>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Target offer">
                                        {['storefront', 'custom_url'].includes(whatsappForm.destination_type) ? (
                                            <Input disabled value={whatsappForm.destination_type === 'storefront' ? copy('Storefront', 'Storefront') : copy('Custom URL', 'URL maalum')} className="h-12 rounded-xl text-muted-foreground" />
                                        ) : (
                                            <select value={whatsappForm.destination_id || ''} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, destination_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">{copy('Choose target...', 'Chagua lengwa...')}</option>
                                                {whatsappTargetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                ))}
                                            </select>
                                        )}
                                    </Field>
                                    <Field label="Custom URL">
                                        <Input disabled={whatsappForm.destination_type !== 'custom_url'} value={whatsappForm.destination_url || ''} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, destination_url: e.target.value }))} placeholder="https://..." className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                <Field label="Response message" hint="Use {{link}} where the tracked Takeer link should appear.">
                                    <Textarea value={whatsappForm.response_message} onChange={(e) => setWhatsappForm((prev) => ({ ...prev, response_message: e.target.value }))} className="min-h-28 rounded-xl" maxLength={1000} />
                                </Field>

                                <div className="flex gap-2">
                                    <Button onClick={saveWhatsappAutomation} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {copy('Save automation', 'Hifadhi automation')}
                                    </Button>
                                    {whatsappForm.id && <Button variant="outline" onClick={resetWhatsappForm} className="h-12 rounded-2xl font-black">{copy('Cancel', 'Ghairi')}</Button>}
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'whatsapp' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Automations and test', 'Automations na test')}</CardTitle>
                                <CardDescription>{copy('Simulate an inbound WhatsApp message before Cloud API credentials are live.', 'Fanya simulation ya ujumbe unaoingia wa WhatsApp kabla credentials za Cloud API kuwa live.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-4">
                                    <InlineStat label="Active" value={Number(summary.active_whatsapp_automations || 0).toLocaleString()} />
                                    <InlineStat label="Sent" value={Number(summary.whatsapp_sent || 0).toLocaleString()} />
                                    <InlineStat label="Clicks" value={Number(summary.whatsapp_clicks || 0).toLocaleString()} />
                                    <InlineStat label="Accounts" value={Number(whatsappAccounts.length || 0).toLocaleString()} />
                                </div>

                                <div className="rounded-2xl border bg-slate-50/70 p-4">
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <Field label="Account">
                                            <select value={whatsappTest.account_id || ''} onChange={(e) => setWhatsappTest((prev) => ({ ...prev, account_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">{copy('Choose account...', 'Chagua akaunti...')}</option>
                                                {whatsappAccounts.map((account) => (
                                                    <option key={account.id} value={account.id}>{account.verified_name || account.display_phone_number || account.phone_number_id}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Buyer phone">
                                            <Input value={whatsappTest.from_phone} onChange={(e) => setWhatsappTest((prev) => ({ ...prev, from_phone: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Message">
                                            <Input value={whatsappTest.message_text} onChange={(e) => setWhatsappTest((prev) => ({ ...prev, message_text: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <div className="flex items-end">
                                            <Button disabled={saving || !whatsappTest.account_id} onClick={simulateWhatsappMessage} className="h-12 w-full rounded-2xl font-black">
                                                <Send className="mr-2 h-4 w-4" />
                                                {copy('Simulate', 'Jaribu kwa simulation')}
                                            </Button>
                                        </div>
                                    </div>
                                    {whatsappTestResult && (
                                        <div className="mt-3 rounded-xl border bg-white p-3 text-xs">
                                            <p className="font-black">{copy('Result:', 'Matokeo:')} {marketingStatusLabel(whatsappTestResult.status || 'processed', copy)}</p>
                                            <p className="mt-1 text-muted-foreground">{copy('Keyword:', 'Keyword:')} {whatsappTestResult.matched_keyword || copy('none', 'hakuna')} · {copy('Message:', 'Ujumbe:')} {whatsappTestResult.message_text || copy('none', 'hakuna')}</p>
                                            {whatsappTestResult.destination_url && <p className="mt-1 break-all font-semibold text-brand-700">{whatsappTestResult.destination_url}</p>}
                                        </div>
                                    )}
                                </div>

                                {whatsappAutomations.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <MessageSquareText className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">{copy('No WhatsApp automations yet', 'Hakuna automations za WhatsApp bado')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Create a keyword responder for catalog, price, services, or order help.', 'Unda responder wa keyword kwa catalog, bei, huduma au msaada wa order.')}</p>
                                    </div>
                                ) : whatsappAutomations.map((automation) => (
                                    <div key={automation.id} className="rounded-2xl border bg-white p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black">{automation.name}</p>
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${automation.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{marketingStatusLabel(automation.status, copy)}</span>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">{automation.whatsapp_account_label || copy('Any account', 'Akaunti yoyote')} · {(automation.trigger_keywords || []).join(', ')}</p>
                                                <p className="mt-2 text-xs text-muted-foreground">{Number(automation.matched_count || 0).toLocaleString()} {copy('matched', 'zimefanana')} · {Number(automation.sent_count || 0).toLocaleString()} {copy('sent', 'zimetumwa')} · {Number(automation.clicks_count || 0).toLocaleString()} {copy('clicks', 'mibofyo')}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {automation.destination_url && <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(automation.destination_url, copy('Destination copied.', 'Lengwa limenakiliwa.'))}><Copy className="h-4 w-4" /></Button>}
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editWhatsappAutomation(automation)}>{copy('Edit', 'Hariri')}</Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteWhatsappAutomation(automation.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'whatsapp' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Follower WhatsApp broadcast', 'Tangazo la WhatsApp kwa followers')}</CardTitle>
                                <CardDescription>{copy('Send a simulated WhatsApp update to followers who allow WhatsApp notifications.', 'Tuma update ya WhatsApp ya simulation kwa followers wanaoruhusu notifications za WhatsApp.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Destination">
                                        <select value={whatsappBroadcast.destination_type} onChange={(e) => setWhatsappBroadcast((prev) => ({ ...prev, destination_type: e.target.value, destination_id: '', destination_url: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="storefront">{copy('Storefront', 'Storefront')}</option>
                                            <option value="product">{copy('Product/service/download', 'Bidhaa/huduma/download')}</option>
                                            <option value="bundle">{copy('Bundle/course', 'Bundle/kozi')}</option>
                                            <option value="subscription_plan">{copy('Membership', 'Uanachama')}</option>
                                            <option value="post">{copy('Premium post', 'Post maalum')}</option>
                                            <option value="content_item">{copy('Content item', 'Kipengele cha content')}</option>
                                            <option value="custom_url">{copy('Custom URL', 'URL maalum')}</option>
                                        </select>
                                    </Field>
                                    <Field label="Target offer">
                                        {['storefront', 'custom_url'].includes(whatsappBroadcast.destination_type) ? (
                                            <Input disabled value={whatsappBroadcast.destination_type === 'storefront' ? copy('Storefront', 'Storefront') : copy('Custom URL', 'URL maalum')} className="h-12 rounded-xl text-muted-foreground" />
                                        ) : (
                                            <select value={whatsappBroadcast.destination_id || ''} onChange={(e) => setWhatsappBroadcast((prev) => ({ ...prev, destination_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">{copy('Choose target...', 'Chagua lengwa...')}</option>
                                                {whatsappBroadcastTargetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                ))}
                                            </select>
                                        )}
                                    </Field>
                                    <Field label="Custom URL">
                                        <Input disabled={whatsappBroadcast.destination_type !== 'custom_url'} value={whatsappBroadcast.destination_url || ''} onChange={(e) => setWhatsappBroadcast((prev) => ({ ...prev, destination_url: e.target.value }))} placeholder="https://..." className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                <Field label="Broadcast message" hint="Use {{link}} where the tracked Takeer link should appear.">
                                    <Textarea value={whatsappBroadcast.message} onChange={(e) => setWhatsappBroadcast((prev) => ({ ...prev, message: e.target.value }))} className="min-h-28 rounded-xl" maxLength={1000} />
                                </Field>

                                <Button onClick={sendWhatsappFollowerBroadcast} disabled={saving || !whatsappBroadcast.message.trim()} className="h-12 rounded-2xl font-black">
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    {copy('Send to WhatsApp followers', 'Tuma kwa followers wa WhatsApp')}
                                </Button>
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-dashed border-brand-200 bg-brand-50/30">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{copy('SMS packages preview', 'Muonekano wa vifurushi vya SMS')}</CardTitle>
                                <CardDescription>{copy('Buy SMS credits for customer broadcasts, launch alerts, and group-sale updates.', 'Nunua salio la SMS kwa matangazo ya wateja, alerts za uzinduzi na updates za mauzo ya kundi.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-3">
                                {smsPackages.map((pack) => (
                                    <div key={pack.id} className="rounded-2xl border bg-white p-4">
                                        <p className="font-black">{pack.name}</p>
                                        <p className="mt-1 text-2xl font-black text-brand-600">{Number(pack.credits).toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">{copy('SMS credits', 'Salio la SMS')}</p>
                                        <p className="mt-3 text-sm font-black">TZS {Number(pack.price).toLocaleString()}</p>
                                        <Button
                                            variant="outline"
                                            disabled={smsBusy}
                                            onClick={() => buySmsPackage(pack.id)}
                                            className="mt-3 h-9 w-full rounded-xl text-xs font-black"
                                        >
                                            {copy('Add credits', 'Ongeza salio')}
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-emerald-100 bg-emerald-50/25">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">{copy('Abandoned checkout recovery', 'Urejeshaji wa checkout iliyoachwa')}</CardTitle>
                                        <CardDescription>{copy('Automatically send one recovery SMS after a buyer opens checkout but does not complete.', 'Tuma SMS moja ya kurejesha baada ya buyer kufungua checkout bila kukamilisha.')}</CardDescription>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${abandonedAutomation.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {abandonedAutomation.is_enabled ? copy('Active', 'Hai') : copy('Off', 'Imezimwa')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <label className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
                                    <div>
                                        <p className="text-sm font-black">{copy('Enable recovery automation', 'Washa automation ya kurejesha')}</p>
                                        <p className="text-xs text-muted-foreground">{copy('Runs every 15 minutes and uses SMS credits. Each abandoned checkout event is messaged once.', 'Huendeshwa kila dakika 15 na hutumia salio la SMS. Kila checkout iliyoachwa hutumiwa ujumbe mara moja.')}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(abandonedAutomation.is_enabled)}
                                        onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, is_enabled: e.target.checked }))}
                                        className="h-5 w-5"
                                    />
                                </label>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Send after" hint="Minutes after checkout starts. Minimum 30.">
                                        <Input type="number" min="30" max="10080" value={abandonedAutomation.delay_minutes || 60} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, delay_minutes: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Lookback days" hint="How far back eligible abandoned checkouts are considered.">
                                        <Input type="number" min="1" max="30" value={abandonedAutomation.max_age_days || 7} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, max_age_days: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Coupon code" hint="Optional. Must be one of this merchant's coupons.">
                                        <Input value={abandonedAutomation.coupon_code || ''} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, coupon_code: e.target.value.toUpperCase() }))} placeholder={copy('Optional', 'Hiari')} className="h-12 rounded-xl font-black" />
                                    </Field>
                                </div>

                                <Field label="Recovery message" hint="Keep it short. Coupon code is appended automatically if not already included.">
                                    <Textarea value={abandonedAutomation.message || ''} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, message: e.target.value }))} className="min-h-24 rounded-xl" maxLength={640} />
                                </Field>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {copy('Sent recoveries:', 'Ujumbe wa kurejesha uliotumwa:')} {Number(abandonedAutomation.sent_count || 0).toLocaleString()}
                                        {abandonedAutomation.last_run_at ? ` · last run ${new Date(abandonedAutomation.last_run_at).toLocaleString()}` : ''}
                                    </p>
                                    <Button disabled={smsBusy} onClick={saveAbandonedAutomation} className="h-12 rounded-2xl font-black">
                                        {smsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {copy('Save automation', 'Hifadhi automation')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">{copy('SMS campaign', 'Kampeni ya SMS')}</CardTitle>
                                        <CardDescription>{copy('Provider-ready workflow for customer broadcasts and launch alerts.', 'Workflow iliyo tayari kwa provider kwa matangazo ya wateja na alerts za uzinduzi.')}</CardDescription>
                                    </div>
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                        {copy('Simulated', 'Simulation')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex gap-3">
                                    <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-black text-amber-900">{copy('SMS consent and provider status', 'Ridhaa ya SMS na hali ya provider')}</p>
                                        <p className="mt-1 text-xs leading-5 text-amber-800">
                                            {copy('Send only to customers who have a relationship with this business or opted into updates. Real provider sending is not connected yet, so Send now and scheduled sends record simulated delivery logs.', 'Tuma kwa wateja wenye uhusiano na biashara hii au waliojiunga na updates pekee. Utumaji halisi wa provider bado haujaunganishwa, hivyo kutuma sasa na kutuma kwa ratiba huweka kumbukumbu za simulation.')}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-brand-50/50 p-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">{copy('Available SMS credits', 'Salio la SMS linalopatikana')}</p>
                                        <p className="text-3xl font-black">{Number(smsBalance.credits || 0).toLocaleString()}</p>
                                    </div>
                                    <MessageSquareText className="h-8 w-8 text-brand-600" />
                                </div>

                                <Field label="Campaign name" hint="Internal name, for example New handbag drop or Webinar reminder.">
                                    <Input value={smsForm.name} onChange={(e) => setSmsForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={copy('New product launch', 'Uzinduzi wa bidhaa mpya')} className="h-12 rounded-xl" />
                                </Field>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Audience" hint={selectedAudience?.requires_ref ? 'Choose the exact product or subscription plan on the right.' : 'Choose who should receive this SMS.'}>
                                        <select value={smsForm.audience_type} onChange={(e) => setSmsForm((prev) => ({ ...prev, audience_type: e.target.value, audience_ref_id: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            {smsAudiences.map((audience) => (
                                                <option key={audience.type} value={audience.type}>
                                                    {audience.label}{audience.count !== null && audience.count !== undefined ? ` (${audience.count})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Target offer" hint={selectedAudience?.requires_ref ? 'Pick the exact product or plan whose customers should receive this SMS.' : 'Only needed for product buyers or one subscription plan.'}>
                                        {selectedAudience?.requires_ref ? (
                                            <select
                                                value={smsForm.audience_ref_id}
                                                onChange={(e) => setSmsForm((prev) => ({ ...prev, audience_ref_id: e.target.value }))}
                                                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground"
                                            >
                                                <option value="">{copy('Choose target...', 'Chagua lengwa...')}</option>
                                                {targetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>
                                                        {target.label} · {target.meta}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input disabled value={copy('Not needed', 'Haihitajiki')} className="h-12 rounded-xl text-muted-foreground" />
                                        )}
                                    </Field>
                                </div>

                                <Field label="SMS message" hint="One credit usually covers 160 characters. Longer messages use more credits per recipient.">
                                    <Textarea value={smsForm.message} onChange={(e) => setSmsForm((prev) => ({ ...prev, message: e.target.value }))} placeholder="Habari! Bidhaa mpya imefika..." className="min-h-28 rounded-xl" maxLength={640} />
                                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                                        <span>{smsCharacters}/640 characters</span>
                                        <span>{smsSegments} credit{smsSegments === 1 ? '' : 's'} per recipient</span>
                                    </div>
                                </Field>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Send mode">
                                        <select value={smsForm.send_mode} onChange={(e) => setSmsForm((prev) => ({ ...prev, send_mode: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="draft">{copy('Save draft', 'Hifadhi draft')}</option>
                                            <option value="send_now">{copy('Send now', 'Tuma sasa')}</option>
                                            <option value="schedule">{copy('Schedule', 'Panga')}</option>
                                        </select>
                                    </Field>
                                    <Field label="Schedule time" hint="Only used when Send mode is Schedule.">
                                        <Input disabled={smsForm.send_mode !== 'schedule'} type="datetime-local" value={smsForm.scheduled_at} onChange={(e) => setSmsForm((prev) => ({ ...prev, scheduled_at: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                {smsEstimate && (
                                    <div className="rounded-2xl border bg-slate-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Estimate', 'Makadirio')}</p>
                                        <p className="mt-1 text-sm font-bold">
                                            {Number(smsEstimate.recipient_count || 0).toLocaleString()} {copy('recipients', 'wapokeaji')} · {Number(smsEstimate.estimated_credits || 0).toLocaleString()} {copy('credits', 'salio')}
                                        </p>
                                        {smsEstimate.sample?.length > 0 && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Sample: {smsEstimate.sample.map((entry) => entry.name || entry.phone).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button variant="outline" disabled={smsBusy} onClick={estimateSmsCampaign} className="h-12 rounded-2xl font-black flex-1">
                                        {copy('Estimate cost', 'Kadiria gharama')}
                                    </Button>
                                    <Button disabled={smsBusy} onClick={() => saveSmsCampaign(smsForm.send_mode)} className="h-12 rounded-2xl font-black flex-1">
                                        {smsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : smsForm.send_mode === 'send_now' ? <Send className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                        {smsForm.send_mode === 'send_now' ? copy('Simulate send', 'Jaribu kutuma kwa simulation') : copy('Save campaign', 'Hifadhi kampeni')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">{copy('SMS campaign history', 'Historia ya kampeni za SMS')}</CardTitle>
                                <CardDescription>{copy('Draft, scheduled, and simulated campaign results.', 'Matokeo ya kampeni za draft, zilizopangwa na simulation.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {smsCampaigns.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <MessageSquareText className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">{copy('No SMS campaigns yet', 'Hakuna kampeni za SMS bado')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{copy('Create one above to test the workflow.', 'Unda moja hapo juu kujaribu workflow.')}</p>
                                    </div>
                                ) : smsCampaigns.map((campaign) => (
                                    <div key={campaign.id} className="rounded-2xl border p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-black">{campaign.name}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">{campaign.message}</p>
                                                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                                                    {campaign.estimated_recipients} {copy('recipients', 'wapokeaji')} · {campaign.estimated_credits} {copy('credits', 'salio')} · {copy('sent', 'zimetumwa')} {campaign.sent_count}
                                                    {campaign.scheduled_at ? ` · ${copy('scheduled', 'zimepangwa')} ${new Date(campaign.scheduled_at).toLocaleString()}` : ''}
                                                    {campaign.pending_count ? ` · ${copy('pending', 'zinasubiri')} ${campaign.pending_count}` : ''}
                                                </p>
                                                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {campaign.provider_mode || 'queued_intent'}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                {marketingStatusLabel(campaign.status, copy)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function AnalyticsExports({ merchantUsername }) {
    const { copy } = useLocale();
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - (29 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const [fromDate, setFromDate] = useState(thirtyDaysAgo);
    const [toDate, setToDate] = useState(today);

    const reports = [
        {
            title: 'Revenue statement',
            description: 'Paid orders, payout state, gross, fees, and net amount.',
            href: `/merchant/${merchantUsername}/exports/statement.csv`,
        },
        {
            title: 'Campaign report',
            description: 'Coupons, referrals, group sales, SMS, and recovery activity.',
            href: `/merchant/${merchantUsername}/exports/campaigns.csv`,
        },
        {
            title: 'Product performance',
            description: 'Views, orders, gross revenue, released, and pending revenue.',
            href: `/merchant/${merchantUsername}/exports/product-performance.csv`,
        },
        {
            title: 'Order report',
            description: 'Buyer, item, discount, source, gateway, and tracking fields.',
            href: `/merchant/${merchantUsername}/exports/orders.csv`,
        },
    ];
    const exportHref = (href) => {
        const params = new URLSearchParams();
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        const query = params.toString();

        return query ? `${href}?${query}` : href;
    };
    const openExport = (href) => {
        window.location.assign(exportHref(href));
    };
    const clearDateRange = () => {
        setFromDate('');
        setToDate('');
    };

    return (
        <Card className="rounded-[28px] border-brand-100/70">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                            <FileDown className="h-3.5 w-3.5" />
                            {copy('Analytics exports', 'Uhamishaji wa analytics')}
                        </div>
                        <CardTitle className="mt-3 text-xl font-black">{copy('Download CSV reports', 'Pakua ripoti za CSV')}</CardTitle>
                        <CardDescription>
                            {copy('Export creator finance, campaign, product, and order data for spreadsheets or bookkeeping.', 'Export data za fedha za creator, kampeni, bidhaa na orders kwa spreadsheets au bookkeeping.')}
                        </CardDescription>
                    </div>
                    <div className="flex w-full flex-col gap-2 md:max-w-lg">
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="From">
                                <Input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="h-11 rounded-xl" />
                            </Field>
                            <Field label="To">
                                <Input type="date" value={toDate} min={fromDate || undefined} max={today} onChange={(e) => setToDate(e.target.value)} className="h-11 rounded-xl" />
                            </Field>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={clearDateRange} className="self-start rounded-xl">
                            {copy('Clear range', 'Futa kipindi')}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {reports.map((report) => (
                        <button
                            type="button"
                            key={report.href}
                            onClick={() => openExport(report.href)}
                            className="group rounded-2xl border bg-white p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
                            aria-label={`${copy('Export', 'Export')} ${report.title}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black">{marketingCopy(copy, report.title)}</p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{marketingCopy(copy, report.description)}</p>
                                </div>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white text-brand-600 group-hover:border-brand-200">
                                    <FileDown className="h-4 w-4" />
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function MarketingSectionNav({ baseUrl, activeSection, tabs = sectionTabs }) {
    const { copy } = useLocale();
    const scrollContainerRef = React.useRef(null);
    const scrollTabsRight = () => {
        scrollContainerRef.current?.scrollBy({ left: 180, behavior: 'smooth' });
    };

    return (
        <div className="relative border-b border-border">
            <div ref={scrollContainerRef} className="overflow-x-auto">
                <div className="flex min-w-max gap-1 pr-14 md:pr-0">
                    {tabs.map(([key, label]) => {
                        const href = key === 'overview' ? baseUrl : `${baseUrl}/${key}`;
                        const active = activeSection === key;

                        return (
                            <Link
                                key={key}
                                href={href}
                                className={`border-b-2 px-3 py-3 text-sm font-black transition ${active
                                    ? 'border-brand-600 text-brand-700'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {marketingCopy(copy, label)}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l from-background via-background/95 to-transparent pr-1 md:hidden">
                <button
                    type="button"
                    onClick={scrollTabsRight}
                    className="flex h-8 w-8 items-center justify-center rounded-full border bg-white text-brand-700 shadow-sm"
                    aria-label={copy('Show more marketing tabs', 'Onyesha tabo zaidi za masoko')}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function CreatorAnalytics({ analytics = {} }) {
    const { copy } = useLocale();
    const sources = analytics.source_revenue || [];
    const funnels = analytics.funnels || [];
    const topProducts = analytics.top_products || [];
    const topReferrals = analytics.top_referrals || [];
    const topCoupons = analytics.top_coupons || [];
    const gaps = analytics.tracking_gaps || [];
    const identity = analytics.identity_coverage || {};

    return (
        <Card className="rounded-[28px] border-brand-100/70 overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            <BarChart3 className="h-3.5 w-3.5" />
                            {copy('Creator analytics', 'Uchambuzi wa creator')}
                        </div>
                        <CardTitle className="mt-3 text-xl font-black">{copy('Sales funnel and campaign performance', 'Funnel ya mauzo na utendaji wa kampeni')}</CardTitle>
                        <CardDescription>
                            {copy('Revenue, conversion signals, and top offers from the data Takeer already tracks.', 'Mapato, ishara za conversion na ofa bora kutoka data ambayo Takeer tayari inafuatilia.')}
                        </CardDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-w-[220px]">
                        <MiniMoney label={`Revenue · ${analytics.window_label || 'All time'}`} value={analytics.revenue_total || 0} tone="emerald" />
                        <div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-brand-800">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-75">{copy('Paid orders', 'Orders zilizolipwa')}</p>
                            <p className="mt-1 text-sm font-black">{Number(analytics.orders_total || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-4">
                    {sources.length === 0 ? (
                        <EmptyAnalytics text={copy('No attributed sales yet.', 'Hakuna mauzo yaliyohusishwa bado.')} />
                    ) : sources.map((source) => (
                        <div key={source.key} className="rounded-2xl border bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{source.label}</p>
                                    <p className="mt-2 text-lg font-black">{formatCurrency(source.revenue)}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                                    {Number(source.share || 0).toLocaleString()}%
                                </span>
                            </div>
                            <p className="mt-2 text-xs font-semibold text-muted-foreground">
                                {Number(source.orders || 0).toLocaleString()} {copy('orders', 'orders')}
                            </p>
                            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{source.note}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border bg-slate-50/70 p-4">
                        <div className="flex items-center gap-2">
                            <MousePointerClick className="h-4 w-4 text-brand-600" />
                            <p className="text-sm font-black uppercase tracking-wider">{copy('Conversion signals', 'Ishara za conversion')}</p>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {funnels.map((funnel) => (
                                <div key={funnel.key} className="rounded-2xl border bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-black">{funnel.label}</p>
                                        <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-black text-brand-700">
                                            {funnel.conversion_rate === null ? copy('Tracking', 'Ufuatiliaji') : `${Number(funnel.conversion_rate || 0).toLocaleString()}%`}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <InlineStat label={funnel.key === 'sms' ? 'Sent' : 'Views'} value={Number(funnel.views || 0).toLocaleString()} />
                                        <InlineStat label="Orders" value={funnel.orders === null ? copy('Pending', 'Inasubiri') : Number(funnel.orders || 0).toLocaleString()} />
                                    </div>
                                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{funnel.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            <p className="text-sm font-black uppercase tracking-wider">{copy('Top movers', 'Vinavyofanya vizuri')}</p>
                        </div>
                        <div className="mt-3 space-y-3">
                            <TopList title="Products" rows={topProducts} empty="No product sales yet." />
                            <TopList title="Referrals" rows={topReferrals} empty="No referral conversions yet." />
                            <TopList title="Coupons" rows={topCoupons} empty="No coupon redemptions yet." />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-sm font-black uppercase tracking-wider">{copy('Identity stitching', 'Uunganishaji wa utambulisho')}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{identity.note || copy('Buyer identity is linked after a deterministic account, phone, or checkout signal.', 'Utambulisho wa buyer unaunganishwa baada ya signal ya akaunti, simu au checkout iliyo wazi.')}</p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            {identity.confidence || copy('deterministic', 'iliyo wazi')}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <InlineStat label="Known buyers" value={Number(identity.identified_buyers || 0).toLocaleString()} />
                        <InlineStat label="Known orders" value={Number(identity.identified_orders || 0).toLocaleString()} />
                        <InlineStat label="Order coverage" value={`${Number(identity.identified_order_rate || 0).toLocaleString()}%`} />
                        <InlineStat label="Linked sessions" value={Number(identity.linked_sessions || 0).toLocaleString()} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TopList({ title, rows = [], empty }) {
    const { copy } = useLocale();
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{marketingCopy(copy, title)}</p>
            <div className="mt-2 space-y-2">
                {rows.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground">{marketingCopy(copy, empty)}</p>
                ) : rows.slice(0, 3).map((row) => (
                    <div key={`${title}-${row.id || row.code}`} className="rounded-xl border px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-black">{row.title || row.label || row.code}</p>
                            <p className="shrink-0 text-xs font-black">{formatCurrency(row.revenue || 0)}</p>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                            {row.orders !== undefined ? `${Number(row.orders || 0).toLocaleString()} ${copy('orders', 'orders')}` : ''}
                            {row.conversions !== undefined ? `${Number(row.conversions || 0).toLocaleString()} ${copy('conversions', 'conversions')}` : ''}
                            {row.redemptions !== undefined ? `${Number(row.redemptions || 0).toLocaleString()} ${copy('redemptions', 'matumizi')}` : ''}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EmptyAnalytics({ text }) {
    const { copy } = useLocale();
    return (
        <div className="rounded-2xl border border-dashed bg-white p-5 text-sm font-semibold text-muted-foreground">
            {marketingCopy(copy, text)}
        </div>
    );
}

function Metric({ label, value }) {
    const { copy } = useLocale();
    return (
        <Card className="rounded-2xl">
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{marketingCopy(copy, label)}</p>
                <p className="mt-2 text-xl font-black">{value}</p>
            </CardContent>
        </Card>
    );
}

function InlineStat({ label, value }) {
    const { copy } = useLocale();
    return (
        <div className="rounded-2xl border bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{marketingCopy(copy, label)}</p>
            <p className="mt-2 text-xl font-black">{value}</p>
        </div>
    );
}

function MiniMoney({ label, value, tone = 'slate' }) {
    const { copy } = useLocale();
    const toneClass = {
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        slate: 'border-slate-200 bg-slate-50 text-slate-700',
    }[tone] || 'border-slate-200 bg-slate-50 text-slate-700';

    return (
        <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-75">{marketingCopy(copy, label)}</p>
            <p className="mt-1 text-sm font-black">TZS {Number(value || 0).toLocaleString()}</p>
        </div>
    );
}

function Field({ label, hint, children }) {
    const { copy } = useLocale();
    return (
        <label className="space-y-1.5 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{marketingCopy(copy, label)}</span>
            {children}
            {hint && <span className="block text-[11px] font-semibold leading-5 text-muted-foreground">{marketingCopy(copy, hint)}</span>}
        </label>
    );
}

function formatCurrency(value) {
    return `TZS ${Number(value || 0).toLocaleString()}`;
}

function discountLabel(coupon, translate = (_, swahili) => swahili) {
    if (coupon.discount_type === 'fixed') {
        return `TZS ${Number(coupon.discount_value || 0).toLocaleString()} ${translate('off', 'punguzo')}`;
    }

    return `${Number(coupon.discount_value || 0).toLocaleString()}% ${translate('off', 'punguzo')}`;
}

function targetLabel(link, translate = (_, swahili) => swahili) {
    const labels = {
        storefront: translate('storefront', 'storefront'),
        product: `${translate('product', 'bidhaa')} #${link.target_id}`,
        bundle: `${translate('bundle', 'bundle')} #${link.target_id}`,
        subscription_plan: `${translate('membership', 'uanachama')} #${link.target_id}`,
        post: `${translate('post', 'post')} #${link.target_id}`,
        content_item: `${translate('content', 'content')} #${link.target_id}`,
    };

    return labels[link.target_type] || translate('destination', 'lengwa');
}

function marketingStatusLabel(status, translate = (_, swahili) => swahili) {
    const labels = {
        active: ['Active', 'Hai'],
        paused: ['Paused', 'Imesitishwa'],
        expired: ['Expired', 'Imeisha'],
        draft: ['Draft', 'Rasimu'],
        successful: ['Successful', 'Imefanikiwa'],
        cancelled: ['Cancelled', 'Imeghairiwa'],
        queued: ['Queued', 'Imepangwa'],
        sent: ['Sent', 'Imetumwa'],
        simulated: ['Simulated', 'Simulation'],
    };
    return labels[status] ? translate(...labels[status]) : String(status || '').replaceAll('_', ' ');
}
