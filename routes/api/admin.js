// // routes/api/admin.js
// const router = require('express').Router();
// const adminController = require('../../controllers/adminController');
// const { authenticate, authorize, apiLimiter } = require('../../middleware/auth');
// const { body, param, validate } = require('../../utils/validators');

// // Admin only routes
// router.use(authenticate, authorize('admin'));

// // Order management
// router.get('/orders', 
//   apiLimiter,
//   adminController.getAllOrders
// );

// router.put('/orders/:id/fulfillment', 
//   apiLimiter,
//   param('id').isUUID(),
//   body('fulfillmentMethod').isIn(['manual', 'postEx']),
//   validate,
//   adminController.updateFulfillmentMethod
// );

// // Rider management
// router.post('/riders', 
//   apiLimiter,
//   body('riderId').notEmpty().escape(),
//   body('password').isLength({ min: 6 }),
//   body('name').notEmpty().escape(),
//   body('phone').notEmpty().escape(),
//   validate,
//   adminController.createRider
// );

// router.get('/riders', 
//   apiLimiter,
//   adminController.getRiders
// );

// router.put('/riders/:id', 
//   apiLimiter,
//   param('id').isUUID(),
//   validate,
//   adminController.updateRider
// );

// // Analytics
// router.get('/analytics', 
//   apiLimiter,
//   adminController.getAdminAnalytics
// );

// module.exports = router;
// routes/api/admin.js
const router = require('express').Router();
const adminController = require('../../controllers/adminController');
const { authenticate, authorize, apiLimiter } = require('../../middleware/auth');
const { body, param } = require('express-validator'); // Import from express-validator
const { validate } = require('../../utils/validators'); // Import validate separately

// Admin only routes
router.use(authenticate, authorize('admin'));

// Order management
router.get('/orders', 
  apiLimiter,
  adminController.getAllOrders
);

router.put('/order/fulfillment', 
  apiLimiter,
  body('fulfillmentMethod').isIn(['Rushrr', 'postEx']),
  validate,
  adminController.updateFulfillmentMethod
);

// Rider management
router.post('/create-rider', 
  apiLimiter,
  body('riderId').notEmpty().escape(),
  body('password').isLength({ min: 6 }),
  validate,
  adminController.createRider
);

router.get('/riders', 
  apiLimiter,
  adminController.getRiders
);

router.put('/update-rider', 
  apiLimiter,
  validate,
  adminController.updateRider
);

// Analytics
router.get('/analytics', 
  apiLimiter,
  adminController.getAdminAnalytics
);

router.get('/merchants-with-orders', 
  apiLimiter,
  adminController.getAllMerchantsWithTotalOrders
);

router.get('/performance-data', 
  apiLimiter,
  adminController.getAdminPerformanceData
);

module.exports = router;