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
        const fields = ['spend', 'purchase_roas', 'impressions', 'ctr', 'cost_per_action_type'];
        
        // --- THIS IS THE NEW PART ---
        // We add a 'filtering' parameter to specify the campaign IDs
        const params = { 
            'level': 'account', 
            'date_preset': getDatePreset(period),
            'filtering': [{
                field: 'campaign.id',
                operator: 'IN',
                value: TARGET_CAMPAIGN_IDS
            }]
        };
        // -----------------------------
        
        const result = await account.getInsights(fields, params);
        
        if (!result || result.length === 0) {
            const emptyData = {
                totalRevenue: 0,
                hotels: [{ name: 'Home Place Suites', location: 'Bartlesville', cpa: 0, ctr: 0, reach: 0 }],
            };
            return { statusCode: 200, body: JSON.stringify(emptyData) };
        }

        const stats = result[0];
        const spend = parseFloat(stats.spend || 0);
        const roas = stats.purchase_roas ? parseFloat(stats.purchase_roas[0].value) : 0;
        const totalRevenue = spend * roas;

        const cpaValue = stats.cost_per_action_type && stats.cost_per_action_type.length > 0
            ? parseFloat(stats.cost_per_action_type[0].value)
            : 0;

        const formattedData = {
            totalRevenue: totalRevenue,
            hotels: [{
                name: 'Home Place Suites',
                location: 'Bartlesville',
                cpa: cpaValue,
                ctr: stats.ctr ? parseFloat(stats.ctr) : 0,
                reach: stats.impressions ? parseInt(stats.impressions, 10) : 0,
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