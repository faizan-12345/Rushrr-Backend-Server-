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

// JWT Authentication
// const authenticate = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization')?.replace('Bearer ', '');
    
//     if (!token) {
//       throw new Error();
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findOne({ 
//       where: { 
//         id: decoded.id, 
//         isActive: true 
//       } 
//     });

//     if (!user) {
//       throw new Error();
//     }

//     req.user = user;
//     req.token = token;
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Please authenticate' });
//   }
// };

const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    let token = req.header('Authorization')?.replace('Bearer ', '');

    // If not in header, try getting token from cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication token not found.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({
      where: {
        id: decoded.id,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Please authenticate' });
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