// Comprehensive fix for all login and 404 errors
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');
const { body, validationResult } = require('express-validator');
const path = require('path');

const router = express.Router();

// Phone number normalization function
const normalizePhoneNumber = (phone) => {
  // Remove all spaces and special characters except + at the beginning
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Convert to standard +254 format
  if (cleanPhone.startsWith('+254')) {
    return cleanPhone;
  } else if (cleanPhone.startsWith('254')) {
    return '+' + cleanPhone;
  } else if (cleanPhone.startsWith('0')) {
    return '+254' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
    return '+254' + cleanPhone;
  }
  
  return cleanPhone; // Return as-is if no pattern matches
};

// Custom phone validation function
const validatePhoneNumber = (phone) => {
  // Remove all spaces and special characters except + at the beginning
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check for different Kenyan phone number formats
  const patterns = [
    /^\+254[17]\d{8}$/, // +2547XXXXXXXX or +2541XXXXXXXX
    /^254[17]\d{8}$/,   // 2547XXXXXXXX or 2541XXXXXXXX
    /^0[17]\d{8}$/,     // 07XXXXXXXX or 01XXXXXXXX
    /^[17]\d{8}$/       // 7XXXXXXXX or 1XXXXXXXX
  ];
  
  return patterns.some(pattern => pattern.test(cleanPhone));
};

// Input validation middleware
const validateLogin = [
  body('phone')
    .custom((value) => {
      if (!validatePhoneNumber(value)) {
        throw new Error('Invalid phone number format. Use +254, 254, 07, or 01 format');
      }
      return true;
    }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

const validateRegistration = [
  body('phone')
    .custom((value) => {
      if (!validatePhoneNumber(value)) {
        throw new Error('Invalid phone number format. Use +254, 254, 07, or 01 format');
      }
      return true;
    }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('name')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
  body('invitationCode')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value && value.length < 6 || value && value.length > 8) {
        throw new Error('Invalid invitation code format');
      }
      return true;
    })
];

// FIXED LOGIN ENDPOINT
router.post('/login', validateLogin, async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(`🚨 Login validation failed for IP: ${req.ip}`);
    return res.status(400).json({
      error: 'Invalid input data',
      details: errors.array()
    });
  }

  const { phone, password } = req.body;
  
  // Normalize phone number for consistent database lookup
  const normalizedPhone = normalizePhoneNumber(phone);
  
  try {
    console.log(`🔍 Login attempt for phone: ${phone} (normalized: ${normalizedPhone})`);
    
    // Query the database
    const [userResult] = await pool.query('SELECT * FROM users WHERE phone=?', [normalizedPhone]);
    
    console.log(`🔍 Database query result: ${userResult.length} users found`);
    
    // If no user found with normalized phone, try alternative formats
    if (userResult.length === 0) {
      console.log(`🔍 Trying alternative phone formats for: ${phone}`);
      
      // Try different phone formats
      const alternativePhones = [];
      
      // Add original phone
      alternativePhones.push(phone);
      
      // Add variations
      if (phone.startsWith('+254')) {
        alternativePhones.push(phone.substring(1)); // Remove +
        alternativePhones.push('0' + phone.substring(4)); // Convert to 0 format
      } else if (phone.startsWith('254')) {
        alternativePhones.push('+' + phone);
        alternativePhones.push('0' + phone.substring(3));
      } else if (phone.startsWith('0')) {
        alternativePhones.push('+254' + phone.substring(1));
        alternativePhones.push('254' + phone.substring(1));
      }
      
      // Try each alternative format
      for (const altPhone of alternativePhones) {
        if (altPhone !== normalizedPhone) {
          console.log(`🔍 Trying alternative format: ${altPhone}`);
          const [altResult] = await pool.query('SELECT * FROM users WHERE phone=?', [altPhone]);
          if (altResult.length > 0) {
            console.log(`✅ User found with alternative format: ${altPhone}`);
            userResult.push(...altResult);
            break;
          }
        }
      }
    }
    
    if (userResult.length === 0) {
      console.log(`❌ User not found: ${phone} (normalized: ${normalizedPhone})`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userResult[0];
    console.log(`✅ User found: ${user.name} (ID: ${user.id})`);
    
    // Check if user is active
    if (!user.is_active) {
      console.log(`❌ User suspended: ${phone}`);
      return res.status(403).json({ 
        error: 'Account suspended. Please contact admin for assistance.',
        suspended: true,
        appealAvailable: true,
        appealMessage: 'Your account has been suspended. You can submit an appeal to request a review of this decision.'
      });
    }
    
    // Check password
    let passwordMatch = false;
    
    console.log(`🔍 Checking password for user: ${user.name}`);
    console.log(`🔍 Stored password hash length: ${user.password ? user.password.length : 'null'}`);
    console.log(`🔍 Input password length: ${password ? password.length : 'null'}`);
    
    // Try plain text password first
    if (user.password === password) {
      passwordMatch = true;
      console.log(`✅ Plain text password match for ${phone}`);
    } else {
      // Try bcrypt comparison
      try {
        passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
          console.log(`✅ Bcrypt password match for ${phone}`);
        } else {
          console.log(`❌ Bcrypt password mismatch for ${phone}`);
        }
      } catch (error) {
        console.log(`❌ Password comparison error for ${phone}:`, error.message);
        passwordMatch = false;
      }
    }
    
    if (!passwordMatch) {
      console.log(`❌ Password mismatch for ${phone}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { 
        userId: user.id, 
        phone: user.phone, 
        is_admin: !!user.is_admin
      }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );
    
    console.log(`✅ Login successful for ${phone}`);
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: user.id, 
        phone: user.phone, 
        name: user.name,
        full_name: user.full_name,
        is_admin: !!user.is_admin, 
        level: user.level, 
        wallet_balance: user.wallet_balance,
        bond_balance: user.bond_balance,
        referral_code: user.referral_code, 
        referred_by: user.referred_by
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// REGISTRATION ENDPOINT
router.post('/register', validateRegistration, async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(`🚨 Registration validation failed for IP: ${req.ip}`);
    return res.status(400).json({
      error: 'Invalid input data',
      details: errors.array()
    });
  }

  const { phone, password, name, invitationCode } = req.body;
  
  // Normalize phone number for consistent database storage
  const normalizedPhone = normalizePhoneNumber(phone);
  
  try {
    console.log(`🔍 Registration attempt for phone: ${phone} (normalized: ${normalizedPhone})`);
    
    // Check if user already exists
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE phone=?', [normalizedPhone]);
    
    if (existingUsers.length > 0) {
      console.log(`❌ User already exists: ${phone}`);
      return res.status(400).json({ error: 'User with this phone number already exists' });
    }
    
    // Validate invitation code if provided
    let referredBy = null;
    if (invitationCode) {
      const [invitationUsers] = await pool.query(
        'SELECT id FROM users WHERE invitation_code = ?',
        [invitationCode]
      );
      
      if (invitationUsers.length === 0) {
        console.log(`❌ Invalid invitation code: ${invitationCode}`);
        return res.status(400).json({ error: 'Invalid invitation code' });
      }
      
      referredBy = invitationUsers[0].id;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate unique invitation code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let invitationCode_new;
    let isUnique = false;
    
    while (!isUnique) {
      invitationCode_new = '';
      for (let i = 0; i < 8; i++) {
        invitationCode_new += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const [existingCodes] = await pool.query('SELECT id FROM users WHERE invitation_code = ?', [invitationCode_new]);
      if (existingCodes.length === 0) {
        isUnique = true;
      }
    }
    
    // Create user with trial information
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 5); // 5 days from now
    
    const [result] = await pool.query(
      'INSERT INTO users (phone, password, name, full_name, is_active, level, wallet_balance, bond_balance, invitation_code, referral_code, referred_by, trial_start_date, trial_end_date, trial_days_remaining, is_trial_active, trial_expired, temp_worker_start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [normalizedPhone, hashedPassword, name, name, 1, 0, 0, 0, invitationCode_new, invitationCode_new, referredBy, now, trialEndDate, 5, true, false, now.toISOString().split('T')[0]]
    );
    
    const userId = result.insertId;
        
        // Process invitation rewards based on level system
        if (referredBy) {
          try {
            // Get referrer details and their level
            const [referrerRows] = await pool.query(
              'SELECT id, wallet_balance, level FROM users WHERE id = ?', 
              [referredBy]
            );
            
            if (referrerRows.length > 0) {
              const referrer = referrerRows[0];
              
              // Get level invitation rates
              const [levelRows] = await pool.query(
                'SELECT invitation_rate_a, invitation_rate_b, invitation_rate_c FROM levels WHERE level = ?',
                [referrer.level]
              );
              
              if (levelRows.length > 0) {
                const level = levelRows[0];
                
                // Calculate rewards based on invited user's level (not referrer's level)
                let rewardAmount = 0;
                
                // Define reward amounts based on invited user's level
                const levelRewards = {
                  0: 0,    // Level 0 users get no reward
                  1: 288,  // Level 1 user joins: KES 288
                  2: 600,  // Level 2 user joins: KES 600
                  3: 1200, // Level 3 user joins: KES 1200
                  4: 1800, // Level 4 user joins: KES 1800
                  5: 2400, // Level 5 user joins: KES 2400
                };
                
                // For now, new users start at level 0, so no immediate reward
                // Reward will be given when they reach level 1+
                rewardAmount = levelRewards[0] || 0;
                
                if (rewardAmount > 0) {
                  const newBalance = parseFloat(referrer.wallet_balance) + rewardAmount;
                  
                  // Update referrer's wallet
                  await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, referredBy]);
                  
                  // Create referral reward record
                  await pool.query(
                    'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [referredBy, userId, referrer.level, rewardAmount, 'completed', now]
                  );
                  
                  console.log(`✅ Invitation reward processed: User ${userId} referred by ${referredBy} (Level ${referrer.level}, +KES ${rewardAmount})`);
                }
                
                // Multi-level referral rewards removed: only direct inviter is awarded per policy.
              }
            }
          } catch (rewardError) {
            console.error('Error processing invitation rewards:', rewardError.message);
          }
        }
    console.log(`✅ User created successfully: ${name} (ID: ${userId})`);
    
    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { 
        userId: userId, 
        phone: phone, 
        is_admin: false
      }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: userId, 
        phone: phone, 
        name: name,
        full_name: name,
        is_admin: false, 
        level: 0, 
        wallet_balance: 0,
        bond_balance: 0,
        referral_code: invitationCode_new, 
        referred_by: referredBy
      },
      message: 'Registration successful'
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Serve favicon
router.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/favicon.ico'));
});

// Serve service worker
router.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/sw.js'));
});

// Test database connection endpoint
router.get('/test-db', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT COUNT(*) as userCount FROM users');
    res.json({ 
      success: true, 
      message: `Database connected. Total users: ${result[0].userCount}` 
    });
  } catch (error) {
    console.error('❌ Database test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      details: error.message 
    });
  }
});

module.exports = router;
