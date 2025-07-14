// // routes/api/riders.js
// const router = require('express').Router();
// const riderController = require('../../controllers/riderController');
// const { authenticate, authorize, apiLimiter, authLimiter } = require('../../middleware/auth');
// const { body, validate } = require('../../utils/validators');

// // Rider authentication
// router.post('/login', 
//   authLimiter,
//   body('riderId').notEmpty().escape(),
//   body('password').notEmpty(),
//   validate,
//   riderController.loginRider
// );

// // Rider routes (requires rider authentication)
// router.post('/scan-order', 
//   apiLimiter,
//   authenticate,
//   body('airwayBillNumber').notEmpty().escape(),
//   body('location').optional().isObject(),
//   validate,
//   riderController.scanOrder
// );

// router.put('/order-status', 
//   apiLimiter,
//   authenticate,
//   body('orderId').isUUID(),
//   body('status').isIn(['in_warehouse', 'in_transit', 'delivered', 'failed']),
//   body('failureReason').optional().escape(),
//   body('location').optional().isObject(),
//   validate,
//   riderController.updateOrderStatus
// );

// router.put('/location', 
//   apiLimiter,
//   authenticate,
//   body('location').isObject(),
//   validate,
//   riderController.updateLocation
// );

// module.exports = router;// routes/api/riders.js
const router = require('express').Router();
const riderController = require('../../controllers/riderController');
const { authenticate, authorize, apiLimiter, authLimiter } = require('../../middleware/auth');
const { body } = require('express-validator'); // Add this import
const { validate } = require('../../utils/validators'); // Import validate separately

// Rider authentication
router.post('/login', 
  // authLimiter,
  body('riderId').notEmpty().escape(),
  body('password').notEmpty(),
  validate,
  riderController.loginRider
);

// Rider routes (requires rider authentication)
router.post('/scan-order', 
  // apiLimiter,
  authenticate,
  authorize('rider'),
  body('airwayBillNumber').notEmpty().escape(),
  body('location').optional().isObject(),
  validate,
  riderController.scanOrder
);

router.put('/order-status', 
  apiLimiter,
  authenticate,
  authorize('rider'),
  body('orderId').isUUID(),
  body('failureReason').optional().escape(),
  body('location').optional().isObject(),
  validate,
  riderController.updateOrderStatus
);

router.put('/location', 
  // apiLimiter,
  authenticate,
  body('location').isObject(),
  validate,
  riderController.updateLocation
);

router.get('/info', 
  // apiLimiter,
  authenticate,
  authorize('rider'),
  riderController.getRiderInfo
);

router.get('/rider/orders', 
    // apiLimiter,
  authenticate,
  authorize('rider'),
  riderController.getAllOrdersForRider
);

module.exports = router;