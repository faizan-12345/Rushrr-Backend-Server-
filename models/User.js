// models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50]
    }
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('merchant'),
    defaultValue: 'merchant'
  },
  apiKey: {
    type: DataTypes.STRING,
    unique: true
  },
  // shopifyStoreUrl: {
  //   type: DataTypes.STRING
  // },
  shopifyStoreUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  shopifyStoreName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pickupAddressCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 10);
      if (user.role === 'merchant') {
        user.apiKey = require('crypto').randomBytes(32).toString('hex');
      }
    }
  }
});

module.exports = User;