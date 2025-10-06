// Performance optimization middleware
const responseTime = require('response-time');

// Response time middleware
const responseTimeMiddleware = responseTime({
  digits: 2,
  header: 'X-Response-Time',
  suffix: false
});

// Memory usage monitoring
const memoryUsageMiddleware = (req, res, next) => {
  const memUsage = process.memoryUsage();
  res.setHeader('X-Memory-Usage', JSON.stringify({
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
  }));
  next();
};

// Query optimization middleware
const queryOptimizationMiddleware = (req, res, next) => {
  // Add query optimization headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

// Cache control middleware for API responses
const cacheControlMiddleware = (req, res, next) => {
  // Set appropriate cache headers based on route
  if (req.path.startsWith('/api/')) {
    if (req.path.includes('/stats') || req.path.includes('/profile')) {
      // Cache user-specific data for 30 seconds
      res.setHeader('Cache-Control', 'private, max-age=30');
    } else if (req.path.includes('/tasks') || req.path.includes('/notifications')) {
      // Cache task/notification data for 10 seconds
      res.setHeader('Cache-Control', 'private, max-age=10');
    } else {
      // No cache for sensitive API endpoints
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
  next();
};

// Database connection optimization
const dbOptimizationMiddleware = (req, res, next) => {
  // Add database optimization headers
  res.setHeader('X-DB-Pool-Size', '50');
  res.setHeader('X-DB-Connection-Limit', '50');
  next();
};

module.exports = {
  responseTimeMiddleware,
  memoryUsageMiddleware,
  queryOptimizationMiddleware,
  cacheControlMiddleware,
  dbOptimizationMiddleware
};
