const generateAirwayBill = () => `AWB-${require('crypto').randomBytes(5).toString('hex').toUpperCase()}`;
module.exports = generateAirwayBill;