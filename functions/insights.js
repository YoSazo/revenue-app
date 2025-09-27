const bizSdk = require('facebook-nodejs-business-sdk');

// --- Get all secrets from Netlify Environment Variables ---
const accessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;
// We'll add these for the Hotjar integration in the next phase
// const hotjarClientId = process.env.HOTJAR_CLIENT_ID;
// const hotjarClientSecret = process.env.HOTJAR_CLIENT_SECRET;

const TARGET_CAMPAIGN_IDS = [
  '6898612187193',
  '6898612186993',
  '6898612186793',
];

const Api = bizSdk.FacebookAdsApi.init(accessToken);
const AdAccount = bizSdk.AdAccount;

// Helper function to safely extract action values
const getActionValue = (actions, actionType) => {
    if (!actions) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseInt(action.value, 10) : 0;
};

// Helper function to calculate conversion rates safely
const calculateRate = (numerator, denominator) => {
    if (!denominator || denominator === 0) return 0;
    return (numerator / denominator) * 100;
};

exports.handler = async (event) => {
    if (!accessToken || !adAccountId) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Facebook API credentials are not configured.' }) };
    }

    try {
        const account = new AdAccount(adAccountId);
        
        const fields = [
            'campaign_name',
            'spend',
            'impressions',
            'clicks',
            'ctr',
            'reach',
            'frequency',
            'actions' // This contains all conversion events
        ];
        
        const params = {
            level: 'campaign', // We are now fetching data per campaign
            time_increment: 1, // This gives us daily breakdowns
            date_preset: 'this_week_sun_today', // Default to this week's data
            filtering: [{
                field: 'campaign.id',
                operator: 'IN',
                value: TARGET_CAMPAIGN_IDS
            }]
        };

        const insights = await account.getInsights(fields, params);
        
        const processedData = insights.map(insight => {
            const actions = insight.actions || [];

            // Funnel Metrics
            const lpv = getActionValue(actions, 'landing_page_view');
            const searches = getActionValue(actions, 'search');
            const atc = getActionValue(actions, 'add_to_cart');
            const ic = getActionValue(actions, 'initiate_checkout');
            const purchases = getActionValue(actions, 'purchase') + getActionValue(actions, 'offsite_conversion.fb_pixel_purchase');

            return {
                date: insight.date_start,
                campaignName: insight.campaign_name,
                spend: parseFloat(insight.spend),
                impressions: parseInt(insight.impressions, 10),
                clicks: parseInt(insight.clicks, 10),
                ctr: parseFloat(insight.ctr),
                reach: parseInt(insight.reach, 10),
                frequency: parseFloat(insight.frequency),
                // Funnel Counts
                lpv,
                searches,
                atc,
                ic,
                purchases,
                // Conversion Rates
                lpvToSearchRate: calculateRate(searches, lpv),
                searchToAtcRate: calculateRate(atc, searches),
                atcToIcRate: calculateRate(ic, atc),
                icToPurchaseRate: calculateRate(purchases, ic),
            };
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify(processedData),
        };

    } catch (error) {
        console.error('Error fetching from Facebook API:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data from Facebook Marketing API.' }),
        };
    }
};