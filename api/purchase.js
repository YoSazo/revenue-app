// api/purchase.js
// This endpoint receives purchase data from Zapier webhooks
const { kv } = require('@vercel/kv');

const PURCHASES_KEY = 'zapier_purchases';

// Helper to read purchases
async function readPurchases() {
    try {
        const purchases = await kv.get(PURCHASES_KEY);
        return purchases || [];
    } catch (error) {
        console.error('Error reading from KV:', error);
        return [];
    }
}

// Helper to write purchases
async function writePurchases(purchases) {
    await kv.set(PURCHASES_KEY, purchases);
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