// This file is your new backend, formatted as a Netlify Function.
const bizSdk = require('facebook-nodejs-business-sdk');

// Environment variables are set in the Netlify UI, not a .env file.
const accessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

const Api = bizSdk.FacebookAdsApi.init(accessToken);
const AdAccount = bizSdk.AdAccount;

const getDatePreset = (period) => {
    switch (period) {
        case 'yesterday': return 'yesterday';
        case 'thisWeek': return 'this_week_sun_today';
        case 'today': default: return 'today';
    }
};

// This is the main function that Netlify will run.
exports.handler = async (event) => {
    // 'event' contains information about the incoming request.
    const period = event.queryStringParameters.period || 'today';

    if (!accessToken || !adAccountId) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Facebook API credentials are not configured on the server.' }),
        };
    }

    try {
        const account = new AdAccount(adAccountId);
        const fields = ['spend', 'purchase_roas', 'impressions', 'ctr', 'cpa'];
        const params = { 'level': 'account', 'date_preset': getDatePreset(period) };
        
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

        const formattedData = {
            totalRevenue: totalRevenue,
            hotels: [{
                name: 'Home Place Suites',
                location: 'Bartlesville',
                cpa: stats.cpa ? parseFloat(stats.cpa) : 0,
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