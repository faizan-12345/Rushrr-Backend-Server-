// controllers/adminController.js
const Order = require('../models/Order');
const Rider = require('../models/Rider');
const User = require('../models/User');
const OrderTracking = require('../models/OrderTracking');
const { Op } = require('sequelize');
const { fn, col , where, literal} = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: {
        status: { [Op.ne]: 'selected' } // ✅ exclude orders with status 'selected'
      },
      include: [
        {
          model: User,
          as: 'merchant',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Rider,
          as: 'rider',
          attributes: ['id', 'name', 'riderId']
        },
        {
          model: OrderTracking,
          as: 'tracking',
          limit: 1,
          order: [['timestamp', 'DESC']]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const updateFulfillmentMethod = async (req, res) => {
  try {
    const { id } = req.query;
    const { fulfillmentMethod } = req.body;

    // Validate input
    if (!id || !fulfillmentMethod) {
      return res.status(400).json({ error: 'Order ID and fulfillmentMethod are required' });
    }

    const validMethods = ['Rushrr', 'postEx'];
    if (!validMethods.includes(fulfillmentMethod)) {
      return res.status(400).json({ error: 'Invalid fulfillment method' });
    }

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If already set, avoid unnecessary update
    if (order.fulfillmentMethod === fulfillmentMethod) {
      return res.status(200).json({ message: `Fulfillment method is already set to ${fulfillmentMethod}` });
    }

    // Update fulfillment method
    await order.update({ fulfillmentMethod });

    // Optional: Trigger integration when switching to postEx
    if (fulfillmentMethod === 'postEx') {
      // await PostExService.createShipment(order); // implement separately
    }

    res.json({
      success: true,
      message: `Fulfillment method updated to ${fulfillmentMethod}`,
      fulfillmentMethod: order.fulfillmentMethod,
      orderId: order.id,
      status: order.status
    });
  } catch (error) {
    console.error('Update fulfillment method error:', error);
    res.status(500).json({ error: 'Failed to update fulfillment method' });
  }
};


// const createRider = async (req, res) => {
//   try {
//     const { riderId, password, name, phone, vehicleType, vehicleNumber } = req.body;

//     // Check if rider ID already exists
//     const existingRider = await Rider.findOne({ where: { riderId } });
//     if (existingRider) {
//       return res.status(400).json({ error: 'Rider ID already exists' });
//     }

//     const rider = await Rider.create({
//       riderId,
//       password,
//       name,
//       phone,
//       vehicleType,
//       vehicleNumber
//     });

//     res.status(201).json({
//       success: true,
//       rider: {
//         id: rider.id,
//         riderId: rider.riderId,
//         name: rider.name,
//         phone: rider.phone,
//         vehicleType: rider.vehicleType,
//         vehicleNumber: rider.vehicleNumber
//       }
//     });
//   } catch (error) {
//     console.error('Create rider error:', error);
//     res.status(500).json({ error: 'Failed to create rider' });
//   }
// };

const createRider = async (req, res) => {
  try {
    const { riderId, password } = req.body;

    if (!riderId || !password) {
      return res.status(400).json({ error: 'Rider ID and password are required' });
    }

    // Check if rider ID already exists
    const existingRider = await Rider.findOne({ where: { riderId } });
    if (existingRider) {
      return res.status(400).json({ error: 'Rider ID already exists' });
    }

    const rider = await Rider.create({ riderId, password });

    res.status(201).json({
      success: true,
      message: 'Rider profile created with credentials only',
      rider: {
        id: rider.id,
        riderId: rider.riderId
      }
    });
  } catch (error) {
    console.error('Create rider error:', error);
    res.status(500).json({ error: 'Failed to create rider' });
  }
};


const getRiders = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows } = await Rider.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      riders: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get riders error:', error);
    res.status(500).json({ error: 'Failed to fetch riders' });
  }
};

const updateRider = async (req, res) => {
  try {
    const { id } = req.query;
    const updates = req.body;

    // Only allow specific fields to be updated
    const allowedFields = ['password', 'name', 'phone', 'vehicleType', 'vehicleNumber', 'isActive'];
    const validUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }

    const rider = await Rider.findByPk(id);
    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    // Hash the password if it's being updated
    if (validUpdates.password) {
      validUpdates.password = await bcrypt.hash(validUpdates.password, 10);
    }

    await rider.update(validUpdates);

    // Exclude password from response
    const { password, ...safeRider } = rider.toJSON();

    res.json({
      success: true,
      rider: safeRider
    });
  } catch (error) {
    console.error('Update rider error:', error);
    res.status(500).json({ error: 'Failed to update rider' });
  }
};

// const getAdminAnalytics = async (req, res) => {
//   try {
//     const [
//       totalCustomers,
//       orderStats,
//       todayStats
//     ] = await Promise.all([
//       User.count({ where: { role: 'merchant' } }),
//       Order.findAll({
//         attributes: [
//           'status',
//           [sequelize.fn('COUNT', sequelize.col('id')), 'count']
//         ],
//         group: ['status']
//       }),
//       Order.findAll({
//         where: {
//           createdAt: {
//             [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
//           }
//         },
//         attributes: [
//           'status',
//           [sequelize.fn('COUNT', sequelize.col('id')), 'count']
//         ],
//         group: ['status']
//       })
//     ]);

//     const analytics = {
//       customers: totalCustomers,
//       pickups: 0,
//       delivered: 0,
//       returned: 0,
//       inProcess: 0,
//       todayPickups: 0,
//       todayDelivered: 0
//     };

//     orderStats.forEach(stat => {
//       const count = parseInt(stat.dataValues.count);
//       switch (stat.status) {
//         case 'picked_up':
//           analytics.pickups += count;
//           break;
//         case 'delivered':
//           analytics.delivered += count;
//           break;
//         case 'returned':
//         case 'failed':
//           analytics.returned += count;
//           break;
//         case 'selected':
//         case 'booked':
//         case 'in_warehouse':
//         case 'in_transit':
//           analytics.inProcess += count;
//           break;
//       }
//     });

//     todayStats.forEach(stat => {
//       const count = parseInt(stat.dataValues.count);
//       if (stat.status === 'picked_up') {
//         analytics.todayPickups = count;
//       } else if (stat.status === 'delivered') {
//         analytics.todayDelivered = count;
//       }
//     });

//     res.json(analytics);
//   } catch (error) {
//     console.error('Get admin analytics error:', error);
//     res.status(500).json({ error: 'Failed to fetch analytics' });
//   }
// };

const getAdminAnalytics = async (req, res) => {
  try {
    const [
      totalCustomers,
      orderStats,
      todayStats
    ] = await Promise.all([
      User.count({ where: { role: 'merchant' } }),
      Order.findAll({
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['status']
      }),
      Order.findAll({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['status']
      })
    ]);

    const analytics = {
      customers: totalCustomers,
      pickups: 0,
      delivered: 0,
      returned: 0,
      inProcess: 0,
      todayPickups: 0,
      todayDelivered: 0
    };

    orderStats.forEach(stat => {
      const count = parseInt(stat.dataValues.count);
      switch (stat.status) {
        case 'picked_up':
          analytics.pickups += count;
          break;
        case 'delivered':
          analytics.delivered += count;
          break;
        case 'returned':
        case 'failed':
          analytics.returned += count;
          break;
        case 'selected':
        case 'booked':
        case 'in_warehouse':
        case 'in_transit':
          analytics.inProcess += count;
          break;
      }
    });

    todayStats.forEach(stat => {
      const count = parseInt(stat.dataValues.count);
      if (stat.status === 'picked_up') {
        analytics.todayPickups = count;
      } else if (stat.status === 'delivered') {
        analytics.todayDelivered = count;
      }
    });

    res.json(analytics);
  } catch (error) {
    console.error('Get admin analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

const getAllMerchantsWithTotalOrders = async (req, res) => {
  try {
    // Get all merchants
    const merchants = await User.findAll({
      where: { role: 'merchant' },
      attributes: ['id', 'firstName', 'lastName', 'email','apiKey', 'shopifyStoreUrl', 'shopifyStoreName', 'isActive', 'createdAt']
    });

    // Get total non-selected orders grouped by merchantId
    const orderCounts = await Order.findAll({
      where: {
        status: { [Op.not]: 'selected' }
      },
      attributes: [
        'merchantId',
        [fn('COUNT', col('id')), 'totalOrders']
      ],
      group: ['merchantId']
    });

    // Map merchantId to totalOrders
    const orderCountMap = {};
    orderCounts.forEach(order => {
      orderCountMap[order.merchantId] = parseInt(order.dataValues.totalOrders);
    });

    // Attach totalOrders to each merchant
    const merchantsWithOrders = merchants.map(merchant => {
      return {
        ...merchant.toJSON(),
        totalOrders: orderCountMap[merchant.id] || 0
      };
    });

    res.json({ success: true, merchants: merchantsWithOrders });
  } catch (error) {
    console.error('Get all merchants error:', error);
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
};

const getAdminPerformanceData = async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Top Performing Customers (non-selected orders)
    const topMerchantsRaw = await Order.findAll({
      where: { status: { [Op.not]: 'selected' } },
      attributes: [
        'merchantId',
        [fn('COUNT', col('id')), 'totalOrders']
      ],
      group: ['merchantId'],
      // order: [[literal('totalOrders'), 'DESC']],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 10
    });

    const merchantIds = topMerchantsRaw.map(o => o.merchantId);
    const orderCountMap = {};
    topMerchantsRaw.forEach(o => {
      orderCountMap[o.merchantId] = parseInt(o.dataValues.totalOrders);
    });

    const topMerchants = await User.findAll({
      where: { id: merchantIds },
      attributes: ['id', 'firstName', 'lastName', 'email', 'shopifyStoreUrl', 'shopifyStoreName', 'apiKey']
    });

    const topPerformingCustomers = topMerchants.map(m => ({
      ...m.toJSON(),
      totalOrders: orderCountMap[m.id] || 0
    }));

    // Today's Performance (using updatedAt)
    const todayBookings = await Order.count({
      where: {
        status: { [Op.not]: 'selected' },
        updatedAt: { [Op.gte]: twentyFourHoursAgo }
      }
    });

    const todayDeliveries = await Order.count({
      where: {
        status: 'delivered',
        updatedAt: { [Op.gte]: twentyFourHoursAgo }
      }
    });

    const todayReturns = await Order.count({
      where: {
        status: 'returned',
        updatedAt: { [Op.gte]: twentyFourHoursAgo }
      }
    });

    // Performance Metrics
    const totalProcessedOrders = await Order.count({
      where: {
        status: { [Op.not]: 'selected' }
      }
    });

    const deliveredOrders = await Order.count({
      where: {
        status: 'delivered'
      }
    });

    const returnedOrders = await Order.count({
      where: {
        status: 'returned'
      }
    });

    const deliverySuccessRate = totalProcessedOrders > 0
      ? ((deliveredOrders / totalProcessedOrders) * 100).toFixed(2)
      : '0.00';

    const returnRate = totalProcessedOrders > 0
      ? ((returnedOrders / totalProcessedOrders) * 100).toFixed(2)
      : '0.00';

    res.json({
      topPerformingCustomers,
      todaysPerformance: {
        newBookings: todayBookings,
        deliveries: todayDeliveries,
        returns: todayReturns
      },
      performanceMetrics: {
        deliverySuccessRate: `${deliverySuccessRate}%`,
        returnRate: `${returnRate}%`
      }
    });

  } catch (error) {
    console.error('Admin performance analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
};

module.exports = {
  getAllOrders,
  updateFulfillmentMethod, // done 
  createRider, // done 
  getRiders, // done 
  updateRider, // done 
  getAdminAnalytics ,// done 
  getAllMerchantsWithTotalOrders,
  getAdminPerformanceData
};