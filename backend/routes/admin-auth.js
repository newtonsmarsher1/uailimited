const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');

const router = express.Router();

// Admin login route
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    const [rows] = await pool.query(
      'SELECT * FROM admin_users WHERE username = ? AND role = ?',
      [username, role]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Not yet registered' });
    }

    const user = rows[0];
    
    if (user.rejected) {
      return res.status(403).json({ error: 'Access rejected by CEO' });
    }

    if (role !== 'CEO' && !user.verified) {
      return res.status(403).json({ error: 'Not yet verified by CEO' });
    }

    let passwordValid = false;
    if (role === 'CEO') {
      passwordValid = (password === 'Caroline');
    } else {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token with admin info (matching admin-portal format)
    const token = jwt.sign(
      { 
        userId: user.id,  // Use userId instead of id to match admin-portal
        username: user.username, 
        role: user.role,
        is_admin: true 
      }, 
      'uai_admin_secret_key_2025', // Use same secret as admin-portal
      { expiresIn: '24h' }
    );

    res.json({ 
      userId: user.id, 
      userRole: user.role, 
      name: user.name,
      token: token
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
