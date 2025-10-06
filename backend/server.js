const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const sql = require('./config/database-supabase.js');
const bcrypt = require('bcrypt');
const axios = require('axios');
const moment = require('moment');
const path = require('path');
const { processInvestmentPayouts, getInvestmentStats } = require('./services/investmentService.js');
const dailyResetService = require('./services/dailyResetService.js');
const monthlyResetService = require('./services/monthlyResetService.js');
const DailyEarningsService = require('./services/dailyEarningsService.js');
const securityMonitor = require('./services/securityMonitor.js');

// Import security middleware
const {
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
  requestLogger,
  adminIPWhitelist,
  sqlInjectionProtection
} = require('./middleware/security.js');

// Import middleware
const { auth, admin, JWT_SECRET } = require('./middleware/auth.js');
const { simpleAuth } = require('./middleware/auth-simple.js');
const { validateSession } = require('./middleware/sessionValidation.js');
const { maintenanceCheck, maintenanceToggle } = require('./middleware/maintenance.js');

// Import performance middleware
const {
  responseTimeMiddleware,
  memoryUsageMiddleware,
  queryOptimizationMiddleware,
  cacheControlMiddleware,
  dbOptimizationMiddleware
} = require('./middleware/performance.js');

// Import route modules
const authRoutes = require('./routes/auth.js');
const adminAuthRoutes = require('./routes/admin-auth.js');
const userRoutes = require('./routes/user.js');
const taskRoutes = require('./routes/tasks.js');
const appTaskRoutes = require('./routes/app-tasks.js');
const paymentRoutes = require('./routes/payments.js');
const adminRoutes = require('./routes/admin.js');
const investmentRoutes = require('./routes/investments.js');
const notificationRoutes = require('./routes/notifications.js');
const invitationRoutes = require('./routes/invitation.js');
const ceoControlRoutes = require('./routes/ceo-control.js');
const appealsRoutes = require('./routes/appeals.js');
const sessionRoutes = require('./routes/sessions.js');
const trialRoutes = require('./routes/trial.js');

const app = express();

// Trust proxy for rate limiting (needed for X-Forwarded-For headers)
// Use a function to check if IP should be trusted
app.set('trust proxy', (ip) => {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
});

// Performance optimizations
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Enhanced security with performance optimizations
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for better performance
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Performance middleware (applied first for monitoring)
app.use(responseTimeMiddleware);
app.use(memoryUsageMiddleware);
app.use(queryOptimizationMiddleware);
app.use(cacheControlMiddleware);
app.use(dbOptimizationMiddleware);

// Security middleware
app.use(requestLogger);
app.use(sqlInjectionProtection);
app.use(securityHeaders);
app.use(adminIPWhitelist);

// Optimized middleware
app.use(express.json({ 
  limit: '5mb', // Reduced from 10mb for better performance
  verify: (req, res, buf) => {
    // Skip parsing for certain routes
    if (req.path.includes('/static/') || req.path.includes('/images/')) {
      return;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '5mb',
  parameterLimit: 1000
}));

// CORS configuration for port forwarding with performance optimizations
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Static files with enhanced caching and performance optimizations
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: '7d', // Increased cache time to 7 days
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set correct MIME types
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days for JS
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days for CSS
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for HTML
    } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days for images
    }
  }
}));

// Make middleware available to routes
app.locals.auth = auth;
app.locals.admin = admin;
app.locals.JWT_SECRET = JWT_SECRET;

// Routes without maintenance check (temporarily disabled)
app.use('/api/auth', smartAuthLimiter, authRoutes);
app.use('/api/auth', smartAuthLimiter, adminAuthRoutes);
app.use('/api/user', smartGeneralLimiter, userRoutes);
app.use('/api/tasks', smartGeneralLimiter, taskRoutes);
app.use('/api/app-tasks', smartGeneralLimiter, appTaskRoutes);
app.use('/api/payments', paymentLimiter, paymentRoutes);
app.use('/api/admin', sensitiveLimiter, adminRoutes);
app.use('/api/investments', investmentLimiter, investmentRoutes);
app.use('/api/notifications', smartGeneralLimiter, notificationRoutes);
app.use('/api/invitation', smartGeneralLimiter, invitationRoutes);
app.use('/api', sensitiveLimiter, ceoControlRoutes);
app.use('/api/sessions', sessionLimiter, sessionRoutes);
app.use('/api/appeals', smartGeneralLimiter, appealsRoutes);
app.use('/api/trial', smartGeneralLimiter, trialRoutes);

// APK Download endpoint with security
app.get('/download/UAI.apk', downloadLimiter, (req, res) => {
  const apkPath = path.join(__dirname, '../UAI.apk');
  
  // Additional security checks
  const userAgent = req.get('User-Agent') || '';
  const suspiciousAgents = ['curl', 'wget', 'python', 'bot', 'crawler'];
  
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    console.log(`🚨 Suspicious download attempt from IP: ${req.ip} - User-Agent: ${userAgent}`);
    return res.status(403).json({ error: 'Download not allowed' });
  }
  
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="UAI.apk"');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  res.download(apkPath, 'UAI.apk', (err) => {
    if (err) {
      console.error('Error downloading APK:', err);
      res.status(404).json({ error: 'APK file not found' });
    } else {
      console.log(`📱 APK downloaded by IP: ${req.ip}`);
    }
  });
});

// Maintenance toggle endpoint (admin only)
app.post('/api/maintenance/toggle', simpleAuth, maintenanceToggle);

// Maintenance status endpoint
app.get('/api/maintenance/status', (req, res) => {
  const { maintenanceMode, MAINTENANCE_EXEMPT_USERS } = require('./middleware/maintenance.js');
    res.json({
    enabled: maintenanceMode.enabled || false,
    startTime: maintenanceMode.startTime,
    endTime: maintenanceMode.endTime,
    exemptUsers: MAINTENANCE_EXEMPT_USERS
  });
});

// Health check endpoint with lenient rate limiting
app.get('/api/health', lenientLimiter, async (req, res) => {
  try {
    // Test database connection
    const result = await sql`SELECT 1 as test`;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'Connected',
      databaseTest: result[0].test
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'Disconnected',
      error: error.message
    });
  }
});

// 502 Bad Gateway error page
app.get('/502', (req, res) => {
  res.status(502).sendFile(path.join(__dirname, '../frontend/502.html'));
});

// Handle 502 errors globally
app.use((err, req, res, next) => {
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.status === 502) {
    console.log('502 Bad Gateway error detected, serving custom 502 page');
    return res.status(502).sendFile(path.join(__dirname, '../frontend/502.html'));
  }
  next(err);
});

// Get user's withdrawal status
app.get('/api/user/withdrawal-status', smartWithdrawalStatusLimiter, simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get the most recent withdrawal for this user
    const withdrawals = await sql`
      SELECT id, amount, status, requested_at, processed_at, approved_by, rejected_by, admin_notes
      FROM withdrawals 
      WHERE user_id = ${userId}
      ORDER BY requested_at DESC 
      LIMIT 1
    `;
    
    if (withdrawals.length === 0) {
      return res.json({ withdrawal: null });
    }
    
    const withdrawal = withdrawals[0];
    
    // Check if withdrawal is pending (regardless of date)
    // Only return null if withdrawal is completed (approved/rejected)
    if (withdrawal.status === 'approved' || withdrawal.status === 'rejected') {
      // Only hide completed withdrawals, show pending ones regardless of date
      console.log('📅 Withdrawal completed, returning null');
      return res.json({ withdrawal: null });
    }
    
    // Debug logging
    console.log('📅 Withdrawal Status Debug:', {
      userId: userId,
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      requestedAt: withdrawal.requested_at
    });
    
    res.json({ withdrawal });
    
  } catch (error) {
    console.error('Error fetching withdrawal status:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawal status' });
  }
});

// Serve frontend routes
app.get('*', (req, res) => {
  // Check if the request is for a specific HTML file
  if (req.path.endsWith('.html')) {
    const filePath = path.join(__dirname, '../frontend', req.path);
    res.sendFile(filePath, (err) => {
      if (err) {
        // If file doesn't exist, serve index.html
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
      }
    });
  } else {
    // For all other routes, serve index.html
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server (only if not in Vercel environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  
  // Optimize server settings
  app.set('x-powered-by', false); // Remove X-Powered-By header
  app.set('etag', 'strong'); // Use strong ETags
  // Trust proxy already configured above with specific IPs
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Accessible from: http://localhost:${PORT} or http://[your-ip]:${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Performance monitoring
    console.log('⚡ Performance optimizations enabled:');
    console.log('  - Compression: Level 6');
    console.log('  - Database pool: 50 connections');
    console.log('  - Static file caching: 7 days');
    console.log('  - Response time monitoring: Enabled');
    console.log('  - Memory usage monitoring: Enabled');
    
    // Memory usage info
    const memUsage = process.memoryUsage();
    console.log('💾 Initial memory usage:', {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB'
    });
    
    // Start daily reset scheduler
    const dailyResetInstance = new dailyResetService();
    dailyResetInstance.startScheduler();
    
    // Start monthly reset scheduler
    monthlyResetService.startScheduler();
    
    // Start daily earnings update service
    const dailyEarningsService = new DailyEarningsService();
    dailyEarningsService.startService();
    
    // Process investment payouts on server startup
    console.log('🔄 Processing investment payouts on startup...');
    // Temporarily disabled due to database schema issue
    // processInvestmentPayouts().then(() => {
    //   console.log('✅ Initial payout processing completed');
    // }).catch(error => {
    //   console.error('❌ Error in initial payout processing:', error);
    // });
  });
  
  // Server performance optimizations
  server.keepAliveTimeout = 65000; // 65 seconds
  server.headersTimeout = 66000; // 66 seconds
  server.maxConnections = 1000; // Maximum connections
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// Set up automatic payout processing every 15 minutes
// Temporarily disabled due to database schema issue
// setInterval(() => {
//   console.log('🔄 Running scheduled payout processing...');
//   processInvestmentPayouts().then(() => {
//     console.log('✅ Scheduled payout processing completed');
//   }).catch(error => {
//     console.error('❌ Error in scheduled payout processing:', error);
//   });
// }, 15 * 60 * 1000); // Run every 15 minutes

module.exports = app;