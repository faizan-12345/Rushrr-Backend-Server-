// const express = require('express');
// const router = express.Router();
// const orderController = require('../../controllers/orderController');
// const { authenticate } = require('../../middleware/auth');

// router.get('/selected',  orderController.getSelectedOrders);
// router.post('/select',  orderController.selectOrders);
// router.post('/create',  orderController.createSelectedOrders);


// module.exports = router;
// routes/api/orders.js
const router = require('express').Router();
const orderController = require('../../controllers/orderController');
const { authenticate, authorize, validateApiKey, apiLimiter } = require('../../middleware/auth');
const { orderValidationRules, validate } = require('../../utils/validators');

// Merchant routes
router.post('/create-order', 
  apiLimiter,
  authenticate, 
  authorize('merchant'),
orderValidationRules.create,
  validate,
  orderController.createOrders
);

router.get('/', 
  apiLimiter,
  authenticate, 
  authorize('merchant', 'admin'),
  orderController.getOrders
);

router.put('/update', 
  apiLimiter,
  authenticate, 
  authorize('merchant'),
  orderValidationRules.update,
  validate,
  orderController.updateOrder
);

router.post('/book', 
  apiLimiter,
  authenticate, 
  authorize('merchant'),
  orderController.bookOrder
);

router.get('/analytics', 
  apiLimiter,
  authenticate, 
  authorize('merchant'),
  orderController.getOrderAnalytics
);

// Shopify API routes (using API key)
router.post('/shopify', 
  apiLimiter,
  validateApiKey,
  orderValidationRules.create,
  validate,
  orderController.createOrders
);

router.get('/shopify', 
  apiLimiter,
  validateApiKey,
  orderController.getOrders
);

router.post('/tracking', 
  // apiLimiter,
  orderController.getOrderTrackingByTrackingId
);

module.exports = router;