const express = require('express');
const { pool } = require('../config/database');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

// Get all users
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, phone, name, level, wallet_balance as balance, referral_code, is_admin,
        temp_worker_start_date, created_at, total_withdrawn
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        id, phone, name, level, wallet_balance as balance, referral_code, is_admin,
        temp_worker_start_date, created_at, total_withdrawn
      FROM users 
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user
router.put('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, bond_level, balance, wallet_balance, is_admin, is_temporary_worker } = req.body;
    
    await pool.query(`
      UPDATE users 
      SET name = ?, bond_level = ?, balance = ?, wallet_balance = ?, 
          is_admin = ?, is_temporary_worker = ?
      WHERE id = ?
    `, [name, bond_level, balance, wallet_balance, is_admin, is_temporary_worker, id]);
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const [user] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user and related data
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user statistics
router.get('/stats/overview', verifyAdminToken, async (req, res) => {
  try {
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [activeUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE level > 0');
    const [tempWorkers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE temp_worker_start_date IS NOT NULL');
    const [totalBalance] = await pool.query('SELECT SUM(wallet_balance) as total FROM users');
    const [totalWallet] = await pool.query('SELECT SUM(wallet_balance) as total FROM users');
    
    res.json({
      totalUsers: totalUsers[0].count,
      activeUsers: activeUsers[0].count,
      tempWorkers: tempWorkers[0].count,
      totalBalance: totalBalance[0].total || 0,
      totalWallet: totalWallet[0].total || 0
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get user task completions
router.get('/:id/tasks', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        tc.*, t.title as task_title, t.reward as task_reward
      FROM task_completions tc
      LEFT JOIN tasks t ON tc.task_id = t.id
      WHERE tc.user_id = ?
      ORDER BY tc.completed_at DESC
    `, [id]);
    
    res.json(rows);
  } catch (error) {
    console.error('Get user tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

// Get user earnings
router.get('/:id/earnings', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        ues.*, u.name as user_name
      FROM user_earnings_summary ues
      LEFT JOIN users u ON ues.user_id = u.id
      WHERE ues.user_id = ?
    `, [id]);
    
    res.json(rows[0] || {});
  } catch (error) {
    console.error('Get user earnings error:', error);
    res.status(500).json({ error: 'Failed to fetch user earnings' });
  }
});

module.exports = router;
