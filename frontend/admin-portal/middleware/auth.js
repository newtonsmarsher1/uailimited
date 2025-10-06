const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'uai_admin_secret_key_2025';

// Verify admin token middleware
const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if admin user exists and is verified
    const [rows] = await pool.query(
      'SELECT id, username, role, verified, rejected FROM admin_users WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const admin = rows[0];
    
    if (admin.rejected) {
      return res.status(403).json({ error: 'Access rejected by CEO' });
    }

    if (admin.role !== 'CEO' && !admin.verified) {
      return res.status(403).json({ error: 'Not yet verified by CEO' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Check if user is CEO
const requireCEO = (req, res, next) => {
  if (req.admin.role !== 'CEO') {
    return res.status(403).json({ error: 'CEO access required' });
  }
  next();
};

// Generate admin token
const generateAdminToken = (adminId, role) => {
  return jwt.sign({ userId: adminId, role }, JWT_SECRET, { expiresIn: '24h' });
};

module.exports = {
  verifyAdminToken,
  requireCEO,
  generateAdminToken,
  JWT_SECRET
};
