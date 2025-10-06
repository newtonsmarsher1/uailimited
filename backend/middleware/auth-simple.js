// Simplified authentication middleware that works with existing tokens
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');

// Simple authentication middleware that accepts both old and new tokens
const simpleAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    // Try to verify JWT token
    let decoded;
    try {
      // Try with the JWT secret from environment or default
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError.message);
      return res.status(401).json({ error: 'Invalid token.' });
    }
    
    // Check if user exists and is active
    const [userRows] = await pool.query(
      'SELECT id, phone, name, is_active, level FROM users WHERE id = ?',
      [decoded.userId || decoded.id]
    );
    
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    const user = userRows[0];
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account suspended.' });
    }
    
    // Add user info to request
    req.user = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      level: user.level
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error.' });
  }
};

// Multi-device authentication middleware (optional)
const multiDeviceAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user exists and is active
    const [userRows] = await pool.query(
      'SELECT id, phone, name, is_active, level FROM users WHERE id = ?',
      [decoded.userId || decoded.id]
    );
    
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    const user = userRows[0];
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account suspended.' });
    }
    
    // Generate device fingerprint
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    const deviceFingerprint = require('crypto')
      .createHash('sha256')
      .update(userAgent + acceptLanguage + acceptEncoding)
      .digest('hex');
    
    // Check if device is registered (optional check)
    try {
      const [deviceRows] = await pool.query(
        'SELECT id FROM user_devices WHERE user_id = ? AND device_fingerprint = ? AND is_active = 1',
        [user.id, deviceFingerprint]
      );
      
      // If device is registered, update last activity
      if (deviceRows.length > 0) {
        await pool.query(
          'UPDATE user_devices SET last_activity = NOW() WHERE id = ?',
          [deviceRows[0].id]
        );
      }
    } catch (deviceError) {
      // If device check fails, continue anyway (fallback to simple auth)
      console.log('Device check failed, continuing with simple auth:', deviceError.message);
    }
    
    // Add user info to request
    req.user = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      level: user.level,
      deviceFingerprint: deviceFingerprint
    };
    
    next();
  } catch (error) {
    console.error('Multi-device auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error.' });
  }
};

// Generate device fingerprint from request
function generateDeviceFingerprint(req) {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  const fingerprint = require('crypto')
    .createHash('sha256')
    .update(userAgent + acceptLanguage + acceptEncoding)
    .digest('hex');
  
  return fingerprint;
}

// Get device info from request
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  
  let deviceType = 'Unknown';
  let os = 'Unknown';
  let browser = 'Unknown';
  
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    deviceType = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    deviceType = 'Tablet';
  } else {
    deviceType = 'Desktop';
  }
  
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  return {
    deviceType,
    os,
    browser,
    userAgent: userAgent.substring(0, 200),
    ip: req.ip || req.connection.remoteAddress || 'Unknown'
  };
}

// Device management functions
const deviceManager = {
  async registerDevice(userId, deviceFingerprint, deviceInfo, loginToken) {
    try {
      // Check if device already exists
      const [existingDevice] = await pool.query(
        'SELECT id FROM user_devices WHERE user_id = ? AND device_fingerprint = ?',
        [userId, deviceFingerprint]
      );
      
      if (existingDevice.length > 0) {
        // Update existing device
        await pool.query(
          'UPDATE user_devices SET login_token = ?, is_active = 1, last_activity = NOW(), device_info = ? WHERE id = ?',
          [loginToken, JSON.stringify(deviceInfo), existingDevice[0].id]
        );
        return { success: true, deviceId: existingDevice[0].id, action: 'updated' };
      }
      
      // Register new device
      const [result] = await pool.query(
        'INSERT INTO user_devices (user_id, device_fingerprint, device_name, device_info, login_token) VALUES (?, ?, ?, ?, ?)',
        [userId, deviceFingerprint, deviceInfo.deviceType, JSON.stringify(deviceInfo), loginToken]
      );
      
      return { success: true, deviceId: result.insertId, action: 'registered' };
    } catch (error) {
      console.error('Device registration error:', error);
      throw error;
    }
  },
  
  async getUserDevices(userId) {
    try {
      const [devices] = await pool.query(
        'SELECT id, device_name, device_info, last_activity, created_at FROM user_devices WHERE user_id = ? AND is_active = 1 ORDER BY last_activity DESC',
        [userId]
      );
      
      return devices.map(device => ({
        id: device.id,
        name: device.device_name,
        info: JSON.parse(device.device_info || '{}'),
        lastActivity: device.last_activity,
        createdAt: device.created_at
      }));
    } catch (error) {
      console.error('Get user devices error:', error);
      throw error;
    }
  }
};

module.exports = {
  simpleAuth,
  multiDeviceAuth,
  deviceManager,
  generateDeviceFingerprint,
  getDeviceInfo
};
