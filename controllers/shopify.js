const fetch = require('node-fetch');

// async function fetchOrdersFromShopify(shop, accessToken, orderIds) {
//   const results = [];

//   for (const id of orderIds) {
//     try {
//       // Clean the order ID (remove gid://shopify/Order/ prefix if present)
//       const cleanId = id.toString().replace('gid://shopify/Order/', '');
      
//       const response = await fetch(`https://${shop}/admin/api/2023-10/orders/${cleanId}.json`, {
//         method: 'GET',
//         headers: {
//           'X-Shopify-Access-Token': accessToken,
//           'Content-Type': 'application/json',
//         },
//       });

//       if (!response.ok) {
//         console.error(`Failed to fetch order ${cleanId}:`, response.status, response.statusText);
//         continue;
//       }

//       const data = await response.json();
//       results.push(data.order);
//     } catch (error) {
//       console.error(`Error fetching order ${id}:`, error);
//     }
//   }

//   return results;
// }

exports.fetchOrdersHandler = async (req, res) => {
  try {
    const { shop, orders } = req.body;

    console.log('🛒 Received request from shop:', shop);
    console.log('📦 Orders received:', orders.length);

    orders.forEach((order, index) => {
      console.log(`\n--- ORDER ${index + 1} ---`);
      console.log('Shopify Order ID:', order.id);
      console.log('Order Number:', order.name);
      console.log('Total Price:', order.totalPriceSet?.presentmentMoney?.amount, order.totalPriceSet?.presentmentMoney?.currencyCode);
      console.log('Created At:', order.createdAt);
      console.log('Customer:', order.customer?.displayName || 'Unknown customer');
      console.log('--- END ORDER ---\n');
    });

    res.json({
      success: true,
      message: `Successfully received ${orders.length} orders and logged`,
    });

  } catch (error) {
    console.error('❌ Backend error:', error);
    res.status(500).json({ error: 'Something went wrong in fetchOrdersHandler' });
  }
};