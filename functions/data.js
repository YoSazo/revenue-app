const bizSdk = require('facebook-nodejs-business-sdk');
const webpush = require('web-push');

// --- Get all secrets from Netlify Environment Variables ---
const accessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
// ---------------------------------------------------------

// This will hold the user's subscription in memory.
// For a multi-user app, you would store this in a database.
let pushSubscription = null;

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
      'mailto:your-email@example.com', // You can change this to your email
      vapidPublicKey,
      vapidPrivateKey
    );
}

const TARGET_CAMPAIGN_IDS = [
  '6898612187193',
  '6898612186993',
  '6898612186793',
];

const Api = bizSdk.FacebookAdsApi.init(accessToken);
const AdAccount = bizSdk.AdAccount;

const getDatePreset = (period) => {
    switch (period) {
        case 'yesterday': return 'yesterday';
        case 'thisWeek': return 'this_week_sun_today';
        case 'today': default: return 'today';
    }
};

const getActionValue = (actions, actionType) => {
    if (!actions) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseInt(action.value, 10) : 0;
};

// --- MAIN FUNCTION HANDLER ---
exports.handler = async (event) => {
    const path = event.path.replace('/.netlify/functions/data', '');

    // --- ROUTE 1: Handle subscribing to notifications ---
    if (path === '/subscribe' && event.httpMethod === 'POST') {
        if (!vapidPublicKey) {
            console.error("VAPID keys not configured.");
            return { statusCode: 500, body: 'VAPID keys not configured on server.' };
        }
        pushSubscription = JSON.parse(event.body);
        console.log('Received Push Subscription:', pushSubscription);
        return { statusCode: 201, body: JSON.stringify({ message: 'Subscription received.' }) };
    }
    
    // --- ROUTE 2: Handle Facebook Webhook (for real-time "cha-ching") ---
    if (path === '/webhook' && event.httpMethod === 'POST') {
        console.log('Webhook from Facebook received!');
        if (pushSubscription) {
            const payload = JSON.stringify({ title: 'Cha-Ching!', body: 'New conversion recorded!' });
            try {
                await webpush.sendNotification(pushSubscription, payload);
                console.log('Push notification sent!');
            } catch (error) {
                console.error('Error sending push notification:', error);
            }
        }
        return { statusCode: 200, body: 'EVENT_RECEIVED' };
    }

    // --- ROUTE 3: Handle fetching dashboard data (Default) ---
    const period = event.queryStringParameters.period || 'today';

    try {
        // ... (The entire data fetching logic from the previous step is unchanged)
        const account = new AdAccount(adAccountId);
        const fields = ['spend', 'purchase_roas', 'impressions', 'ctr', 'inline_link_click_ctr', 'actions'];
        const params = { 'level': 'account', 'date_preset': getDatePreset(period), 'filtering': [{ field: 'campaign.id', operator: 'IN', value: TARGET_CAMPAIGN_IDS }] };
        const result = await account.getInsights(fields, params);
        if (!result || result.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ totalRevenue: 0, hotels: [] }) };
        }
        const stats = result[0];
        const spend = parseFloat(stats.spend || 0);
        const roas = stats.purchase_roas ? parseFloat(stats.purchase_roas[0].value) : 0;
        const totalRevenue = spend * roas;
        const actions = stats.actions;
        const standardPurchases = getActionValue(actions, 'purchase');
        const pixelPurchases = getActionValue(actions, 'offsite_conversion.fb_pixel_purchase');
        const totalPurchases = standardPurchases + pixelPurchases;
        const detailedMetrics = {
            lpv: getActionValue(actions, 'landing_page_view'),
            searches: getActionValue(actions, 'search'),
            atc: getActionValue(actions, 'add_to_cart'),
            initiateCheckouts: getActionValue(actions, 'initiate_checkout'),
            paymentInfoAdds: getActionValue(actions, 'add_payment_info'),
            purchases: totalPurchases,
        };
        const formattedData = {
            totalRevenue: totalRevenue,
            hotels: [{ name: 'Home Place Suites', location: 'Bartlesville', cpa: totalPurchases > 0 ? spend / totalPurchases : 0, ctr: stats.inline_link_click_ctr ? parseFloat(stats.inline_link_click_ctr) : 0, reach: stats.impressions ? parseInt(stats.impressions, 10) : 0, details: { ...detailedMetrics, ctr_all: stats.ctr ? parseFloat(stats.ctr) : 0, ctr_link: stats.inline_link_click_ctr ? parseFloat(stats.inline_link_click_ctr) : 0, } }],
        };
        return { statusCode: 200, body: JSON.stringify(formattedData) };

    } catch (error) {
        console.error('Error fetching from Facebook API:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch data from Facebook Marketing API.' }) };
    }
};