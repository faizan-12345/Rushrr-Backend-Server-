// const { db } = require('../config/database');

// const authenticate = async (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
  
//   if (!token) return res.sendStatus(401);

//   try {
//     const merchant = await db.oneOrNone(
//       'SELECT id FROM merchants WHERE api_token = $1',
//       [token]
//     );
    
//     if (!merchant) return res.sendStatus(403);
    
//     req.merchant = merchant;
//     next();
//   } catch (error) {
//     res.sendStatus(500);
//   }
// };

// module.exports = { authenticate };

// middleware/auth.js
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Rider = require('../models/Rider');

// JWT Authentication

// const authenticate = async (req, res, next) => {
//   try {
//     let token = req.header('Authorization')?.replace('Bearer ', '');

//     if (!token && req.cookies?.token) {
//       token = req.cookies.token;
//     }

//     if (!token) {
//       return res.status(401).json({ error: 'Authentication token not found.' });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Check in User (merchant) table first
//     let user = await User.findOne({
//       where: {
//         id: decoded.id,
//         isActive: true
//       }
//     });

//     if (user) {
//       req.user = {
//         id: user.id,
//         email: user.email,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         role: user.role
//       };
//       req.token = token;
//       return next();
//     }

//     // If not found in User, check Admin table
//     const admin = await Admin.findOne({
//       where: { id: decoded.id }
//     });

//     if (admin) {
//       req.user = {
//         id: admin.id,
//         email: admin.email,
//         role: admin.role
//       };
//       req.token = token;
//       return next();
//     }

//     // If not found in either table
//     return res.status(401).json({ error: 'Invalid or expired token.' });

//   } catch (error) {
//     console.error('Authentication error:', error.message);
//     return res.status(401).json({ error: 'Authentication failed.' });
//   }
// };

const authenticate = async (req, res, next) => {
  try {
    let token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication token not found.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check in User (merchant) table first
    const user = await User.findOne({
      where: {
        id: decoded.id,
        isActive: true
      }
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };
      req.token = token;
      return next();
    }

    // Then check in Admin table
    const admin = await Admin.findOne({
      where: { id: decoded.id }
    });

    if (admin) {
      req.user = {
        id: admin.id,
        email: admin.email,
        role: admin.role
      };
      req.token = token;
      return next();
    }

    // Lastly check in Rider table
    const rider = await Rider.findOne({
      where: { id: decoded.id, isActive: true }
    });

    if (rider) {
      req.user = {
        id: rider.id,
        riderId: rider.riderId,
        name: rider.name,
        phone: rider.phone,
        role: 'rider'
      };
      req.token = token;
      return next();
    }

    return res.status(401).json({ error: 'Invalid or expired token.' });

  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
};


// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// API Key validation for Shopify
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      throw new Error();
    }

    const user = await User.findOne({ 
      where: { 
        apiKey, 
        isActive: true 
      } 
    });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid API key' });
  }
};

// Rate limiting
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// DDoS protection
const apiLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many requests');
const authLimiter = createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts');

module.exports = {
  authenticate,
  authorize,
  validateApiKey,
  apiLimiter,
  authLimiter
};