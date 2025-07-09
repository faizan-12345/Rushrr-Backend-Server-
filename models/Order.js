// models/Order.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  merchantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  shopifyOrderId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true
  },
  shopifyStoreUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Store complete Shopify order data
  shopifyOrderData: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  // Our internal status tracking
  status: {
    type: DataTypes.ENUM('selected', 'booked', 'picked_up', 'in_warehouse', 'in_transit', 'delivered', 'failed', 'returned'),
    defaultValue: 'selected'
  },
  fulfillmentMethod: {
    type: DataTypes.ENUM('manual', 'postEx'),
    defaultValue: 'manual'
  },
  trackingId: {
    type: DataTypes.STRING,
    unique: true
  },
  airwayBillNumber: {
    type: DataTypes.STRING,
    unique: true
  },
  failureReason: {
    type: DataTypes.STRING
  },
  riderId: {
    type: DataTypes.UUID,
    references: {
      model: 'Riders',
      key: 'id'
    }
  },
  codCollected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  pickedUpAt: {
    type: DataTypes.DATE
  },
  deliveredAt: {
    type: DataTypes.DATE
  }
});

module.exports = Order;