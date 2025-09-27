import axios from 'axios';

const clientId = process.env.HOTJAR_CLIENT_ID;
const clientSecret = process.env.HOTJAR_CLIENT_SECRET;
const siteId = process.env.HOTJAR_SITE_ID;

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }
    console.log('Fetching new Hotjar access token from v1 endpoint...');
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);

        const response = await axios.post('https://api.hotjar.io/v1/oauth/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + response.data.expires_in * 1000 - 600000;
        return accessToken;
    } catch (error) {
        console.error('Error fetching Hotjar access token:', error.response ? error.response.data : error.message);
        throw new Error('Could not authenticate with Hotjar.');
    }
}

// --- THIS IS THE FIX ---
// Changed from 'exports.handler' to Vercel's 'export default async function handler'
export default async function handler(request, response) {
    if (!clientId || !clientSecret || !siteId) {
        return response.status(500).json({ error: 'Hotjar credentials or Site ID are not configured.' });
    }

    try {
        const token = await getAccessToken();
        const recordingsResponse = await axios.get(`https://api.hotjar.io/v1/sites/${siteId}/recordings?limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        
        const recordings = recordingsResponse.data.data || [];
        // Use response.status().json() to send the data back
        return response.status(200).json(recordings);

    } catch (error) {
        if (error.response && error.response.status === 403) {
             console.error('Hotjar API returned 403 Forbidden. Check "recordings:read" scope.');
        }
        console.error('Error fetching Hotjar recordings:', error.response ? error.response.data : error.message);
        return response.status(500).json({ error: 'Failed to fetch data from Hotjar API.' });
    }
}