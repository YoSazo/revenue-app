const bizSdk = require('facebook-nodejs-business-sdk');

const accessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

// --- EDIT THIS LIST TO ADD OR REMOVE CAMPAIGN IDs ---
const TARGET_CAMPAIGN_IDS = [
  '6898612187193',
  '6898612186993',
  '6898612186793',
];
// ----------------------------------------------------

const Api = bizSdk.FacebookAdsApi.init(accessToken);
const AdAccount = bizSdk.AdAccount;

const getDatePreset = (period) => {
    switch (period) {
        case 'yesterday': return 'yesterday';
        case 'thisWeek': return 'this_week_sun_today';
        case 'today': default: return 'today';
    }
};

// Helper function to safely extract action values from the API response
const getActionValue = (actions, actionType) => {
    if (!actions) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseInt(action.value, 10) : 0;
};

exports.handler = async (event) => {
    const period = event.queryStringParameters.period || 'today';

    if (!accessToken || !adAccountId) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Facebook API credentials are not configured on the server.' }),
        };
    }

    try {
        const account = new AdAccount(adAccountId);
        
        // --- UPDATED to fetch all the new metrics we need ---
        const fields = [
            'spend', 
            'purchase_roas', 
            'impressions', 
            'ctr', // This is CTR (All)
            'inline_link_click_ctr', // This is CTR (Link Click)
            'actions' // This contains LPV, Searches, ATC, etc.
        ];
        
        const params = { 
            'level': 'account', 
            'date_preset': getDatePreset(period),
            'filtering': [{
                field: 'campaign.id',
                operator: 'IN',
                value: TARGET_CAMPAIGN_IDS
            }]
        };
        
        const result = await account.getInsights(fields, params);
        
        if (!result || result.length === 0) {
            // Return a default empty state if there's no data
            return { statusCode: 200, body: JSON.stringify({ totalRevenue: 0, hotels: [] }) };
        }

        const stats = result[0];
        const spend = parseFloat(stats.spend || 0);
        const roas = stats.purchase_roas ? parseFloat(stats.purchase_roas[0].value) : 0;
        const totalRevenue = spend * roas;

        // Extracting all the detailed actions using our helper function
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
            purchases: getActionValue(actions, 'purchase'),
        };

        const formattedData = {
            totalRevenue: totalRevenue,
            hotels: [{
                name: 'Home Place Suites',
                location: 'Bartlesville',
                // Note: Facebook doesn't provide a simple CPA for a whole account,
                // so we calculate it based on spend and purchase actions.
                cpa: detailedMetrics.purchases > 0 ? spend / detailedMetrics.purchases : 0,
                ctr: stats.inline_link_click_ctr ? parseFloat(stats.inline_link_click_ctr) : 0,
                reach: stats.impressions ? parseInt(stats.impressions, 10) : 0,
                details: {
                    ...detailedMetrics,
                    ctr_all: stats.ctr ? parseFloat(stats.ctr) : 0,
                    ctr_link: stats.inline_link_click_ctr ? parseFloat(stats.inline_link_click_ctr) : 0,
                }
            }],
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify(formattedData),
        };

    } catch (error) {
        console.error('Error fetching from Facebook API:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data from Facebook Marketing API.' }),
        };
    }
};