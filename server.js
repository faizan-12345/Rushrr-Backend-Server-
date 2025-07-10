// // require('dotenv').config();
// // const express = require('express');
// // const bodyParser = require('body-parser');
// // const { db } = require('./config/database');
// // const cors = require('cors');

// // const app = express();

// // // CORS configuration for Shopify app
// // app.use(cors({
// //   origin: function (origin, callback) {
// //     // Allow requests with no origin (like mobile apps or curl requests)
// //     if (!origin) return callback(null, true);
    
// //     const allowedOrigins = [
// //       'https://admin.shopify.com',
// //       /https:\/\/.*\.myshopify\.com$/,
// //       /http:\/\/localhost:\d+$/,
// //       /https:\/\/.*\.shopifyapps\.com$/,
// //     ];
    
// //     const isAllowed = allowedOrigins.some(allowedOrigin => {
// //       if (typeof allowedOrigin === 'string') {
// //         return origin === allowedOrigin;
// //       } else {
// //         return allowedOrigin.test(origin);
// //       }
// //     });
    
// //     return callback(null, isAllowed);
// //   },
// //   credentials: true,
// //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
// //   allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-Access-Token'],
// //   preflightContinue: false,
// //   optionsSuccessStatus: 200
// // }));

// // // Middleware
// // app.use(bodyParser.json());
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));

// // // Test database connection
// // db.one('SELECT NOW()')
// //   .then(data => console.log('Database connected at:', data.now))
// //   .catch(err => console.error('Database connection error:', err));

// // // Routes
// // // app.use('/api', require('./routes/api/orders'));
// // app.use('/api/orders', require('./routes/api/orders'));
// // app.use('/api/shopify', require('./routes/api/shopify')); // ✅ Add this line


// // // Error handling middleware
// // app.use((err, req, res, next) => {
// //   console.error(err.stack);
// //   res.status(500).json({ error: 'Internal Server Error' });
// // });

// // const PORT = process.env.PORT || 3001;
// // app.listen(PORT, () => {
// //   console.log(`Server running on http://localhost:${PORT}`);
// // });
// require('dotenv').config();
// const express = require('express');
// const bodyParser = require('body-parser');
// const { db } = require('./config/database');
// const cors = require('cors');
// const ngrok = require('@ngrok/ngrok'); // 👉 ADD THIS

// const app = express();

// // CORS configuration for Shopify app
// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true);

//     const allowedOrigins = [
//       'https://admin.shopify.com',
//       /https:\/\/.*\.myshopify\.com$/,
//       /http:\/\/localhost:\d+$/,
//       /https:\/\/.*\.shopifyapps\.com$/,
//     ];

//     const isAllowed = allowedOrigins.some((allowedOrigin) => {
//       return (typeof allowedOrigin === 'string')
//         ? origin === allowedOrigin
//         : allowedOrigin.test(origin);
//     });

//     return callback(null, isAllowed);
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-Access-Token'],
// }));

// app.use(bodyParser.json());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Database test
// db.one('SELECT NOW()')
//   .then(data => console.log('📦 Database connected at:', data.now))
//   .catch(err => console.error('❌ Database error:', err));

// // Routes
// app.use('/api/orders', require('./routes/api/orders'));
// app.use('/api/shopify', require('./routes/api/shopify'));

// // Error handling
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Internal Server Error' });
// });

// const PORT = process.env.PORT || 3001;

// app.listen(PORT, async () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);

//   try {
//     const listener = await ngrok.connect({
//       addr: PORT,
//       authtoken_from_env: true, // automatically pick from env
//     });

//     console.log(`🌍 Ngrok tunnel ready: ${listener.url()}`);
//     console.log(`👉 Use this in your Shopify frontend: ${listener.url()}/api/shopify/fetch-orders`);
//   } catch (err) {
//     console.error('❌ Failed to start ngrok:', err);
//   }
// });

// server.js
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
// const mongoSanitize = require('express-mongo-sanitize');
// const xss = require('xss-clean');
const hpp = require('hpp');
// const { sequelize, setupAssociations } = require('./config/database');
// server.js
const sequelize = require('./config/database');
const { setupAssociations } = require('./config/database');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
// app.use(cors({
//   origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
//   credentials: true,
//   optionsSuccessStatus: 200
// }));

app.use(cors({
  origin: '*', // allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
})); 

app.use(cookieParser());

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
// app.use(mongoSanitize());
// app.use(mongoSanitize({
//   replaceWith: '_', // default is '_'
//   onSanitize: ({ req, key }) => {
//     // Optionally log or handle malicious keys
//     console.warn(`Sanitized: ${key}`);
//   }
// }));

// Data sanitization against XSS
// app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compression middleware
app.use(compression());

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}

// API routes
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/orders', require('./routes/api/orders'));
app.use('/api/riders', require('./routes/api/riders'));
app.use('/api/admin', require('./routes/api/admin'));
app.use('/api/merchants', require('./routes/api/merchants'));
app.use('/webhooks/shopify', require('./routes/api/shopify'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection and server start
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Set up model associations
    setupAssociations();

    // Sync database (use migrations in production)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('Database synchronized.');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});