// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Op } = require('sequelize');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'merchant'
    });

    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        apiKey: user.apiKey,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Find user with parameterized query (prevents SQL injection)
//     const user = await User.findOne({ 
//       where: { 
//         email,
//         isActive: true 
//       } 
//     });

//     if (!user) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     // Update last login
//     await user.update({ lastLogin: new Date() });

//     const token = generateToken(user.id);

//     res.json({
//       user: {
//         id: user.id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email,
//         apiKey: user.apiKey,
//         role: user.role
//       },
//       token
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ error: 'Login failed' });
//   }
// };

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const role = req.query.role?.toLowerCase();

    if (!role || !['admin', 'merchant'].includes(role)) {
      return res.status(400).json({ error: 'Invalid or missing role in query params (admin or merchant)' });
    }

    if (role === 'admin') {
      // Admin login from env
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminHashedPassword = process.env.ADMIN_HASHED_PASSWORD;

      if (email !== adminEmail) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, adminHashedPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const adminToken = generateToken('admin-static-id'); // Or use email as identifier

      return res.json({
        user: {
          id: 'admin-static-id',
          firstName: 'Admin',
          lastName: 'User',
          email: adminEmail,
          role: 'admin'
        },
        token: adminToken
      });
    }

    // Merchant login from DB
    const user = await User.findOne({
      where: {
        email,
        isActive: true
      }
    });

    if (!user || user.role !== 'merchant') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await user.update({ lastLogin: new Date() });

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        apiKey: user.apiKey,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// const verifyApiKey = async (req, res) => {
//   try {
//     const { apiKey, shopifyStoreUrl } = req.body;

//     const user = await User.findOne({ 
//       where: { 
//         apiKey,
//         isActive: true 
//       } 
//     });

//     if (!user) {
//       return res.status(401).json({ error: 'Invalid API key' });
//     }

//     // Update Shopify store URL
//     await user.update({ shopifyStoreUrl });

//     res.json({ 
//       success: true, 
//       message: 'API key verified successfully' 
//     });
//   } catch (error) {
//     console.error('API key verification error:', error);
//     res.status(500).json({ error: 'Verification failed' });
//   }
// };

const verifyApiKey = async (req, res) => {
  try {
    const { apiKey, shopifyStoreUrl, shopifyStoreName } = req.body;

    if (!apiKey || !shopifyStoreUrl || !shopifyStoreName) {
      return res.status(400).json({ error: 'All fields are required: apiKey, shopifyStoreUrl, shopifyStoreName' });
    }

    const user = await User.findOne({ 
      where: { 
        apiKey,
        isActive: true 
      } 
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid or wrong API key' });
    }

    if (user.shopifyStoreUrl || user.shopifyStoreName) {
      return res.status(400).json({ error: 'Shopify store already connected' });
    }

    // Update both fields
    await user.update({ 
      shopifyStoreUrl, 
      shopifyStoreName 
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Shopify store connected successfully' 
    });

  } catch (error) {
    console.error('API key verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};


module.exports = {
  signup,
  login,
  verifyApiKey
};