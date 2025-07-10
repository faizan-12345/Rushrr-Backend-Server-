// utils/generateTrackingId.js
const { v4: uuidv4 } = require('uuid');
const generateTrackingId = () => `TRK-${uuidv4().split('-')[0].toUpperCase()}`;
module.exports = generateTrackingId;
