// const Order = require('../models/Order');
// const OrderService = require('../services/OrderService');

// class OrderController {
//   async getSelectedOrders(req, res) {
//     try {
//       const orders = await Order.getSelected(req.merchant.id);
//       res.json({ orders });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
  
//   // Add other methods here
//   async selectOrders(req, res) {
//     try {
//       const { orderIds } = req.body;
//       const shop = req.headers['x-shopify-shop-domain'];
//       const result = await OrderService.selectOrders(shop, orderIds);
//       res.json({
//         success: true,
//         saved_count: result.length,
//         orders: result
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }

//   async createSelectedOrders(req, res) {
//     try {
//       const { orders } = req.body;
//       const merchantId = req.merchant.id;
  
//       const savedOrders = [];
  
//       for (const order of orders) {
//         const orderData = {
//           shopify_order_id: order.id,
//           merchant_id: merchantId,
//           order_number: order.order_number,
//           customer_name: order.customer?.first_name + ' ' + order.customer?.last_name,
//           customer_phone: order.customer?.phone,
//           customer_email: order.customer?.email,
//           shipping_address: `${order.shipping_address?.address1}, ${order.shipping_address?.city}`,
//           total_amount: order.total_price,
//           cod_amount: order.total_price, // Assuming COD by default, adjust logic if needed
//           status: 'selected'
//         };
  
//         const savedOrder = await Order.create(orderData);
//         savedOrders.push(savedOrder);
//       }
  
//       res.status(201).json({
//         success: true,
//         message: `${savedOrders.length} orders saved.`,
//         orders: savedOrders
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
  
// }

// // Properly export the class instance
// module.exports = new OrderController();

// controllers/orderController.js
const Order = require('../models/Order');
const User = require('../models/User');
const OrderTracking = require('../models/OrderTracking');
// const { sequelize } = require('../config/database');
const sequelize = require('../config/database'); // ✅ Correct
const { Op } = require('sequelize');
const crypto = require('crypto');
const generateTrackingId = require('../utils/generateTrackingId');
const generateAirwayBill = require('../utils/generateAirwayBill');
const he = require('he'); // Add at top

// const createOrders = async (req, res) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { orders, shopifyStoreUrl } = req.body;
//     const merchantId = req.user.id;

//     if (!shopifyStoreUrl) {
//       return res.status(400).json({ error: 'Shopify store URL is required' });
//     }

//     // Process each Shopify order
//     const createdOrders = await Promise.all(
//       orders.map(async (shopifyOrder) => {
//         // Check if order already exists
//         const existingOrder = await Order.findOne({
//           where: {
//             shopifyOrderId: shopifyOrder.id,
//             merchantId
//           }
//         });

//         if (existingOrder) {
//           return existingOrder;
//         }

//         // Create new order with Shopify data
//         return Order.create({
//           merchantId,
//           shopifyOrderId: shopifyOrder.id,
//           shopifyStoreUrl,
//           shopifyOrderData: shopifyOrder,
//           status: 'selected'
//         }, { transaction });
//       })
//     );

//     await transaction.commit();

//     res.status(201).json({
//       success: true,
//       orders: createdOrders.map(order => ({
//         id: order.id,
//         shopifyOrderId: order.shopifyOrderId,
//         orderNumber: order.shopifyOrderData.order_number,
//         customerName: order.shopifyOrderData.shipping_address?.name || order.shopifyOrderData.billing_address?.name,
//         totalPrice: order.shopifyOrderData.total_price,
//         status: order.status,
//         createdAt: order.createdAt
//       }))
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Create orders error:', error);
//     res.status(500).json({ error: 'Failed to create orders' });
//   }
// };

const createOrders = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { orders, shopifyStoreUrl } = req.body;
    const merchantId = req.user.id;

    if (!shopifyStoreUrl) {
      return res.status(400).json({ error: 'Shopify store URL is required' });
    }

    const merchant = await User.findOne({ where: { id: merchantId } });

    if (!merchant) {
      return res.status(404).json({ success: false, message: 'Merchant not found.' });
    }
    console.log(merchant.email)
    console.log(merchant.shopifyStoreUrl)
//     console.log('DB URL:', merchant.shopifyStoreUrl);
// console.log('DB URL Length:', merchant.shopifyStoreUrl.length);
// console.log('DB URL Char Codes:', merchant.shopifyStoreUrl.split('').map(c => c.charCodeAt(0)));

// console.log('Payload URL:', shopifyStoreUrl);
// console.log('Payload URL Length:', shopifyStoreUrl.length);
// console.log('Payload URL Char Codes:', shopifyStoreUrl.split('').map(c => c.charCodeAt(0)));

    // Step 2: Compare store URL
    // if (merchant.shopifyStoreUrl.trim().toLowerCase() === shopifyStoreUrl.trim().toLowerCase()) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Store mismatch: Provided Shopify store URL does not match the registered merchant store.`
    //   });
    // }
    const normalizeUrl = (url) =>
      he.decode(url) // decode HTML entities
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '') // remove protocol
        .replace(/\/$/, '');         // remove trailing slash
    
    if (normalizeUrl(merchant.shopifyStoreUrl) !== normalizeUrl(shopifyStoreUrl)) {
      return res.status(400).json({
        success: false,
        message: `Store mismatch: Provided Shopify store URL does not match the registered merchant store.`,
      });
    }
    
    const createdOrders = await Promise.all(
      orders.map(async (shopifyOrder) => {
        const existingOrder = await Order.findOne({
          where: {
            shopifyOrderId: shopifyOrder.id,
            merchantId
          }
        });

        if (existingOrder) return existingOrder;

        return Order.create({
          merchantId,
          shopifyOrderId: shopifyOrder.id,
          shopifyStoreUrl,
          shopifyOrderData: shopifyOrder,
          trackingId: generateTrackingId(), // ✅ generate trackingId
          status: 'selected',
          airwayBillNumber: null, // will remain null
          riderId: null,
          codCollected: null,
          pickedUpAt: null,
          deliveredAt: null
        }, { transaction });
      })
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      orders: createdOrders.map(order => ({
        id: order.id,
        shopifyOrderId: order.shopifyOrderId,
        orderNumber: order.shopifyOrderData.order_number,
        customerName: order.shopifyOrderData.shipping_address?.name || order.shopifyOrderData.billing_address?.name,
        totalPrice: order.shopifyOrderData.total_price,
        status: order.status,
        trackingId: order.trackingId,
        createdAt: order.createdAt
      }))
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create orders error:', error);
    res.status(500).json({ error: 'Failed to create orders' });
  }
};

// const getOrders = async (req, res) => {
//   try {
//     const { status, page = 1, limit = 20 } = req.query;
//     const merchantId = req.user.id;
//     const offset = (page - 1) * limit;

//     const whereClause = { merchantId };
//     if (status) {
//       whereClause.status = status;
//     }

//     const { count, rows } = await Order.findAndCountAll({
//       where: whereClause,
//       include: [
//         {
//           model: OrderTracking,
//           as: 'tracking',
//           limit: 5,
//           order: [['timestamp', 'DESC']]
//         }
//       ],
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//       order: [['createdAt', 'DESC']]
//     });

//     // Format response with Shopify data
//     const formattedOrders = rows.map(order => ({
//       id: order.id,
//       shopifyOrderId: order.shopifyOrderId,
//       orderNumber: order.shopifyOrderData.order_number,
//       customerName: order.shopifyOrderData.shipping_address?.name || order.shopifyOrderData.billing_address?.name,
//       customerEmail: order.shopifyOrderData.email || order.shopifyOrderData.contact_email,
//       shippingAddress: order.shopifyOrderData.shipping_address,
//       totalPrice: order.shopifyOrderData.total_price,
//       currency: order.shopifyOrderData.currency,
//       lineItems: order.shopifyOrderData.line_items,
//       status: order.status,
//       trackingId: order.trackingId,
//       airwayBillNumber: order.airwayBillNumber,
//       tracking: order.tracking,
//       createdAt: order.createdAt
//     }));

//     res.json({
//       orders: formattedOrders,
//       pagination: {
//         total: count,
//         page: parseInt(page),
//         pages: Math.ceil(count / limit)
//       }
//     });
//   } catch (error) {
//     console.error('Get orders error:', error);
//     res.status(500).json({ error: 'Failed to fetch orders' });
//   }
// };


const getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const merchantId = req.user.id;
    const offset = (page - 1) * limit;

    const whereClause = { merchantId };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: OrderTracking,
          as: 'tracking',
          order: [['timestamp', 'DESC']]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const formattedOrders = rows.map(order => {
      const data = order.shopifyOrderData || {};
      return {
        id: order.id,
        merchantId: order.merchantId,
        shopifyOrderId: order.shopifyOrderId,
        shopifyStoreUrl: order.shopifyStoreUrl,
        status: order.status,
        fulfillmentMethod: order.fulfillmentMethod,
        trackingId: order.trackingId,
        airwayBillNumber: order.airwayBillNumber,
        failureReason: order.failureReason,
        riderId: order.riderId,
        codCollected: order.codCollected,
        pickedUpAt: order.pickedUpAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,

        // Flattened Shopify Data
        orderNumber: data.order_number || '',
        customerName: data.shipping_address?.name || data.billing_address?.name || '',
        customerEmail: data.email || data.contact_email || '',
        shippingAddress: data.shipping_address || null,
        billingAddress: data.billing_address || null,
        totalPrice: data.total_price || null,
        currency: data.currency || '',
        lineItems: data.line_items || [],
        tracking: order.tracking || []
      };
    });

    res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// const updateOrder = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { shopifyOrderData } = req.body;
//     const merchantId = req.user.id;

//     const order = await Order.findOne({
//       where: { id, merchantId }
//     });

//     if (!order) {
//       return res.status(404).json({ error: 'Order not found' });
//     }

//     // Only update the Shopify order data (editable fields from app)
//     if (shopifyOrderData) {
//       await order.update({ shopifyOrderData });
//     }

//     res.json({
//       success: true,
//       order: {
//         id: order.id,
//         shopifyOrderId: order.shopifyOrderId,
//         orderNumber: order.shopifyOrderData.order_number,
//         status: order.status
//       }
//     });
//   } catch (error) {
//     console.error('Update order error:', error);
//     res.status(500).json({ error: 'Failed to update order' });
//   }
// };

// const bookOrders = async (req, res) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { orderIds, airwayBills } = req.body;
//     const merchantId = req.user.id;

//     // Validate orders belong to merchant and are in 'selected' status
//     const orders = await Order.findAll({
//       where: {
//         id: { [Op.in]: orderIds },
//         merchantId,
//         status: 'selected'
//       }
//     });

//     if (orders.length !== orderIds.length) {
//       await transaction.rollback();
//       return res.status(400).json({ error: 'Invalid orders selected' });
//     }

//     // Update orders and create tracking
//     const bookedOrders = await Promise.all(
//       orders.map(async (order, index) => {
//         const trackingId = crypto.randomBytes(8).toString('hex').toUpperCase();
        
//         await order.update({
//           status: 'booked',
//           airwayBillNumber: airwayBills[index],
//           trackingId
//         }, { transaction });

//         await OrderTracking.create({
//           orderId: order.id,
//           status: 'booked',
//           description: 'Order booked and ready for pickup'
//         }, { transaction });

//         return order;
//       })
//     );

//     await transaction.commit();

//     res.json({
//       success: true,
//       orders: bookedOrders.map(order => ({
//         id: order.id,
//         shopifyOrderId: order.shopifyOrderId,
//         orderNumber: order.shopifyOrderData.order_number,
//         trackingId: order.trackingId,
//         airwayBillNumber: order.airwayBillNumber,
//         status: order.status
//       }))
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Book orders error:', error);
//     res.status(500).json({ error: 'Failed to book orders' });
//   }
// };

const updateOrder = async (req, res) => {
  try {
    const { id } = req.query;
    const updateFields = req.body;
    const merchantId = req.user.id;

    if (!updateFields || Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }
 console.log(`This is the id ${id}`)
    const order = await Order.findOne({
      where: { id, merchantId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ensure shopifyOrderData exists on the order
    const existingData = order.shopifyOrderData || {};

    // Merge only the fields passed into the existing shopifyOrderData
    const updatedShopifyData = { ...existingData, ...updateFields };

    await order.update({ shopifyOrderData: updatedShopifyData });

    res.json({
      success: true,
      order: {
        id: order.id,
        shopifyOrderId: order.shopifyOrderId,
        orderNumber: updatedShopifyData.order_number,
        status: order.status,
        shopifyOrderData: updatedShopifyData
      }
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
};


const bookOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { orderId } = req.body;
    const merchantId = req.user.id;

    const order = await Order.findOne({
      where: {
        id: orderId,
        merchantId,
        status: 'selected'
      }
    });

    if (!order) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Order not found or not in selected status' });
    }

    const airwayBillNumber = generateAirwayBill();
    const trackingId = generateTrackingId();

    await order.update({
      status: 'booked',
      airwayBillNumber,
      trackingId
    }, { transaction });

    await OrderTracking.create({
      orderId: order.id,
      status: 'booked',
      description: 'Order booked and ready for pickup'
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      order: {
        id: order.id,
        shopifyOrderId: order.shopifyOrderId,
        orderNumber: order.shopifyOrderData.order_number,
        trackingId: order.trackingId,
        airwayBillNumber: order.airwayBillNumber,
        status: order.status
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Book order error:', error);
    res.status(500).json({ error: 'Failed to book order' });
  }
};

const getOrderAnalytics = async (req, res) => {
  try {
    const merchantId = req.user.id;

    const analytics = await Order.findAll({
      where: { merchantId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    const analyticsMap = {
      inProcess: 0,
      delivered: 0,
      inTransit: 0,
      returned: 0,
      codCollected: 0,
      totalOrders: 0
    };

    analytics.forEach(item => {
      const count = parseInt(item.dataValues.count);
      analyticsMap.totalOrders += count;

      switch (item.status) {
        case 'selected':
        case 'booked':
          analyticsMap.inProcess += count;
          break;
        case 'delivered':
          analyticsMap.delivered += count;
          break;
        case 'picked_up':
        case 'in_warehouse':
        case 'in_transit':
          analyticsMap.inTransit += count;
          break;
        case 'returned':
        case 'failed':
          analyticsMap.returned += count;
          break;
      }
    });
    
    // const codCollected = await Order.count({
    //   where: {
    //     merchantId,
    //     codCollected: true
    //   }
    // });

    // analyticsMap.codCollected = codCollected;

// Get COD collected amount
const codCollectedAmount = await Order.sum('codAmount', {
  where: {
    merchantId,
    codCollected: true
  }
});

analyticsMap.codCollected = codCollectedAmount || 0;


    res.json(analyticsMap);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

module.exports = {
  createOrders,
  getOrders,
  updateOrder,
  bookOrder,
  getOrderAnalytics
};