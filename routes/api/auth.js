// routes/api/auth.js
const router = require('express').Router();
const authController = require('../../controllers/authController');
const { userValidationRules, validate } = require('../../utils/validators');
const { authLimiter } = require('../../middleware/auth');

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

module.exports = router;