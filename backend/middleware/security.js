const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const securityMonitor = require('../services/securityMonitor.js');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.log(`🚨 Rate limit exceeded for IP: ${req.ip} - ${req.path}`);
      securityMonitor.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  200, // 200 requests per window (increased from 100)
  'Too many requests from this IP, please try again later'
);

// Strict rate limiting for auth endpoints
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // 10 login attempts per window (increased from 5)
  'Too many login attempts, please try again later'
);

// Very strict rate limiting for sensitive operations
const sensitiveLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window (increased from 3)
  'Too many attempts for this sensitive operation'
);

// Payment operations rate limiting (more lenient for recharge methods)
const paymentLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20, // 20 requests per 5 minutes
  'Too many payment requests, please slow down'
);

// Download rate limiting
const downloadLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 downloads per hour (increased from 5)
  'Download limit exceeded, please try again later'
);

// Lenient rate limiting for health checks and static files
const lenientLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  50, // 50 requests per 5 minutes
  'Too many requests, please slow down'
);

// Very lenient rate limiting for user status endpoints (users need to check status frequently)
const userStatusLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  100, // 100 requests per 5 minutes
  'Too many status requests, please slow down'
);

// Extra lenient rate limiting for withdrawal status (users check this very frequently)
const withdrawalStatusLimiter = createRateLimit(
  1 * 60 * 1000, // 1 minute
  30, // 30 requests per minute
  'Too many withdrawal status requests, please slow down'
);

// Trusted IPs that get higher limits
const trustedIPs = [
  '127.0.0.1',
  '::1',
  'localhost',
  '102.0.11.44' // Add your current IP
];

// Enhanced rate limiter that considers trusted IPs
const createSmartRateLimit = (windowMs, max, message, trustedMultiplier = 2) => {
  return rateLimit({
    windowMs: windowMs,
    max: (req) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (trustedIPs.includes(clientIP)) {
        return max * trustedMultiplier; // Trusted IPs get higher limits
      }
      return max;
    },
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      console.log(`🚨 Rate limit exceeded for IP: ${clientIP} - ${req.path}`);
      securityMonitor.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        ip: clientIP,
        path: req.path,
        userAgent: req.get('User-Agent'),
        trusted: trustedIPs.includes(clientIP)
      });
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Smart rate limiters
const smartGeneralLimiter = createSmartRateLimit(
  15 * 60 * 1000, // 15 minutes
  200, // Base limit
  'Too many requests from this IP, please try again later',
  2 // Trusted IPs get 2x limit
);

const smartAuthLimiter = createSmartRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // Base limit
  'Too many login attempts, please try again later',
  1.5 // Trusted IPs get 1.5x limit
);

// Very lenient rate limiting for session management (user needs to check sessions frequently)
const sessionLimiter = createSmartRateLimit(
  15 * 60 * 1000, // 15 minutes
  50, // Base limit - 50 requests per 15 minutes
  'Too many session management requests, please try again later',
  3 // Trusted IPs get 3x limit (150 requests)
);

// Smart withdrawal status limiter with higher limits for trusted IPs
const smartWithdrawalStatusLimiter = createSmartRateLimit(
  1 * 60 * 1000, // 1 minute
  30, // Base limit - 30 requests per minute
  'Too many withdrawal status requests, please slow down',
  3 // Trusted IPs get 3x limit (90 requests per minute)
);

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://images.unsplash.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(`🚨 Input validation failed for IP: ${req.ip} - ${req.path}`);
    return res.status(400).json({
      error: 'Invalid input data',
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  phone: body('phone')
    .isMobilePhone('any')
    .withMessage('Invalid phone number format'),
  
  amount: body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  password: body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  email: body('email')
    .isEmail()
    .withMessage('Invalid email format'),
  
  userId: body('userId')
    .isInt({ min: 1 })
    .withMessage('Invalid user ID')
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
    
    // Log suspicious activities
    if (res.statusCode >= 400 || duration > 5000) {
      console.log(`⚠️ Suspicious activity:`, logData);
    } else {
      console.log(`📝 Request:`, logData);
    }
  });
  
  next();
};

// IP whitelist for admin operations
const adminIPWhitelist = (req, res, next) => {
  const allowedIPs = [
    '127.0.0.1',
    '::1',
    'localhost'
  ];
  
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (req.path.includes('/admin') && !allowedIPs.includes(clientIP)) {
    console.log(`🚨 Unauthorized admin access attempt from IP: ${clientIP}`);
    securityMonitor.logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', {
      ip: clientIP,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    return res.status(403).json({
      error: 'Access denied'
    });
  }
  
  next();
};

// File upload security
const fileUploadSecurity = (req, res, next) => {
  // Check for malicious file uploads
  if (req.files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    for (const file of req.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        console.log(`🚨 Blocked malicious file upload: ${file.originalname}`);
        return res.status(400).json({
          error: 'File type not allowed'
        });
      }
      
      if (file.size > maxSize) {
        console.log(`🚨 File too large: ${file.originalname}`);
        return res.status(400).json({
          error: 'File too large'
        });
      }
    }
  }
  
  next();
};

// SQL injection protection
const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(UNION\s+SELECT)/i,
    /(script\s*:)/i,
    /(javascript\s*:)/i
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  const checkObject = (obj) => {
    for (const key in obj) {
      if (checkValue(obj[key])) {
        return true;
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    console.log(`🚨 SQL injection attempt blocked from IP: ${req.ip}`);
    securityMonitor.logSecurityEvent('SQL_INJECTION_ATTEMPT', {
      ip: req.ip,
      path: req.path,
      body: req.body,
      query: req.query,
      params: req.params
    });
    return res.status(400).json({
      error: 'Invalid request data'
    });
  }
  
  next();
};

// Investment operations rate limiting (more lenient for payout processing)
const investmentLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20, // 20 requests per 5 minutes (allows multiple payout attempts)
  'Too many investment operations, please try again later'
);

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveLimiter,
  downloadLimiter,
  lenientLimiter,
  userStatusLimiter,
  withdrawalStatusLimiter,
  smartWithdrawalStatusLimiter,
  smartGeneralLimiter,
  smartAuthLimiter,
  sessionLimiter,
  investmentLimiter,
  paymentLimiter,
  securityHeaders,
  validateInput,
  commonValidations,
  requestLogger,
  adminIPWhitelist,
  fileUploadSecurity,
  sqlInjectionProtection,
  trustedIPs
};
