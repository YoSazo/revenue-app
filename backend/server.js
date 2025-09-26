const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// NOTE: You'll need to install these packages by running:
// npm install express body-parser

const app = express();
const port = 3000;

// This will hold the push notification subscription
let pushSubscription = null;

// --- MOCK DATA (to be replaced with Facebook API calls) ---
const mockData = {
    today: {
        totalRevenue: 13859.22,
        hotels: [
            { name: 'Home Place Suites', location: 'Bartlesville', cpa: 30, ctr: 9, reach: 127324 },
        ]
    },
    yesterday: {
        totalRevenue: 11240.50,
        hotels: [
            { name: 'Home Place Suites', location: 'Bartlesville', cpa: 32, ctr: 9, reach: 130102 },
        ]
    },
    thisWeek: {
        totalRevenue: 95430.10,
        hotels: [
            { name: 'Home Place Suites', location: 'Bartlesville', cpa: 31, ctr: 9, reach: 980432 },
        ]
    }
};


// --- MIDDLEWARE ---
// Serve the frontend files (index.html, service-worker.js)
app.use(express.static(path.join(__dirname, '..'))); 
app.use(bodyParser.json());


// --- API ROUTES ---

// Endpoint to get dashboard data
app.get('/api/data', (req, res) => {
    const period = req.query.period || 'today';
    console.log(`Data requested for: ${period}`);
    
    // TODO: Replace this with a real call to the Facebook Marketing API
    const data = mockData[period];
    
    if (data) {
        res.json(data);
    } else {
        res.status(404).json({ error: 'Data not found for the specified period.' });
    }
});

// Endpoint to store the push notification subscription
app.post('/api/subscribe', (req, res) => {
    pushSubscription = req.body;
    console.log('Received push subscription:', pushSubscription);
    res.status(201).json({ message: 'Subscription received.' });
    
    // You can send a test notification here if you want
});

// Endpoint for Facebook Webhooks to send "cha-ching" events
app.post('/api/webhook', (req, res) => {
    console.log('Webhook received from Facebook:', req.body);
    
    // 1. Process the webhook data to get conversion details.
    const conversionValue = req.body.entry[0].changes[0].value.value; // Example path
    
    // 2. Create the notification payload.
    const payload = JSON.stringify({
        title: 'New Conversion! 💸',
        body: `Cha-ching! You just got a conversion worth $${conversionValue}!`
    });

    // 3. TODO: Send the push notification to the stored subscription.
    // webPush.sendNotification(pushSubscription, payload).catch(err => console.error(err));
    
    res.status(200).send('EVENT_RECEIVED');
});


// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

