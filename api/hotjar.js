const axios = require('axios');

const clientId = process.env.HOTJAR_CLIENT_ID;
const clientSecret = process.env.HOTJAR_CLIENT_SECRET;
const siteId = process.env.HOTJAR_SITE_ID; // Make sure this is set in Netlify!

// A simple in-memory cache for the access token
let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    console.log('Fetching new Hotjar access token from v1 endpoint...');
    try {
        // FIX 1: Use URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);

        // FIX 2: Correct POST URL to v1 and domain to .io
        const response = await axios.post('https://api.hotjar.io/v1/oauth/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        accessToken = response.data.access_token;
        // Set expiry to 50 minutes (token lasts for 60)
        tokenExpiry = Date.now() + response.data.expires_in * 1000 - 600000;
        console.log('Successfully fetched Hotjar token.');
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
        
        // FIX 3: Correct GET URL for recordings to v1 and domain to .io
        const recordingsResponse = await axios.get(`https://api.hotjar.io/v1/sites/${siteId}/recordings?limit=10`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        // The recordings are now nested under a `data` property in the v1 response
        const recordings = recordingsResponse.data.data || [];
        
        return {
            statusCode: 200,
            body: JSON.stringify(recordings),
        };

    } catch (error) {
        // Adding a check for 403 Forbidden, which often indicates a scope issue
        if (error.response && error.response.status === 403) {
             console.error('Hotjar API returned 403 Forbidden. Please check that your API credential has the "recordings:read" scope enabled in your Hotjar settings.');
        }
        console.error('Error fetching Hotjar recordings:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data from Hotjar API.' }),
        };
    }
};