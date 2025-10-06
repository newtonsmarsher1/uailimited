const express = require('express');
const { pool } = require('../config/database');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

// Get all payments
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.*, u.name as user_name, u.phone as user_phone
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment requests for HR manager
router.get('/hr-requests', verifyAdminToken, async (req, res) => {
  try {
    const [requests] = await pool.query(`
      SELECT p.*, u.name as user_name, u.phone as user_phone
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.payment_method = 'hr_manager'
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    const [pendingCount] = await pool.query(`
      SELECT COUNT(*) as count FROM payments 
      WHERE payment_method = 'hr_manager' AND status = 'pending'
    `);

    const [approvedToday] = await pool.query(`
      SELECT COUNT(*) as count FROM payments 
      WHERE payment_method = 'hr_manager' AND status = 'approved' 
      AND DATE(processed_at) = CURDATE()
    `);

    const [totalAmount] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE payment_method = 'hr_manager' AND status = 'approved'
    `);

    res.json({
      requests: requests,
      stats: {
        pending: pendingCount[0].count,
        approvedToday: approvedToday[0].count,
        totalAmount: totalAmount[0].total
      }
    });
  } catch (error) {
    console.error('Get HR payment requests error:', error);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

// Approve payment
router.post('/approve/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationMessage } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get payment details
      const [payment] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending"',
        [id]
      );
      
      if (payment.length === 0) {
        throw new Error('Payment not found or already processed');
      }
      
      const paymentData = payment[0];

      // Update payment status
      await connection.query(`
        UPDATE payments 
        SET status = 'approved', 
            processed_by = ?, 
            processed_at = NOW(),
            verification_message = ?
        WHERE id = ?
      `, [req.admin.id, verificationMessage, id]);

      // Update user's wallet balance
      await connection.query(`
        UPDATE users 
        SET wallet_balance = wallet_balance + ? 
        WHERE id = ?
      `, [paymentData.amount, paymentData.user_id]);

      // Create notification for user
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (?, ?, 'success')
      `, [paymentData.user_id, `Your recharge of KES ${paymentData.amount} has been approved and added to your wallet!`]);

      // Create notification for CEO
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (1, ?, 'info')
      `, [`${req.admin.name || req.admin.role} approved recharge: KES ${paymentData.amount} for user ${paymentData.user_id}`]);

      await connection.commit();
      res.json({ success: true, message: 'Payment approved successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve payment' });
  }
});

// Reject payment
router.post('/reject/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get payment details
      const [payment] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending"',
        [id]
      );
      
      if (payment.length === 0) {
        throw new Error('Payment not found or already processed');
      }
      
      const paymentData = payment[0];

      // Update payment status
      await connection.query(`
        UPDATE payments 
        SET status = 'rejected', 
            processed_by = ?, 
            processed_at = NOW()
        WHERE id = ?
      `, [req.admin.id, id]);

      // Create notification for user
      const message = reason 
        ? `Your recharge request of KES ${paymentData.amount} has been rejected. Reason: ${reason}`
        : `Your recharge request of KES ${paymentData.amount} has been rejected. Please contact support.`;
      
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (?, ?, 'error')
      `, [paymentData.user_id, message]);

      // Create notification for CEO
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (1, ?, 'info')
      `, [`${req.admin.name || req.admin.role} rejected recharge: KES ${paymentData.amount} for user ${paymentData.user_id}`]);

      await connection.commit();
      res.json({ success: true, message: 'Payment rejected successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject payment' });
  }
});

// Get payment statistics
router.get('/stats/overview', verifyAdminToken, async (req, res) => {
  try {
    const [pendingCount] = await pool.query(
      'SELECT COUNT(*) as count FROM payments WHERE status = "pending"'
    );
    const [approvedCount] = await pool.query(
      'SELECT COUNT(*) as count FROM payments WHERE status = "approved"'
    );
    const [rejectedCount] = await pool.query(
      'SELECT COUNT(*) as count FROM payments WHERE status = "rejected"'
    );
    const [totalAmount] = await pool.query(
      'SELECT SUM(amount) as total FROM payments WHERE status = "approved"'
    );
    
    res.json({
      pending: pendingCount[0].count,
      approved: approvedCount[0].count,
      rejected: rejectedCount[0].count,
      totalAmount: totalAmount[0].total || 0
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Failed to fetch payment statistics' });
  }
});

module.exports = router;
