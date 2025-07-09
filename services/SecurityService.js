// services/SecurityService.js
const crypto = require('crypto');
const { RateLimiterPostgres } = require('rate-limiter-flexible');
const { sequelize } = require('../config/database');

class SecurityService {
  constructor() {
    this.initRateLimiters();
  }

  initRateLimiters() {
    // Initialize PostgreSQL rate limiter for distributed systems
    this.loginLimiter = new RateLimiterPostgres({
      storeClient: sequelize,
      keyPrefix: 'login_fail',
      points: 5, // Number of attempts
      duration: 900, // Per 15 minutes
      blockDuration: 900, // Block for 15 minutes
    });

    this.apiLimiter = new RateLimiterPostgres({
      storeClient: sequelize,
      keyPrefix: 'api_call',
      points: 100, // Number of requests
      duration: 900, // Per 15 minutes
    });
  }

  // Encrypt sensitive data
  encryptData(text) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt sensitive data
  decryptData(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv(
      algorithm, 
      key, 
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Generate secure random tokens
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data for comparison
  hashData(data) {
    return crypto
      .createHash('sha256')
      .update(data + process.env.HASH_SALT)
      .digest('hex');
  }

  // Validate request origin
  validateOrigin(origin) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    return allowedOrigins.includes(origin);
  }

  // Check for SQL injection patterns
  detectSQLInjection(input) {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
      /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
      /(\'|\"|;|\\)/g
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // Sanitize file uploads
  validateFileUpload(file) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type');
    }

    if (file.size > maxSize) {
      throw new Error('File size exceeds limit');
    }

    return true;
  }
}

module.exports = new SecurityService();