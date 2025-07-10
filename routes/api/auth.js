// routes/api/auth.js
const router = require('express').Router();
const authController = require('../../controllers/authController');
const { userValidationRules, validate } = require('../../utils/validators');
const { authLimiter, authenticate } = require('../../middleware/auth');

router.post('/signup', 
  authLimiter,
  userValidationRules.signup, 
  validate, 
  authController.signup
);
router.post('/admin-signup', 
  authLimiter,
  validate, 
  authController.adminSignup
);

router.post('/login', 
  // authLimiter,
  userValidationRules.login, 
  validate, 
  authController.login
);

router.post('/verify-api-key', 
  // authLimiter,
  authController.verifyApiKey
);
router.post('/verify-shopify-store', 
  // authLimiter,
  authController.checkShopifyStoreConnection
);
router.get('/merchant-info', 
  authLimiter,
  authenticate,
  authController.getMerchantInfo
);

module.exports = router;