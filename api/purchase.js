// api/purchase.js
// This endpoint receives purchase data from Zapier webhooks
const fs = require('fs').promises;
const path = require('path');

const PURCHASES_FILE = path.join('/tmp', 'zapier_purchases.json');

// Helper to read purchases
async function readPurchases() {
    try {
        const data = await fs.readFile(PURCHASES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Helper to write purchases
async function writePurchases(purchases) {
    await fs.writeFile(PURCHASES_FILE, JSON.stringify(purchases, null, 2));
}

module.exports = async (request, response) => {
    // Enable CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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