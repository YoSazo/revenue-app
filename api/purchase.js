// api/purchase.js
// This endpoint receives purchase data from Zapier webhooks
const { createClient } = require('redis');

const PURCHASES_KEY = 'zapier_purchases';

let client;

async function getRedisClient() {
    if (!client) {
        client = createClient({
            url: process.env.REDIS_URL
        });
        client.on('error', (err) => console.error('Redis Client Error', err));
        await client.connect();
    }
    return client;
}

// Helper to read purchases
async function readPurchases() {
    try {
        const redis = await getRedisClient();
        const data = await redis.get(PURCHASES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading from Redis:', error);
        return [];
    }
}

// Helper to write purchases
async function writePurchases(purchases) {
    try {
        const redis = await getRedisClient();
        await redis.set(PURCHASES_KEY, JSON.stringify(purchases));
    } catch (error) {
        console.error('Error writing to Redis:', error);
        throw error;
    }
}

module.exports = async (request, response) => {
    // Enable CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // GET method - retrieve all purchases
    if (request.method === 'GET') {
        try {
            const purchases = await readPurchases();
            
            // Calculate total revenue
            const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);
            
            return response.status(200).json({
                success: true,
                totalRevenue,
                purchases,
                count: purchases.length
            });
        } catch (error) {
            console.error('Error reading purchases:', error);
            return response.status(500).json({ error: 'Failed to read purchases' });
        }
    }

    // DELETE method - delete a specific purchase or all purchases
    if (request.method === 'DELETE') {
        try {
            const { orderId } = request.query;
            
            // If orderId is 'all', clear all purchases
            if (orderId === 'all') {
                await writePurchases([]);
                return response.status(200).json({
                    success: true,
                    message: 'All purchases deleted'
                });
            }
            
            // Delete specific purchase by orderId
            if (orderId) {
                const purchases = await readPurchases();
                const filteredPurchases = purchases.filter(p => p.orderId !== orderId);
                
                if (purchases.length === filteredPurchases.length) {
                    return response.status(404).json({
                        error: 'Purchase not found'
                    });
                }
                
                await writePurchases(filteredPurchases);
                return response.status(200).json({
                    success: true,
                    message: 'Purchase deleted',
                    orderId
                });
            }
            
            return response.status(400).json({
                error: 'Missing orderId parameter'
            });
        } catch (error) {
            console.error('Error deleting purchase:', error);
            return response.status(500).json({ error: 'Failed to delete purchase' });
        }
    }

    // POST method - receive new purchase from Zapier
    if (request.method === 'POST') {
        try {
            const { amount, orderId, timestamp, campaignName } = request.body;

            // Validate and convert amount
            if (!amount) {
                return response.status(400).json({ 
                    error: 'Missing "amount" field.' 
                });
            }

            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount)) {
                return response.status(400).json({ 
                    error: 'Invalid "amount" field. Must be a valid number.' 
                });
            }

            const purchaseData = {
                amount: parsedAmount,
                orderId: orderId || `order_${Date.now()}`,
                timestamp: timestamp || new Date().toISOString(),
                campaignName: campaignName || 'Unknown',
                received: new Date().toISOString()
            };

            // Read existing purchases
            const purchases = await readPurchases();
            
            // Add new purchase
            purchases.push(purchaseData);
            
            // Save back to file
            await writePurchases(purchases);

            console.log('Purchase received from Zapier:', purchaseData);

            return response.status(200).json({
                success: true,
                message: 'Purchase recorded successfully',
                data: purchaseData
            });

        } catch (error) {
            console.error('Error processing purchase webhook:', error);
            return response.status(500).json({ 
                error: 'Failed to process purchase data',
                details: error.message 
            });
        }
    }

    return response.status(405).json({ error: 'Method not allowed' });
};