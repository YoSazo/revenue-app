const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') }); // Securely load API keys
const bizSdk = require('facebook-nodejs-business-sdk');

// NOTE: You'll need to install these new packages by running:
// npm install facebook-nodejs-business-sdk dotenv

const app = express();
const port = 3000;

// --- FACEBOOK API SETUP ---
// Get these from your Facebook Developer App dashboard
const accessToken = process.env.FB_ACCESS_TOKEN;
const adAccountId = process.env.FB_AD_ACCOUNT_ID;

if (!accessToken || !adAccountId) {
    console.error('FATAL ERROR: Facebook Access Token or Ad Account ID is not defined in your .env file.');
    // In a real app, you might exit here, but for now we'll log the error.
} else {
    console.log('Facebook API credentials loaded successfully.');
}

const Api = bizSdk.FacebookAdsApi.init(accessToken);
const AdAccount = bizSdk.AdAccount;
const Campaign = bizSdk.Campaign;

// This will hold the push notification subscription
let pushSubscription = null;

// --- MIDDLEWARE ---
// Serve the frontend files (index.html, service-worker.js)
app.use(express.static(path.join(__dirname, '..'))); 
app.use(bodyParser.json());


// --- API ROUTES ---

// Helper function to get date ranges
const getDatePreset = (period) => {
    switch (period) {
        case 'yesterday':
            return 'yesterday';
        case 'thisWeek':
            return 'this_week_sun_today';
        case 'today':
        default:
            return 'today';
    }
};

// Endpoint to get live dashboard data from Facebook
app.get('/api/data', async (req, res) => {
    const period = req.query.period || 'today';
    console.log(`Live data requested for: ${period}`);

    if (!accessToken || !adAccountId) {
         return res.status(500).json({ error: 'Facebook API credentials are not configured on the server.' });
    }

    try {
        const account = new AdAccount(adAccountId);
        const fields = [
            'spend',
            'purchase_roas', // This will give us the return on ad spend
            'impressions',
            'ctr',
            'cpa',
        ];
        const params = {
            'level': 'account',
            'date_preset': getDatePreset(period),
        };
        
        const result = await account.getInsights(fields, params);
        
        if (result.length === 0) {
            // Handle case where there's no data for the period
             const emptyData = {
                totalRevenue: 0,
                hotels: [{ name: 'Home Place Suites', location: 'Bartlesville', cpa: 0, ctr: 0, reach: 0 }],
            };
            return res.json(emptyData);
        }

        const stats = result[0];
        const spend = parseFloat(stats.spend);
        // ROAS is a ratio (e.g., 2.5 means $2.50 revenue for every $1 spent)
        const roas = stats.purchase_roas ? parseFloat(stats.purchase_roas[0].value) : 0;
        const totalRevenue = spend * roas;

        const formattedData = {
            totalRevenue: totalRevenue,
            hotels: [{
                name: 'Home Place Suites',
                location: 'Bartlesville',
                cpa: stats.cpa ? parseFloat(stats.cpa) : 0,
                ctr: parseFloat(stats.ctr),
                reach: parseInt(stats.impressions, 10),
            }],
        };
        
        res.json(formattedData);

    } catch (error) {
        console.error('Error fetching from Facebook API:', error);
        res.status(500).json({ error: 'Failed to fetch data from Facebook Marketing API.' });
    }
});

// Endpoint to store the push notification subscription
app.post('/api/subscribe', (req, res) => {
    pushSubscription = req.body;
    console.log('Received push subscription:', pushSubscription);
    res.status(201).json({ message: 'Subscription received.' });
});

// Endpoint for Facebook Webhooks
app.post('/api/webhook', (req, res) => {
    console.log('Webhook received from Facebook:', req.body);
    // ... (webhook logic remains the same for now)
    res.status(200).send('EVENT_RECEIVED');
});


// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

