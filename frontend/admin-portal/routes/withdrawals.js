const express = require('express');
const { pool } = require('../config/database');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

// Get all withdrawals
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        w.*, u.name as user_name, u.phone as user_phone,
        ROUND(w.amount * 0.9, 2) as admin_display_amount
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      ORDER BY w.requested_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// Approve withdrawal
router.post('/approve/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    await connection.beginTransaction();
    
    try {
      // Get withdrawal details
      const [withdrawal] = await connection.query(
        'SELECT * FROM withdrawals WHERE id = ? AND status = "pending"',
        [id]
      );
      
      if (withdrawal.length === 0) {
        throw new Error('Withdrawal not found or already processed');
      }
      
      const withdrawalData = withdrawal[0];
      
      // Update withdrawal status
      await connection.query(
        'UPDATE withdrawals SET status = "approved", processed_at = NOW() WHERE id = ?',
        [id]
      );
      
      // Create notification for user
      await connection.query(
        'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, "success")',
        [withdrawalData.user_id, `Your withdrawal of KES ${withdrawalData.amount} has been approved! (Amount shown is after 10% tax deduction)`]
      );
      
      await connection.commit();
      res.json({ success: true, message: 'Withdrawal approved successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve withdrawal' });
  }
});

// Reject withdrawal
router.post('/reject/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const connection = await pool.getConnection();
    
    await connection.beginTransaction();
    
    try {
      // Get withdrawal details
      const [withdrawal] = await connection.query(
        'SELECT * FROM withdrawals WHERE id = ? AND status = "pending"',
        [id]
      );
      
      if (withdrawal.length === 0) {
        throw new Error('Withdrawal not found or already processed');
      }
      
      const withdrawalData = withdrawal[0];
      
      // Update withdrawal status
      await connection.query(
        'UPDATE withdrawals SET status = "rejected", processed_at = NOW() WHERE id = ?',
        [id]
      );
      
      // Refund the amount to user's wallet
      await connection.query(
        'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
        [withdrawalData.amount, withdrawalData.user_id]
      );
      
      // Create notification for user
      const message = reason 
        ? `Your withdrawal of KES ${withdrawalData.amount} has been rejected. Reason: ${reason} (Amount shown was after 10% tax deduction)`
        : `Your withdrawal of KES ${withdrawalData.amount} has been rejected. (Amount shown was after 10% tax deduction)`;
      
      await connection.query(
        'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, "error")',
        [withdrawalData.user_id, message]
      );
      
      await connection.commit();
      res.json({ success: true, message: 'Withdrawal rejected and amount refunded' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject withdrawal' });
  }
});

// Get withdrawal statistics
router.get('/stats/overview', verifyAdminToken, async (req, res) => {
  try {
    const [pendingCount] = await pool.query(
      'SELECT COUNT(*) as count FROM withdrawals WHERE status = "pending"'
    );
    const [approvedCount] = await pool.query(
      'SELECT COUNT(*) as count FROM withdrawals WHERE status = "approved"'
    );
    const [rejectedCount] = await pool.query(
      'SELECT COUNT(*) as count FROM withdrawals WHERE status = "rejected"'
    );
    const [totalAmount] = await pool.query(
      'SELECT SUM(amount) as total FROM withdrawals WHERE status = "approved"'
    );
    
    res.json({
      pending: pendingCount[0].count,
      approved: approvedCount[0].count,
      rejected: rejectedCount[0].count,
      totalAmount: totalAmount[0].total || 0
    });
  } catch (error) {
    console.error('Get withdrawal stats error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawal statistics' });
  }
});

module.exports = router;
