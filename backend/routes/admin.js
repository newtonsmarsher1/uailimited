const express = require('express');
const pool = require('../config/database.js');
const { adminAuth } = require('../middleware/admin-auth.js');

const router = express.Router();

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  const [users] = await pool.query('SELECT id, phone, level, wallet_balance, referral_code, referred_by, is_admin FROM users');
  res.json(users);
});

// Get all payments
router.get('/payments', adminAuth, async (req, res) => {
  const [payments] = await pool.query('SELECT * FROM payments');
  res.json(payments);
});

// Get all withdrawals
router.get('/withdrawals', adminAuth, async (req, res) => {
  const [withdrawals] = await pool.query('SELECT * FROM withdrawals');
  res.json(withdrawals);
});

// Approve withdrawal
router.post('/approve-withdrawal', adminAuth, async (req, res) => {
  const { withdrawal_id } = req.body;
  await pool.query('UPDATE withdrawals SET status="approved", processed_at=NOW() WHERE id=?', [withdrawal_id]);
  res.json({ success: true });
});

// Reject withdrawal - refund EXACT amount deducted and ensure idempotency
router.post('/reject-withdrawal', adminAuth, async (req, res) => {
  try {
    const { withdrawal_id } = req.body;

    if (!withdrawal_id) {
      return res.status(400).json({ error: 'withdrawal_id is required' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Lock the withdrawal row to prevent race conditions
      const [rows] = await connection.query(
        'SELECT id, user_id, amount, status FROM withdrawals WHERE id = ? FOR UPDATE',
        [withdrawal_id]
      );

      if (!rows.length) {
        throw new Error('Withdrawal not found');
      }

      const withdrawal = rows[0];

      // Idempotency: if already rejected or approved, do nothing
      if (withdrawal.status === 'rejected') {
        await connection.commit();
        return res.json({ success: true, message: 'Already rejected. No changes applied.' });
      }
      if (withdrawal.status === 'approved') {
        await connection.commit();
        return res.status(400).json({ error: 'Withdrawal already approved. Cannot reject.' });
      }

      // Update withdrawal status to rejected
      await connection.query(
        'UPDATE withdrawals SET status = "rejected", processed_at = NOW(), rejected_by = ? WHERE id = ?',
        [req.admin?.id || null, withdrawal_id]
      );

      // Refund EXACT amount previously deducted from wallet and total_withdrawn
      await connection.query(
        'UPDATE users SET wallet_balance = wallet_balance + ?, total_withdrawn = GREATEST(0, total_withdrawn - ?) WHERE id = ?',
        [withdrawal.amount, withdrawal.amount, withdrawal.user_id]
      );

      // Optional: mark any related pending payment record for admin visibility as rejected
      // We don't have a direct linkage, so best-effort update the most recent pending withdrawal payment
      await connection.query(
        `UPDATE payments 
         SET status = 'rejected', processed_at = NOW(), description = CONCAT(IFNULL(description,''), ' [Auto-rejected with refund]')
         WHERE user_id = ? AND status = 'pending' AND payment_method = 'withdrawal'
         ORDER BY created_at DESC
         LIMIT 1`,
        [withdrawal.user_id]
      );

      // Notify user
      await connection.query(
        'INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, ?, NOW())',
        [
          withdrawal.user_id,
          `Your withdrawal of KES ${withdrawal.amount} was rejected. The same amount has been returned to your wallet.`,
          'error'
        ]
      );

      await connection.commit();
      res.json({ success: true, message: 'Withdrawal rejected and amount refunded to wallet.' });
    } catch (error) {
      await connection.rollback();
      console.error('Reject withdrawal error:', error);
      res.status(500).json({ error: error.message || 'Failed to reject withdrawal' });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Reject withdrawal outer error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject withdrawal' });
  }
});

// Get recharge requests
router.get('/recharge-requests', adminAuth, async (req, res) => {
  try {
    console.log('🔍 Fetching recharge requests...');
    
    // Get all payments with user and HR manager info
    const [requests] = await pool.query(`
      SELECT p.*, u.name as user_name, u.phone as user_phone, 
             hr.name as hr_manager_name, hr.mobile as hr_manager_phone
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN admin_users hr ON p.hr_manager_id = hr.id
      WHERE p.payment_method IN ('hr_manager_method1', 'hr_manager_method2', 'hr_manager_method3', 'hr_manager_method4', 'financial_method1', 'financial_method2', 'financial_method3', 'financial_method4')
      ORDER BY p.created_at DESC
      LIMIT 100
    `);
    
    console.log(`📋 Found ${requests.length} recharge requests`);

    // Get counts
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;
    const totalAmount = requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    res.json({
      requests: requests,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        totalAmount: totalAmount
      }
    });
  } catch (err) {
    console.error('Get recharge requests error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch recharge requests',
      details: err.message 
    });
  }
});

// Approve recharge
router.post('/approve-recharge', adminAuth, async (req, res) => {
  try {
    const { rechargeId, amount, verificationMessage } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get recharge details
      const [recharge] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending" AND (payment_method LIKE "%hr_manager%" OR payment_method LIKE "%method%" OR payment_method LIKE "%financial%")',
        [rechargeId]
      );
      
      if (recharge.length === 0) {
        throw new Error('Recharge request not found or already processed');
      }
      
      const rechargeData = recharge[0];

      // Update recharge status
      await connection.query(`
        UPDATE payments 
        SET status = 'approved', 
            processed_at = NOW(),
            verification_message = ?
        WHERE id = ?
      `, [verificationMessage, rechargeId]);

      // Update user's wallet balance
      await connection.query(`
        UPDATE users 
        SET wallet_balance = wallet_balance + ? 
        WHERE id = ?
      `, [rechargeData.amount, rechargeData.user_id]);

      // Create notification for user
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (?, ?, 'success')
      `, [rechargeData.user_id, `Your recharge of KES ${rechargeData.amount} has been approved and added to your wallet!`]);

      await connection.commit();
      res.json({ success: true, message: 'Recharge approved successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Approve recharge error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve recharge' });
  }
});

// Reject recharge
router.post('/reject-recharge', adminAuth, async (req, res) => {
  try {
    const { rechargeId, reason } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get recharge details
      const [recharge] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending" AND (payment_method LIKE "%hr_manager%" OR payment_method LIKE "%method%" OR payment_method LIKE "%financial%")',
        [rechargeId]
      );
      
      if (recharge.length === 0) {
        throw new Error('Recharge request not found or already processed');
      }
      
      const rechargeData = recharge[0];

      // Update recharge status
      await connection.query(`
        UPDATE payments 
        SET status = 'rejected', 
            processed_at = NOW()
        WHERE id = ?
      `, [rechargeId]);

      // Create notification for user
      const message = reason 
        ? `Your recharge request of KES ${rechargeData.amount} has been rejected. Reason: ${reason}`
        : `Your recharge request of KES ${rechargeData.amount} has been rejected. Please contact support.`;
      
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (?, ?, 'error')
      `, [rechargeData.user_id, message]);

      await connection.commit();
      res.json({ success: true, message: 'Recharge rejected successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Reject recharge error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject recharge' });
  }
});

// Get all appeals (admin only)
router.get('/appeals', adminAuth, async (req, res) => {
  try {
    console.log('🔍 Fetching all appeals for admin...');
    
    // Get all appeals with user information
    const [appeals] = await pool.query(`
      SELECT a.*, u.name as user_name, u.phone as user_phone, u.level as user_level,
             u.wallet_balance, ues.total_earnings, ues.this_month_earnings
      FROM appeals a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN user_earnings_summary ues ON u.id = ues.user_id
      ORDER BY a.created_at DESC
    `);
    
    console.log(`📊 Found ${appeals.length} appeals`);
    
    res.json({
      success: true,
      appeals: appeals
    });
    
  } catch (error) {
    console.error('Get appeals error:', error);
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

// Approve appeal (admin only)
router.post('/approve-appeal', adminAuth, async (req, res) => {
  try {
    const { appeal_id, admin_response } = req.body;
    
    if (!appeal_id) {
      return res.status(400).json({ error: 'Appeal ID is required' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Get appeal details
      const [appealRows] = await connection.query(`
        SELECT * FROM appeals WHERE id = ?
      `, [appeal_id]);
      
      if (!appealRows.length) {
        throw new Error('Appeal not found');
      }
      
      const appeal = appealRows[0];
      
      // Update appeal status
      await connection.query(`
        UPDATE appeals 
        SET status = 'approved', 
            admin_response = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [admin_response || 'Appeal approved', appeal_id]);
      
      // If user was suspended, reactivate their account
      if (appeal.user_id) {
        await connection.query(`
          UPDATE users 
          SET is_active = 1, updated_at = NOW()
          WHERE id = ?
        `, [appeal.user_id]);
        
        console.log(`✅ User ${appeal.user_id} account reactivated`);
      }
      
      await connection.commit();
      console.log(`✅ Appeal ${appeal_id} approved`);
      
      res.json({ 
        success: true, 
        message: 'Appeal approved successfully' 
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Approve appeal error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve appeal' });
  }
});

// Reject appeal (admin only)
router.post('/reject-appeal', adminAuth, async (req, res) => {
  try {
    const { appeal_id, admin_response } = req.body;
    
    if (!appeal_id) {
      return res.status(400).json({ error: 'Appeal ID is required' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Update appeal status
      await connection.query(`
        UPDATE appeals 
        SET status = 'rejected', 
            admin_response = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [admin_response || 'Appeal rejected', appeal_id]);
      
      await connection.commit();
      console.log(`✅ Appeal ${appeal_id} rejected`);
      
      res.json({ 
        success: true, 
        message: 'Appeal rejected successfully' 
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Reject appeal error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject appeal' });
  }
});

module.exports = router;
