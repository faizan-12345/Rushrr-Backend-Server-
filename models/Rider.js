// models/Rider.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const Rider = sequelize.define('Rider', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  riderId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vehicleType: {
    type: DataTypes.STRING
  },
  vehicleNumber: {
    type: DataTypes.STRING
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  currentLocation: {
    type: DataTypes.JSONB
  },
  totalDeliveries: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalPickups: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastLocationUpdate: {
    type: DataTypes.DATE
  }
}, {
  hooks: {
    beforeCreate: async (rider) => {
      rider.password = await bcrypt.hash(rider.password, 10);
    }
  }
});

module.exports = Rider;