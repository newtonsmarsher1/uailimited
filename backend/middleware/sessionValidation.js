// Session validation middleware
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');

// Middleware to validate session
const validateSession = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, req.app.locals.JWT_SECRET);
    
    // Add user info to request
    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      is_admin: decoded.is_admin,
      level: decoded.level
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token. Please log in again.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Session validation error:', error);
    return res.status(500).json({ error: 'Session validation failed' });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware to log security events
const logSecurityEvent = async (req, res, next) => {
  // Add security logging for sensitive operations
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log sensitive operations
    if (req.path.includes('/withdraw') || req.path.includes('/transfer') || req.path.includes('/admin')) {
      console.log(`🔒 Security Event: ${req.method} ${req.path} - User: ${req.user?.id} - IP: ${req.ip}`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  validateSession,
  requireAdmin,
  logSecurityEvent
};

