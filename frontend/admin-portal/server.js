const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/database');
const { verifyAdminToken } = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and common forwarded ports
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    // Check if origin is in allowed list or if it's a forwarded port
    if (allowedOrigins.indexOf(origin) !== -1 || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('ngrok') ||
        origin.includes('tunnel')) {
      return callback(null, true);
    }
    
    console.log('🔒 CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', usersRoutes);

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Test basic connection
    const connection = await pool.getConnection();
    
    // Check if payments table exists
    const [tables] = await connection.query('SHOW TABLES LIKE "payments"');
    const paymentsExists = tables.length > 0;
    
    // Check if users table exists
    const [userTables] = await connection.query('SHOW TABLES LIKE "users"');
    const usersExists = userTables.length > 0;
    
    // Get user count
    let userCount = 0;
    if (usersExists) {
      const [count] = await connection.query('SELECT COUNT(*) as count FROM users');
      userCount = count[0].count;
    }
    
    // Get payment count
    let paymentCount = 0;
    if (paymentsExists) {
      const [count] = await connection.query('SELECT COUNT(*) as count FROM payments');
      paymentCount = count[0].count;
    }
    
    connection.release();
    
    res.json({
      status: 'ok',
      database: 'uai',
      tables: {
        payments: paymentsExists,
        users: usersExists
      },
      counts: {
        users: userCount,
        payments: paymentCount
      }
    });
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({ 
      status: 'error',
      error: err.message,
      database: 'uai'
    });
  }
});

// API Routes
// Routes are defined directly in this file below

// Notification Management Routes
app.get('/api/admin/notifications', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    const [notifications] = await pool.query(`
      SELECT 
        id, title, message, type, target_type, target_users, target_level,
        show_as_popup, status, created_at, sent_at
      FROM admin_notifications 
      ORDER BY created_at DESC
    `);
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/admin/notifications', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { title, message, type, target_type, target_users, target_level, show_as_popup, save_as_draft } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    const status = save_as_draft ? 'draft' : 'active';
    
    const [result] = await pool.query(`
      INSERT INTO admin_notifications 
      (title, message, type, target_type, target_users, target_level, show_as_popup, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      title, 
      message, 
      type || 'info', 
      target_type || 'all',
      target_users ? JSON.stringify(target_users) : null,
      target_level || null,
      show_as_popup ? 1 : 0,
      status
    ]);
    
    if (!save_as_draft) {
      // Send notification to users
      await sendNotificationToUsers(result.insertId, target_type, target_users, target_level, title, message);
    }
    
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.put('/api/admin/notifications/:id', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.params;
    const { title, message, type, target_type, target_users, target_level, show_as_popup } = req.body;
    
    await pool.query(`
      UPDATE admin_notifications 
      SET title = ?, message = ?, type = ?, target_type = ?, target_users = ?, target_level = ?, show_as_popup = ?
      WHERE id = ?
    `, [
      title, message, type, target_type,
      target_users ? JSON.stringify(target_users) : null,
      target_level, show_as_popup ? 1 : 0, id
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

app.delete('/api/admin/notifications/:id', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.params;
    
    await pool.query('DELETE FROM admin_notifications WHERE id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

app.post('/api/admin/notifications/:id/send', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.params;
    
    // Get notification details
    const [notifications] = await pool.query(`
      SELECT * FROM admin_notifications WHERE id = ?
    `, [id]);
    
    if (notifications.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notification = notifications[0];
    
    // Update status to active
    await pool.query(`
      UPDATE admin_notifications 
      SET status = 'active', sent_at = NOW() 
      WHERE id = ?
    `, [id]);
    
    // Send notification to users
    await sendNotificationToUsers(id, notification.target_type, 
      notification.target_users ? JSON.parse(notification.target_users) : null, 
      notification.target_level, notification.title, notification.message);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.get('/api/admin/notification-stats', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get total notifications
    const [totalNotifications] = await pool.query('SELECT COUNT(*) as count FROM admin_notifications');
    
    // Get active notifications
    const [activeNotifications] = await pool.query('SELECT COUNT(*) as count FROM admin_notifications WHERE status = "active"');
    
    // Get total users
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_admin = 0');
    
    // Get notifications sent today
    const [todayNotifications] = await pool.query(`
      SELECT COUNT(*) as count FROM admin_notifications 
      WHERE DATE(sent_at) = CURDATE()
    `);
    
    res.json({
      total_notifications: totalNotifications[0].count,
      active_notifications: activeNotifications[0].count,
      total_users: totalUsers[0].count,
      today_notifications: todayNotifications[0].count
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

// Helper function to send notifications to users
async function sendNotificationToUsers(notificationId, targetType, targetUsers, targetLevel, title, message) {
  try {
    const { pool } = require('./config/database');
    
    let whereClause = 'WHERE is_admin = 0';
    let params = [];
    
    if (targetType === 'specific' && targetUsers && targetUsers.length > 0) {
      whereClause += ' AND id IN (' + targetUsers.map(() => '?').join(',') + ')';
      params = targetUsers;
    } else if (targetType === 'level' && targetLevel !== null) {
      whereClause += ' AND level = ?';
      params = [targetLevel];
    } else if (targetType === 'temporary') {
      whereClause += ' AND level = 0';
    }
    
    const [users] = await pool.query(`SELECT id FROM users ${whereClause}`, params);
    
    // Insert notifications for each user
    for (const user of users) {
      await pool.query(`
        INSERT INTO notifications (user_id, message, type, created_at)
        VALUES (?, ?, 'admin_notification', NOW())
      `, [user.id, `📢 ${title || 'Admin Notification'}: ${message || 'New notification from admin'}`]);
    }
    
    console.log(`📢 Sent notification ${notificationId} to ${users.length} users`);
  } catch (error) {
    console.error('Error sending notification to users:', error);
  }
}

// Legacy routes for backward compatibility
app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Check if this is a reports request (has specific query parameters)
    if (req.query.reports === 'true') {
      // Get total users count
      const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_admin = 0');
      
      // Get active users (users with wallet_balance > 0 or recent activity)
      const [activeUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_admin = 0 AND wallet_balance > 0');
      
      // Get top 10 users with their details
      const [users] = await pool.query(`
        SELECT 
          id, name, level, wallet_balance as balance, 
          (SELECT COUNT(*) FROM task_completions WHERE user_id = users.id) as tasks_completed
        FROM users 
        WHERE is_admin = 0 
        ORDER BY wallet_balance DESC 
        LIMIT 10
      `);
      
      res.json({
        totalUsers: totalUsers[0].count,
        activeUsers: activeUsers[0].count,
        users: users
      });
    } else {
      // Original functionality for backward compatibility
      const [rows] = await pool.query('SELECT id, phone, name, level, wallet_balance as balance, referral_code, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 100');
      res.json(rows);
    }
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/user-details', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔍 User details API called with ID:', req.query.id);
    const mysql = require('mysql2/promise');
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Use direct connection instead of pool
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Caroline',
      database: 'uai'
    });
    
    console.log('🔍 Executing query for user ID:', id);
    const [rows] = await connection.execute(`
      SELECT id, phone, name, wallet_balance as balance, total_withdrawn, 
             referral_code, invitation_code, level, is_admin, is_active, created_at
      FROM users 
      WHERE id = ?
    `, [id]);
    
    console.log('🔍 Query result:', rows);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Get user details error:', err);
    res.status(500).json({ error: 'Failed to fetch user details', details: err.message });
  }
});

app.post('/api/admin/add-funds', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔍 Add funds request received:', req.body);
    const { pool } = require('./config/database');
    const { userId, amount, adminRole, adminId } = req.body;
    
    console.log('📋 Request data:', { userId, amount, adminRole, adminId });
    
    // Check admin role - ONLY CEO can add funds
    if (adminRole !== 'CEO') {
      console.log('❌ Non-CEO admin attempted to add funds');
      return res.status(403).json({ error: 'Only CEO can add funds to user accounts. Please contact the CEO for this action.' });
    }
    
    if (!userId || !amount || amount <= 0) {
      console.log('❌ Invalid request data');
      return res.status(400).json({ error: 'Valid user ID and amount are required' });
    }
    
    // Check if user exists
    console.log('🔍 Checking if user exists...');
    const [userRows] = await pool.query('SELECT id, name, wallet_balance, phone FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    console.log('👤 User found:', user);
    const newBalance = parseFloat(user.wallet_balance || 0) + parseFloat(amount);
    console.log('💰 New balance will be:', newBalance);
    
    // Update user's wallet balance
    console.log('🔄 Updating user wallet balance...');
    await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userId]);
    console.log('✅ Wallet balance updated');
    
    // Check if fund_tracking table exists, create if not
    console.log('🔍 Checking fund_tracking table...');
    try {
      const [fundTrackingCheck] = await pool.query("SHOW TABLES LIKE 'fund_tracking'");
      if (fundTrackingCheck.length === 0) {
        console.log('📋 Creating fund_tracking table...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS fund_tracking (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT,
            user_id INT,
            amount DECIMAL(10,2),
            added_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ fund_tracking table created');
      }
      
      // Track the fund addition (CEO only)
      console.log('🔄 Tracking fund addition...');
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        'INSERT INTO fund_tracking (admin_id, user_id, amount, added_date) VALUES (?, ?, ?, ?)',
        [adminId, userId, amount, today]
      );
      console.log('✅ Fund tracking record created');
    } catch (trackingError) {
      console.log('⚠️ Fund tracking failed, continuing without it:', trackingError.message);
    }
    
    // Log the transaction
    console.log('🔄 Logging transaction...');
    await pool.query(`
      INSERT INTO payments (user_id, amount, payment_method, status, description, created_at)
      VALUES (?, ?, 'admin_funds', 'completed', 'Funds added by admin', NOW())
    `, [userId, amount]);
    console.log('✅ Transaction logged');
    
    // Send notification to user about funds added
    console.log('🔄 Sending notification...');
    await pool.query(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, 'admin_notification', NOW())
    `, [userId, `Admin has added KES ${parseFloat(amount).toLocaleString()} to your wallet. Your new balance is KES ${newBalance.toLocaleString()}.`]);
    console.log('✅ Notification sent');
    
    console.log(`✅ Admin added KES ${amount} to user ${user.name} (ID: ${userId})`);
    
    res.json({ 
      success: true, 
      message: `Successfully added KES ${amount} to user's wallet`,
      newBalance: newBalance
    });
    
  } catch (err) {
    console.error('❌ Add funds error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to add funds', details: err.message });
  }
});

app.post('/api/admin/toggle-user-status', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user exists and get current status
    const [userRows] = await pool.query('SELECT id, name, is_active FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const newStatus = !user.is_active;
    
    // Update user status
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
    
    console.log(`Admin ${newStatus ? 'activated' : 'suspended'} user ${user.name} (ID: ${userId})`);
    
    res.json({ 
      success: true, 
      message: `User ${newStatus ? 'activated' : 'suspended'} successfully`,
      newStatus: newStatus
    });
    
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

app.post('/api/admin/delete-user', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user exists
    const [userRows] = await pool.query('SELECT id, name, is_admin FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Prevent deletion of admin users
    if (user.is_admin) {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }
    
    // Delete ALL user's related data from all tables
    await pool.query('DELETE FROM payments WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM user_tasks WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM task_completions WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM user_task_stats WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM user_earnings_summary WHERE user_id = ?', [userId]);
    
    // Delete the user
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    
    console.log(`Admin deleted user ${user.name} (ID: ${userId}) and all related data`);
    
    res.json({ 
      success: true, 
      message: 'User and all related data deleted successfully'
    });
    
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Change user password endpoint
app.post('/api/admin/change-user-password', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const bcrypt = require('bcrypt');
    const { userId, newPassword, adminId, adminRole } = req.body;
    
    if (!userId || !newPassword || !adminId || !adminRole) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Check if user exists
    const [userRows] = await pool.query('SELECT id, name, phone FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user's password
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    
    // Log the password change
    console.log(`Admin ${adminRole} (ID: ${adminId}) changed password for user ${user.name} (ID: ${userId}, Phone: ${user.phone})`);
    
    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      newPassword: newPassword // Return the plain password so admin can share it with user
    });
    
  } catch (err) {
    console.error('Change user password error:', err);
    res.status(500).json({ error: 'Failed to change user password' });
  }
});

app.get('/api/admin/tasks', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const [rows] = await pool.query('SELECT id, title, bond_level_required, reward, videoUrl, question, expected_answer FROM tasks');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const [rows] = await pool.query('SELECT id, user_id, amount, status, requested_at FROM withdrawals');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// Get all pending admins (all roles) with privacy controls
app.get('/api/admin/pending-admins', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const userRole = req.admin.role;
    const userId = req.admin.id;
    
    const [rows] = await pool.query(`
      SELECT id, username, name, id_number, mobile, gmail, position, role, verified, rejected, created_at 
      FROM admin_users 
      WHERE role != 'CEO' AND role != 'super_admin' AND rejected = 0
      ORDER BY created_at DESC
    `);
    
    // Apply privacy controls - only CEO can see full details
    const filteredRows = rows.map(admin => {
      if (userRole === 'CEO' || admin.id === userId) {
        // CEO or self - return full details
        return admin;
      } else {
        // Other admins - return only basic info
        return {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role,
          verified: admin.verified,
          rejected: admin.rejected,
          created_at: admin.created_at,
          // Sensitive fields hidden for privacy
          id_number: null,
          mobile: null,
          gmail: null,
          position: null
        };
      }
    });
    
    res.json(filteredRows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending admins' });
  }
});

// Verify any admin (all roles)
app.post('/api/admin/verify-admin', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.body;
    await pool.query('UPDATE admin_users SET verified=1, rejected=0 WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin' });
  }
});

// Reject any admin (all roles)
app.post('/api/admin/reject-admin', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.body;
    await pool.query('UPDATE admin_users SET rejected=1, verified=0 WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject admin' });
  }
});

app.get('/api/admin/hr-managers', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const [rows] = await pool.query('SELECT id, name, id_number, mobile, gmail, position, verified, rejected FROM admin_users WHERE role="HR Manager" AND rejected=0');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HR managers' });
  }
});

app.post('/api/admin/verify-hr', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.body;
    await pool.query('UPDATE admin_users SET verified=1 WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify HR manager' });
  }
});

app.post('/api/admin/reject-hr', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.body;
    await pool.query('UPDATE admin_users SET rejected=1 WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject HR manager' });
  }
});

app.post('/api/admin/delete-task', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id } = req.body;
    await pool.query('DELETE FROM tasks WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.post('/api/admin/create-task', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { title, bond_level_required, reward, videoUrl, question, expected_answer } = req.body;
    
    if (!title || !bond_level_required || !reward) {
      return res.status(400).json({ error: 'Title, bond level, and reward are required' });
    }
    
    await pool.query(
      'INSERT INTO tasks (title, bond_level_required, reward, videoUrl, question, expected_answer, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [title, bond_level_required, reward, videoUrl, question, expected_answer]
    );
    
    res.json({ success: true, message: 'Task created successfully' });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.post('/api/admin/update-task', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id, title, bond_level_required, reward, videoUrl, question, expected_answer, is_active } = req.body;
    
    if (!id || !title || !bond_level_required || !reward) {
      return res.status(400).json({ error: 'ID, title, bond level, and reward are required' });
    }
    
    await pool.query(
      'UPDATE tasks SET title=?, bond_level_required=?, reward=?, videoUrl=?, question=?, expected_answer=?, is_active=? WHERE id=?',
      [title, bond_level_required, reward, videoUrl, question, expected_answer, is_active, id]
    );
    
    res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Withdrawal management routes
app.get('/api/admin/withdrawal-requests', async (req, res) => {
  try {
    console.log('🔍 Withdrawal requests API called');
    const { pool } = require('./config/database');
    
    console.log('🔍 Executing withdrawal requests query...');
    const [requests] = await pool.query(`
      SELECT 
        w.*, 
        u.name as user_name, 
        u.phone as user_phone,
        u.full_name,
        u.id_number,
        u.bank_type,
        u.account_number
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      ORDER BY w.requested_at DESC
      LIMIT 100
    `);

    console.log('🔍 Executing stats queries...');
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
      'SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = "approved"'
    );
    
    console.log('🔍 Query results:', {
      requests: requests.length,
      pending: pendingCount[0].count,
      approved: approvedCount[0].count,
      rejected: rejectedCount[0].count,
      totalAmount: totalAmount[0].total
    });

    res.json({
      requests: requests,
      stats: {
        pending: pendingCount[0].count,
        approved: approvedCount[0].count,
        rejected: rejectedCount[0].count,
        totalAmount: totalAmount[0].total
      }
    });
  } catch (err) {
    console.error('❌ Get withdrawal requests error:', err);
    res.status(500).json({ error: 'Failed to fetch withdrawal requests', details: err.message });
  }
});

// Payment management routes
app.get('/api/admin/payment-requests', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const [requests] = await pool.query(`
      SELECT p.*, u.name as user_name, u.phone as user_phone
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

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
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = "approved"'
    );

    res.json({
      requests: requests,
      stats: {
        pending: pendingCount[0].count,
        approved: approvedCount[0].count,
        rejected: rejectedCount[0].count,
        totalAmount: totalAmount[0].total
      }
    });
  } catch (err) {
    console.error('Get payment requests error:', err);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

// Recharge management routes
app.get('/api/admin/recharge-requests', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    console.log('🔍 Fetching recharge requests...');
    
    // First, check if there are any payments at all
    const [allPayments] = await pool.query('SELECT COUNT(*) as count FROM payments');
    console.log(`📊 Total payments in database: ${allPayments[0].count}`);
    
    // Get all payments with user and HR manager info (including approved ones)
    // ONLY include recharge requests - exclude withdrawal requests
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
    
    console.log(`📋 Found ${requests.length} recharge requests (only recharge methods)`);
    
    // Debug: Check what payment methods exist in the database
    const [allPaymentMethods] = await pool.query(`
      SELECT DISTINCT payment_method, COUNT(*) as count 
      FROM payments 
      GROUP BY payment_method 
      ORDER BY count DESC
    `);
    console.log('🔍 All payment methods in database:', allPaymentMethods);

    // Use all requests as recharge requests since we're already filtering out withdrawals in the query
    const rechargeRequests = requests;
    
    console.log(`💰 Found ${rechargeRequests.length} recharge requests`);

    // Get counts
    const pendingCount = rechargeRequests.filter(r => r.status === 'pending').length;
    const approvedCount = rechargeRequests.filter(r => r.status === 'approved').length;
    const rejectedCount = rechargeRequests.filter(r => r.status === 'rejected').length;
    const totalAmount = rechargeRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    res.json({
      requests: rechargeRequests,
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

// Bulk update balance for specific users
app.post('/api/admin/bulk-update-balance', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔍 Bulk update balance request received:', req.body);
    const { pool } = require('./config/database');
    const { adminRole, adminId, startId, endId, level, newBalance } = req.body;
    
    // Check admin role - ONLY CEO can do bulk updates
    if (req.admin?.role !== 'CEO') {
      console.log('❌ Non-CEO admin attempted bulk update. Role:', req.admin?.role);
      return res.status(403).json({ error: 'Only CEO can perform bulk balance updates. Please contact the CEO for this action.' });
    }
    
    if (!startId || !endId || level === undefined || !newBalance) {
      console.log('❌ Invalid request data');
      return res.status(400).json({ error: 'Start ID, End ID, Level, and New Balance are required' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // First, get all users in the range with the specified level
      console.log('🔍 Finding users with IDs', startId, 'to', endId, 'and level', level);
      const [userRows] = await connection.query(
        'SELECT id, name, phone, wallet_balance, level FROM users WHERE id >= ? AND id <= ? AND level = ?',
        [startId, endId, level]
      );
      
      console.log('👥 Found users:', userRows.length);
      
      if (userRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `No users found with IDs ${startId}-${endId} and level ${level}` });
      }
      
      // Update each user's balance
      const updatePromises = userRows.map(user => {
        console.log(`🔄 Updating user ${user.id} (${user.name}) balance from ${user.wallet_balance} to ${newBalance}`);
        return connection.query(
          'UPDATE users SET wallet_balance = ? WHERE id = ?',
          [newBalance, user.id]
        );
      });
      
      await Promise.all(updatePromises);
      
      // Log the bulk update (create table if it doesn't exist)
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS admin_actions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            action_type VARCHAR(100) NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_admin_id (admin_id),
            INDEX idx_action_type (action_type),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        await connection.query(`
          INSERT INTO admin_actions (admin_id, action_type, details, created_at) 
          VALUES (?, 'bulk_balance_update', ?, NOW())
        `, [adminId, `Updated balance to ${newBalance} for ${userRows.length} users (IDs ${startId}-${endId}, level ${level})`]);
      } catch (logError) {
        console.log('⚠️ Could not log admin action:', logError.message);
        // Continue with the update even if logging fails
      }
      
      await connection.commit();
      
      console.log('✅ Bulk balance update completed successfully');
      res.json({
        success: true,
        message: `Successfully updated balance to ${newBalance} for ${userRows.length} users`,
        updatedUsers: userRows.map(u => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          oldBalance: u.wallet_balance,
          newBalance: newBalance
        }))
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (err) {
    console.error('❌ Bulk update balance error:', err);
    console.error('❌ Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      sqlState: err.sqlState
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update balances',
      details: err.message 
    });
  }
});

app.post('/api/admin/approve-recharge', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { rechargeId, amount, verificationMessage } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get recharge details
      const [recharge] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending" AND payment_method IN ("hr_manager_method1", "hr_manager_method2", "hr_manager_method3", "hr_manager_method4", "financial_method1", "financial_method2", "financial_method3", "financial_method4")',
        [rechargeId]
      );
      
      if (recharge.length === 0) {
        throw new Error('Recharge request not found or already processed');
      }
      
      const rechargeData = recharge[0];

      // Update recharge status (keep the record, don't delete)
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

app.post('/api/admin/reject-recharge', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { rechargeId, reason } = req.body;
    
    console.log('🚫 Reject recharge request:', { rechargeId, reason });
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get recharge details
      const [recharge] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending" AND payment_method IN ("hr_manager_method1", "hr_manager_method2", "hr_manager_method3", "hr_manager_method4", "financial_method1", "financial_method2", "financial_method3", "financial_method4")',
        [rechargeId]
      );
      
      console.log('🔍 Found recharge records:', recharge.length);
      console.log('🔍 Recharge data:', recharge);
      
      if (recharge.length === 0) {
        console.log('❌ No recharge found with ID:', rechargeId);
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

      console.log('✅ Updated recharge status to rejected');

      // Create notification for user
      const message = reason 
        ? `Your recharge request of KES ${rechargeData.amount} has been rejected. Reason: ${reason}`
        : `Your recharge request of KES ${rechargeData.amount} has been rejected. Please contact support.`;
      
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (?, ?, 'error')
      `, [rechargeData.user_id, message]);

      console.log('✅ Created notification for user');

      await connection.commit();
      console.log('✅ Transaction committed successfully');
      res.json({ success: true, message: 'Recharge rejected successfully' });

    } catch (error) {
      console.error('❌ Error in reject recharge transaction:', error);
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('❌ Reject recharge error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject recharge' });
  }
});

app.post('/api/admin/approve-payment', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { paymentId, amount, verificationMessage } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get payment details
      const [payment] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending"',
        [paymentId]
      );
      
      if (payment.length === 0) {
        throw new Error('Payment not found or already processed');
      }
      
      const paymentData = payment[0];

      // Update payment status
      await connection.query(`
        UPDATE payments 
        SET status = 'approved', 
            processed_at = NOW(),
            verification_message = ?
        WHERE id = ?
      `, [verificationMessage, paymentId]);

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

      await connection.commit();
      res.json({ success: true, message: 'Payment approved successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Approve payment error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve payment' });
  }
});

app.post('/api/admin/reject-payment', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { paymentId, reason } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get payment details
      const [payment] = await connection.query(
        'SELECT * FROM payments WHERE id = ? AND status = "pending"',
        [paymentId]
      );
      
      if (payment.length === 0) {
        throw new Error('Payment not found or already processed');
      }
      
      const paymentData = payment[0];

      // Update payment status
      await connection.query(`
        UPDATE payments 
        SET status = 'rejected', 
            processed_at = NOW()
        WHERE id = ?
      `, [paymentId]);

      // Create notification for user
      const message = reason 
        ? `Your recharge request of KES ${paymentData.amount} has been rejected. Reason: ${reason}`
        : `Your recharge request of KES ${paymentData.amount} has been rejected. Please contact support.`;
      
      await connection.query(`
        INSERT INTO notifications (user_id, message, type) 
        VALUES (?, ?, 'error')
      `, [paymentData.user_id, message]);

      await connection.commit();
      res.json({ success: true, message: 'Payment rejected successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Reject payment error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject payment' });
  }
});

// Add missing registration routes
app.post('/api/admin/register', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const bcrypt = require('bcrypt');
    let { username, password, name, id_number, mobile, gmail, position, role } = req.body;
    
    if (!username) username = 'Uaiagency';
    if (!password) password = 'Uai@2025';
    if (!role) return res.status(400).json({ error: 'Role is required' });

    // Check for duplicate username (should be unique across all roles)
    const [exists] = await pool.query(
      'SELECT id, role FROM admin_users WHERE username = ?',
      [username]
    );
    
    if (exists.length > 0) {
      return res.status(409).json({ 
        error: `Username '${username}' already exists. Please choose a different username.` 
      });
    }

    // Check for duplicate mobile number (required - no duplicates allowed)
    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }
    
    const [mobileExists] = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE mobile = ?',
      [mobile]
    );
    
    if (mobileExists.length > 0) {
      return res.status(409).json({ 
        error: `Mobile number '${mobile}' is already registered by ${mobileExists[0].username} (${mobileExists[0].role}). Please use a different mobile number.` 
      });
    }

    // Check for duplicate email (required - no duplicates allowed)
    if (!gmail) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    const [emailExists] = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE gmail = ?',
      [gmail]
    );
    
    if (emailExists.length > 0) {
      return res.status(409).json({ 
        error: `Email '${gmail}' is already registered by ${emailExists[0].username} (${emailExists[0].role}). Please use a different email address.` 
      });
    }

    // Check for duplicate name (required - no duplicates allowed)
    if (!name) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    
    const [nameExists] = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE name = ?',
      [name]
    );
    
    if (nameExists.length > 0) {
      return res.status(409).json({ 
        error: `Name '${name}' is already registered by ${nameExists[0].username} (${nameExists[0].role}). Please use a different name.` 
      });
    }

    const hash = await bcrypt.hash(password, 10);
    
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, name, id_number, mobile, gmail, position, role, verified, rejected, first_login, is_ceo_added) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, name, id_number, mobile, gmail, role, role, 0, 0, 1, false]
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

// CEO endpoint to add admin users manually
app.post('/api/admin/ceo-add-admin', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const bcrypt = require('bcrypt');
    const { username, password, name, id_number, mobile, gmail, position, role, ceoId } = req.body;
    
    if (!username || !password || !name || !role || !ceoId) {
      return res.status(400).json({ error: 'Username, password, name, role, and CEO ID are required' });
    }

    // Verify the CEO exists
    const [ceoCheck] = await pool.query(
      'SELECT id FROM admin_users WHERE id = ? AND role = "CEO"',
      [ceoId]
    );
    
    if (ceoCheck.length === 0) {
      return res.status(403).json({ error: 'Only CEO can add admin users' });
    }

    // Check for duplicate username
    const [exists] = await pool.query(
      'SELECT id FROM admin_users WHERE username = ?',
      [username]
    );
    
    if (exists.length > 0) {
      return res.status(409).json({ 
        error: `Username '${username}' already exists. Please choose a different username.` 
      });
    }

    // Check for duplicate mobile number
    if (mobile) {
      const [mobileExists] = await pool.query(
        'SELECT id FROM admin_users WHERE mobile = ?',
        [mobile]
      );
      
      if (mobileExists.length > 0) {
        return res.status(409).json({ 
          error: `Mobile number '${mobile}' is already registered. Please use a different mobile number.` 
        });
      }
    }

    // Check for duplicate email
    if (gmail) {
      const [emailExists] = await pool.query(
        'SELECT id FROM admin_users WHERE gmail = ?',
        [gmail]
      );
      
      if (emailExists.length > 0) {
        return res.status(409).json({ 
          error: `Email '${gmail}' is already registered. Please use a different email address.` 
        });
      }
    }

    // Check for duplicate name
    if (name) {
      const [nameExists] = await pool.query(
        'SELECT id FROM admin_users WHERE name = ?',
        [name]
      );
      
      if (nameExists.length > 0) {
        return res.status(409).json({ 
          error: `Name '${name}' is already registered. Please use a different name.` 
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, name, id_number, mobile, gmail, position, role, verified, rejected, first_login, is_ceo_added) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, name, id_number, mobile, gmail, role, role, 1, 0, 0, true]
    );

    res.json({ 
      success: true, 
      message: 'Admin user added successfully by CEO',
      username: username,
      password: password
    });
  } catch (error) {
    console.error('CEO add admin error:', error);
    res.status(500).json({ error: 'Failed to add admin user' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const bcrypt = require('bcrypt');
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
      passwordValid = await bcrypt.compare(password, user.password);
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.verified) {
      return res.json({ 
        userId: user.id, 
        userRole: user.role, 
        name: user.name
      });
    }

    if (!user.verified && user.first_login) {
      return res.json({ 
        firstLogin: true, 
        userId: user.id, 
        userRole: user.role, 
        name: user.name
      });
    }

    res.json({ 
      userId: user.id, 
      userRole: user.role, 
      name: user.name
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/admin/complete-registration', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const bcrypt = require('bcrypt');
    const { userId, password, name, id_number, mobile, gmail, position } = req.body;
    
    if (!userId || !password || !name) {
      return res.status(400).json({ error: 'User ID, password, and name are required' });
    }

    // Check for duplicate mobile number (excluding current user)
    if (mobile) {
      const [mobileExists] = await pool.query(
        'SELECT id, username, role FROM admin_users WHERE mobile = ? AND id != ?',
        [mobile, userId]
      );
      
      if (mobileExists.length > 0) {
        return res.status(409).json({ 
          error: `Mobile number '${mobile}' is already registered by ${mobileExists[0].username} (${mobileExists[0].role}). Please use a different mobile number.` 
        });
      }
    }

    // Check for duplicate email (excluding current user)
    if (gmail) {
      const [emailExists] = await pool.query(
        'SELECT id, username, role FROM admin_users WHERE gmail = ? AND id != ?',
        [gmail, userId]
      );
      
      if (emailExists.length > 0) {
        return res.status(409).json({ 
          error: `Email '${gmail}' is already registered by ${emailExists[0].username} (${emailExists[0].role}). Please use a different email address.` 
        });
      }
    }

    // Check for duplicate name (excluding current user)
    if (name) {
      const [nameExists] = await pool.query(
        'SELECT id, username, role FROM admin_users WHERE name = ? AND id != ?',
        [name, userId]
      );
      
      if (nameExists.length > 0) {
        return res.status(409).json({ 
          error: `Name '${name}' is already registered by ${nameExists[0].username} (${nameExists[0].role}). Please use a different name.` 
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    
    await pool.query(
      `UPDATE admin_users SET 
       password = ?, name = ?, id_number = ?, mobile = ?, gmail = ?, 
       verified = 1, first_login = 0 
       WHERE id = ?`,
      [hash, name, id_number, mobile, gmail, userId]
    );

    res.json({ success: true, message: 'Registration completed successfully' });
  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// Get approved withdrawals
app.get('/api/admin/approved-withdrawals', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    const [rows] = await pool.query(`
      SELECT w.*, u.name as user_name, u.phone as user_phone, u.full_name, u.bank_type, u.account_number
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.status = 'approved'
      ORDER BY w.processed_at DESC, w.created_at DESC
      LIMIT 100
    `);
    
    res.json(rows);
  } catch (err) {
    console.error('Get approved withdrawals error:', err);
    res.status(500).json({ error: 'Failed to fetch approved withdrawals' });
  }
});

// Get CEO-added admins for financial details
app.get('/api/admin/ceo-added-admins', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get only admins added by CEO (excluding self-registered ones)
    const [rows] = await pool.query(`
      SELECT id, username, name, mobile, gmail, role, position, created_at
      FROM admin_users 
      WHERE is_ceo_added = 1 AND role != 'CEO'
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      admins: rows
    });
  } catch (err) {
    console.error('Get CEO-added admins error:', err);
    res.status(500).json({ error: 'Failed to fetch CEO-added admins' });
  }
});

// Get random admin for recharge assignment (CEO-added only)
app.get('/api/admin/random-admin', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get only CEO-added verified admins (excluding CEO and self-registered users)
    const [rows] = await pool.query(`
      SELECT id, name, mobile, role 
      FROM admin_users 
      WHERE verified = 1 AND role != 'CEO' AND rejected = 0 AND is_ceo_added = 1
      ORDER BY RAND()
      LIMIT 1
    `);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No CEO-added admins available for recharge assignment' });
    }
    
    const admin = rows[0];
    res.json({
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        phone: admin.mobile,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Get random admin error:', err);
    res.status(500).json({ error: 'Failed to fetch random admin' });
  }
});

// Approve withdrawal request
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  try {
    console.log('🔍 Approve withdrawal request received:', req.body);
    const { pool } = require('./config/database');
    const { withdrawalId, adminNotes, adminId, adminName } = req.body;
    
    if (!withdrawalId) {
      console.log('❌ Missing withdrawalId');
      return res.status(400).json({ error: 'Withdrawal ID is required' });
    }
    
    if (!adminId || !adminName) {
      console.log('❌ Missing admin information');
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    console.log('🔍 Getting withdrawal details for ID:', withdrawalId);
    // Get withdrawal details
    const [withdrawalRows] = await pool.query(`
      SELECT w.*, u.name as user_name, u.phone as user_phone 
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `, [withdrawalId]);
    
    if (withdrawalRows.length === 0) {
      console.log('❌ Withdrawal not found');
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }
    
    const withdrawal = withdrawalRows[0];
    console.log('✅ Withdrawal found:', withdrawal);
    
    console.log('🔍 Updating withdrawal status...');
    // Update withdrawal status (only update existing columns)
    await pool.query(
      'UPDATE withdrawals SET status = ? WHERE id = ?',
      ['approved', withdrawalId]
    );
    
    console.log('🔍 Updating payment record...');
    // Update corresponding payment record
    await pool.query(
      'UPDATE payments SET status = ? WHERE user_id = ? AND payment_method = "withdrawal" AND amount = ? AND status = "pending"',
      ['completed', withdrawal.user_id, withdrawal.amount]
    );
    
    console.log('🔍 Creating notification...');
    // Send notification to user
    await pool.query(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, 'withdrawal_approved', NOW())
    `, [withdrawal.user_id, `Your withdrawal request for KES ${withdrawal.amount} has been approved and processed.`]);
    
    console.log(`✅ Admin approved withdrawal KES ${withdrawal.amount} for user ${withdrawal.user_name} (ID: ${withdrawal.user_id})`);
    
    res.json({ 
      success: true, 
      message: 'Withdrawal approved successfully'
    });
    
  } catch (err) {
    console.error('Approve withdrawal error:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Failed to approve withdrawal',
      details: err.message 
    });
  }
});

// Reject withdrawal request
app.post('/api/admin/reject-withdrawal', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { withdrawalId, adminNotes, adminId, adminName } = req.body;
    
    if (!withdrawalId) {
      return res.status(400).json({ error: 'Withdrawal ID is required' });
    }
    
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Get withdrawal details
    const [withdrawalRows] = await pool.query(`
      SELECT w.*, u.name as user_name, u.phone as user_phone 
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `, [withdrawalId]);
    
    if (withdrawalRows.length === 0) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }
    
    const withdrawal = withdrawalRows[0];
    
    // Refund the user's wallet balance and subtract from total_withdrawn
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance + ?, total_withdrawn = total_withdrawn - ? WHERE id = ?',
      [withdrawal.amount, withdrawal.amount, withdrawal.user_id]
    );
    
    // Update withdrawal status with admin information
    await pool.query(
      'UPDATE withdrawals SET status = ? WHERE id = ?',
      ['rejected', withdrawalId]
    );
    
    // Update corresponding payment record
    await pool.query(
      'UPDATE payments SET status = ? WHERE user_id = ? AND payment_method = "withdrawal" AND amount = ? AND status = "pending"',
      ['cancelled', withdrawal.user_id, withdrawal.amount]
    );
    
    // Send notification to user
    await pool.query(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, 'withdrawal_rejected', NOW())
    `, [withdrawal.user_id, `Your withdrawal request for KES ${withdrawal.amount} has been rejected. Reason: ${adminNotes || 'No reason provided'}. Amount has been refunded to your wallet.`]);
    
    console.log(`Admin rejected withdrawal KES ${withdrawal.amount} for user ${withdrawal.user_name} (ID: ${withdrawal.user_id})`);
    
    res.json({ 
      success: true, 
      message: 'Withdrawal rejected successfully'
    });
    
  } catch (err) {
    console.error('Reject withdrawal error:', err);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// Clear specific recharge records by ID
app.post('/api/admin/clear-specific-recharge-records', async (req, res) => {
  try {
    console.log('🧹 Clear specific recharge records request received:', req.body);
    const { pool } = require('./config/database');
    const { recordIds, adminId, adminName } = req.body;
    
    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'Record IDs are required' });
    }
    
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Verify CEO access
    const [adminRows] = await pool.query(
      'SELECT role FROM admin_users WHERE id = ? AND name = ?',
      [adminId, adminName]
    );
    
    if (adminRows.length === 0 || adminRows[0].role !== 'CEO') {
      console.log('❌ Non-CEO admin attempted to clear specific recharge records');
      return res.status(403).json({ error: 'Only CEO can clear recharge records' });
    }
    
    // Create placeholders for the IN clause
    const placeholders = recordIds.map(() => '?').join(',');
    
    // Delete specific records
    const [result] = await pool.query(`
      DELETE FROM payments 
      WHERE id IN (${placeholders})
      AND payment_method IN ('hr_manager_method1', 'hr_manager_method2', 'hr_manager_method3', 'hr_manager_method4', 'financial_method1', 'financial_method2', 'financial_method3', 'financial_method4')
    `, recordIds);
    
    console.log(`✅ Successfully cleared ${result.affectedRows} specific recharge records`);
    
    res.json({ 
      success: true,
      message: `Successfully cleared ${result.affectedRows} specific recharge records`,
      clearedCount: result.affectedRows 
    });
    
  } catch (err) {
    console.error('❌ Clear specific recharge records error:', err);
    res.status(500).json({ error: 'Failed to clear specific recharge records', details: err.message });
  }
});

// Clear recharge records API endpoint
app.post('/api/admin/clear-recharge-records', async (req, res) => {
  try {
    console.log('🧹 Clear recharge records request received:', req.body);
    const { pool } = require('./config/database');
    const { 
      clearRechargePending = false, 
      clearRechargeApproved = false, 
      clearRechargeRejected = false,
      adminId,
      adminName 
    } = req.body;
    
    // Validate CEO access
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Check if admin is CEO
    const [adminRows] = await pool.query(
      'SELECT role FROM admin_users WHERE id = ? AND name = ?',
      [adminId, adminName]
    );
    
    if (adminRows.length === 0 || adminRows[0].role !== 'CEO') {
      console.log('❌ Non-CEO admin attempted to clear recharge records');
      return res.status(403).json({ error: 'Only CEO can clear recharge records' });
    }
    
    // Check if any option is selected
    if (!clearRechargePending && !clearRechargeApproved && !clearRechargeRejected) {
      return res.status(400).json({ error: 'Please select at least one record type to clear' });
    }
    
    console.log('📋 Clear options:', { clearRechargePending, clearRechargeApproved, clearRechargeRejected });
    
    // Build WHERE clause based on options
    const conditions = [];
    if (clearRechargePending) conditions.push("status = 'pending'");
    if (clearRechargeApproved) conditions.push("status = 'approved'");
    if (clearRechargeRejected) conditions.push("status = 'rejected'");
    
    const whereClause = conditions.join(' OR ');
    
    // Count records to be deleted
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM payments 
      WHERE payment_method IN ('hr_manager_method1', 'hr_manager_method2', 'hr_manager_method3', 'hr_manager_method4', 'financial_method1', 'financial_method2', 'financial_method3', 'financial_method4')
      AND (${whereClause})
    `);
    
    const recordCount = countResult[0].count;
    console.log(`📊 Records to be cleared: ${recordCount}`);
    
    if (recordCount === 0) {
      console.log('✅ No records found matching criteria');
      return res.json({ 
        success: true, 
        message: 'No records found matching criteria',
        clearedCount: 0 
      });
    }
    
    // Delete records
    const [result] = await pool.query(`
      DELETE FROM payments 
      WHERE payment_method IN ('hr_manager_method1', 'hr_manager_method2', 'hr_manager_method3', 'hr_manager_method4', 'financial_method1', 'financial_method2', 'financial_method3', 'financial_method4')
      AND (${whereClause})
    `);
    
    console.log(`✅ Successfully cleared ${result.affectedRows} recharge records`);
    
    res.json({ 
      success: true, 
      message: `Successfully cleared ${result.affectedRows} recharge records`,
      clearedCount: result.affectedRows 
    });
    
  } catch (err) {
    console.error('❌ Clear recharge records error:', err);
    res.status(500).json({ error: 'Failed to clear recharge records', details: err.message });
  }
});

// Clear withdrawal records API endpoint
app.post('/api/admin/clear-withdrawal-records', async (req, res) => {
  try {
    console.log('🧹 Clear withdrawal records request received:', req.body);
    const { pool } = require('./config/database');
    const { 
      clearWithdrawalPending = false, 
      clearWithdrawalApproved = false, 
      clearWithdrawalRejected = false,
      adminId,
      adminName 
    } = req.body;
    
    // Validate CEO access
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Check if admin is CEO
    const [adminRows] = await pool.query(
      'SELECT role FROM admin_users WHERE id = ? AND name = ?',
      [adminId, adminName]
    );
    
    if (adminRows.length === 0 || adminRows[0].role !== 'CEO') {
      console.log('❌ Non-CEO admin attempted to clear withdrawal records');
      return res.status(403).json({ error: 'Only CEO can clear withdrawal records' });
    }
    
    // Check if any option is selected
    if (!clearWithdrawalPending && !clearWithdrawalApproved && !clearWithdrawalRejected) {
      return res.status(400).json({ error: 'Please select at least one record type to clear' });
    }
    
    console.log('📋 Clear options:', { clearWithdrawalPending, clearWithdrawalApproved, clearWithdrawalRejected });
    
    // Build WHERE clause based on options
    const conditions = [];
    if (clearWithdrawalPending) conditions.push("status = 'pending'");
    if (clearWithdrawalApproved) conditions.push("status = 'approved'");
    if (clearWithdrawalRejected) conditions.push("status = 'rejected'");
    
    const whereClause = conditions.join(' OR ');
    
    // Count records to be deleted
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM withdrawals 
      WHERE (${whereClause})
    `);
    
    const recordCount = countResult[0].count;
    console.log(`📊 Withdrawal records to be cleared: ${recordCount}`);
    
    if (recordCount === 0) {
      console.log('✅ No withdrawal records found matching criteria');
      return res.json({ 
        success: true, 
        message: 'No withdrawal records found matching criteria',
        clearedCount: 0 
      });
    }
    
    // Delete records
    const [result] = await pool.query(`
      DELETE FROM withdrawals 
      WHERE (${whereClause})
    `);
    
    console.log(`✅ Successfully cleared ${result.affectedRows} withdrawal records`);
    
    res.json({ 
      success: true, 
      message: `Successfully cleared ${result.affectedRows} withdrawal records`,
      clearedCount: result.affectedRows 
    });
    
  } catch (err) {
    console.error('❌ Clear withdrawal records error:', err);
    res.status(500).json({ error: 'Failed to clear withdrawal records', details: err.message });
  }
});

// DUPLICATE ENDPOINT REMOVED - Using the later version below

// DUPLICATE ENDPOINT REMOVED - Using the later version below

// Admin Wallet API Endpoints
app.get('/api/admin/wallet', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const adminId = req.query.adminId;
    
    if (!adminId) {
      // If no admin ID provided, try to get it from session or use default
      return res.status(400).json({ error: 'Admin ID is required' });
    }
    
    // Get admin wallet data
    const [walletRows] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'commission' THEN amount ELSE 0 END), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'commission' THEN amount ELSE 0 END) - 
                 SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as balance
      FROM admin_wallet_transactions 
      WHERE admin_id = ?
    `, [adminId]);
    
    // Calculate real-time earnings from approved withdrawals by this admin
    const [realTimeEarningsRows] = await pool.query(`
      SELECT COALESCE(SUM(amount * 0.03), 0) as real_time_earnings
      FROM withdrawals 
      WHERE status = 'approved' AND approved_by = ?
    `, [adminId]);
    
    // Get pending withdrawal count
    const [pendingRows] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM withdrawals 
      WHERE status = 'pending'
    `);
    
    const realTimeEarnings = parseFloat(realTimeEarningsRows[0]?.real_time_earnings || 0);
    
    const walletData = {
      balance: parseFloat(walletRows[0]?.balance || 0),
      totalEarnings: realTimeEarnings, // Use real-time calculation
      totalWithdrawals: parseFloat(walletRows[0]?.total_withdrawals || 0),
      pendingApprovals: parseInt(pendingRows[0]?.count || 0)
    };
    
    res.json(walletData);
  } catch (error) {
    console.error('Error fetching admin wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

app.get('/api/admin/pending-withdrawals', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    const [rows] = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        ROUND(w.amount * 0.9, 2) as admin_display_amount,
        w.bank_details as bank_name,
        w.account_number,
        w.status,
        w.created_at,
        u.name as user_name,
        u.phone as user_phone
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at DESC
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

// Duplicate endpoint removed - keeping only the first approve-withdrawal endpoint

app.post('/api/admin/reject-withdrawal', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { withdrawalId, adminNotes, adminId, adminName } = req.body;
    
    if (!withdrawalId) {
      return res.status(400).json({ error: 'Withdrawal ID is required' });
    }
    
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Get withdrawal details
    const [withdrawalRows] = await pool.query(`
      SELECT w.*, u.name as user_name, u.phone as user_phone 
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `, [withdrawalId]);
    
    if (withdrawalRows.length === 0) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }
    
    const withdrawal = withdrawalRows[0];
    
    // Refund the user's wallet balance and subtract from total_withdrawn
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance + ?, total_withdrawn = total_withdrawn - ? WHERE id = ?',
      [withdrawal.amount, withdrawal.amount, withdrawal.user_id]
    );
    
    // Update withdrawal status with admin information
    await pool.query(
      'UPDATE withdrawals SET status = ? WHERE id = ?',
      ['rejected', withdrawalId]
    );
    
    // Update corresponding payment record
    await pool.query(
      'UPDATE payments SET status = ? WHERE user_id = ? AND payment_method = "withdrawal" AND amount = ? AND status = "pending"',
      ['cancelled', withdrawal.user_id, withdrawal.amount]
    );
    
    // Send notification to user
    await pool.query(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, 'withdrawal_rejected', NOW())
    `, [withdrawal.user_id, `Your withdrawal request for KES ${withdrawal.amount} has been rejected. Reason: ${adminNotes || 'No reason provided'}. Amount has been refunded to your wallet.`]);
    
    console.log(`Admin rejected withdrawal KES ${withdrawal.amount} for user ${withdrawal.user_name} (ID: ${withdrawal.user_id})`);
    
    res.json({ 
      success: true,
      message: 'Withdrawal rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

app.post('/api/admin/withdraw-funds', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { amount, reason, adminId } = req.body;
    
    if (!amount || !adminId) {
      return res.status(400).json({ error: 'Amount and Admin ID are required' });
    }
    
    // Get admin current balance
    const [walletRows] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'commission' THEN amount ELSE 0 END) - 
                 SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as balance
      FROM admin_wallet_transactions 
      WHERE admin_id = ?
    `, [adminId]);
    
    const currentBalance = parseFloat(walletRows[0]?.balance || 0);
    
    if (amount > currentBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Calculate fees (10% total: 3% to admins, 7% to CEO)
    const adminFee = amount * 0.03;
    const ceoFee = amount * 0.07;
    const netAmount = amount - adminFee - ceoFee;
    
    // Add withdrawal transaction
    await pool.query(`
      INSERT INTO admin_wallet_transactions 
      (admin_id, type, amount, description, created_at)
      VALUES (?, 'withdrawal', ?, ?, NOW())
    `, [adminId, amount, `Withdrawal: ${reason || 'No reason provided'}`]);
    
    // Add fee transactions
    await pool.query(`
      INSERT INTO admin_wallet_transactions 
      (admin_id, type, amount, description, created_at)
      VALUES (?, 'fee', ?, 'Admin fee (3%)', NOW())
    `, [adminId, -adminFee]);
    
    // Note: CEO fee would be handled separately in a real system
    
    res.json({
      success: true,
      message: 'Withdrawal processed successfully',
      amount: amount,
      netAmount: netAmount,
      adminFee: adminFee,
      ceoFee: ceoFee
    });
  } catch (error) {
    console.error('Error processing admin withdrawal:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

app.get('/api/admin/approval-history', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const adminId = req.query.adminId;
    
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is required' });
    }
    
    const [history] = await pool.query(`
      SELECT 
        w.id as withdrawal_id,
        w.user_id,
        w.amount,
        w.approved_at,
        u.name as user_name,
        (w.amount * 0.03) as commission_earned
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.status = 'approved' 
        AND w.approved_by = ?
      ORDER BY w.approved_at DESC
    `, [adminId]);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: 'Failed to fetch approval history' });
  }
});

app.get('/api/admin/approved-withdrawals', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const adminId = req.query.adminId;
    
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is required' });
    }
    
    const [withdrawals] = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.bank_details as bank_name,
        w.account_number,
        w.status,
        w.approved_at,
        w.created_at,
        u.name as user_name,
        u.phone as user_phone
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.status = 'approved' 
        AND w.approved_by = ?
      ORDER BY w.approved_at DESC
    `, [adminId]);
    
    res.json(withdrawals);
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: 'Failed to fetch approval history' });
  }
});

app.get('/api/admin/earnings-history', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const adminId = req.query.adminId;
    
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is required' });
    }
    
    const [earnings] = await pool.query(`
      SELECT 
        type,
        amount,
        description,
        created_at
      FROM admin_wallet_transactions 
      WHERE admin_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [adminId]);
    
    res.json(earnings);
  } catch (error) {
    console.error('Error fetching earnings history:', error);
    res.status(500).json({ error: 'Failed to fetch earnings history' });
  }
});

// Financial Details Management (CEO Only)
app.get('/api/admin/financial-details', async (req, res) => {
  try {
    console.log('🔍 Financial details API called');
    const { pool } = require('./config/database');
    
    // Get all CEO-added financial managers
    const [rows] = await pool.query(`
      SELECT id, name, mobile, bank_name, account_number, branch, swift_code, reference_code, payment_method, verified
      FROM admin_users 
      WHERE role = 'Financial Manager' AND rejected = 0
      ORDER BY payment_method ASC, id DESC
    `);
    
    console.log(`📊 Found ${rows.length} financial managers`);
    console.log('📋 Managers:', rows.map(m => `${m.name} (${m.mobile})`));
    
    res.json({
      success: true,
      financialManagers: rows
    });
  } catch (err) {
    console.error('❌ Get financial details error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch financial details',
      details: err.message 
    });
  }
});

app.post('/api/admin/add-financial-details', async (req, res) => {
  try {
    console.log('🔍 Add financial details request received:', req.body);
    const { pool } = require('./config/database');
    const { name, mobile, adminId, adminName } = req.body;
    
    // Validate CEO access
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Check if admin is CEO
    const [adminRows] = await pool.query(
      'SELECT role FROM admin_users WHERE id = ? AND name = ?',
      [adminId, adminName]
    );
    
    if (adminRows.length === 0 || adminRows[0].role !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can add financial details' });
    }
    
    // Validate input - only name and mobile required
    if (!name || !mobile) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }
    
    if (!mobile.match(/^(07[0-9]{8}|01[0-9]{8}|\+254[0-9]{9})$/)) {
      return res.status(400).json({ error: 'Invalid phone number format. Use format: 0712345678, 0112345678, or +254712345678' });
    }
    
    // Check if mobile number already exists
    const [existingRows] = await pool.query(
      'SELECT id FROM admin_users WHERE mobile = ?',
      [mobile]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    
    // Add new financial manager with minimal required fields
    const bcrypt = require('bcrypt');
    const defaultPassword = '123456'; // Default password for financial managers
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    await pool.query(`
      INSERT INTO admin_users (name, mobile, role, payment_method, verified, username, password_hash, is_ceo_added, is_active, created_at)
      VALUES (?, ?, 'Financial Manager', 'method1', 1, ?, ?, 1, 1, NOW())
    `, [name, mobile, mobile, hashedPassword]); // Use mobile as username
    
    console.log(`✅ CEO ${adminName} added new financial manager: ${name} (${mobile})`);
    
    res.json({
      success: true,
      message: 'Financial manager added successfully',
      defaultPassword: defaultPassword,
      username: mobile
    });
  } catch (err) {
    console.error('❌ Add financial details error:', err);
    res.status(500).json({ error: 'Failed to add financial manager' });
  }
});

app.post('/api/admin/update-financial-details', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id, name, phone, mobile, bank_name, account_number, branch, swift_code, reference_code, payment_method, adminId, adminName } = req.body;
    
    // Use phone parameter if mobile is not provided (for compatibility)
    const phoneNumber = mobile || phone;
    
    // Validate CEO access
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Check if admin is CEO
    const [adminRows] = await pool.query(
      'SELECT role FROM admin_users WHERE id = ? AND name = ?',
      [adminId, adminName]
    );
    
    if (adminRows.length === 0 || adminRows[0].role !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can update financial details' });
    }
    
    // Validate input - simplified for basic financial manager management
    if (!id || !name || !phoneNumber) {
      return res.status(400).json({ error: 'ID, name and phone number are required' });
    }
    
    if (!phoneNumber.match(/^(07[0-9]{8}|01[0-9]{8}|\+254[0-9]{9})$/)) {
      return res.status(400).json({ error: 'Invalid phone number format. Use format: 0712345678, 0112345678, or +254712345678' });
    }
    
    // Check if phone number already exists for another user
    const [existingRows] = await pool.query(
      'SELECT id FROM admin_users WHERE mobile = ? AND id != ?',
      [phoneNumber, id]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Phone number already exists for another user' });
    }
    
    // Update financial manager (simplified - only name and mobile)
    const [updateResult] = await pool.query(`
      UPDATE admin_users 
      SET name = ?, mobile = ?, updated_at = NOW()
      WHERE id = ? AND role = 'Financial Manager' AND is_ceo_added = 1
    `, [name, phoneNumber, id]);
    
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Financial Manager not found or not CEO-added' });
    }
    
    console.log(`CEO ${adminName} updated financial manager ID ${id}: ${name} (${phoneNumber})`);
    
    res.json({
      success: true,
      message: 'Financial manager updated successfully'
    });
  } catch (err) {
    console.error('Update financial details error:', err);
    res.status(500).json({ error: 'Failed to update financial manager' });
  }
});

app.post('/api/admin/delete-financial-details', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { id, adminId, adminName } = req.body;
    
    // Validate CEO access
    if (!adminId || !adminName) {
      return res.status(400).json({ error: 'Admin information is required' });
    }
    
    // Check if admin is CEO
    const [adminRows] = await pool.query(
      'SELECT role FROM admin_users WHERE id = ? AND name = ?',
      [adminId, adminName]
    );
    
    if (adminRows.length === 0 || adminRows[0].role !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can delete financial details' });
    }
    
    // Validate input
    if (!id) {
      return res.status(400).json({ error: 'Financial manager ID is required' });
    }
    
    // Get financial manager details before deletion
    const [fmRows] = await pool.query(
      'SELECT name, mobile, payment_method FROM admin_users WHERE id = ? AND role = "Financial Manager"',
      [id]
    );
    
    if (fmRows.length === 0) {
      return res.status(404).json({ error: 'Financial manager not found' });
    }
    
    const fmManager = fmRows[0];
    
    // Delete financial manager (soft delete by setting rejected = 1)
    await pool.query(`
      UPDATE admin_users 
      SET rejected = 1, updated_at = NOW()
      WHERE id = ? AND role = 'Financial Manager'
    `, [id]);
    
    console.log(`CEO ${adminName} deleted financial manager: ${fmManager.name} (${fmManager.mobile}) for ${fmManager.payment_method}`);
    
    res.json({
      success: true,
      message: 'Financial manager deleted successfully'
    });
  } catch (err) {
    console.error('Delete financial details error:', err);
    res.status(500).json({ error: 'Failed to delete financial manager' });
  }
});

// Reports API endpoints for payments, withdrawals, and tasks
app.get('/api/admin/payments', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get total revenue
    const [totalRevenue] = await pool.query('SELECT SUM(amount) as total FROM payments WHERE status = "approved"');
    
    // Get pending payments count
    const [pendingPayments] = await pool.query('SELECT COUNT(*) as count FROM payments WHERE status = "pending"');
    
    // Get all payments with user details
    const [payments] = await pool.query(`
      SELECT 
        p.id, p.amount, p.status, p.created_at,
        u.name as user_name, u.id as user_id
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);
    
    res.json({
      totalRevenue: parseFloat(totalRevenue[0].total) || 0,
      pendingPayments: pendingPayments[0].count,
      payments: payments
    });
  } catch (err) {
    console.error('Payments API error:', err);
    res.status(500).json({ error: 'Failed to fetch payment data' });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get total withdrawals amount
    const [totalAmount] = await pool.query('SELECT SUM(amount) as total FROM withdrawal_requests WHERE status = "approved"');
    
    // Get pending withdrawals count
    const [pendingWithdrawals] = await pool.query('SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = "pending"');
    
    // Get all withdrawals with user details
    const [withdrawals] = await pool.query(`
      SELECT 
        w.id, w.amount, w.status, w.requested_at,
        u.name as user_name, u.id as user_id
      FROM withdrawal_requests w
      LEFT JOIN users u ON w.user_id = u.id
      ORDER BY w.requested_at DESC
      LIMIT 50
    `);
    
    res.json({
      totalAmount: parseFloat(totalAmount[0].total) || 0,
      pendingWithdrawals: pendingWithdrawals[0].count,
      withdrawals: withdrawals
    });
  } catch (err) {
    console.error('Withdrawals API error:', err);
    res.status(500).json({ error: 'Failed to fetch withdrawal data' });
  }
});

app.get('/api/admin/tasks', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get completed tasks count
    const [completedTasks] = await pool.query('SELECT COUNT(*) FROM task_completions');
    
    // Get all tasks with completion statistics
    const [tasks] = await pool.query(`
      SELECT 
        t.id, t.description, t.status,
        (SELECT COUNT(*) FROM task_completions WHERE task_id = t.id) as completions,
        (SELECT COUNT(*) FROM task_completions WHERE task_id = t.id AND status = 'completed') as successful_completions,
        (SELECT AVG(TIMESTAMPDIFF(MINUTE, started_at, completed_at)) FROM task_completions WHERE task_id = t.id AND completed_at IS NOT NULL) as avg_completion_time
      FROM tasks t
      ORDER BY t.id DESC
    `);
    
    res.json({
      completedTasks: completedTasks[0]['COUNT(*)'],
      tasks: tasks
    });
  } catch (err) {
    console.error('Tasks API error:', err);
    res.status(500).json({ error: 'Failed to fetch task data' });
  }
});

// Get admin users for CEO management
app.get('/api/admin/admin-users', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Only CEO can access this endpoint
    const adminRole = req.headers['x-admin-role'] || req.query.role;
    if (adminRole !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can access admin users' });
    }
    
    const [adminUsers] = await pool.query(`
      SELECT id, name, username, role, is_active, created_at
      FROM admin_users 
      WHERE role != 'CEO'
      ORDER BY created_at DESC
    `);
    
    res.json(adminUsers);
  } catch (err) {
    console.error('❌ Get admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// Change admin password endpoint
app.post('/api/admin/change-admin-password', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const bcrypt = require('bcrypt');
    const { adminId, newPassword, ceoId, ceoRole } = req.body;

    if (!adminId || !newPassword || !ceoId || !ceoRole) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only CEO can change admin passwords
    if (ceoRole !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can change admin passwords' });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if admin exists
    const [adminRows] = await pool.query('SELECT id, name, username FROM admin_users WHERE id = ?', [adminId]);
    if (adminRows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const admin = adminRows[0];

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update admin's password
    await pool.query('UPDATE admin_users SET password = ? WHERE id = ?', [hashedPassword, adminId]);

    // Log the password change
    console.log(`CEO (ID: ${ceoId}) changed password for admin ${admin.name} (ID: ${adminId}, Username: ${admin.username})`);

    res.json({
      success: true,
      message: 'Admin password changed successfully',
      newPassword: newPassword // Return the plain password so CEO can share it with admin
    });

  } catch (err) {
    console.error('Change admin password error:', err);
    res.status(500).json({ error: 'Failed to change admin password' });
  }
});

// Toggle admin status endpoint
app.post('/api/admin/toggle-admin-status', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { adminId, action, ceoId, ceoRole } = req.body;

    if (!adminId || !action || !ceoId || !ceoRole) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only CEO can toggle admin status
    if (ceoRole !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can toggle admin status' });
    }

    // Check if admin exists
    const [adminRows] = await pool.query('SELECT id, name, username FROM admin_users WHERE id = ?', [adminId]);
    if (adminRows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const admin = adminRows[0];

    // Toggle the status
    const newStatus = action === 'suspend' ? 0 : 1;
    await pool.query('UPDATE admin_users SET is_active = ? WHERE id = ?', [newStatus, adminId]);

    // Log the action
    console.log(`CEO (ID: ${ceoId}) ${action}ed admin ${admin.name} (ID: ${adminId}, Username: ${admin.username})`);

    res.json({
      success: true,
      message: `Admin ${action}ed successfully`,
      newStatus: newStatus
    });

  } catch (err) {
    console.error('Toggle admin status error:', err);
    res.status(500).json({ error: 'Failed to toggle admin status' });
  }
});

// Appeals Management API
// Get all appeals
app.get('/api/admin/appeals', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔍 Fetching appeals...');
    const { pool } = require('./config/database');
    
    const [appeals] = await pool.query(`
      SELECT a.*, au.name as reviewed_by_name
      FROM appeals a
      LEFT JOIN admin_users au ON a.reviewed_by = au.id
      ORDER BY a.created_at DESC
    `);
    
    console.log(`✅ Found ${appeals.length} appeals`);
    
    res.json({
      success: true,
      appeals: appeals
    });
  } catch (err) {
    console.error('❌ Get appeals error:', err);
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

// Review appeal
app.post('/api/admin/appeals/:appealId/review', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { appealId } = req.params;
    const { status, admin_response } = req.body;
    const adminId = req.admin.id;
    const adminName = req.admin.username;
    
    // Validate input
    if (!status || !admin_response) {
      return res.status(400).json({ error: 'Status and admin response are required' });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be approved or rejected' });
    }
    
    // Check if appeal exists
    const [appealRows] = await pool.query(`
      SELECT * FROM appeals WHERE id = ?
    `, [appealId]);
    
    if (appealRows.length === 0) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    const appeal = appealRows[0];
    
    // Update appeal
    await pool.query(`
      UPDATE appeals 
      SET status = ?, admin_response = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ?
    `, [status, admin_response, adminId, appealId]);
    
    // If approved, reactivate user account
    if (status === 'approved') {
      await pool.query(`
        UPDATE users 
        SET is_active = 1 
        WHERE id = ?
      `, [appeal.user_id]);
      
      console.log(`✅ Appeal approved - User ${appeal.user_name} (ID: ${appeal.user_id}) account reactivated`);
    }
    
    console.log(`📝 Appeal ${appealId} ${status} by admin ${adminName} (ID: ${adminId})`);
    
    res.json({
      success: true,
      message: `Appeal ${status} successfully`
    });
    
  } catch (err) {
    console.error('❌ Review appeal error:', err);
    res.status(500).json({ error: 'Failed to review appeal' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve admin portal HTML for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Server will not start.');
      // process.exit(1);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Admin portal server running on http://0.0.0.0:${PORT}`);
      console.log(`🌐 Accessible from: http://localhost:${PORT} or http://[your-ip]:${PORT}`);
      if (dbConnected) {
        console.log(`📊 Database connected successfully`);
      } else {
        console.log(`⚠️ Database connection failed - some features may not work`);
      }
      console.log(`🔐 Authentication system ready`);
      console.log(`👥 User management system ready`);
      console.log(`📋 Task management system ready`);
      console.log(`💰 Payment & withdrawal system ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();