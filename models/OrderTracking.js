// models/OrderTracking.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderTracking = sequelize.define('OrderTracking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.JSONB
  },
  description: {
    type: DataTypes.STRING
  },
  riderId: {
    type: DataTypes.UUID,
    references: {
      model: 'Riders',
      key: 'id'
    }
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = OrderTracking;