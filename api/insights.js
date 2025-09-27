const bizSdk = require('facebook-nodejs-business-sdk');

const accessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

const CAMPAIGN_NAME_MAP = {
  '6898612187193': 'OKC',
  '6898612186993': 'BART',
  '6898612186793': 'TULSA',
};
const TARGET_CAMPAIGN_IDS = Object.keys(CAMPAIGN_NAME_MAP);

const Api = bizSdk.FacebookAdsApi.init(accessToken);
const AdAccount = bizSdk.AdAccount;

const getActionValue = (actions, actionType) => {
    if (!actions) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseInt(action.value, 10) : 0;
};

const calculateRate = (numerator, denominator) => {
    if (!denominator || denominator === 0) return 0;
    return (numerator / denominator) * 100;
};

module.exports = async (request, response) => {
    if (!accessToken || !adAccountId) {
        return response.status(500).json({ error: 'Facebook API credentials are not configured.' });
    }

    try {
        const account = new AdAccount(adAccountId);
        
        const fields = [
            'campaign_id', 'spend', 'impressions', 'clicks', 'ctr', 'cpc',
            'purchase_roas', 'cpm', 'reach', 'frequency', 'actions'
        ];
        
        const params = {
            level: 'campaign',
            time_increment: 1,
            date_preset: 'this_week_sun_today',
            filtering: [{ field: 'campaign.id', operator: 'IN', value: TARGET_CAMPAIGN_IDS }]
        };

        const insights = await account.getInsights(fields, params);
        
        const processedData = insights.map(insight => {
            const actions = insight.actions || [];
            const lpv = getActionValue(actions, 'landing_page_view');
            const searches = getActionValue(actions, 'search');
            const atc = getActionValue(actions, 'add_to_cart');
            const ic = getActionValue(actions, 'initiate_checkout');
            const purchases = getActionValue(actions, 'purchase') + getActionValue(actions, 'offsite_conversion.fb_pixel_purchase');

            return {
                date: insight.date_start,
                campaignName: CAMPAIGN_NAME_MAP[insight.campaign_id] || insight.campaign_id,
                spend: parseFloat(insight.spend),
                impressions: parseInt(insight.impressions, 10),
                clicks: parseInt(insight.clicks, 10),
                ctr: parseFloat(insight.ctr),
                cpc: parseFloat(insight.cpc || 0),
                roas: insight.purchase_roas && insight.purchase_roas.length > 0 ? parseFloat(insight.purchase_roas[0].value) : 0,
                lpv,
                searches,
                atc,
                ic,
                purchases,
                lpvToSearchRate: calculateRate(searches, lpv),
                searchToAtcRate: calculateRate(atc, searches),
                atcToIcRate: calculateRate(ic, atc),
                icToPurchaseRate: calculateRate(purchases, ic),
            };
        });
        
        return response.status(200).json(processedData);

    } catch (error) {
        console.error('Error fetching from Facebook API:', error);
        return response.status(500).json({ error: 'Failed to fetch data from Facebook Marketing API.' });
    }
};