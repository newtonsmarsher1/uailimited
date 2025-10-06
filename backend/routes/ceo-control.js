const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const router = express.Router();

// Database connection
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: 'Caroline',
  database: 'uai'
};

// CEO Control Panel API Routes

// Get all admins
router.get('/admin/users', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(
      'SELECT id, username, name, mobile, gmail, position, role, verified, rejected, is_active, updated_at FROM admin_users WHERE is_active = 1 ORDER BY CASE role WHEN "CEO" THEN 1 WHEN "super_admin" THEN 2 WHEN "HR Manager" THEN 3 WHEN "Financial Manager" THEN 4 ELSE 5 END, name ASC'
    );
    
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Change admin password
router.post('/admin/change-password', async (req, res) => {
  try {
    const { adminId, newPassword } = req.body;
    
    if (!adminId || !newPassword) {
      return res.status(400).json({ error: 'Admin ID and new password are required' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(
      'UPDATE admin_users SET password_hash = ? WHERE id = ? AND is_active = 1',
      [hashedPassword, adminId]
    );
    
    await connection.end();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Change CEO password
router.post('/admin/change-ceo-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Get CEO's current password
    const [rows] = await connection.execute(
      'SELECT password_hash FROM admin_users WHERE role = "CEO" AND is_active = 1 LIMIT 1'
    );
    
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'CEO not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    
    if (!isCurrentPasswordValid) {
      await connection.end();
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update CEO password
    await connection.execute(
      'UPDATE admin_users SET password_hash = ? WHERE role = "CEO" AND is_active = 1',
      [hashedNewPassword]
    );
    
    await connection.end();
    
    res.json({ success: true, message: 'CEO password changed successfully' });
  } catch (error) {
    console.error('Error changing CEO password:', error);
    res.status(500).json({ error: 'Failed to change CEO password' });
  }
});

// Suspend admins
router.post('/admin/suspend', async (req, res) => {
  try {
    const { adminIds } = req.body;
    
    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      return res.status(400).json({ error: 'Admin IDs are required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Suspend selected admins (except CEO)
    const placeholders = adminIds.map(() => '?').join(',');
    await connection.execute(
      `UPDATE admin_users SET is_active = 0 WHERE id IN (${placeholders}) AND role != 'CEO'`,
      adminIds
    );
    
    await connection.end();
    
    res.json({ success: true, message: 'Admins suspended successfully' });
  } catch (error) {
    console.error('Error suspending admins:', error);
    res.status(500).json({ error: 'Failed to suspend admins' });
  }
});

// Activate admins
router.post('/admin/activate', async (req, res) => {
  try {
    const { adminIds } = req.body;
    
    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      return res.status(400).json({ error: 'Admin IDs are required' });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Activate selected admins
    const placeholders = adminIds.map(() => '?').join(',');
    await connection.execute(
      `UPDATE admin_users SET is_active = 1 WHERE id IN (${placeholders})`,
      adminIds
    );
    
    await connection.end();
    
    res.json({ success: true, message: 'Admins activated successfully' });
  } catch (error) {
    console.error('Error activating admins:', error);
    res.status(500).json({ error: 'Failed to activate admins' });
  }
});

// Get notifications
router.get('/admin/notifications', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get user notifications
    const [userNotifications] = await connection.execute(`
      SELECT 
        'user_registration' as type,
        CONCAT('New user registered: ', name) as message,
        created_at as timestamp,
        'info' as priority
      FROM users 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    // Get withdrawal notifications
    const [withdrawalNotifications] = await connection.execute(`
      SELECT 
        'withdrawal_request' as type,
        CONCAT('Withdrawal request: $', amount) as message,
        created_at as timestamp,
        CASE 
          WHEN status = 'pending' THEN 'urgent'
          WHEN status = 'approved' THEN 'success'
          ELSE 'info'
        END as priority
      FROM withdrawals 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    // Get recharge notifications
    const [rechargeNotifications] = await connection.execute(`
      SELECT 
        'recharge_request' as type,
        CONCAT('Recharge request: $', amount) as message,
        created_at as timestamp,
        CASE 
          WHEN status = 'pending' THEN 'warning'
          WHEN status = 'approved' THEN 'success'
          ELSE 'info'
        END as priority
      FROM recharges 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    await connection.end();
    
    // Combine and sort all notifications
    const allNotifications = [
      ...userNotifications,
      ...withdrawalNotifications,
      ...rechargeNotifications
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(allNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get financial overview
router.get('/admin/financial-overview', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get withdrawal data
    const [withdrawalData] = await connection.execute(`
      SELECT 
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as total_rejected
      FROM withdrawals
    `);
    
    // Get recharge data
    const [rechargeData] = await connection.execute(`
      SELECT 
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_recharge_approved,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_recharge_pending,
        SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as total_recharge_rejected
      FROM recharges
    `);
    
    await connection.end();
    
    const financialOverview = {
      withdrawals: {
        approved: withdrawalData[0].total_approved || 0,
        pending: withdrawalData[0].total_pending || 0,
        rejected: withdrawalData[0].total_rejected || 0
      },
      recharges: {
        approved: rechargeData[0].total_recharge_approved || 0,
        pending: rechargeData[0].total_recharge_pending || 0,
        rejected: rechargeData[0].total_recharge_rejected || 0
      },
      total: {
        approved: (withdrawalData[0].total_approved || 0) + (rechargeData[0].total_recharge_approved || 0),
        pending: (withdrawalData[0].total_pending || 0) + (rechargeData[0].total_recharge_pending || 0),
        rejected: (withdrawalData[0].total_rejected || 0) + (rechargeData[0].total_recharge_rejected || 0)
      }
    };
    
    res.json(financialOverview);
  } catch (error) {
    console.error('Error fetching financial overview:', error);
    res.status(500).json({ error: 'Failed to fetch financial overview' });
  }
});

// Server management endpoints
router.post('/admin/start-servers', async (req, res) => {
  try {
    // This would typically start actual server processes
    // For now, we'll just return success
    res.json({ success: true, message: 'Servers started successfully' });
  } catch (error) {
    console.error('Error starting servers:', error);
    res.status(500).json({ error: 'Failed to start servers' });
  }
});

router.post('/admin/restart-servers', async (req, res) => {
  try {
    // This would typically restart actual server processes
    res.json({ success: true, message: 'Servers restarted successfully' });
  } catch (error) {
    console.error('Error restarting servers:', error);
    res.status(500).json({ error: 'Failed to restart servers' });
  }
});

router.post('/admin/stop-servers', async (req, res) => {
  try {
    // This would typically stop actual server processes
    res.json({ success: true, message: 'Servers stopped successfully' });
  } catch (error) {
    console.error('Error stopping servers:', error);
    res.status(500).json({ error: 'Failed to stop servers' });
  }
});

// Export financial report
router.get('/admin/export-financial-report', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get detailed financial data
    const [withdrawals] = await connection.execute(`
      SELECT 
        u.name as user_name,
        w.amount,
        w.status,
        w.created_at,
        w.approved_at
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.created_at DESC
    `);
    
    const [recharges] = await connection.execute(`
      SELECT 
        u.name as user_name,
        r.amount,
        r.status,
        r.created_at,
        r.approved_at
      FROM recharges r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    
    await connection.end();
    
    const report = {
      generated_at: new Date().toISOString(),
      withdrawals: withdrawals,
      recharges: recharges,
      summary: {
        total_withdrawals: withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0),
        total_recharges: recharges.reduce((sum, r) => sum + (r.amount || 0), 0)
      }
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error exporting financial report:', error);
    res.status(500).json({ error: 'Failed to export financial report' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

module.exports = router;
