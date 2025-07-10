// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
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

const adminSignup = async (req, res) => {
  try {
    const {email, password } = req.body;

    // Check if user exists
    const existingUser = await Admin.findOne({ where: { email } });
    if (existingUser) {
      console.log(email)
      console.log(existingUser.email)
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await Admin.create({
      email,
      password
    });

    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const role = req.query.role?.toLowerCase();

    if (!role || !['admin', 'merchant'].includes(role)) {
      return res.status(400).json({ error: 'Invalid or missing role in query params (admin or merchant)' });
    }

    if (role === 'admin') {
      // ✅ Admin login from Admin table
      const admin = await Admin.findOne({ where: { email } });
  // console.log(`This is admin data ${admin}`);
  // const normalizedEmail = email.trim().toLowerCase(); // normalize
  // const admin = await Admin.findOne({ where: { email: normalizedEmail } });
  // console.log('This is admin data', admin);
      if (!admin) {
        return res.status(401).json({ error: 'Email not found' });
      }
  // const admin = await Admin.findOne({ where: { email } });
  // if (admin) {
  //   return res.status(400).json({ error: 'Email already registered' });
  // }
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const token = generateToken(admin.id);

      return res
        .cookie('token', token, {
          httpOnly: true,
          sameSite: 'Lax',
          maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .json({
          user: {
            id: admin.id,
            email: admin.email,
            role: 'admin'
          },
          token
        });
    }

    // ✅ Merchant login from User table
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

    res
      .cookie('token', token, {
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
      .json({
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

// const checkShopifyStoreConnection = async (req, res) => {
//   try {
//     const { shopifyStoreUrl } = req.body;

//     if (!shopifyStoreUrl) {
//       return res.status(400).json({ error: 'shopifyStoreUrl is required' });
//     }

//     const user = await User.findOne({
//       where: { shopifyStoreUrl }
//     });

//     if (user) {
//       return res.status(200).json({ 
//         success: true, 
//         message: 'This Shopify store is already connected' 
//       });
//     }

//     return res.status(404).json({ 
//       success: false, 
//       message: 'No connected store found. Please connect your Shopify store first.' 
//     });

//   } catch (error) {
//     console.error('Error checking Shopify store connection:', error);
//     return res.status(500).json({ error: 'Something went wrong while checking the store connection' });
//   }
// };

const checkShopifyStoreConnection = async (req, res) => {
  try {
    const { shopifyStoreUrl } = req.body;

    if (!shopifyStoreUrl) {
      return res.status(400).json({ error: 'shopifyStoreUrl is required' });
    }

    const user = await User.findOne({
      where: { shopifyStoreUrl }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'No connected store found. Please connect your Shopify store first.' 
      });
    }

    // 🔐 Generate JWT token for this user
    const token = jwt.sign(
      { id: user.id, role: user.role }, // Include role if needed
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Shopify store is already connected',
      token
    });
  } catch (error) {
    console.error('Error checking Shopify store connection:', error);
    return res.status(500).json({ error: 'Something went wrong while checking the store connection' });
  }
};


module.exports = {
  signup,
  adminSignup,
  login,
  verifyApiKey,
  checkShopifyStoreConnection
};