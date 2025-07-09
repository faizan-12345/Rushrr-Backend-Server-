// const pgp = require('pg-promise')({
//     capSQL: true // capitalize generated SQL
//   });
  
//   // Local PostgreSQL configuration
//   const dbConfig = {
//     host: 'localhost',
//     port: 5432, // default PostgreSQL port
//     database: 'Testing_Logistic_flow', // your database name
//     user: 'postgres', // your username
//     password: 'admin', // your password
//     max: 30 // connection pool max size
//   };
  
//   const db = pgp(dbConfig);
  
//   module.exports = {
//     db,
//     pgp
//   };
// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Set up associations
const setupAssociations = () => {
  const User = require('../models/User');
  const Order = require('../models/Order');
  const Rider = require('../models/Rider');
  const OrderTracking = require('../models/OrderTracking');

  User.hasMany(Order, { foreignKey: 'merchantId', as: 'orders' });
  Order.belongsTo(User, { foreignKey: 'merchantId', as: 'merchant' });

  Rider.hasMany(Order, { foreignKey: 'riderId', as: 'orders' });
  Order.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });

  Order.hasMany(OrderTracking, { foreignKey: 'orderId', as: 'tracking' });
  OrderTracking.belongsTo(Order, { foreignKey: 'orderId' });

  Rider.hasMany(OrderTracking, { foreignKey: 'riderId' });
  OrderTracking.belongsTo(Rider, { foreignKey: 'riderId' });
};

// module.exports = { sequelize, setupAssociations };
module.exports = sequelize;
module.exports.setupAssociations = setupAssociations;