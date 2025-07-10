// utils/validators.js
const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

// Sanitize input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input);
  }
  return input;
};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  // Sanitize all string inputs
  ['body', 'query', 'params'].forEach(key => {
    if (req[key]) {
      Object.keys(req[key]).forEach(field => {
        req[key][field] = sanitizeInput(req[key][field]);
      });
    }
  });
  
  next();
};

// User validation rules
const userValidationRules = {
  signup: [
    body('firstName').trim().isLength({ min: 2, max: 50 }).escape(),
    body('lastName').trim().isLength({ min: 2, max: 50 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character')
  ],
  // login: [
  //   body('email').isEmail().normalizeEmail(),
  //   body('password').notEmpty()
  // ]
  login: [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty()
  ]
};

// Order validation rules
// utils/validators.js (only order-related part)
const orderValidationRules = {
    create: [
      body('orders').isArray().withMessage('Orders must be an array'),
      body('orders.*.id').isNumeric().withMessage('Shopify order ID must be numeric'),
      body('shopifyStoreUrl').notEmpty().escape().withMessage('Shopify store URL is required')
    ],
    update: [
      param('id').isUUID(),
      body('shopifyOrderData').optional().isObject()
    ],
    book: [
      body('orderIds').isArray().withMessage('Order IDs must be an array'),
      body('orderIds.*').isUUID().withMessage('Invalid order ID format'),
      body('airwayBills').isArray().withMessage('Airway bills must be an array'),
      body('airwayBills.*').notEmpty().escape()
    ]
  };

module.exports = {
  validate,
  userValidationRules,
  orderValidationRules,
  sanitizeInput
};