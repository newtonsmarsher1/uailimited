const express = require('express');
const pool = require('../config/database');
const simpleAuth = require('../middleware/auth-simple');
const pushNotification = require('../services/notificationService');

const router = express.Router();

// Get random HR manager for recharge method 1
router.get('/random-hr-manager', async (req, res) => {
  try {
    // Get a random Financial Manager from the admin_users table with complete details
    const [hrManagers] = await pool.query(`
      SELECT id, name, mobile as phone, bank_name, account_number, branch, swift_code, reference_code, is_ceo_added
      FROM admin_users
      WHERE role = 'Financial Manager' AND is_active = 1 AND name IS NOT NULL AND mobile IS NOT NULL
      ORDER BY RAND()
      LIMIT 1
    `);

    if (hrManagers.length > 0) {
      const hrManager = hrManagers[0];
      res.json({
        success: true,
        data: {
          id: hrManager.id,
          name: hrManager.name,
          phone: hrManager.phone,
          bankName: hrManager.bank_name,
          accountNumber: hrManager.account_number,
          branch: hrManager.branch,
          swiftCode: hrManager.swift_code,
          referenceCode: hrManager.reference_code,
          isCeoAdded: hrManager.is_ceo_added
        }
      });
    } else {
      res.json({
        success: false,
        message: 'No HR managers available'
      });
    }
  } catch (error) {
    console.error('Error fetching random HR manager:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching HR manager details'
    });
  }
});

// Get payment status
router.get('/status/:transactionNumber', simpleAuth, async (req, res) => {
  try {
    const { transactionNumber } = req.params;
    
    const [payments] = await pool.query(`
      SELECT status, verification_message, processed_at
      FROM payments
      WHERE transaction_number = ? AND user_id = ?
    `, [transactionNumber, req.user.id]);

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];
    res.json({
      status: payment.status,
      reason: payment.verification_message,
      processedAt: payment.processed_at
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

// Simple payment status for testing
router.get('/test-payment', (req, res) => {
  res.json({ status: "pending", message: "Pay to mpesa 0114710035 and wait for confirmation." });
});

// Withdrawal request
router.post('/withdraw', simpleAuth, async (req, res) => {
  try {
    console.log('🔍 Withdrawal request received:', {
      userId: req.user.id,
      body: req.body
    });

    const { amount, pin } = req.body;
    
    if (!amount || !pin) {
      console.log('❌ Missing required fields:', { amount, pin });
      return res.status(400).json({ error: 'Amount and PIN are required' });
    }
    
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      console.log('❌ Invalid PIN format:', pin);
      return res.status(400).json({ error: 'PIN must be 4 digits' });
    }
    
    // Check if user has bound withdrawal details
    const [user] = await pool.query(
      'SELECT wallet_balance, withdrawal_pin, pin_attempts, pin_locked_until, full_name, bank_type, account_number FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user.length) {
      console.log('❌ User not found:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    console.log('📊 User data:', {
      wallet_balance: userData.wallet_balance,
      has_withdrawal_pin: !!userData.withdrawal_pin,
      has_binding: !!(userData.full_name && userData.bank_type && userData.account_number)
    });
    
    // Check if PIN is locked
    if (userData.pin_locked_until && new Date() < new Date(userData.pin_locked_until)) {
      const lockTime = new Date(userData.pin_locked_until);
      const remainingMinutes = Math.ceil((lockTime - new Date()) / (1000 * 60));
      console.log('❌ PIN is locked, remaining minutes:', remainingMinutes);
      return res.status(400).json({ 
        error: `PIN is locked. Please contact HR Manager or try again in ${remainingMinutes} minutes.` 
      });
    }
    
    // Check if user has bound withdrawal details
    if (!userData.full_name || !userData.bank_type || !userData.account_number) {
      console.log('❌ User has not bound withdrawal details');
      return res.status(400).json({ 
        error: 'Please bind your withdrawal details first. Go to Bind Withdrawal Details.' 
      });
    }
    
    // Check if user has withdrawal PIN set
    if (!userData.withdrawal_pin) {
      console.log('❌ User has not set withdrawal PIN');
      return res.status(400).json({ 
        error: 'Please set your withdrawal PIN first. Go to Bind Withdrawal Details.'
      });
    }
    
    // Validate PIN
    const bcrypt = require('bcrypt');
    const isPinValid = await bcrypt.compare(pin, userData.withdrawal_pin);
    console.log('🔐 PIN validation result:', isPinValid);
    
    if (!isPinValid) {
      // Increment PIN attempts
      const newAttempts = (userData.pin_attempts || 0) + 1;
      const lockUntil = newAttempts >= 3 ? new Date(Date.now() + 30 * 60 * 1000) : null; // Lock for 30 minutes after 3 attempts
      
      await pool.query(
        'UPDATE users SET pin_attempts = ?, pin_locked_until = ? WHERE id = ?',
        [newAttempts, lockUntil, req.user.id]
      );
      
      console.log('❌ Invalid PIN, attempt:', newAttempts);
      
      if (newAttempts >= 3) {
        return res.status(400).json({ 
          error: 'Too many incorrect PIN attempts. PIN locked for 30 minutes.' 
        });
      } else {
        return res.status(400).json({ 
          error: `Invalid PIN. ${3 - newAttempts} attempts remaining.` 
        });
      }
    }
    
    // Reset PIN attempts on successful validation
    await pool.query(
      'UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = ?',
      [req.user.id]
    );
    
    // Check withdrawal restrictions
    console.log('🔍 Checking withdrawal restrictions...');
    
    // 1. Check if user has already withdrawn today
    const today = new Date().toISOString().split('T')[0];
    const [todayWithdrawals] = await pool.query(
      'SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ? AND DATE(requested_at) = ?',
      [req.user.id, today]
    );
    
    if (todayWithdrawals[0].count > 0) {
      console.log('❌ User has already withdrawn today');
      return res.status(400).json({ 
        error: 'You can only withdraw once per day. Please try again tomorrow.' 
      });
    }
    
    // 2. Check current time (8:00 AM to 4:00 PM only)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // Convert to minutes
    const startTime = 8 * 60; // 8:00 AM in minutes
    const endTime = 16 * 60; // 4:00 PM in minutes
    
    if (currentTime < startTime || currentTime >= endTime) {
      console.log('❌ Withdrawal outside allowed hours:', currentHour + ':' + currentMinute);
      return res.status(400).json({ 
        error: 'Withdrawals are only allowed between 8:00 AM and 4:00 PM. Current time: ' + 
               now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      });
    }
    
    // 3. Check if it's Sunday
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0) { // 0 = Sunday
      console.log('❌ Withdrawal attempted on Sunday');
      return res.status(400).json({ 
        error: 'Withdrawals are not allowed on Sundays. Please try again on Monday.' 
      });
    }
    
    // 4. Check if it's the second Tuesday of the month (auditing day)
    const isSecondTuesday = (() => {
      const date = now.getDate();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
      const secondTuesdayDate = (2 - firstDayOfMonth + 7) % 7 + 8; // Calculate second Tuesday
      return dayOfWeek === 2 && date === secondTuesdayDate; // Tuesday = 2
    })();
    
    if (isSecondTuesday) {
      console.log('❌ Withdrawal attempted on second Tuesday');
      return res.status(400).json({ 
        error: 'Withdrawals are not allowed on the second Tuesday of every month (auditing day). Please try again tomorrow.'
      });
    }
    
    // 5. Check for public holidays (Kenya public holidays 2024-2025)
    const publicHolidays = [
      '2024-01-01', // New Year's Day
      '2024-01-02', // New Year Holiday
      '2024-04-01', // Easter Monday
      '2024-05-01', // Labour Day
      '2024-06-01', // Madaraka Day
      '2024-06-16', // Eid al-Adha
      '2024-10-10', // Moi Day
      '2024-10-20', // Mashujaa Day
      '2024-12-12', // Jamhuri Day
      '2024-12-25', // Christmas Day
      '2024-12-26', // Boxing Day
      '2025-01-01', // New Year's Day
      '2025-04-21', // Easter Monday
      '2025-05-01', // Labour Day
      '2025-06-01', // Madaraka Day
      '2025-10-10', // Moi Day
      '2025-10-20', // Mashujaa Day
      '2025-12-12', // Jamhuri Day
      '2025-12-25', // Christmas Day
      '2025-12-26'  // Boxing Day
    ];
    
    const todayDate = now.toISOString().split('T')[0];
    if (publicHolidays.includes(todayDate)) {
      console.log('❌ Withdrawal attempted on public holiday:', todayDate);
      return res.status(400).json({ 
        error: 'Withdrawals are not allowed on public holidays. Please try again tomorrow.' 
      });
    }
    
    // Referral requirements removed: any user can withdraw regardless of referrals
    console.log('✅ Referral requirement skipped');
    
    // Check balance
    if (userData.wallet_balance < amount) {
      console.log('❌ Insufficient balance:', userData.wallet_balance, '<', amount);
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    console.log('✅ All validations passed, processing withdrawal...');
    
    // Calculate 90% for admin display (10% tax)
    const adminDisplayAmount = Math.round(amount * 0.9 * 100) / 100; // Round to 2 decimal places
    const taxAmount = Math.round((amount - adminDisplayAmount) * 100) / 100;
    
    console.log(`💰 Withdrawal: User requests ${amount}, Admin sees ${adminDisplayAmount}, Tax ${taxAmount}`);
    
    // Process withdrawal - deduct full amount from wallet and update total_withdrawn with full amount
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance - ?, total_withdrawn = total_withdrawn + ? WHERE id = ?', 
      [amount, amount, req.user.id]
    );
    
    console.log('✅ Balance deducted and total_withdrawn updated with full amount');
    
    // Insert into withdrawals table with full amount (user receives full amount)
    const [withdrawalResult] = await pool.query(
      'INSERT INTO withdrawals (user_id, amount, status, requested_at) VALUES (?, ?, "pending", NOW())',
      [req.user.id, amount]
    );
    
    console.log('✅ Withdrawal record created with full amount, ID:', withdrawalResult.insertId);
    
    // Also insert into payments table for admin portal visibility with admin display amount (90%)
    await pool.query(
      'INSERT INTO payments (user_id, amount, status, payment_method, description, created_at) VALUES (?, ?, "pending", "withdrawal", ?, NOW())',
      [req.user.id, adminDisplayAmount, `Withdrawal request for KES ${amount} (admin sees KES ${adminDisplayAmount} after 10% tax)`]
    );
    
    console.log('✅ Payment record created for admin visibility with admin display amount');
    
    pushNotification(req.user.id, `Withdrawal request for KES ${amount} submitted. Await admin approval.`, "info");
    
    // Notify all admins about the withdrawal request
    const [admins] = await pool.query(
      'SELECT id FROM admin_users WHERE role IN ("Admin", "CEO") AND is_active = 1'
    );
    
    admins.forEach(admin => {
      pushNotification(admin.id, `New withdrawal request: KES ${adminDisplayAmount} from user ${req.user.id}`, "withdrawal_request");
    });
    
    console.log('✅ Notifications sent with admin display amount');
    
    res.json({ status: "pending", message: "Withdrawal requested. Await admin approval.", userAmount: amount, adminAmount: adminDisplayAmount });
    
  } catch (error) {
    console.error('❌ Error processing withdrawal:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

module.exports = router;

