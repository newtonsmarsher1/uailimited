const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db-vercel.js');
const bcrypt = require('bcrypt');
const axios = require('axios');
const moment = require('moment');
const { processInvestmentPayouts, getInvestmentStats } = require('./process-investment-payouts.js');


// DARAJA config for M-PESA API
const DARAJA = {
  // Production credentials (replace with your actual Safaricom Daraja credentials)
  consumerKey: process.env.DARAJA_CONSUMER_KEY || 'KrfGaEKOmQiAkDZtHe0yt8Hu8BIGgBLijxAHcGwBr2w1CAqx',
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '9vALTqheARYBGkTsNIqbMA9zNAnf2HGm8rbtUqfTLp1sQB1bUU0Vv5ZvG6sq2XYb',
  shortCode: process.env.DARAJA_SHORTCODE || '522522', // Test shortcode for development
  passkey: process.env.DARAJA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
            callbackUrl: process.env.DARAJA_CALLBACK_URL || 'https://20bcc49e1411.ngrok-free.app/api/mpesa-callback', // Updated with your ngrok URL
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
};

// Get OAuth token from Safaricom with better error handling
async function getDarajaToken() {
  try {
    // Add delay to prevent rate limiting
    await delay(1000); // 1 second delay
    
    const auth = Buffer.from(`${DARAJA.consumerKey}:${DARAJA.consumerSecret}`).toString('base64');
    const baseUrl = DARAJA.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    const res = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('✅ Daraja token obtained successfully');
    return res.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get Daraja token:', error.response?.data || error.message);
    throw new Error(`M-PESA API authentication failed: ${error.response?.data?.error_description || error.message}`);
  }
}

// Send STK Push with improved error handling and dynamic amount
// Add delay function to prevent rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendStkPush({ phone, amount, accountRef = 'UAI Recharge', desc = 'Wallet Recharge' }) {
  try {
    // Add delay to prevent rate limiting
    await delay(2000); // 2 second delay
    
    const token = await getDarajaToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${DARAJA.shortCode}${DARAJA.passkey}${timestamp}`).toString('base64');
    
    const baseUrl = DARAJA.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    const payload = {
      BusinessShortCode: DARAJA.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount), // Ensure amount is an integer
      PartyA: phone,
      PartyB: DARAJA.shortCode,
      PhoneNumber: phone,
      CallBackURL: DARAJA.callbackUrl,
      AccountReference: accountRef,
      TransactionDesc: desc,
    };
    
    console.log(`📱 Sending STK Push: Amount: KES ${amount}, Phone: ${phone}`);
    console.log(`🔧 Environment: ${DARAJA.environment}, Base URL: ${baseUrl}`);
    
    const res = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000 // 15 second timeout
    });
    
    console.log('✅ STK Push sent successfully:', res.data);
    return res.data;
  } catch (error) {
    console.error('❌ STK Push failed:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.data?.errorCode === '400.002.02') {
      throw new Error('Invalid PhoneNumber - Please use a valid Kenyan phone number');
    } else if (error.response?.data?.errorCode === '400.002.01') {
      throw new Error('Merchant does not exist - Test environment limitation');
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed - Check M-PESA credentials');
    } else if (error.response?.status === 403) {
      throw new Error('Access denied - Check M-PESA API permissions');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - Please try again');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network error - Please check your internet connection');
    } else {
      const errorMessage = error.response?.data?.errorMessage || error.message;
      throw new Error(`M-PESA STK Push failed: ${errorMessage}`);
    }
  }
}

const app = express();

app.use(express.json());
app.use(cors());
const JWT_SECRET = "UAI_SECRET";

/// Supported languages (sample for demo)
const LANGUAGES = {
  en: require('./lang/en.json'),
  sw: require('./lang/sw.json'),
  fr: require('./lang/fr.json')
};
function getLang(req) {
  return req.headers['x-lang'] || req.query.lang || req.body.lang || 'en';
}

// Helper Middlewares
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}
function admin(req, res, next) {
  if (!req.user?.is_admin) return res.sendStatus(403);
  next();
}

// --- Notifications System ---
const notifications = {}; // {userId: [{message, type, timestamp}]}
async function pushNotification(userId, message, type="info") {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
      [userId, message, type]
    );
  } catch (error) {
    console.error('Error pushing notification:', error);
  }
}

// Helper to notify all CEO and HR Manager users
async function notifyAdminsOfNewUser(message) {
  try {
    const [admins] = await pool.query('SELECT id FROM admin_users WHERE role IN ("CEO", "HR Manager") AND rejected=0 AND verified=1');
    for (const admin of admins) {
      // Check if this admin user exists in the users table before sending notification
      const [userExists] = await pool.query('SELECT id FROM users WHERE id = ?', [admin.id]);
      if (userExists.length > 0) {
        await pushNotification(admin.id, message, "info");
      } else {
        console.log(`Skipping notification for admin ${admin.id} - user not found in users table`);
      }
    }
  } catch (err) {
    console.error('Error notifying admins:', err);
  }
}

// KCB Transfer Configuration
let KCB_CONFIG = {
  enabled: true, // Set to false to disable auto-transfers
  accountName: 'YOUR KCB ACCOUNT NAME', // Replace with your KCB account name
  accountNumber: 'YOUR KCB ACCOUNT NUMBER', // Replace with your KCB account number
  bankCode: 'KCB', // KCB bank code
  transferPercentage: 100, // Percentage of payment to transfer (100 = full amount)
  minimumTransferAmount: 10, // Minimum amount to trigger transfer
  maximumTransferAmount: 100000 // Maximum amount to transfer at once
};

// Process automatic KCB transfer
async function processKcbTransfer(userId, amount, mpesaReceiptNumber) {
  try {
    // Check if KCB transfers are enabled
    if (!KCB_CONFIG.enabled) {
      console.log('🔄 KCB auto-transfer disabled');
      return;
    }

    // Calculate transfer amount based on percentage
    const transferAmount = (amount * KCB_CONFIG.transferPercentage) / 100;
    
    // Check minimum and maximum limits
    if (transferAmount < KCB_CONFIG.minimumTransferAmount) {
      console.log(`🔄 Transfer amount ${transferAmount} below minimum ${KCB_CONFIG.minimumTransferAmount}`);
      return;
    }
    
    if (transferAmount > KCB_CONFIG.maximumTransferAmount) {
      console.log(`🔄 Transfer amount ${transferAmount} exceeds maximum ${KCB_CONFIG.maximumTransferAmount}`);
      return;
    }

    // Get user details
    const [user] = await pool.query('SELECT name, phone FROM users WHERE id = ?', [userId]);
    if (!user.length) {
      console.log('❌ User not found for KCB transfer');
      return;
    }

    const userData = user[0];

    // Record the transfer in database
    await pool.query(
      `INSERT INTO kcb_transfers (
        user_id, 
        original_amount, 
        transfer_amount, 
        mpesa_receipt, 
        kcb_account_name, 
        kcb_account_number, 
        status, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        amount,
        transferAmount,
        mpesaReceiptNumber,
        KCB_CONFIG.accountName,
        KCB_CONFIG.accountNumber,
        'pending'
      ]
    );

    // Simulate KCB transfer (in real implementation, this would call KCB API)
    console.log(`🏦 Processing KCB transfer: KES ${transferAmount} to ${KCB_CONFIG.accountName} (${KCB_CONFIG.accountNumber})`);
    
    // Update transfer status to completed (in real implementation, this would be based on KCB API response)
    await pool.query(
      'UPDATE kcb_transfers SET status = ?, completed_at = NOW() WHERE user_id = ? AND mpesa_receipt = ?',
      ['completed', userId, mpesaReceiptNumber]
    );

    // Send notification to user about KCB transfer
    await pushNotification(
      userId,
      `KES ${transferAmount.toFixed(2)} has been automatically transferred to your KCB account ${KCB_CONFIG.accountNumber}.`,
      "success"
    );

    // Notify admins about KCB transfer
    await notifyAdminsOfNewUser(
      `KCB Transfer: KES ${transferAmount.toFixed(2)} transferred to ${KCB_CONFIG.accountName} (${KCB_CONFIG.accountNumber}) from payment of KES ${amount.toFixed(2)}`
    );

    console.log(`✅ KCB transfer completed: KES ${transferAmount} for user ${userId}`);

  } catch (error) {
    console.error('❌ Error processing KCB transfer:', error);
    
    // Record failed transfer
    await pool.query(
      'UPDATE kcb_transfers SET status = ?, error_message = ? WHERE user_id = ? AND mpesa_receipt = ?',
      ['failed', error.message, userId, mpesaReceiptNumber]
    );
  }
}

// --- Language APIs ---
app.post('/api/set-lang', auth, async (req, res) => {
  const { lang } = req.body;
  console.log('Setting language for user', req.user.id, 'to:', lang);
  if (!LANGUAGES[lang]) {
    console.log('Unsupported language:', lang);
    return res.status(400).json({ error: "Unsupported language" });
  }
  await pool.query('UPDATE users SET language=? WHERE id=?', [lang, req.user.id]);
  console.log('Language updated successfully');
  res.json({ success: true });
});

app.get('/api/get-lang', auth, async (req, res) => {
  console.log('Getting language for user:', req.user.id);
  try {
  const [userRows] = await pool.query('SELECT language FROM users WHERE id=?', [req.user.id]);
  if (!userRows.length) {
      console.log('User not found:', req.user.id);
    return res.status(404).json({ error: 'User not found' });
  }
  const user = userRows[0];
    const userLang = user.language || 'en';
    console.log('User language:', userLang);
    console.log('Available languages:', Object.keys(LANGUAGES));
    console.log('Translations for', userLang, ':', LANGUAGES[userLang]);
    res.json({ lang: userLang, translations: LANGUAGES[userLang] });
  } catch (error) {
    console.error('Error getting language:', error);
    res.status(500).json({ error: 'Failed to get language' });
  }
});

// --- Auth Routes with notification and user level logic ---
app.post('/api/register', async (req, res) => {
  const { phone, password, name, referral } = req.body;
  
  try {
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Validate invitation code
    if (!referral || !referral.trim()) {
      return res.status(400).json({ error: 'Invitation code is required' });
    }

    // Check if invitation code is valid (from existing users)
    const [inviterUser] = await pool.query(
      'SELECT id, referral_code FROM users WHERE referral_code = ?',
      [referral.trim()]
    );

    if (inviterUser.length === 0) {
      return res.status(400).json({ error: 'Invalid invitation code. Please enter a valid invitation code to register.' });
    }

    // Generate unique referral code for new user (6-8 characters alphanumeric)
    const { generateUniqueReferralCode } = require('./update-referral-codes.js');
    const newReferralCode = await generateUniqueReferralCode();
    
    // Create user as temporary worker with 0 balance
    const hashedPassword = await bcrypt.hash(password, 10);
    const currentDate = new Date();
    const [result] = await pool.query(
      'INSERT INTO users (phone, password, name, is_temporary_worker, temp_worker_start_date, bond_level, balance, referred_by, referral_code) VALUES (?, ?, ?, TRUE, ?, 0, 0.00, ?, ?)',
      [phone, hashedPassword, name, currentDate, inviterUser[0].referral_code, newReferralCode]
    );

    // Send welcome notification
    await pushNotification(result.insertId, "Welcome to UAI! You are now a temporary worker. Complete tasks to earn rewards and upgrade to Level 1.", "success");
    // Notify CEO and HR Manager
    await notifyAdminsOfNewUser(`New temporary worker joined: Name: ${name}, Level: 0, Account: ${phone}, Balance: 0.00`);

    const token = jwt.sign({ id: result.insertId, phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      message: 'Registration successful! You are now a temporary worker. Complete tasks to earn rewards and upgrade to Level 1.',
      isTempWorker: true,
      initialBalance: 0.00
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE phone=?', [phone]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  
  // Check if password matches (handle both hashed and plain text)
  let ok = false;
  if (user.password === password) {
    // Plain text password match
    ok = true;
  } else {
    // Try bcrypt comparison for hashed passwords
    try {
      ok = await bcrypt.compare(password, user.password);
    } catch (error) {
      ok = false;
    }
  }
  
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, phone: user.phone, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '2d' });
  await pushNotification(user.id, "Login successful", "success");
  res.json({ 
    token, 
            user: { id: user.id, phone: user.phone, is_admin: !!user.is_admin, bond_level: user.bond_level, balance: user.balance, referral_code: user.referral_code, referred_by: user.referred_by }
  });
});

// Check if referral code is valid
app.post('/api/validate-referral', async (req, res) => {
  const { code } = req.body;
  
  try {
    if (!code || !code.trim()) {
      return res.status(400).json({ valid: false, error: 'Referral code is required' });
    }

    const [referralCode] = await pool.query(
      'SELECT * FROM referral_codes WHERE code = ? AND is_active = TRUE',
      [code.trim().toUpperCase()]
    );

    if (referralCode.length === 0) {
      return res.status(200).json({ valid: false, error: 'Invalid referral code' });
    }

    res.json({ valid: true, message: 'Valid referral code' });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate referral code' });
  }
});

// Get all active referral codes (admin only)
app.get('/api/referral-codes', admin, async (req, res) => {
  try {
    const [codes] = await pool.query(
      'SELECT * FROM referral_codes WHERE is_active = TRUE ORDER BY id DESC'
    );
    res.json(codes);
  } catch (error) {
    console.error('Error fetching referral codes:', error);
    res.status(500).json({ error: 'Failed to fetch referral codes' });
  }
});

// Create new referral code (admin only)
app.post('/api/referral-codes', admin, async (req, res) => {
  const { code } = req.body;
  
  try {
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO referral_codes (code, created_by) VALUES (?, ?)',
      [code.trim().toUpperCase(), req.user.id]
    );

    res.json({ 
      success: true, 
      message: 'Referral code created successfully',
      code: code.trim().toUpperCase()
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Referral code already exists' });
    }
    console.error('Error creating referral code:', error);
    res.status(500).json({ error: 'Failed to create referral code' });
  }
});

// --- User Home Info, Level Detection ---
app.get('/api/home', auth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT phone, bond_level, balance, referral_code FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Get recent payments for this user
    const [recentPayments] = await pool.query(`
      SELECT amount, mpesa_code, status, created_at 
      FROM payments 
      WHERE user_id = ? AND status = 'confirmed'
      ORDER BY created_at DESC 
      LIMIT 5
    `, [req.user.id]);
    
    res.json({
      ...user,
      recentPayments: recentPayments,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
});

// Get payment history for user
app.get('/api/payment-history', auth, async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT amount, mpesa_code, status, created_at 
      FROM payments 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [req.user.id]);
    
    res.json({
      payments: payments,
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0)
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// --- User profile & stats ---
app.get('/api/user-stats', auth, async (req, res) => {
  try {
    // Fetch all relevant user info
    const [userRows] = await pool.query('SELECT phone, name, bond_level as level, avatar, balance as wallet_balance, referral_code, referred_by, bond_level as bond, is_admin, is_temporary_worker, temp_worker_start_date, total_tasks_completed, total_earnings, this_month_earnings FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Get today's stats from user_task_stats
    const [todayStats] = await pool.query(`
      SELECT tasks_completed_today, todays_earnings
      FROM user_task_stats 
      WHERE user_id=? AND DATE(date)=CURDATE()
    `, [req.user.id]);
    
    console.log(`📊 Today's stats for user ${req.user.id}:`, todayStats);
    
    // Get completed task IDs for today
    const [completedTasks] = await pool.query(`
      SELECT task_id FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    const completed_task_ids = completedTasks.map(task => parseInt(task.task_id));
    console.log(`📋 Completed task IDs for today:`, completed_task_ids);
    console.log(`📊 Raw completed tasks data:`, completedTasks);
    
    // Get total withdrawal
    const [withdrawRows] = await pool.query(`
      SELECT SUM(amount) as total_withdrawal FROM withdrawals WHERE user_id=? AND status='approved'
    `, [req.user.id]);
    
    // Use new database structure for stats
    const today_earning = todayStats.length > 0 ? todayStats[0].todays_earnings : 0;
    const tasks_completed_today = todayStats.length > 0 ? todayStats[0].tasks_completed_today : 0;
    
    console.log(`💰 Today's earnings: ${today_earning}, Tasks completed today: ${tasks_completed_today}`);
    
    res.json({
      phone: user.phone,
      name: user.name,
      level: user.level,
      avatar: user.avatar,
      today_earning: today_earning,
      month_earning: user.this_month_earnings || 0,
      total_revenue: user.total_earnings || 0,
      total_withdrawal: withdrawRows[0].total_withdrawal || 0,
      wallet_balance: user.wallet_balance || 0,
      bond: user.bond || 0,
      tasks_done: user.total_tasks_completed || 0,
      tasks_completed_today: tasks_completed_today,
      completed_task_ids: completed_task_ids,
      referral_code: user.referral_code,
      referred_by: user.referred_by,
      is_temporary_worker: user.is_temporary_worker || false,
      temp_worker_start_date: user.temp_worker_start_date
    });
  } catch (error) {
    console.error('Error in user-stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// --- Level System APIs ---
app.get('/api/levels', auth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT bond_level FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const userLevel = user.bond_level || 1;
    
    // Get user's task completion for today
    const [todayTasks] = await pool.query(`
      SELECT COUNT(*) as completed_today
      FROM user_tasks ut
      WHERE ut.user_id=? AND DATE(ut.completed_at)=CURDATE()
    `, [req.user.id]);
    
    // Fetch levels from database
    const [levels] = await pool.query(`
      SELECT 
        level,
        cost,
        target,
        daily_tasks as dailyTasks,
        daily_commission as dailyCommission,
        reward_per_task as rewardPerTask,
        invitation_rate_a,
        invitation_rate_b,
        invitation_rate_c,
        task_commission_rate_a,
        task_commission_rate_b,
        task_commission_rate_c,
        is_locked as locked
      FROM levels 
      ORDER BY level
    `);
    
    const userLevelData = levels.find(l => l.level === userLevel) || levels[0];
    const completedToday = todayTasks[0].completed_today || 0;
    
    res.json({
      currentLevel: userLevel,
      completedToday: completedToday,
      remaining: Math.max(0, userLevelData.dailyTasks - completedToday),
      levelData: levels
    });
  } catch (error) {
    console.error('Error in levels:', error);
    res.status(500).json({ error: 'Failed to fetch levels data' });
  }
});

app.post('/api/choose-level', auth, async (req, res) => {
  try {
    const { level } = req.body;
    if (level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    // Check if user has enough balance to upgrade
    const [userRows] = await pool.query('SELECT balance, is_temporary_worker, bond_level, phone FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const currentLevel = user.bond_level || 0;
    
    // Get level cost from database
    const [levelRows] = await pool.query('SELECT cost FROM levels WHERE level = ?', [level]);
    console.log('🔍 Level upgrade request:', { level, userBalance: user.balance, isTempWorker: user.is_temporary_worker, currentLevel });
    
    if (!levelRows.length) {
      console.log('❌ Level not found in database:', level);
      return res.status(400).json({ error: 'Invalid level' });
    }
    const cost = levelRows[0].cost;
    console.log('💰 Level cost from database:', cost);
    
    // Convert to numbers for proper comparison
    const userBalance = parseFloat(user.balance);
    const levelCost = parseFloat(cost);
    
    if (userBalance < levelCost) {
      console.log('❌ Insufficient balance:', { userBalance: userBalance, requiredCost: levelCost });
      return res.status(400).json({ error: 'Insufficient balance for this level' });
    }
    
    console.log('✅ Balance check passed:', { userBalance: userBalance, cost: levelCost });
    
    // Calculate refund amount (cost of previous level)
    let refundAmount = 0;
    if (currentLevel > 0 && currentLevel < level) {
      // Get the cost of the user's current level for refund
      const [currentLevelRows] = await pool.query('SELECT cost FROM levels WHERE level = ?', [currentLevel]);
      if (currentLevelRows.length > 0) {
        refundAmount = currentLevelRows[0].cost;
        console.log(`💰 Refund amount for Level ${currentLevel}: KES ${refundAmount}`);
      }
    }
    
    // Calculate net cost (new level cost - refund)
    const netCost = cost - refundAmount;
    console.log(`💰 Net cost after refund: KES ${netCost} (${cost} - ${refundAmount})`);
    
    // If user is a temporary worker, upgrade them immediately regardless of trial status
    if (user.is_temporary_worker) {
      // Remove temporary worker status and upgrade to the chosen level
      // For temp workers, no refund since they didn't pay for previous level
      await pool.query(
        'UPDATE users SET bond_level=?, balance=balance-?, is_temporary_worker=FALSE WHERE id=?', 
        [level, cost, req.user.id]
      );
      
      // Update temporary worker status to upgraded
      await pool.query(
        'UPDATE temporary_worker SET status = "upgraded" WHERE user_id = ?',
        [req.user.id]
      );
      
      await pushNotification(req.user.id, `Upgraded from trial to Level ${level}!`, "success");
      await notifyAdminsOfNewUser(`User ${user.phone || 'Unknown'} upgraded from trial to Level ${level}`);
    } else {
      // Regular level upgrade for non-temporary workers with refund
      const newBalance = userBalance - netCost;
      await pool.query('UPDATE users SET bond_level=?, balance=? WHERE id=?', [level, newBalance, req.user.id]);
      
      const refundMessage = refundAmount > 0 ? ` (Refunded KES ${refundAmount} from Level ${currentLevel})` : '';
      await pushNotification(req.user.id, `Upgraded to Level ${level}!${refundMessage}`, "success");
      await notifyAdminsOfNewUser(`User ${user.phone || 'Unknown'} upgraded to Level ${level}${refundMessage}`);
      
      console.log(`✅ Level upgrade completed: Level ${currentLevel} → Level ${level}, Net cost: KES ${netCost}, Refund: KES ${refundAmount}`);
    }
    
    res.json({ 
      success: true, 
      newLevel: level, 
      cost: cost,
      refundAmount: refundAmount,
      netCost: netCost
    });
  } catch (error) {
    console.error('Error in choose-level:', error);
    res.status(500).json({ error: 'Failed to choose level' });
  }
});

// --- Task APIs (level logic included) ---
app.get('/api/tasks', auth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT bond_level FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const userLevel = user.bond_level || 1;
  
  // Get tasks for user's level
  const [tasks] = await pool.query('SELECT * FROM tasks WHERE bond_level_required<=? ORDER BY id', [userLevel]);
  
  // Get completed tasks for today
  const [completedToday] = await pool.query(`
    SELECT task_id FROM user_tasks 
    WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
  `, [req.user.id]);
  
  // Get all completed tasks
  const [allCompleted] = await pool.query(`
    SELECT task_id FROM user_tasks WHERE user_id=? AND is_complete=1
  `, [req.user.id]);
  
  const completedIds = new Set(allCompleted.map(r => r.task_id));
  const completedTodayIds = new Set(completedToday.map(r => r.task_id));
  
  // Get max tasks per day from database
  const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel]);
  const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
  
      // Add video URLs and metadata for company ads
    const tasksWithVideos = tasks.map(t => {
      let videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984"; // Default Design Studio
      let thumbnailUrl = "https://img.youtube.com/vi/3V1FjfGJ1bE/maxresdefault.jpg";
      
      // Map specific tasks to YouTube video URLs
      if (t.title.includes("Design Studio")) {
        videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984";
        thumbnailUrl = "https://img.youtube.com/vi/3V1FjfGJ1bE/maxresdefault.jpg";
      } else if (t.title.includes("Samsung Galaxy")) {
        videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984";
        thumbnailUrl = "https://img.youtube.com/vi/4Qp0NE1xXps/maxresdefault.jpg";
      } else if (t.title.includes("Tecno Camera")) {
        videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984";
        thumbnailUrl = "https://img.youtube.com/vi/Z8vZxiMZK5U/maxresdefault.jpg";
      }
      
      // Get level-based reward for the user
      const levelRewards = {
        1: 17,      // Level 1: 17 shillings (default)
        2: 26.5,    // Level 2: 26.5 shillings
        3: 42,      // Level 3: 42 shillings
        4: 70.5,    // Level 4: 70.5 shillings
        5: 118,     // Level 5: 118 shillings
        6: 155,     // Level 6: 155 shillings
        7: 220,     // Level 7: 220 shillings
        8: 430,     // Level 8: 430 shillings
        9: 480      // Level 9: 480 shillings
      };
      
      const userLevelReward = levelRewards[userLevel] || levelRewards[1];
      
      // Update task with level-based reward
      const updatedTask = {
        ...t,
        reward: userLevelReward, // Apply level-based reward
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        completed: completedIds.has(t.id),
        completedToday: completedTodayIds.has(t.id)
      };
      
      return updatedTask;
    });
  
  res.json({
    tasks: tasksWithVideos,
    maxTasksPerDay: maxTasksPerDay,
    completedToday: completedToday.length,
    userLevel: userLevel
  });
  } catch (error) {
    console.error('Error in tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/complete-task', auth, async (req, res) => {
  console.log('🔍 Raw request body:', req.body);
  console.log('🔍 Request headers:', req.headers);
  console.log('🔍 Content-Type:', req.headers['content-type']);
  console.log('🔍 req.body.task_id:', req.body.task_id);
  console.log('🔍 req.body.taskId:', req.body.taskId);
  console.log('🔍 req.body keys:', Object.keys(req.body));
  console.log('🔍 req.body type:', typeof req.body);
  
  const taskId = req.body.task_id || req.body.taskId;
  
  console.log('🔄 Task completion request received:', {
    userId: req.user.id,
    taskId: taskId,
    body: req.body,
    bodyKeys: Object.keys(req.body),
    task_id_value: req.body.task_id,
    taskId_value: req.body.taskId,
    headers: req.headers['content-type']
  });
  
  try {
    // Get user info
    const [[user]] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get task info - handle both database tasks and hardcoded frontend tasks
    let task;
    if (taskId <= 150) {
      // This is a hardcoded frontend task, create a virtual task object
      task = {
        id: taskId,
        title: `App Download Task ${taskId}`,
        description: `Download app task ${taskId}`,
        reward: 17 // Base reward, will be overridden by level-based calculation
      };
    } else {
      // This is a database task
      const [[dbTask]] = await pool.query('SELECT * FROM tasks WHERE id=?', [taskId]);
      if (!dbTask) return res.status(404).json({ error: 'Task not found' });
      task = dbTask;
    }

    // Get level-based reward for the user
    const levelRewards = {
      1: 17,      // Level 1: 17 shillings (default)
      2: 26.5,    // Level 2: 26.5 shillings
      3: 42,      // Level 3: 42 shillings
      4: 70.5,    // Level 4: 70.5 shillings
      5: 118,     // Level 5: 118 shillings
      6: 155,     // Level 6: 155 shillings
      7: 220,     // Level 7: 220 shillings
      8: 430,     // Level 8: 430 shillings
      9: 480      // Level 9: 480 shillings
    };
    
    const userLevelReward = levelRewards[user.bond_level] || levelRewards[1];
    const actualReward = userLevelReward; // Use level-based reward instead of task.reward
    
    console.log(`💰 Awarding system: User ${req.user.id}, Level ${user.bond_level}, Reward: ${actualReward}`);

    // Allow task completion without checking if already completed today

    // Check daily task limit for all users
    const [todayTasks] = await pool.query(`
      SELECT COUNT(*) as completed_today
      FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    const completedToday = todayTasks[0].completed_today || 0;
    
    // Get user's daily task limit from levels table
    const userLevel = user.is_temporary_worker ? 0 : user.bond_level;
    const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel]);
    const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
    
    console.log(`🔍 Daily limit check: User ${req.user.id}, Level ${userLevel}, Completed today: ${completedToday}/${maxTasksPerDay}`);
    
    // Check if user has exceeded daily limit
    if (completedToday >= maxTasksPerDay) {
      return res.status(403).json({ 
        error: `Daily task limit reached! You have completed ${completedToday} tasks today. Daily limit for your level is ${maxTasksPerDay} tasks.`,
        dailyLimitReached: true,
        completedToday: completedToday,
        maxTasksPerDay: maxTasksPerDay
      });
    }

    // For temporary workers, check if they can still work
    if (user.is_temporary_worker) {
      // Check total tasks completed
      const [totalTasks] = await pool.query(`
        SELECT COUNT(*) as total_completed
        FROM user_tasks 
        WHERE user_id=? AND is_complete=1
      `, [req.user.id]);
      
      const totalCompleted = totalTasks[0].total_completed || 0;
      
      // Check if they've completed 5 tasks
      if (totalCompleted >= 5) {
        return res.status(403).json({ 
          error: 'Trial period completed! You have completed 5 tasks. Please upgrade to Level 1 to continue.',
          shouldUpgrade: true,
          tasksCompleted: totalCompleted
        });
      }
      
      // Check if they've exceeded 5 days (regardless of task completion)
      const startDate = new Date(user.temp_worker_start_date);
      const today = new Date();
      const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart >= 5) {
        return res.status(403).json({ 
          error: 'Trial period expired after 5 days. Please upgrade to continue.',
          shouldUpgrade: true,
          daysSinceStart: daysSinceStart
        });
      }
    }

    // Start transaction for data consistency
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      console.log(`🔄 Starting task completion for user ${req.user.id}, task ${taskId}, reward ${task.reward}`);
      
      // Get current stats before update
      const [currentStats] = await connection.query(`
        SELECT 
          u.total_tasks_completed as user_tasks,
          u.total_earnings as user_earnings,
          u.this_month_earnings as user_month_earnings,
          u.balance as user_balance,
          COALESCE(ues.total_tasks_completed, 0) as summary_tasks,
          COALESCE(ues.total_earnings, 0) as summary_earnings,
          COALESCE(ues.this_month_earnings, 0) as summary_month_earnings,
          COALESCE(uts.tasks_completed_today, 0) as today_tasks,
          COALESCE(uts.todays_earnings, 0) as today_earnings
        FROM users u
        LEFT JOIN user_earnings_summary ues ON u.id = ues.user_id
        LEFT JOIN user_task_stats uts ON u.id = uts.user_id AND uts.date = CURDATE()
        WHERE u.id = ?
      `, [req.user.id]);
      
      const before = currentStats[0] || {};
      console.log('📊 Before update:', before);

      // 1. Record task completion in user_tasks
      console.log(`📝 Inserting into user_tasks: user_id=${req.user.id}, task_id=${taskId}`);
      const insertResult = await connection.query(`
        INSERT INTO user_tasks (user_id, task_id, is_complete, completed_at) 
        VALUES (?, ?, 1, NOW())
      `, [req.user.id, taskId]);
      console.log('✅ Recorded in user_tasks, result:', insertResult);

      // 2. Record detailed task completion with enhanced tracking
      await connection.query(`
        INSERT INTO task_completions (user_id, task_id, task_name, reward_amount, user_level_at_completion, completion_date, completed_at)
        VALUES (?, ?, ?, ?, ?, CURDATE(), NOW())
      `, [req.user.id, taskId, task.title, actualReward, user.bond_level]);
      console.log('✅ Recorded in task_completions with enhanced tracking');

      // 3. Update or create daily stats
      const today = new Date().toISOString().split('T')[0];
      console.log(`📅 Updating daily stats for user ${req.user.id}, date: ${today}, reward: ${actualReward}`);
      await connection.query(`
        INSERT INTO user_task_stats (user_id, date, tasks_completed_today, todays_earnings)
        VALUES (?, CURDATE(), 1, ?)
        ON DUPLICATE KEY UPDATE 
        tasks_completed_today = tasks_completed_today + 1,
        todays_earnings = todays_earnings + ?
      `, [req.user.id, actualReward, actualReward]);
      console.log('✅ Updated daily stats');

      // 4. Update user earnings summary
      await connection.query(`
        INSERT INTO user_earnings_summary (user_id, total_tasks_completed, total_earnings, this_month_earnings)
        VALUES (?, 1, ?, ?)
        ON DUPLICATE KEY UPDATE 
        total_tasks_completed = total_tasks_completed + 1,
        total_earnings = total_earnings + ?,
        this_month_earnings = this_month_earnings + ?
      `, [req.user.id, actualReward, actualReward, actualReward, actualReward]);
      console.log('✅ Updated earnings summary');

      // 5. Update user balance and stats
      const newBalance = parseFloat(user.balance) + parseFloat(actualReward);
      await connection.query(`
        UPDATE users SET 
        balance = ?, 
        total_tasks_completed = total_tasks_completed + 1,
        total_earnings = total_earnings + ?,
        this_month_earnings = this_month_earnings + ?,
        last_task_date = CURDATE()
        WHERE id = ?
      `, [newBalance, actualReward, actualReward, req.user.id]);
      console.log('✅ Updated user table');

      // 6. Update temporary worker earnings if applicable
      if (user.is_temporary_worker) {
        await connection.query(
          'UPDATE temporary_worker SET total_earnings = total_earnings + ? WHERE user_id = ?',
          [actualReward, req.user.id]
        );
        console.log('✅ Updated temporary worker earnings');
      }

      // Commit transaction
      await connection.commit();
      console.log('✅ Transaction committed');

      // Get updated stats for response
      const [stats] = await pool.query(`
        SELECT 
          ues.total_tasks_completed,
          ues.total_earnings,
          ues.this_month_earnings,
          uts.todays_earnings,
          uts.tasks_completed_today
        FROM user_earnings_summary ues
        LEFT JOIN user_task_stats uts ON ues.user_id = uts.user_id AND uts.date = CURDATE()
        WHERE ues.user_id = ?
      `, [req.user.id]);

      const userStats = stats[0] || {};
      console.log('📊 After update:', userStats);

      const response = { 
        success: true, 
        reward: actualReward, 
        newBalance: newBalance,
        stats: {
          totalTasksCompleted: userStats.total_tasks_completed || 0,
          totalEarnings: userStats.total_earnings || 0,
          thisMonthEarnings: userStats.this_month_earnings || 0,
          todaysEarnings: userStats.todays_earnings || 0,
          tasksCompletedToday: userStats.tasks_completed_today || 0
        },
        message: user.is_temporary_worker ? 
          `Task completed! Earned KES ${actualReward}. Trial task ${totalCompleted + 1}/5` :
          `Task completed! Earned KES ${actualReward}`
      };
      
      console.log('✅ Task completion response:', response);
      res.json(response);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// --- Get user's completed tasks ---
app.get('/api/user-tasks', auth, async (req, res) => {
  try {
    // Get completed tasks for today
    const [completedTasks] = await pool.query(`
      SELECT task_id FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    console.log(`🔍 Raw completed tasks query result for user ${req.user.id}:`, completedTasks);
    
    const completedTaskIds = completedTasks.map(task => parseInt(task.task_id));
    console.log(`📋 User ${req.user.id} completed tasks for today:`, completedTaskIds);
    
    res.json({
      completedTasks: completedTaskIds
    });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

// --- Get detailed task history for profile ---
app.get('/api/task-history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
          // Get detailed task completion history
      const [taskHistory] = await pool.query(`
        SELECT 
          tc.task_name,
          tc.reward_amount,
          tc.user_level_at_completion,
          tc.completion_date,
          'app_download' as task_type,
          DATE_FORMAT(tc.completed_at, '%Y-%m-%d %H:%i:%s') as completed_at_formatted
        FROM task_completions tc
        WHERE tc.user_id = ?
        ORDER BY tc.completed_at DESC
        LIMIT ? OFFSET ?
      `, [req.user.id, limit, offset]);
    
    // Get total count for pagination
    const [totalCount] = await pool.query(`
      SELECT COUNT(*) as total FROM task_completions WHERE user_id = ?
    `, [req.user.id]);
    
    // Get summary statistics
    const [summaryStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks_completed,
        SUM(reward_amount) as total_earnings,
        AVG(reward_amount) as average_reward,
        MAX(reward_amount) as highest_reward,
        MIN(completion_date) as first_task_date,
        MAX(completion_date) as last_task_date
      FROM task_completions 
      WHERE user_id = ?
    `, [req.user.id]);
    
    // Get daily streak information
    const [streakInfo] = await pool.query(`
      SELECT 
        COUNT(DISTINCT completion_date) as active_days,
        MAX(streak_length) as longest_streak
      FROM (
        SELECT 
          completion_date,
          @streak := IF(DATEDIFF(completion_date, @prev_date) = 1, @streak + 1, 1) as streak_length,
          @prev_date := completion_date
        FROM (
          SELECT DISTINCT completion_date 
          FROM task_completions 
          WHERE user_id = ? 
          ORDER BY completion_date
        ) dates, (SELECT @streak := 0, @prev_date := NULL) vars
      ) streaks
    `, [req.user.id]);
    
    console.log(`📊 Task history for user ${req.user.id}:`, {
      totalTasks: totalCount[0].total,
      currentPage: page,
      taskHistory: taskHistory.length
    });
    
    res.json({
      taskHistory: taskHistory,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount[0].total / limit),
        totalItems: totalCount[0].total,
        hasNextPage: page * limit < totalCount[0].total,
        hasPrevPage: page > 1
      },
      summary: {
        totalTasksCompleted: summaryStats[0].total_tasks_completed || 0,
        totalEarnings: summaryStats[0].total_earnings || 0,
        averageReward: summaryStats[0].average_reward || 0,
        highestReward: summaryStats[0].highest_reward || 0,
        firstTaskDate: summaryStats[0].first_task_date,
        lastTaskDate: summaryStats[0].last_task_date,
        activeDays: streakInfo[0].active_days || 0,
        longestStreak: streakInfo[0].longest_streak || 0
      }
    });
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({ error: 'Failed to fetch task history' });
  }
});

// --- Payment & Recharge APIs ---
app.post('/api/pay', auth, async (req, res) => {
  // Here: receive a payment request and create a pending payment
  await pool.query('INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)', [req.user.id, req.body.amount, 'pending']);
  pushNotification(req.user.id, "Recharge initiated. Please complete payment.", "info");
  res.json({ status: "pending", message: "Pay to mpesa 0114710035 and wait for confirmation." });
});

// Recharge Method 1: STK Push
app.post('/api/recharge-method1', auth, async (req, res) => {
  const { number, amount } = req.body;
  
  // Validate input
  if (!number || !amount) {
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }
  
  if (amount < 10 || amount > 70000) {
    return res.status(400).json({ error: 'Amount must be between KES 10 and KES 70,000' });
  }
  
  try {
    // Format phone number for M-PESA
    let formattedPhone = number;
    if (number.startsWith('0')) {
      formattedPhone = '254' + number.substring(1);
    } else if (number.startsWith('+254')) {
      formattedPhone = number.substring(1);
    } else if (!number.startsWith('254')) {
      formattedPhone = '254' + number;
    }
    
    console.log(`💰 Processing STK Push: Phone: ${formattedPhone}, Amount: KES ${amount}`);
    
    // For sandbox testing, use the user's actual phone number
    // const testPhone = '254708374149'; // Valid test phone for sandbox
    
    // Initiate STK Push with user's actual phone number
    const stkRes = await sendStkPush({ 
      phone: formattedPhone, // Use user's actual phone number
      amount: amount,
      accountRef: `UAI_${req.user.id}`,
      desc: `UAI Wallet Recharge`
    });
    
    // Save payment as pending with more details
    await pool.query(
      'INSERT INTO payments (user_id, amount, status, created_at) VALUES (?, ?, ?, NOW())', 
      [req.user.id, amount, 'pending']
    );
    
    // Send notification
    await pushNotification(
      req.user.id, 
      `STK Push sent for KES ${amount}. Please enter your M-PESA PIN to complete payment.`, 
      "info"
    );
    
    console.log(`✅ STK Push initiated successfully for user ${req.user.id}`);
    
    res.json({ 
      message: "STK push sent successfully. Please enter your M-PESA PIN to complete payment.", 
      stk: stkRes,
      amount: amount,
      phone: formattedPhone,
      note: 'Using your actual phone number for testing'
    });
  } catch (error) {
    console.error('❌ Daraja STK Push error:', error.message);
    
    // Check if it's a "Merchant does not exist" error (expected in sandbox)
    if (error.message && error.message.includes('Merchant does not exist')) {
      // Create a mock success response for testing
      console.log('🔄 Creating mock success response for sandbox testing...');
      
      // Save payment as pending
      await pool.query(
        'INSERT INTO payments (user_id, amount, status, created_at) VALUES (?, ?, ?, NOW())', 
        [req.user.id, amount, 'pending']
      );
      
      // Send notification
      await pushNotification(
        req.user.id, 
        `STK Push sent for KES ${amount}. Please enter your M-PESA PIN to complete payment.`, 
        "info"
      );
      
      // Return mock success response
      res.json({ 
        message: "STK push sent successfully. Please enter your M-PESA PIN to complete payment.", 
        stk: {
          CheckoutRequestID: 'mock-checkout-request-id',
          MerchantRequestID: 'mock-merchant-request-id',
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing'
        },
        amount: amount,
        phone: number, // Use the original number from request
        note: 'Mock response for sandbox testing - Using your actual phone number'
      });
      return;
    }
    
    // Provide more helpful error messages for other errors
    let errorMessage = 'Failed to initiate STK Push';
    if (error.message && error.message.includes('Invalid PhoneNumber')) {
      errorMessage = 'Invalid phone number format. Please use a valid Kenyan phone number.';
    } else if (error.message) {
      errorMessage = `Payment error: ${error.message}`;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      note: 'This is a test environment. In production, real phone numbers will work.'
    });
  }
});

// Recharge Method 2: STK Push (alternate)
app.post('/api/recharge-method2', auth, async (req, res) => {
  const { number, amount } = req.body;

  // Validate input
  if (!number || !amount) {
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  if (amount < 10 || amount > 70000) {
    return res.status(400).json({ error: 'Amount must be between KES 10 and KES 70,000' });
  }

  try {
    // Format phone number for M-PESA
    let formattedPhone = number;
    if (number.startsWith('0')) {
      formattedPhone = '254' + number.substring(1);
    } else if (number.startsWith('+254')) {
      formattedPhone = number.substring(1);
    } else if (!number.startsWith('254')) {
      formattedPhone = '254' + number;
    }

    console.log(`💰 Processing STK Push (Method 2): Phone: ${formattedPhone}, Amount: KES ${amount}`);

    // Initiate STK Push with user's actual phone number
    const stkRes = await sendStkPush({ 
      phone: formattedPhone, // Use user's actual phone number
      amount: amount,
      accountRef: `UAI_M2_${req.user.id}`,
      desc: `UAI Wallet Recharge (Method 2)`
    });

    // Save payment as pending with more details
    await pool.query(
      'INSERT INTO payments (user_id, amount, status, created_at) VALUES (?, ?, ?, NOW())',
      [req.user.id, amount, 'pending']
    );

    // Send notification
    await pushNotification(
      req.user.id,
      `STK Push sent for KES ${amount} (Method 2). Please enter your M-PESA PIN to complete payment.`,
      "info"
    );

    console.log(`✅ STK Push (Method 2) initiated successfully for user ${req.user.id}`);

    res.json({
      message: "STK push sent successfully (Method 2). Please enter your M-PESA PIN to complete payment.",
      stk: stkRes,
      amount: amount,
      phone: formattedPhone,
      note: 'Using your actual phone number for testing'
    });
  } catch (error) {
    console.error('❌ Daraja STK Push error (Method 2):', error.message);

    // Check if it's a "Merchant does not exist" error (expected in sandbox)
    if (error.message && error.message.includes('Merchant does not exist')) {
      // Create a mock success response for testing
      console.log('🔄 Creating mock success response for sandbox testing (Method 2)...');

      // Save payment as pending
      await pool.query(
        'INSERT INTO payments (user_id, amount, status, created_at) VALUES (?, ?, ?, NOW())',
        [req.user.id, amount, 'pending']
      );

      // Send notification
      await pushNotification(
        req.user.id,
        `STK Push sent for KES ${amount} (Method 2). Please enter your M-PESA PIN to complete payment.`,
        "info"
      );

      // Return mock success response
      res.json({
        message: "STK push sent successfully (Method 2). Please enter your M-PESA PIN to complete payment.",
        stk: {
          CheckoutRequestID: 'mock-checkout-request-id-method2',
          MerchantRequestID: 'mock-merchant-request-id-method2',
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing'
        },
        amount: amount,
        phone: number,
        note: 'Mock response for sandbox testing (Method 2) - Using your actual phone number'
      });
      return;
    }

    // Provide more helpful error messages for other errors
    let errorMessage = 'Failed to initiate STK Push (Method 2)';
    if (error.message && error.message.includes('Invalid PhoneNumber')) {
      errorMessage = 'Invalid phone number format. Please use a valid Kenyan phone number.';
    } else if (error.message) {
      errorMessage = `Payment error (Method 2): ${error.message}`;
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
      note: 'This is a test environment. In production, real phone numbers will work.'
    });
  }
});

// Recharge Method 3: Paybill Message with Verification API
app.post('/api/recharge-method3', auth, async (req, res) => {
  const { mpesa_message } = req.body;
  
  if (!mpesa_message) {
    return res.status(400).json({ error: 'M-PESA message is required' });
  }
  
  try {
    // Parse M-PESA message to extract amount and receipt number
    const message = mpesa_message.toLowerCase();
    const amountMatch = message.match(/kes\s*(\d+(?:\.\d{2})?)/i);
    const receiptMatch = message.match(/receipt\s*#?\s*(\w+)/i) || message.match(/ref\s*#?\s*(\w+)/i);
    
    if (!amountMatch) {
      return res.status(400).json({ error: 'Failed to fetch payments. Please check your message and try again.' });
    }
    
    const amount = parseFloat(amountMatch[1]);
    const receiptNumber = receiptMatch ? receiptMatch[1] : 'MANUAL_' + Date.now();
    
    // Get user info
    const [user] = await pool.query('SELECT id, phone, balance, name FROM users WHERE id = ?', [req.user.id]);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    const newBalance = parseFloat(userData.balance || 0) + amount;
    
    // Update user balance immediately
    await pool.query(
      'UPDATE users SET balance = ? WHERE id = ?',
      [newBalance, req.user.id]
    );

    // Record payment in payments table
    await pool.query(
      'INSERT INTO payments (user_id, amount, mpesa_code, status) VALUES (?, ?, ?, ?)',
      [req.user.id, amount, receiptNumber, 'confirmed']
    );

    // Send notification to user
    await pushNotification(req.user.id, `Payment of KES ${amount.toFixed(2)} confirmed! Your balance has been updated to KES ${newBalance.toFixed(2)}.`, "success");

    // Notify admins
    await notifyAdminsOfNewUser(`Manual payment confirmed: User ${userData.name || userData.phone} received KES ${amount.toFixed(2)}. New balance: KES ${newBalance.toFixed(2)}`);

    console.log(`✅ Manual payment processed: User ${req.user.id} received KES ${amount}. Balance: ${userData.balance} → ${newBalance}`);
    
    res.json({ 
      message: `Payment of KES ${amount.toFixed(2)} confirmed! Your balance has been updated.`,
      newBalance: newBalance.toFixed(2)
    });
    
  } catch (error) {
    console.error('❌ Error processing manual M-PESA payment:', error);
    res.status(500).json({ error: 'Failed to process payment. Please try again.' });
  }
});

// Recharge Method 4: Till Number Message with Verification API
app.post('/api/recharge-method4', auth, async (req, res) => {
  const { mpesa_message } = req.body;
  
  console.log(`🔍 Method 4 - Received message: ${mpesa_message}`);
  
  if (!mpesa_message) {
    console.log(`❌ Method 4 - No message provided`);
    return res.status(400).json({ error: 'M-PESA message is required' });
  }
  
  try {
    // Parse M-PESA message to extract amount and receipt number
    const message = mpesa_message.toLowerCase();
    const amountMatch = message.match(/kes\s*(\d+(?:\.\d{2})?)/i);
    const receiptMatch = message.match(/receipt\s*#?\s*(\w+)/i) || message.match(/ref\s*#?\s*(\w+)/i);
    
    console.log(`🔍 Method 4 - Parsed message: ${message}`);
    console.log(`🔍 Method 4 - Amount match: ${amountMatch}`);
    
    if (!amountMatch) {
      console.log(`❌ Method 4 - No amount found in message`);
      return res.status(400).json({ error: 'Failed to fetch payments. Please check your message and try again.' });
    }
    
    const amount = parseFloat(amountMatch[1]);
    const receiptNumber = receiptMatch ? receiptMatch[1] : 'MANUAL_' + Date.now();
    
    // Get user info
    const [user] = await pool.query('SELECT id, phone, balance, name FROM users WHERE id = ?', [req.user.id]);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    const newBalance = parseFloat(userData.balance || 0) + amount;
    
    // Update user balance immediately
    await pool.query(
      'UPDATE users SET balance = ? WHERE id = ?',
      [newBalance, req.user.id]
    );

    // Record payment in payments table
    await pool.query(
      'INSERT INTO payments (user_id, amount, mpesa_code, status) VALUES (?, ?, ?, ?)',
      [req.user.id, amount, receiptNumber, 'confirmed']
    );

    // Send notification to user
    await pushNotification(req.user.id, `Payment of KES ${amount.toFixed(2)} confirmed! Your balance has been updated to KES ${newBalance.toFixed(2)}.`, "success");

    // Notify admins
    await notifyAdminsOfNewUser(`Manual payment confirmed: User ${userData.name || userData.phone} received KES ${amount.toFixed(2)}. New balance: KES ${newBalance.toFixed(2)}`);

    console.log(`✅ Manual payment processed: User ${req.user.id} received KES ${amount}. Balance: ${userData.balance} → ${newBalance}`);
    
    res.json({ 
      message: `Payment of KES ${amount.toFixed(2)} confirmed! Your balance has been updated.`,
      newBalance: newBalance.toFixed(2)
    });
    
  } catch (error) {
    console.error('❌ Error processing manual M-PESA payment:', error);
    res.status(500).json({ error: 'Failed to process payment. Please try again.' });
  }
});

// M-PESA Message Verification API
app.post('/api/verify-mpesa-message', auth, async (req, res) => {
  const { user_message, expected_amount, user_phone } = req.body;
  
  if (!user_message || !expected_amount || !user_phone) {
    return res.status(400).json({ 
      error: 'User message, expected amount, and user phone are required' 
    });
  }
  
  try {
    console.log(`🔍 Verifying M-PESA message for user ${req.user.id}`);
    console.log(`📱 User message: ${user_message}`);
    console.log(`💰 Expected amount: KES ${expected_amount}`);
    console.log(`📞 User phone: ${user_phone}`);
    
    // Parse user's submitted message
    const message = user_message.toLowerCase();
    const amountMatch = message.match(/kes\s*(\d+(?:\.\d{2})?)/i);
    const receiptMatch = message.match(/receipt\s*#?\s*(\w+)/i) || message.match(/ref\s*#?\s*(\w+)/i);
    
    if (!amountMatch) {
      return res.status(400).json({ 
        error: 'Failed to fetch payments. Please check your message and try again.',
        verification_status: 'failed',
        reason: 'invalid_message_format'
      });
    }
    
    const extractedAmount = parseFloat(amountMatch[1]);
    const receiptNumber = receiptMatch ? receiptMatch[1] : null;
    
    // Check if amount matches expected amount
    const expectedAmount = parseFloat(expected_amount);
    const amountMatches = Math.abs(extractedAmount - expectedAmount) < 0.01; // Allow small difference
    
    // Verify against database records (simulate checking against actual M-PESA records)
    const [recentPayments] = await pool.query(
      `SELECT * FROM payments 
       WHERE user_id = ? 
       AND amount = ? 
       AND status = 'confirmed'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.user.id, extractedAmount]
    );
    
    const paymentExists = recentPayments.length > 0;
    const verificationStatus = amountMatches && paymentExists ? 'verified' : 'failed';
    
    let verificationResult = {
      verification_status: verificationStatus,
      user_message: user_message,
      extracted_amount: extractedAmount,
      expected_amount: expectedAmount,
      amount_matches: amountMatches,
      receipt_number: receiptNumber,
      payment_exists: paymentExists,
      timestamp: new Date().toISOString()
    };
    
    if (verificationStatus === 'verified') {
      // Update user balance if not already updated
      const [user] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.user.id]);
      if (user.length > 0) {
        const currentBalance = parseFloat(user[0].balance || 0);
        const newBalance = currentBalance + extractedAmount;
        
        await pool.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id]);
        
        // Send success notification
        await pushNotification(
          req.user.id, 
          `M-PESA payment of KES ${extractedAmount.toFixed(2)} verified and confirmed! Your balance has been updated.`, 
          "success"
        );
        
        verificationResult.new_balance = newBalance.toFixed(2);
        verificationResult.message = `Payment of KES ${extractedAmount.toFixed(2)} verified and confirmed!`;
      }
    } else {
      // Send failure notification
      await pushNotification(
        req.user.id, 
        `M-PESA payment verification failed. Please check your message and try again.`, 
        "error"
      );
      
      verificationResult.message = 'Payment verification failed. Please check your message and try again.';
      verificationResult.reason = !amountMatches ? 'amount_mismatch' : 'payment_not_found';
    }
    
    console.log(`✅ M-PESA message verification completed: ${verificationStatus}`);
    console.log(`📊 Verification result:`, verificationResult);
    
    res.json(verificationResult);
    
  } catch (error) {
    console.error('❌ Error verifying M-PESA message:', error);
    res.status(500).json({ 
      error: 'Failed to verify M-PESA message. Please try again.',
      verification_status: 'error',
      details: error.message
    });
  }
});

// Admin API to view verification history
app.get('/api/admin/mpesa-verifications', admin, async (req, res) => {
  try {
    const [verifications] = await pool.query(
      `SELECT p.*, u.name, u.phone 
       FROM payments p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.mpesa_code IS NOT NULL 
       ORDER BY p.created_at DESC 
       LIMIT 50`
    );
    
    res.json({
      verifications: verifications,
      total_count: verifications.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching verification history:', error);
    res.status(500).json({ error: 'Failed to fetch verification history' });
  }
});

// Recharge Method 4: Till Direct Pay
app.post('/api/recharge-method4', auth, async (req, res) => {
  // Usually, frontend just instructs user to pay; backend could verify payment via callback
  pushNotification(req.user.id, "Pay to Till Number 654321 to recharge.", "info");
  res.json({ message: "Pay to Till Number 654321 to recharge." });
});

// Payment Callback for M-PESA (set as your C2B confirmation url)
app.post('/api/mpesa-callback', async (req, res) => {
  try {
    console.log('📱 M-PESA Callback received:', JSON.stringify(req.body, null, 2));
    
    // Parse Safaricom Daraja callback payload
    const {
      Body: {
        stkCallback: {
          MerchantRequestID,
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata
        }
      }
    } = req.body;

    console.log(`🔍 Processing callback: ResultCode=${ResultCode}, ResultDesc=${ResultDesc}`);

    // Check if payment was successful
    if (ResultCode === 0) {
      // Extract payment details from callback metadata
      const metadata = CallbackMetadata?.Item || [];
      let amount = 0;
      let mpesaReceiptNumber = '';
      let phoneNumber = '';

      metadata.forEach(item => {
        if (item.Name === 'Amount') {
          amount = parseFloat(item.Value) / 100; // Convert from cents to shillings
        } else if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value;
        } else if (item.Name === 'PhoneNumber') {
          phoneNumber = item.Value;
        }
      });

      console.log(`💰 Payment confirmed: Amount: KES ${amount}, Receipt: ${mpesaReceiptNumber}, Phone: ${phoneNumber}`);

      // Find user by phone number
      const [users] = await pool.query('SELECT id, phone, balance, name FROM users WHERE phone = ?', [phoneNumber]);
      
      if (users.length > 0) {
        const user = users[0];
        const newBalance = parseFloat(user.balance || 0) + amount;
        
        // Update user balance
        await pool.query(
          'UPDATE users SET balance = ? WHERE id = ?',
          [newBalance, user.id]
        );

        // Update existing pending payment or create new confirmed payment
        await pool.query(
          `UPDATE payments SET status = 'confirmed', mpesa_code = ? WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
          [mpesaReceiptNumber, user.id]
        );

        // Send notification to user
        await pushNotification(
          user.id, 
          `Payment of KES ${amount.toFixed(2)} confirmed! Your balance has been updated to KES ${newBalance.toFixed(2)}.`, 
          "success"
        );

        // Notify admins
        await notifyAdminsOfNewUser(
          `Payment confirmed: User ${user.name || user.phone} received KES ${amount.toFixed(2)}. New balance: KES ${newBalance.toFixed(2)}`
        );

        // Auto-transfer to KCB account if configured
        await processKcbTransfer(user.id, amount, mpesaReceiptNumber);

        console.log(`✅ Balance updated for user ${user.id}: KES ${user.balance} → KES ${newBalance}`);
      } else {
        console.log(`⚠️  No user found with phone number: ${phoneNumber}`);
        // Still acknowledge the callback to prevent retries
      }
    } else {
      console.log(`❌ Payment failed: ${ResultDesc}`);
      // Log failed payment for monitoring
      await pool.query(
        'INSERT INTO payments (user_id, amount, mpesa_code, status) VALUES (?, ?, ?, ?)',
        [null, 0, 'FAILED_' + Date.now(), 'failed']
      );
    }

    // Always acknowledge the callback to prevent retries
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error processing M-PESA callback:', error);
    // Still acknowledge to prevent retries
    res.sendStatus(200);
  }
});

// --- Withdrawals ---
app.post('/api/withdraw', auth, async (req, res) => {
  const { amount, pin } = req.body;
  
  if (!amount || !pin) {
    return res.status(400).json({ error: 'Amount and PIN are required' });
  }
  
  if (pin.length !== 4 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  
  try {
    // Check if user has bound withdrawal details
    const [user] = await pool.query(
      'SELECT balance, withdrawal_pin, pin_attempts, pin_locked_until, full_name, bank_type, account_number FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    
    // Check if PIN is locked
    if (userData.pin_locked_until && new Date() < new Date(userData.pin_locked_until)) {
      const lockTime = new Date(userData.pin_locked_until);
      const remainingMinutes = Math.ceil((lockTime - new Date()) / (1000 * 60));
      return res.status(400).json({ 
        error: `PIN is locked. Please contact HR Manager or try again in ${remainingMinutes} minutes.` 
      });
    }
    
    // Check if user has bound withdrawal details
    if (!userData.full_name || !userData.bank_type || !userData.account_number) {
      return res.status(400).json({ 
        error: 'Please bind your withdrawal details first. Go to Bind Withdrawal Details.' 
      });
    }
    
    // Check if user has withdrawal PIN set
    if (!userData.withdrawal_pin) {
      return res.status(400).json({ 
        error: 'Please set your withdrawal PIN first. Go to Bind Withdrawal Details.' 
      });
    }
    
    // Validate PIN
    const isPinValid = await bcrypt.compare(pin, userData.withdrawal_pin);
    
    if (!isPinValid) {
      // Increment failed attempts
      const newAttempts = (userData.pin_attempts || 0) + 1;
      
      if (newAttempts >= 5) {
        // Lock PIN for 30 minutes
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await pool.query(
          'UPDATE users SET pin_attempts=?, pin_locked_until=? WHERE id=?',
          [newAttempts, lockUntil, req.user.id]
        );
        
        return res.status(400).json({ 
          error: 'Too many failed attempts. PIN is locked for 30 minutes. Please contact HR Manager.' 
        });
      } else {
        // Update attempts count
        await pool.query(
          'UPDATE users SET pin_attempts=? WHERE id=?',
          [newAttempts, req.user.id]
        );
        
        const remainingAttempts = 5 - newAttempts;
        return res.status(400).json({ 
          error: `Invalid PIN. ${remainingAttempts} attempts remaining.` 
        });
      }
    }
    
    // Reset PIN attempts on successful validation
    await pool.query(
      'UPDATE users SET pin_attempts=0, pin_locked_until=NULL WHERE id=?',
      [req.user.id]
    );
    
    // Check balance
    if (userData.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Process withdrawal
    await pool.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, req.user.id]);
    
    await pool.query(
      'INSERT INTO withdrawals (user_id, amount, status) VALUES (?, ?, "pending")',
      [req.user.id, amount]
    );
    
    pushNotification(req.user.id, `Withdrawal request for ${amount} submitted. Await admin approval.`, "info");
    res.json({ status: "pending", message: "Withdrawal requested. Await admin approval." });
    
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

// --- Bind withdrawal details ---
app.post('/api/bind-details', auth, async (req, res) => {
  const { fullName, bankType, accountNumber, withdrawalPin } = req.body;
  
  if (!fullName || !bankType || !accountNumber || !withdrawalPin) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (withdrawalPin.length !== 4 || !/^\d+$/.test(withdrawalPin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  
  try {
    // Hash the withdrawal PIN for security
    const hashedPin = await bcrypt.hash(withdrawalPin, 10);
    
    // Store withdrawal details securely
    await pool.query(
      'UPDATE users SET full_name=?, bank_type=?, account_number=?, withdrawal_pin=?, pin_attempts=0, pin_locked_until=NULL WHERE id=?', 
      [fullName, bankType, accountNumber, hashedPin, req.user.id]
    );
    
    pushNotification(req.user.id, "Withdrawal details bound successfully.", "success");
    res.json({ message: "Withdrawal details saved successfully." });
  } catch (error) {
    console.error('Error binding details:', error);
    res.status(500).json({ error: 'Failed to save details' });
  }
});

// --- Reset withdrawal PIN ---
app.post('/api/reset-withdrawal-pin', auth, async (req, res) => {
  const { password, newPin } = req.body;
  
  console.log('🔐 Reset PIN request for user:', req.user.id);
  console.log('📝 Request data:', { password: password ? '***' : 'missing', newPin: newPin ? '***' : 'missing' });
  
  if (!password || !newPin) {
    return res.status(400).json({ error: 'Password and new PIN are required' });
  }
  
  if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  
  try {
    // Verify account password
    const [user] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if password matches (handle both hashed and plain text passwords)
    let isPasswordValid = false;
    console.log('🔍 Checking password for user:', req.user.id);
    console.log('📋 Stored password type:', user[0].password.startsWith('$2b$') ? 'hashed' : 'plain text');
    
    if (user[0].password === password) {
      // Plain text password match
      isPasswordValid = true;
      console.log('✅ Plain text password match');
    } else {
      // Try bcrypt comparison for hashed passwords
      try {
        isPasswordValid = await bcrypt.compare(password, user[0].password);
        console.log('✅ Bcrypt password match:', isPasswordValid);
      } catch (error) {
        console.log('❌ Bcrypt comparison failed:', error.message);
        isPasswordValid = false;
      }
    }
    
    if (!isPasswordValid) {
      console.log('❌ Password validation failed');
      return res.status(400).json({ error: 'Invalid account password' });
    }
    
    console.log('✅ Password validated successfully');
    
    // Hash the new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);
    console.log('🔐 New PIN hashed successfully');
    
    // Update PIN and reset attempts
    await pool.query(
      'UPDATE users SET withdrawal_pin=?, pin_attempts=0, pin_locked_until=NULL WHERE id=?',
      [hashedPin, req.user.id]
    );
    
    console.log('✅ PIN updated in database for user:', req.user.id);
    pushNotification(req.user.id, "Withdrawal PIN reset successfully.", "success");
    res.json({ message: "Withdrawal PIN reset successfully." });
  } catch (error) {
    console.error('Error resetting PIN:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});

// --- Team Management APIs ---
app.get('/api/team-stats', auth, async (req, res) => {
  const [[user]] = await pool.query('SELECT referral_code FROM users WHERE id=?', [req.user.id]);
  
  // Get direct referrals (A level)
  const [directReferrals] = await pool.query(`
    SELECT id, phone, bond_level, balance, registered_at 
    FROM users WHERE referred_by=?
  `, [user.referral_code]);
  
  // Get indirect referrals (B level)
  const [indirectReferrals] = await pool.query(`
    SELECT u.id, u.phone, u.bond_level, u.balance, u.registered_at
    FROM users u
    JOIN users direct ON u.referred_by = direct.referral_code
    WHERE direct.referred_by = ?
  `, [user.referral_code]);
  
  // Calculate earnings from team
  const [teamEarnings] = await pool.query(`
    SELECT SUM(t.reward) as total_earnings
    FROM user_tasks ut
    JOIN tasks t ON ut.task_id = t.id
    JOIN users u ON ut.user_id = u.id
    WHERE (u.referred_by = ? OR u.referred_by IN (
      SELECT referral_code FROM users WHERE referred_by = ?
    ))
  `, [user.referral_code, user.referral_code]);
  
  res.json({
    directReferrals: directReferrals.length,
    indirectReferrals: indirectReferrals.length,
    totalTeamMembers: directReferrals.length + indirectReferrals.length,
    teamEarnings: teamEarnings[0].total_earnings || 0,
    directReferralsList: directReferrals,
    indirectReferralsList: indirectReferrals
  });
});

// --- Admin APIs ---
app.get('/api/admin/users', auth, admin, async (req, res) => {
  const [users] = await pool.query('SELECT id, phone, bond_level, balance, referral_code, referred_by, is_admin FROM users');
  res.json(users);
});
app.get('/api/admin/payments', auth, admin, async (req, res) => {
  const [payments] = await pool.query('SELECT * FROM payments');
  res.json(payments);
});
app.get('/api/admin/withdrawals', auth, admin, async (req, res) => {
  const [withdrawals] = await pool.query('SELECT * FROM withdrawals');
  res.json(withdrawals);
});
app.post('/api/admin/approve-withdrawal', auth, admin, async (req, res) => {
  const { withdrawal_id } = req.body;
  await pool.query('UPDATE withdrawals SET status="approved", processed_at=NOW() WHERE id=?', [withdrawal_id]);
  pushNotification(req.user.id, "Withdrawal approved.", "success");
  res.json({ success: true });
});
app.post('/api/admin/reject-withdrawal', auth, admin, async (req, res) => {
  const { withdrawal_id } = req.body;
  await pool.query('UPDATE withdrawals SET status="rejected", processed_at=NOW() WHERE id=?', [withdrawal_id]);
  pushNotification(req.user.id, "Withdrawal rejected.", "error");
  res.json({ success: true });
});

// --- Initialize Database with Sample Data ---
app.post('/api/init-db', async (req, res) => {
  try {
    // Insert sample tasks
    const sampleTasks = [
      { title: "Watch Huawei P Series Ad", description: "Watch the creative ad for Huawei P Series", bond_level_required: 1, reward: 16.0, type: "ad" },
      { title: "Watch Fanta Beverage Ad", description: "Watch the colorful Fanta advertisement", bond_level_required: 1, reward: 16.0, type: "ad" },
      { title: "Watch Adidas Sports Gear", description: "Watch Adidas inspiring athletes ad", bond_level_required: 1, reward: 16.0, type: "ad" },
      { title: "Watch Sprite Refresh Ad", description: "Watch Sprite's refreshing advertisement", bond_level_required: 1, reward: 16.0, type: "ad" },
      { title: "Watch Nike Running Ad", description: "Watch Nike's running gear advertisement", bond_level_required: 2, reward: 25.0, type: "ad" },
      { title: "Watch Coca-Cola Happiness", description: "Watch Coca-Cola's happiness campaign", bond_level_required: 2, reward: 25.0, type: "ad" },
      { title: "Watch Samsung Galaxy Ad", description: "Watch Samsung Galaxy smartphone ad", bond_level_required: 3, reward: 40.0, type: "ad" },
      { title: "Watch Apple iPhone Ad", description: "Watch Apple iPhone advertisement", bond_level_required: 3, reward: 40.0, type: "ad" },
      { title: "Watch Mercedes Benz Ad", description: "Watch Mercedes luxury car advertisement", bond_level_required: 4, reward: 68.0, type: "ad" },
      { title: "Watch BMW Performance Ad", description: "Watch BMW performance car advertisement", bond_level_required: 4, reward: 68.0, type: "ad" }
    ];
    
    for (const task of sampleTasks) {
      await pool.query(
        'INSERT INTO tasks (title, description, bond_level_required, reward, type) VALUES (?, ?, ?, ?, ?)',
        [task.title, task.description, task.bond_level_required, task.reward, task.type]
      );
    }
    
    res.json({ success: true, message: "Database initialized with sample data" });
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize database", details: error.message });
  }
});

// --- Upgrade Flow API ---
app.post('/api/upgrade-to-level', auth, async (req, res) => {
  // This endpoint redirects users to the level selection page
  res.json({ 
    success: true, 
    redirectTo: '/level.html',
    message: 'Please select your desired level to upgrade'
  });
});

// --- Temporary Worker APIs ---
app.post('/api/register-temp-worker', async (req, res) => {
  const { phone, password, name, adminCode } = req.body;
  
  try {
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Verify admin code for temporary worker registration (additional security)
    if (!adminCode || adminCode !== 'TEMP_WORKER_2024') {
      return res.status(403).json({ error: 'Invalid admin code for temporary worker registration' });
    }

    // Create temporary worker
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (phone, password, name, is_temporary_worker, temp_worker_start_date, bond_level, balance) VALUES (?, ?, ?, TRUE, CURDATE(), 0, 0.00)',
      [phone, hashedPassword, name]
    );

    // Create temporary worker record
    await pool.query(
      'INSERT INTO temporary_worker (user_id, start_date) VALUES (?, CURDATE())',
      [result.insertId]
    );

    const token = jwt.sign({ id: result.insertId, phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      message: 'Temporary worker registered successfully! Complete 5 tasks in 5 days to upgrade to Level 1.',
      isTempWorker: true
    });
  } catch (error) {
    console.error('Error registering temp worker:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/temp-worker-status', auth, async (req, res) => {
  try {
    const [user] = await pool.query(
      'SELECT is_temporary_worker, temp_worker_start_date, temp_worker_days_completed, bond_level FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user[0];
    
    if (!userData.is_temporary_worker) {
      return res.json({ isTempWorker: false });
    }

    // Calculate days since start (trial days count regardless of task completion)
    const startDate = new Date(userData.temp_worker_start_date);
    const today = new Date();
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 5 - daysSinceStart);

    // Get total tasks completed
    const [totalTasks] = await pool.query(`
      SELECT COUNT(*) as total_completed
      FROM user_tasks 
      WHERE user_id=? AND is_complete=1
    `, [req.user.id]);
    
    const totalCompleted = totalTasks[0].total_completed || 0;
    const tasksRemaining = Math.max(0, 5 - totalCompleted);

    // Check if trial period is over (either 5 tasks or 5 days)
    const isExpired = daysSinceStart >= 5;
    const tasksCompleted = totalCompleted >= 5;
    const shouldUpgrade = isExpired || tasksCompleted;

    res.json({
      isTempWorker: true,
      tasksCompleted: totalCompleted,
      tasksRemaining: tasksRemaining,
      daysCompleted: daysSinceStart,
      daysRemaining: daysRemaining,
      isExpired: isExpired,
      tasksCompleted: tasksCompleted,
      shouldUpgrade: shouldUpgrade,
      startDate: userData.temp_worker_start_date,
      currentLevel: userData.bond_level
    });
  } catch (error) {
    console.error('Error getting temp worker status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

app.post('/api/upgrade-temp-worker', auth, async (req, res) => {
  try {
    const [user] = await pool.query(
      'SELECT is_temporary_worker, bond_level FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user.length || !user[0].is_temporary_worker) {
      return res.status(400).json({ error: 'Not a temporary worker' });
    }

    // Upgrade to level 1
    await pool.query(
      'UPDATE users SET is_temporary_worker = FALSE, bond_level = 1, balance = 100.00 WHERE id = ?',
      [req.user.id]
    );

    // Update temporary worker status
    await pool.query(
      'UPDATE temporary_worker SET status = "upgraded" WHERE user_id = ?',
      [req.user.id]
    );

    res.json({ 
      message: 'Successfully upgraded to Level 1!',
      newLevel: 1,
      bonusBalance: 100.00
    });
  } catch (error) {
    console.error('Error upgrading temp worker:', error);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// --- Check binding status ---
app.get('/api/binding-status', auth, async (req, res) => {
  try {
    const [user] = await pool.query(
      'SELECT full_name, bank_type, account_number, withdrawal_pin FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    const isBound = userData.full_name && userData.bank_type && userData.account_number && userData.withdrawal_pin;
    
    res.json({
      isBound: isBound,
      fullName: userData.full_name,
      bankType: userData.bank_type,
      accountNumber: userData.account_number,
      hasPin: !!userData.withdrawal_pin
    });
  } catch (error) {
    console.error('Error checking binding status:', error);
    res.status(500).json({ error: 'Failed to check binding status' });
  }
});

// --- Notifications API ---
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      'SELECT id, message, type, id as created_at FROM notifications WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.delete('/api/notifications/:id', auth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Verify the notification belongs to the user
    const [notification] = await pool.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );
    
    if (!notification.length) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Delete the notification
    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

app.delete('/api/notifications/clear-all', auth, async (req, res) => {
  try {
    // Delete all notifications for the user
    await pool.query(
      'DELETE FROM notifications WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// --- Casino System ---
app.post('/api/casino/spin', auth, async (req, res) => {
  try {
    const { prize } = req.body;

    // Fetch user's last spin result
    const [userRows] = await pool.query('SELECT last_spin_result FROM users WHERE id = ?', [req.user.id]);
    let lastSpin = null;
    if (userRows.length) {
      lastSpin = userRows[0].last_spin_result;
    }

    // If last spin was WIN, force this spin to be LOSE
    if (lastSpin === 'WIN') {
      await pool.query('UPDATE users SET last_spin_result = ? WHERE id = ?', ['LOSE', req.user.id]);
      return res.json({
        success: true,
        prize: 'LOSE',
        message: 'Better luck next time! (Alternation rule: cannot win twice in a row)'
      });
    }

    // If prize is LOSE, update last_spin_result and return
    if (!prize || prize === 'LOSE') {
      await pool.query('UPDATE users SET last_spin_result = ? WHERE id = ?', ['LOSE', req.user.id]);
      return res.json({
        success: true,
        prize: 'LOSE',
        message: 'Better luck next time!'
      });
    }

    // If last spin was LOSE or NULL, allow win and update last_spin_result
    // Convert prize to numeric value
    let prizeValue = 0;
    switch (prize) {
      case 'JACKPOT':
        prizeValue = 10000;
        break;
      case '1000':
        prizeValue = 1000;
        break;
      case '500':
        prizeValue = 500;
        break;
      case '200':
        prizeValue = 200;
        break;
      case '100':
        prizeValue = 100;
        break;
      case '50':
        prizeValue = 50;
        break;
      case '25':
        prizeValue = 25;
        break;
      case '10':
        prizeValue = 10;
        break;
      default:
        prizeValue = 0;
    }

    // Update user balance
    await pool.query(
      'UPDATE users SET balance = balance + ?, last_spin_result = ? WHERE id = ?',
      [prizeValue, 'WIN', req.user.id]
    );

    // Record the win in casino_wins table
    await pool.query(
      'INSERT INTO casino_wins (user_id, prize, prize_value, win_date) VALUES (?, ?, ?, NOW())',
      [req.user.id, prize, prizeValue]
    );

    // Send notification
    await pushNotification(req.user.id, `Congratulations! You won ${prize} in the casino!`, 'success');

    // Get updated user info
    const [user] = await pool.query(
      'SELECT balance, name FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      prize: prize,
      prizeValue: prizeValue,
      newBalance: user[0].balance,
      message: `Congratulations! You won ${prize}!`
    });

  } catch (error) {
    console.error('Error processing casino win:', error);
    res.status(500).json({ error: 'Failed to process win' });
  }
});

app.get('/api/casino/wins', auth, async (req, res) => {
  try {
    const [wins] = await pool.query(
      'SELECT prize, prize_value, win_date FROM casino_wins WHERE user_id = ? ORDER BY win_date DESC LIMIT 10',
      [req.user.id]
    );
    
    res.json(wins);
  } catch (error) {
    console.error('Error fetching casino wins:', error);
    res.status(500).json({ error: 'Failed to fetch wins' });
  }
});

app.get('/api/casino/recent-winners', async (req, res) => {
  try {
    const [winners] = await pool.query(`
      SELECT u.name, cw.prize, cw.win_date 
      FROM casino_wins cw 
      JOIN users u ON cw.user_id = u.id 
      WHERE cw.prize != 'LOSE' 
      ORDER BY cw.win_date DESC 
      LIMIT 20
    `);
    
    res.json(winners);
  } catch (error) {
    console.error('Error fetching recent winners:', error);
    res.status(500).json({ error: 'Failed to fetch recent winners' });
  }
});

app.post('/api/casino/purchase-trials', auth, async (req, res) => {
  try {
    const { trials, cost } = req.body;
    
    if (!trials || !cost) {
      return res.status(400).json({ error: 'Missing trials or cost information' });
    }
    
    // Get user's current balance
    const [user] = await pool.query(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentBalance = parseFloat(user[0].balance || 0);
    
    // Check if user has enough balance
    if (currentBalance < cost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct the cost from user's balance
    await pool.query(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [cost, req.user.id]
    );
    
    // Record the purchase in casino_purchases table
    await pool.query(
      'INSERT INTO casino_purchases (user_id, trials_purchased, cost, purchase_date) VALUES (?, ?, ?, NOW())',
      [req.user.id, trials, cost]
    );
    
    // Send notification
    await pushNotification(req.user.id, `Successfully purchased ${trials} lottery trials for ₦${cost}`, 'success');
    
    // Get updated balance
    const [updatedUser] = await pool.query(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id]
    );
    
    res.json({ 
      success: true, 
      message: `Successfully purchased ${trials} trials`,
      newBalance: updatedUser[0].balance,
      trialsPurchased: trials
    });
    
  } catch (error) {
    console.error('Error processing trial purchase:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

// Get all temporary workers invited by the current user
app.get('/api/my-temporary-workers', auth, async (req, res) => {
  try {
    // Get the current user's referral code
    const [inviterRows] = await pool.query('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
    if (!inviterRows.length) return res.status(404).json({ error: 'User not found' });
    const inviterCode = inviterRows[0].referral_code;

    // Get all temporary workers referred by this user
    const [workers] = await pool.query(
       `SELECT u.id, u.phone, u.name, u.is_temporary_worker, u.temp_worker_start_date, 
       DATEDIFF(CURDATE(), u.temp_worker_start_date) as days_joined
       FROM users u 
       WHERE u.referred_by = ? AND u.is_temporary_worker = TRUE
       ORDER BY u.temp_worker_start_date DESC`,
      [inviterCode]
    );

    res.json(workers);
  } catch (error) {
    console.error('Error fetching temporary workers:', error);
    res.status(500).json({ error: 'Failed to fetch temporary workers' });
  }
});

// Dismiss temporary worker
app.post('/api/dismiss-temporary-worker', auth, async (req, res) => {
  try {
    const { workerId } = req.body;
    
    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    // Check if the worker exists and is referred by the current user
    const [workerRows] = await pool.query(
      `SELECT u.id, u.is_temporary_worker, u.referred_by 
       FROM users u 
       WHERE u.id = ? AND u.referred_by = (SELECT referral_code FROM users WHERE id = ?)`,
      [workerId, req.user.id]
    );

    if (!workerRows.length) {
      return res.status(404).json({ error: 'Worker not found or not authorized' });
    }

    const worker = workerRows[0];

    if (worker.is_temporary_worker) {
      // Delete the temporary worker
      await pool.query('DELETE FROM users WHERE id = ?', [workerId]);
      await pushNotification(req.user.id, 'Temporary worker dismissed successfully', 'success');
    } else {
      // Worker has been upgraded, just update the status
      await pool.query(
        'UPDATE temporary_worker SET status = "dismissed" WHERE user_id = ?',
        [workerId]
      );
      await pushNotification(req.user.id, 'Worker status updated successfully', 'success');
    }

    res.json({ success: true, message: 'Worker dismissed successfully' });
  } catch (error) {
    console.error('Error dismissing temporary worker:', error);
    res.status(500).json({ error: 'Failed to dismiss worker' });
  }
});

// --- KCB Transfer APIs ---

// Get KCB transfer configuration (admin only)
app.get('/api/admin/kcb-config', auth, admin, async (req, res) => {
  try {
    res.json({
      success: true,
      config: KCB_CONFIG
    });
  } catch (error) {
    console.error('Error getting KCB config:', error);
    res.status(500).json({ error: 'Failed to get KCB configuration' });
  }
});

// Update KCB transfer configuration (admin only)
app.post('/api/admin/kcb-config', auth, admin, async (req, res) => {
  try {
    const { 
      enabled, 
      accountName, 
      accountNumber, 
      transferPercentage, 
      minimumTransferAmount, 
      maximumTransferAmount 
    } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled must be a boolean' });
    }

    if (accountName && typeof accountName !== 'string') {
      return res.status(400).json({ error: 'Account name must be a string' });
    }

    if (accountNumber && typeof accountNumber !== 'string') {
      return res.status(400).json({ error: 'Account number must be a string' });
    }

    if (transferPercentage && (transferPercentage < 0 || transferPercentage > 100)) {
      return res.status(400).json({ error: 'Transfer percentage must be between 0 and 100' });
    }

    if (minimumTransferAmount && minimumTransferAmount < 0) {
      return res.status(400).json({ error: 'Minimum transfer amount must be positive' });
    }

    if (maximumTransferAmount && maximumTransferAmount < 0) {
      return res.status(400).json({ error: 'Maximum transfer amount must be positive' });
    }

    // Update configuration
    KCB_CONFIG = {
      ...KCB_CONFIG,
      enabled: enabled !== undefined ? enabled : KCB_CONFIG.enabled,
      accountName: accountName || KCB_CONFIG.accountName,
      accountNumber: accountNumber || KCB_CONFIG.accountNumber,
      transferPercentage: transferPercentage || KCB_CONFIG.transferPercentage,
      minimumTransferAmount: minimumTransferAmount || KCB_CONFIG.minimumTransferAmount,
      maximumTransferAmount: maximumTransferAmount || KCB_CONFIG.maximumTransferAmount
    };

    console.log('✅ KCB configuration updated:', KCB_CONFIG);

    res.json({
      success: true,
      message: 'KCB configuration updated successfully',
      config: KCB_CONFIG
    });

  } catch (error) {
    console.error('Error updating KCB config:', error);
    res.status(500).json({ error: 'Failed to update KCB configuration' });
  }
});

// Get KCB transfer history (admin only)
app.get('/api/admin/kcb-transfers', auth, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT kt.*, u.name as user_name, u.phone as user_phone
      FROM kcb_transfers kt
      LEFT JOIN users u ON kt.user_id = u.id
    `;

    const params = [];

    if (status) {
      query += ' WHERE kt.status = ?';
      params.push(status);
    }

    query += ' ORDER BY kt.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [transfers] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM kcb_transfers';
    if (status) {
      countQuery += ' WHERE status = ?';
    }
    const [countResult] = await pool.query(countQuery, status ? [status] : []);
    const total = countResult[0].total;

    res.json({
      success: true,
      transfers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error getting KCB transfers:', error);
    res.status(500).json({ error: 'Failed to get KCB transfer history' });
  }
});

// Get user's KCB transfer history
app.get('/api/kcb-transfers', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [transfers] = await pool.query(
      `SELECT * FROM kcb_transfers 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    // Get total count for this user
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM kcb_transfers WHERE user_id = ?',
      [req.user.id]
    );
    const total = countResult[0].total;

    res.json({
      success: true,
      transfers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error getting user KCB transfers:', error);
    res.status(500).json({ error: 'Failed to get KCB transfer history' });
  }
});

// Test KCB transfer (admin only)
app.post('/api/admin/test-kcb-transfer', auth, admin, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: 'User ID and amount are required' });
    }

    // Test the KCB transfer function
    await processKcbTransfer(userId, parseFloat(amount), 'TEST_' + Date.now());

    res.json({
      success: true,
      message: 'KCB transfer test completed'
    });

  } catch (error) {
    console.error('Error testing KCB transfer:', error);
    res.status(500).json({ error: 'Failed to test KCB transfer' });
  }
});

// Test M-PESA STK Push (admin only)
app.post('/api/admin/test-stk-push', auth, admin, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    console.log('🧪 Testing STK Push with amount:', amount);

    // Test STK Push with test phone number
    const testPhone = '254708374149';
    const result = await sendStkPush({
      phone: testPhone,
      amount: parseFloat(amount),
      accountRef: 'TEST_PAYMENT',
      desc: 'Test Payment'
    });

    res.json({
      success: true,
      message: 'STK Push test completed',
      result: result,
      testPhone: testPhone,
      amount: amount
    });

  } catch (error) {
    console.error('Error testing STK Push:', error);
    res.status(500).json({ 
      error: 'Failed to test STK Push',
      details: error.message,
      note: 'This is expected in sandbox environment'
    });
  }
});

// Get M-PESA configuration (admin only)
app.get('/api/admin/mpesa-config', auth, admin, async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        environment: DARAJA.environment,
        shortCode: DARAJA.shortCode,
        callbackUrl: DARAJA.callbackUrl,
        baseUrl: DARAJA.environment === 'production' 
          ? 'https://api.safaricom.co.ke' 
          : 'https://sandbox.safaricom.co.ke'
      }
    });
  } catch (error) {
    console.error('Error getting M-PESA config:', error);
    res.status(500).json({ error: 'Failed to get M-PESA configuration' });
  }
});

// Investment API - Deduct from wallet and create investment record
app.post('/api/invest', auth, async (req, res) => {
  try {
    console.log('💰 Investment request received:', req.body);
    console.log('👤 User ID:', req.user.id);
    
    const { amount, fundName, walletType } = req.body;
    const userId = req.user.id;

    if (!amount || !fundName || !walletType) {
      return res.status(400).json({ error: 'Amount, fund name, and wallet type are required' });
    }

    const investmentAmount = parseFloat(amount);
    if (isNaN(investmentAmount) || investmentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid investment amount' });
    }

    // Define fund details (ROI and duration) - Updated with new rates
    const fundDetails = {
      'UAI Starter Fund': { roi: 2.3, duration: 10 },
      'UAI Micro Fund': { roi: 2.5, duration: 15 },
      'Agriculture Fund': { roi: 2.7, duration: 20 },
      'Tech Growth Fund': { roi: 2.8, duration: 25 },
      'Crypto Mining Fund': { roi: 3.5, duration: 45 },
      'Real Estate Fund': { roi: 3.2, duration: 60 },
      'Wells Fargo': { roi: 2.9, duration: 30 },
      'Citibank': { roi: 3.0, duration: 40 },
      'Gold Investment Fund': { roi: 3.8, duration: 90 },
      'Diamond Elite Fund': { roi: 4.5, duration: 120 }
    };

    const fundInfo = fundDetails[fundName];
    if (!fundInfo) {
      return res.status(400).json({ error: 'Invalid fund name' });
    }

    // Get user's current wallet balance
    const [userRows] = await pool.query(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBalance = parseFloat(userRows[0].balance || 0);

    // Check if user has sufficient balance
    if (currentBalance < investmentAmount) {
      return res.status(400).json({ 
        error: 'Insufficient funds in wallet',
        currentBalance: currentBalance,
        requiredAmount: investmentAmount
      });
    }



    // Start transaction for data consistency
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deduct amount from wallet
      const newBalance = currentBalance - investmentAmount;
      await connection.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);

      // Create investment record with new table structure
      // Calculate end_date based on start_date and duration
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + fundInfo.duration);
      
      await connection.query(
        'INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, wallet_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, "active")',
        [userId, fundName, investmentAmount, fundInfo.roi, fundInfo.duration, walletType, endDate]
      );

      // Send notification to user (with error handling)
      try {
        await pushNotification(userId, `Investment of KES ${investmentAmount.toFixed(2)} in ${fundName} has been processed successfully. Expected return: KES ${(investmentAmount * (1 + (fundInfo.roi / 100) * fundInfo.duration)).toFixed(2)}`, 'success');
      } catch (notificationError) {
        console.log('⚠️ Notification failed, but investment was successful:', notificationError.message);
      }

      await connection.commit();
      console.log('✅ Investment transaction committed successfully');

      const response = {
        success: true,
        message: 'Investment processed successfully',
        newBalance: newBalance,
        investment: {
          fundName,
          amount: investmentAmount,
          roi: fundInfo.roi,
          duration: fundInfo.duration,
          expectedReturn: investmentAmount * (1 + (fundInfo.roi / 100) * fundInfo.duration)
        }
      };

      console.log('📤 Sending success response:', response);
      res.json(response);

    } catch (error) {
      await connection.rollback();
      console.error('❌ Investment transaction failed:', error.message);
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error processing investment:', error);
    res.status(500).json({ error: 'Failed to process investment: ' + error.message });
  }
});

// Get user's investment history
app.get('/api/investments', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [investmentRows] = await pool.query(`
      SELECT 
        id,
        fund_name,
        amount,
        roi_percentage,
        duration_days,
        start_date,
        end_date,
        wallet_type,
        status,
        created_at,
        total_earned,
        CASE 
          WHEN status = 'completed' THEN amount + (amount * (roi_percentage / 100) * duration_days)
          WHEN end_date <= NOW() THEN amount + (amount * (roi_percentage / 100) * duration_days)
          ELSE amount
        END as current_value,
        CASE 
          WHEN status = 'completed' THEN (amount * (roi_percentage / 100) * duration_days)
          WHEN end_date <= NOW() THEN (amount * (roi_percentage / 100) * duration_days)
          ELSE 0
        END as earned_interest
      FROM investments 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      investments: investmentRows
    });

  } catch (error) {
    console.error('Error getting investment history:', error);
    res.status(500).json({ error: 'Failed to get investment history' });
  }
});

// Process investment payouts (admin only)
app.post('/api/process-payouts', auth, admin, async (req, res) => {
  try {
    await processInvestmentPayouts();
    res.json({ success: true, message: 'Payout processing completed' });
  } catch (error) {
    console.error('Error processing payouts:', error);
    res.status(500).json({ error: 'Failed to process payouts' });
  }
});

// Get investment statistics
app.get('/api/investment-stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getInvestmentStats(userId);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting investment stats:', error);
    res.status(500).json({ error: 'Failed to get investment statistics' });
  }
});

// Serve static files from public directory
app.use(express.static('public'));

// Start server on available port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Process investment payouts on server startup
  console.log('🔄 Processing investment payouts on startup...');
  processInvestmentPayouts().then(() => {
    console.log('✅ Initial payout processing completed');
  }).catch(error => {
    console.error('❌ Error in initial payout processing:', error);
  });
});

// Set up automatic payout processing every 15 minutes for better responsiveness
setInterval(() => {
  console.log('🔄 Running scheduled payout processing...');
  processInvestmentPayouts().then(() => {
    console.log('✅ Scheduled payout processing completed');
  }).catch(error => {
    console.error('❌ Error in scheduled payout processing:', error);
  });
}, 15 * 60 * 1000); // Run every 15 minutes