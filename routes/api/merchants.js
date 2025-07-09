// routes/api/merchants.js
const router = require('express').Router();
const { authenticate, apiLimiter } = require('../../middleware/auth');

// Get merchant profile
router.get('/profile', 
  apiLimiter,
  authenticate,
  async (req, res) => {
    try {
      const user = req.user;
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        apiKey: user.apiKey,
        shopifyStoreUrl: user.shopifyStoreUrl
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
);

module.exports = router;