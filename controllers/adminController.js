// controllers/adminController.js
const Order = require('../models/Order');
const Rider = require('../models/Rider');
const User = require('../models/User');
const OrderTracking = require('../models/OrderTracking');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

const getAllOrders = async (req, res) => {
  try {
    const { 
      status, 
      fulfillmentMethod, 
      merchantId,
      startDate,
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (fulfillmentMethod) whereClause.fulfillmentMethod = fulfillmentMethod;
    if (merchantId) whereClause.merchantId = merchantId;
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await Order.findAndCountAll({
      where: whereClause,
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
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      orders: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const updateFulfillmentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { fulfillmentMethod } = req.body;

    const order = await Order.findByPk(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.update({ fulfillmentMethod });

    // If PostEx, integrate with their API
    if (fulfillmentMethod === 'postEx') {
      // Call PostEx API service here
      // await PostExService.createShipment(order);
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Update fulfillment method error:', error);
    res.status(500).json({ error: 'Failed to update fulfillment method' });
  }
};

const createRider = async (req, res) => {
  try {
    const { riderId, password, name, phone, vehicleType, vehicleNumber } = req.body;

    // Check if rider ID already exists
    const existingRider = await Rider.findOne({ where: { riderId } });
    if (existingRider) {
      return res.status(400).json({ error: 'Rider ID already exists' });
    }

    const rider = await Rider.create({
      riderId,
      password,
      name,
      phone,
      vehicleType,
      vehicleNumber
    });

    res.status(201).json({
      success: true,
      rider: {
        id: rider.id,
        riderId: rider.riderId,
        name: rider.name,
        phone: rider.phone,
        vehicleType: rider.vehicleType,
        vehicleNumber: rider.vehicleNumber
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
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields
    delete updates.id;
    delete updates.password;
    delete updates.riderId;

    const rider = await Rider.findByPk(id);
    
    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    await rider.update(updates);

    res.json({
      success: true,
      rider
    });
  } catch (error) {
    console.error('Update rider error:', error);
    res.status(500).json({ error: 'Failed to update rider' });
  }
};

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
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
      }),
      Order.findAll({
        where: {
          createdAt: {
            [Op.gte]: new Date().setHours(0, 0, 0, 0)
          }
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
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

module.exports = {
  getAllOrders,
  updateFulfillmentMethod,
  createRider,
  getRiders,
  updateRider,
  getAdminAnalytics
};