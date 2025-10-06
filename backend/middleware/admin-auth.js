const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');

const JWT_SECRET = 'uai_admin_secret_key_2025';

// Admin authentication middleware
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if it's an admin token (has is_admin: true)
    if (!decoded.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Verify admin user exists in admin_users table
    pool.query('SELECT * FROM admin_users WHERE id = ?', [decoded.userId])
      .then(([rows]) => {
        if (rows.length === 0) {
          return res.status(401).json({ error: 'Invalid admin token' });
        }
        
        const adminUser = rows[0];
        
        // Check if admin is active and not rejected
        if (!adminUser.is_active || adminUser.rejected) {
          return res.status(403).json({ error: 'Admin access denied' });
        }
        
        // Add admin info to request
        req.admin = adminUser;
        req.user = { id: adminUser.id, is_admin: true }; // For compatibility
        next();
      })
      .catch(error => {
        console.error('Admin auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
      });
      
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { adminAuth };
