const axios = require('axios');

const clientId = process.env.HOTJAR_CLIENT_ID;
const clientSecret = process.env.HOTJAR_CLIENT_SECRET;
const siteId = process.env.HOTJAR_SITE_ID; // IMPORTANT: You must add this to Netlify!

// A simple in-memory cache for the access token
let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    console.log('Fetching new Hotjar access token...');
    try {
        const response = await axios.post('https://api.hotjar.com/v2/oauth/token', {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        });
        accessToken = response.data.access_token;
        // Set expiry to 50 minutes (token lasts for 60)
        tokenExpiry = Date.now() + response.data.expires_in * 1000 - 600000;
        return accessToken;
    } catch (error) {
        console.error('Error fetching Hotjar access token:', error.response ? error.response.data : error.message);
        throw new Error('Could not authenticate with Hotjar.');
    }
}

exports.handler = async () => {
    if (!clientId || !clientSecret || !siteId) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Hotjar credentials or Site ID are not configured.' }) };
    }

    try {
        const token = await getAccessToken();
        const recordingsResponse = await axios.get(`https://api.hotjar.com/v2/sites/${siteId}/recordings?limit=10`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify(recordingsResponse.data.recordings),
        };

    } catch (error) {
        console.error('Error fetching Hotjar recordings:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data from Hotjar API.' }),
        };
    }
};