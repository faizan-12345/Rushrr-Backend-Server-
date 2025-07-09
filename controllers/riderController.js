// controllers/riderController.js
const Rider = require('../models/Rider');
const Order = require('../models/Order');
const OrderTracking = require('../models/OrderTracking');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

    res.json({
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
      order: {
        id: order.id,
        trackingId: order.trackingId,
        customerName: order.customerName,
        shippingAddress: order.shippingAddress
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Scan order error:', error);
    res.status(500).json({ error: 'Failed to scan order' });
  }
};

const updateOrderStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { orderId, status, failureReason, location } = req.body;
    const riderId = req.user.id;

    const order = await Order.findOne({
      where: { 
        id: orderId,
        riderId 
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updateData = { status };
    
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      
      // Update rider delivery count
      await Rider.increment(
        { 
          totalDeliveries: 1,
          todayDeliveries: 1 
        },
        { where: { id: riderId }, transaction }
      );
    } else if (status === 'failed') {
      updateData.failureReason = failureReason;
    }

    await order.update(updateData, { transaction });

    // Create tracking entry
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
      message: 'Order status updated successfully'
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

module.exports = {
  loginRider,
  scanOrder,
  updateOrderStatus,
  updateLocation
};