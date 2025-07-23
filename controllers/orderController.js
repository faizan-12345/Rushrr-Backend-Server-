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
const Admin = require('../models/Admin');
// const { sequelize } = require('../config/database');
const sequelize = require('../config/database'); // ✅ Correct
const { Op } = require('sequelize');
const crypto = require('crypto');
const generateTrackingId = require('../utils/generateTrackingId');
const generateAirwayBill = require('../utils/generateAirwayBill');
const he = require('he'); // Add at top


const createOrders = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const isAdmin = req.query.admin === 'true';
    const userId = req.user.id;

    let merchant;
    let shopifyStoreUrl;

    if (isAdmin) {
      // 🧑‍💼 Admin logic
      const admin = await Admin.findOne({ where: { id: userId } });
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin not found.' });
      }

      const { merchantEmail, orders } = req.body;

      if (!merchantEmail) {
        return res.status(400).json({ error: 'merchantEmail is required for admin requests.' });
      }

      merchant = await User.findOne({ where: { email: merchantEmail } });

      if (!merchant) {
        return res.status(404).json({ success: false, message: 'Merchant not found for provided email.' });
      }

      shopifyStoreUrl = merchant.shopifyStoreUrl;

      if (!shopifyStoreUrl) {
        return res.status(400).json({ error: 'Merchant does not have a Shopify store URL configured.' });
      }

      // orders are from body
      if (!orders || !Array.isArray(orders)) {
        return res.status(400).json({ error: 'Orders are required and must be an array.' });
      }

    } else {
      // 🧑‍💻 Merchant logic
      merchant = await User.findOne({ where: { id: userId } });

      if (!merchant) {
        return res.status(404).json({ success: false, message: 'Merchant not found.' });
      }

      shopifyStoreUrl = merchant.shopifyStoreUrl;

      if (!shopifyStoreUrl) {
        return res.status(400).json({ error: 'Your Shopify store URL is not configured.' });
      }

      const { orders } = req.body;

      if (!orders || !Array.isArray(orders)) {
        return res.status(400).json({ error: 'Orders are required and must be an array.' });
      }
    }

    // ✅ Start order creation
    const createdOrders = await Promise.all(
      req.body.orders.map(async (shopifyOrder) => {
        const shopifyOrderId = shopifyOrder.orderReferenceNumber;

        const existingOrder = await Order.findOne({
          where: {
            shopifyOrderId,
            merchantId: merchant.id
          }
        });

        if (existingOrder) return existingOrder;

        return Order.create({
          merchantId: merchant.id,
          shopifyOrderId,
          shopifyStoreUrl,
          shopifyOrderData: shopifyOrder,
          trackingId: null,
          status: 'unbooked',
          airwayBillNumber: null,
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
        orderNumber: order.shopifyOrderData.order_number || order.shopifyOrderData.orderReferenceNumber,
        customerName:
          order.shopifyOrderData.shipping_address?.name ||
          `${order.shopifyOrderData.shipping_address?.first_name || ''} ${order.shopifyOrderData.shipping_address?.last_name || ''}`.trim() ||
          `${order.shopifyOrderData.billing_address?.first_name || ''} ${order.shopifyOrderData.billing_address?.last_name || ''}`.trim(),
        totalPrice: order.shopifyOrderData.total_price || order.shopifyOrderData.orderAmount,
        status: order.status,
        trackingId: order.trackingId,
        createdAt: order.createdAt
      }))
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Create orders error:', error);
    res.status(500).json({ error: error.message });
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
//           order: [['timestamp', 'DESC']]
//         }
//       ],
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//       order: [['createdAt', 'DESC']]
//     });

//     const formattedOrders = rows.map(order => {
//       const data = order.shopifyOrderData || {};
//       return {
//         id: order.id,
//         merchantId: order.merchantId,
//         shopifyOrderId: order.shopifyOrderId,
//         shopifyStoreUrl: order.shopifyStoreUrl,
//         status: order.status,
//         fulfillmentMethod: order.fulfillmentMethod,
//         trackingId: order.trackingId,
//         airwayBillNumber: order.airwayBillNumber,
//         failureReason: order.failureReason,
//         riderId: order.riderId,
//         codCollected: order.codCollected,
//         pickedUpAt: order.pickedUpAt,
//         deliveredAt: order.deliveredAt,
//         createdAt: order.createdAt,
//         updatedAt: order.updatedAt,

//         // Flattened Shopify Data
//         orderNumber: data.order_number || '',
//         customerName: data.shipping_address?.name || data.billing_address?.name || '',
//         customerEmail: data.email || data.contact_email || '',
//         shippingAddress: data.shipping_address || null,
//         billingAddress: data.billing_address || null,
//         totalPrice: data.total_price || null,
//         currency: data.currency || '',
//         lineItems: data.line_items || [],
//         tracking: order.tracking || []
//       };
//     });

//     res.json({
//       success: true,
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


// const createOrders = async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { orders, shopifyStoreUrl } = req.body;
//     const userId = req.user.id;

//     if (!shopifyStoreUrl) {
//       return res.status(400).json({ error: 'Shopify store URL is required' });
//     }

//     // Try finding user in Users table (Merchant)
//     let merchant = await User.findOne({ where: { id: userId } });

//     // If not found, check Admins table
//     if (!merchant) {
//       const admin = await Admin.findOne({ where: { id: userId } });

//       if (!admin) {
//         return res.status(404).json({ success: false, message: 'User not found in merchants or admins.' });
//       }

//       // If user is admin, you can allow them to create orders for a specific merchant (future scope)
//       return res.status(403).json({ success: false, message: 'Admins cannot create orders directly.' });
//     }

//     // Normalize URLs for comparison
//     const normalizeUrl = (url) =>
//       he.decode(url).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

//     if (normalizeUrl(merchant.shopifyStoreUrl) !== normalizeUrl(shopifyStoreUrl)) {
//       return res.status(400).json({
//         success: false,
//         message: `Store mismatch: Provided Shopify store URL does not match the registered merchant store.`,
//       });
//     }

//     // Process order creation
//     const createdOrders = await Promise.all(
//       orders.map(async (shopifyOrder) => {
//         const shopifyOrderId = shopifyOrder.orderReferenceNumber;

//         const existingOrder = await Order.findOne({
//           where: {
//             shopifyOrderId,
//             merchantId: merchant.id
//           }
//         });

//         if (existingOrder) return existingOrder;

//         return Order.create({
//           merchantId: merchant.id,
//           shopifyOrderId,
//           shopifyStoreUrl,
//           shopifyOrderData: shopifyOrder,
//           trackingId: null,
//           status: 'selected',
//           airwayBillNumber: null,
//           riderId: null,
//           codCollected: null,
//           pickedUpAt: null,
//           deliveredAt: null
//         }, { transaction });
//       })
//     );

//     await transaction.commit();

//     res.status(201).json({
//       success: true,
//       orders: createdOrders.map(order => ({
//         id: order.id,
//         shopifyOrderId: order.shopifyOrderId,
//         orderNumber: order.shopifyOrderData.order_number || order.shopifyOrderData.orderReferenceNumber,
//         customerName:
//           order.shopifyOrderData.shipping_address?.name ||
//           `${order.shopifyOrderData.shipping_address?.first_name || ''} ${order.shopifyOrderData.shipping_address?.last_name || ''}`.trim() ||
//           `${order.shopifyOrderData.billing_address?.first_name || ''} ${order.shopifyOrderData.billing_address?.last_name || ''}`.trim(),
//         totalPrice: order.shopifyOrderData.total_price || order.shopifyOrderData.orderAmount,
//         status: order.status,
//         trackingId: order.trackingId,
//         createdAt: order.createdAt
//       }))
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error('Create orders error:', error);
//     res.status(500).json({ error: error.message });
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

    res.json({
      success: true,
      orders: rows, // return full unformatted order objects
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


const updateOrder = async (req, res) => {
  try {
    const { id } = req.query;
    const updateFields = req.body;
    const merchantId = req.user.id;

    if (!updateFields || Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const order = await Order.findOne({
      where: { id, merchantId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const existingData = order.shopifyOrderData || {};

    // ✅ Define allowed keys in shopifyOrderData
    const allowedKeys = [
      'order_number', 'email', 'contact_email', 'shipping_address',
      'billing_address', 'total_price', 'currency', 'line_items'
    ];

    // ✅ Validate keys in the update request
    const invalidKeys = Object.keys(updateFields).filter(
      key => !allowedKeys.includes(key)
    );

    if (invalidKeys.length > 0) {
      return res.status(400).json({
        error: `Invalid field(s): ${invalidKeys.join(', ')}`,
        message: 'Update failed. Only allowed fields can be updated in shopifyOrderData.'
      });
    }

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


// const updateOrder = async (req, res) => {
//   try {
//     const { id, updateTracking } = req.query;
//     const merchantId = req.user.id;
//     const updateFields = req.body;

//     const order = await Order.findOne({
//       where: { id, merchantId }
//     });

//     if (!order) {
//       return res.status(404).json({ error: 'Order not found' });
//     }

//     // ✅ If query param updateTracking=true → update only trackingId
//     if (updateTracking === 'true') {
//       const { trackingId } = updateFields;

//       if (!trackingId || typeof trackingId !== 'string') {
//         return res.status(400).json({ error: 'Valid trackingId is required' });
//       }

//       await order.update({ trackingId });

//       return res.json({
//         success: true,
//         message: 'Tracking ID updated successfully',
//         trackingId: order.trackingId
//       });
//     }

//     // ✅ Otherwise update fields in shopifyOrderData
//     if (!updateFields || Object.keys(updateFields).length === 0) {
//       return res.status(400).json({ error: 'No fields provided for update' });
//     }

//     const existingData = order.shopifyOrderData || {};

//     const allowedKeys = [
//       'order_number', 'email', 'contact_email', 'shipping_address',
//       'billing_address', 'total_price', 'currency', 'line_items'
//     ];

//     const invalidKeys = Object.keys(updateFields).filter(
//       key => !allowedKeys.includes(key)
//     );

//     if (invalidKeys.length > 0) {
//       return res.status(400).json({
//         error: `Invalid field(s): ${invalidKeys.join(', ')}`,
//         message: 'Update failed. Only allowed fields can be updated in shopifyOrderData.'
//       });
//     }

//     const updatedShopifyData = { ...existingData, ...updateFields };

//     await order.update({ shopifyOrderData: updatedShopifyData });

//     return res.json({
//       success: true,
//       order: {
//         id: order.id,
//         shopifyOrderId: order.shopifyOrderId,
//         orderNumber: updatedShopifyData.order_number,
//         status: order.status,
//         shopifyOrderData: updatedShopifyData
//       }
//     });
//   } catch (error) {
//     console.error('Update order error:', error);
//     res.status(500).json({ error: 'Failed to update order' });
//   }
// };


// const bookOrder = async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const { orderId } = req.body;
//     const merchantId = req.user.id;

//     const order = await Order.findOne({
//       where: {
//         id: orderId,
//         merchantId,
//         status: 'selected'
//       }
//     });

//     if (!order) {
//       await transaction.rollback();
//       return res.status(400).json({ error: 'Order not found or not in selected status' });
//     }

//     // const airwayBillNumber = generateAirwayBill();
//     // const trackingId = generateTrackingId();

//     await order.update({
//       status: 'booked',
//     }, { transaction });

//     await OrderTracking.create({
//       orderId: order.id,
//       status: 'booked',
//       description: 'Order booked and ready for pickup'
//     }, { transaction });

//     await transaction.commit();

//     res.json({
//       success: true,
//       order: {
//         id: order.id,
//         shopifyOrderId: order.shopifyOrderId,
//         orderNumber: order.shopifyOrderData.order_number,
//         trackingId: order.trackingId,
//         airwayBillNumber: order.airwayBillNumber,
//         status: order.status
//       }
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Book order error:', error);
//     res.status(500).json({ error: 'Failed to book order' });
//   }
// };


const bookOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { orderId, merchantEmail } = req.body;
    const isAdmin = req.query.admin === 'true';

    let merchantId;
    let order;

    if (isAdmin) {
      if (!merchantEmail) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Merchant email is required for admin booking' });
      }

      const merchant = await User.findOne({ where: { email: merchantEmail } });
      if (!merchant) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Merchant not found' });
      }

      merchantId = merchant.id;

      order = await Order.findOne({
        where: {
          shopifyOrderId: orderId,
          merchantId,
          status: 'unbooked'
        }
      });

    } else {
      merchantId = req.user.id;

      order = await Order.findOne({
        where: {
          id: orderId,
          merchantId,
          status: 'unbooked'
        }
      });
    }

    if (!order) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Order not found or not in unbooked status' });
    }

    await order.update({
      status: 'booked',
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
        case 'unbooked':
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

const getOrderTrackingByTrackingId = async (req, res) => {
  try {
    const { trackingId } = req.body;

    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID is required' });
    }

    // Step 1: Find the order using trackingId
    const order = await Order.findOne({ where: { trackingId } });

    if (!order) {
      return res.status(404).json({ message: 'This order is not booked yet' });
    }

    // Step 2: Fetch all tracking entries related to the order, sorted by updatedAt DESC
    const trackingHistory = await OrderTracking.findAll({
      where: { orderId: order.id },
      order: [['updatedAt', 'DESC']]
    });

    // Step 3: Format tracking history
    const formattedTracking = trackingHistory.map((track, index) => ({
      id: track.id,
      status: track.status,
      location: track.location,
      description: track.description,
      riderId: track.riderId,
      timestamp: track.timestamp,
      updatedAt: track.updatedAt,
      currentStatus: index === 0 // Only latest tracking entry gets currentStatus: true
    }));

    // Step 4: Response with order and tracking history
    return res.json({
      success: true,
      order: {
        id: order.id,
        trackingId: order.trackingId,
        customerName: order.customerName || null,
        shopifyOrderId: order.shopifyOrderId,
        status: order.status,
        fulfillmentMethod: order.fulfillmentMethod,
        codAmount: order.codAmount,
        deliveredAt: order.deliveredAt,
        pickedUpAt: order.pickedUpAt,
        currentStatus: order.status
      },
      trackingHistory: formattedTracking
    });

  } catch (error) {
    console.error('Error fetching tracking info:', error);
    return res.status(500).json({ error: 'Something went wrong while fetching tracking data' });
  }
};

const updateOrderTrackingId = async (req, res) => {
  try {
    const { id } = req.query;
    const { trackingId } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Order ID is required in query' });
    }

    if (!trackingId || typeof trackingId !== 'string') {
      return res.status(400).json({ error: 'Valid trackingId is required in body' });
    }

    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.update({ trackingId });

    return res.status(200).json({
      success: true,
      message: 'Tracking ID updated successfully',
      trackingId: order.trackingId
    });
  } catch (error) {
    console.error('Error updating tracking ID:', error);
    return res.status(500).json({ error: 'Failed to update tracking ID' });
  }
};


module.exports = {
  createOrders,
  getOrders,
  updateOrder,
  bookOrder,
  getOrderAnalytics,
  getOrderTrackingByTrackingId,
  updateOrderTrackingId
};