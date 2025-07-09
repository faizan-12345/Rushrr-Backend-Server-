const express = require('express');
const router = express.Router();
const { fetchOrdersHandler } = require('../../controllers/shopify');
const { authenticate } = require('../../middleware/auth'); // Optional

router.post('/fetch-orders', fetchOrdersHandler); // ✅ No auth for now

module.exports = router;
