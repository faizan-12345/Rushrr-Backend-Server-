// controllers/riderController.js
const Rider = require('../models/Rider');
const Order = require('../models/Order');
const User = require('../models/User');
const OrderTracking = require('../models/OrderTracking');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/database'); 
const { Op } = require('sequelize');

const loginRider = async (req, res) => {
  try {
    const { riderId, password } = req.body;

    const rider = await Rider.findOne({
      where: { 
        riderId,
        isActive: true 
      }
    });

    if (!rider) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, rider.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: rider.id, type: 'rider' }, 
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res
    .cookie('token', token, {
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    .json({
      rider: {
        id: rider.id,
        riderId: rider.riderId,
        name: rider.name,
        totalDeliveries: rider.totalDeliveries,
        todayDeliveries: rider.todayDeliveries
      },
      token
    });
  } catch (error) {
    console.error('Rider login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

const scanOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { airwayBillNumber } = req.body;
    const riderId = req.user.id;

    const order = await Order.findOne({
      where: { 
        airwayBillNumber,
        status: 'booked'
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found or already picked up' });
    }

    // Update order status
    await order.update({
      status: 'picked_up',
      riderId,
      pickedUpAt: new Date()
    }, { transaction });

    // Create tracking entry
    await OrderTracking.create({
      orderId: order.id,
      status: 'picked_up',
      description: 'Order picked up by rider',
      riderId,
      location: req.body.location
    }, { transaction });

    // Update rider stats
    await Rider.increment(
      { totalPickups: 1 },
      { where: { id: riderId }, transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      order
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Scan order error:', error);
    res.status(500).json({ error: 'Failed to scan order' });
  }
};

// const updateOrderStatus = async (req, res) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { orderId, status, failureReason, location } = req.body;
//     const riderId = req.user.id;

//     const order = await Order.findOne({
//       where: { 
//         id: orderId,
//         riderId 
//       }
//     });

//     if (!order) {
//       return res.status(404).json({ error: 'Order not found' });
//     }

//     const updateData = { status };
    
//     if (status === 'delivered') {
//       updateData.deliveredAt = new Date();
      
//       // Update rider delivery count
//       await Rider.increment(
//         { 
//           totalDeliveries: 1,
//           todayDeliveries: 1 
//         },
//         { where: { id: riderId }, transaction }
//       );
//     } else if (status === 'failed') {
//       updateData.failureReason = failureReason;
//     }

//     await order.update(updateData, { transaction });

//     // Create tracking entry
//     await OrderTracking.create({
//       orderId: order.id,
//       status,
//       description: failureReason || `Order status updated to ${status}`,
//       riderId,
//       location
//     }, { transaction });

//     await transaction.commit();

//     res.json({
//       success: true,
//       message: 'Order status updated successfully'
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Update order status error:', error);
//     res.status(500).json({ error: 'Failed to update order status' });
//   }
// };

const updateOrderStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderId, status, failureReason, location } = req.body;
    const riderId = req.user.id;

    // Validate status
    const validStatuses = [
      'picked_up',
      'in_warehouse',
      'in_transit',
      'delivered',
      'failed',
      'returned'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Find the order assigned to this rider
    const order = await Order.findOne({
      where: { id: orderId, riderId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found or not assigned to this rider' });
    }

    const updateData = { status };

    // Handle special status cases
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();

      // Increment delivery counters
      await Rider.increment(
        { totalDeliveries: 1 },
        { where: { id: riderId }, transaction }
      );
    }

    if (status === 'failed') {
      if (!failureReason) {
        return res.status(400).json({ error: 'Failure reason is required for failed orders' });
      }
      updateData.failureReason = failureReason;
    }

    await order.update(updateData, { transaction });

    // Create tracking log
    await OrderTracking.create({
      orderId: order.id,
      status,
      description: failureReason || `Order status updated to ${status}`,
      riderId,
      location
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order  // Include updated order data
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};



const updateLocation = async (req, res) => {
  try {
    const { location } = req.body;
    const riderId = req.user.id;

    await Rider.update(
      { 
        currentLocation: location,
        lastLocationUpdate: new Date()
      },
      { where: { id: riderId } }
    );

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

const getRiderInfo = async (req, res) => {
  try {
    const riderId = req.user.id;

    const rider = await Rider.findByPk(riderId, {
      attributes: { exclude: ['password'] }
    });

    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const todaysPickupCount = await Order.count({
      where: {
        riderId: riderId,
        pickedUpAt: {
          [Op.gte]: twentyFourHoursAgo
        }
      }
    });

    res.json({
      success: true,
      rider,
      todaysPickups: todaysPickupCount
    });

  } catch (error) {
    console.error('Get rider info error:', error);
    res.status(500).json({ error: 'Failed to fetch rider info' });
  }
};

const getAllOrdersForRider = async (req, res) => {
  try {
    const riderId = req.user.id;

    const orders = await Order.findAll({
      where: {
        riderId
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'merchant',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get rider orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders for rider' });
  }
};

module.exports = {
  loginRider, // done 
  scanOrder, // done
  updateOrderStatus, // done
  updateLocation ,
  getRiderInfo, // done 
  getAllOrdersForRider // done 
};