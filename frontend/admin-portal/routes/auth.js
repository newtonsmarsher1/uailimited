const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { generateAdminToken } = require('../middleware/auth');

const router = express.Router();

// Default credentials
const DEFAULT_USERNAME = 'Uaiagency';
const DEFAULT_PASSWORD = 'Uai@2025';

// Admin Registration
router.post('/register', async (req, res) => {
  try {
    let { username, password, name, id_number, mobile, gmail, position, role } = req.body;
    
    if (!username) username = DEFAULT_USERNAME;
    if (!password) password = DEFAULT_PASSWORD;
    if (!role) return res.status(400).json({ error: 'Role is required' });

    const [exists] = await pool.query(
      'SELECT id FROM admin_users WHERE username = ? AND role = ?',
      [username, role]
    );
    
    if (exists.length > 0) {
      return res.status(409).json({ error: 'Username already exists for this role' });
    }

    const hash = await bcrypt.hash(password, 10);
    
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, name, id_number, mobile, gmail, position, role, verified, rejected, first_login) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, name, id_number, mobile, gmail, position, role, 0, 0, 1]
    );

    res.json({ 
      success: true, 
      defaultUsername: username, 
      defaultPassword: password
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
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
      // CEO password should be hashed with bcrypt
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateAdminToken(user.id, user.role);

    if (user.verified) {
      return res.json({ 
        userId: user.id, 
        userRole: user.role, 
        name: user.name,
        token: token
      });
    }

    if (!user.verified && user.first_login) {
      return res.json({ 
        firstLogin: true, 
        userId: user.id, 
        userRole: user.role, 
        name: user.name,
        token: token
      });
    }

    res.json({ 
      userId: user.id, 
      userRole: user.role, 
      name: user.name,
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
