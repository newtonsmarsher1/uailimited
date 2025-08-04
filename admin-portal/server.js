const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection pool (reuse main db.js config if possible)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // update if needed
  password: 'Caroline', // update if needed
  database: 'uai',
  waitForConnections: true,
  connectionLimit: 10,
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Admin API Endpoints ---

// Get all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, phone, name, bond_level, balance, referral_code, is_admin FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all tasks
app.get('/api/admin/tasks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, title, bond_level_required, reward, videoUrl, question, expected_answer FROM tasks');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get all withdrawals
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, user_id, amount, status, requested_at FROM withdrawals');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// Approve withdrawal
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { withdrawal_id } = req.body;
  try {
    await pool.query('UPDATE withdrawals SET status="approved", processed_at=NOW() WHERE id=?', [withdrawal_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

// Reject withdrawal
app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { withdrawal_id } = req.body;
  try {
    await pool.query('UPDATE withdrawals SET status="rejected", processed_at=NOW() WHERE id=?', [withdrawal_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// Get all prizes (example: casino_wins table)
app.get('/api/admin/prizes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, user_id, prize, amount, date FROM casino_wins');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prizes' });
  }
});

// Get all workers (temporary and permanent)
app.get('/api/admin/workers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, phone, IF(is_temporary_worker, "Temporary", "Permanent") as type, IF(is_temporary_worker, "Active", "Permanent") as status, temp_worker_start_date as start_date FROM users WHERE is_temporary_worker=1 OR is_temporary_worker=0');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// --- Admin Users Table Setup (for reference) ---
// CREATE TABLE admin_users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(100) NOT NULL,
//   name VARCHAR(100),
//   id_number VARCHAR(100),
//   mobile VARCHAR(100),
//   gmail VARCHAR(100),
//   position VARCHAR(100),
//   role VARCHAR(50) NOT NULL,
//   password_hash VARCHAR(255) NOT NULL,
//   verified BOOLEAN DEFAULT 0,
//   rejected BOOLEAN DEFAULT 0,
//   first_login BOOLEAN DEFAULT 1
// );

// --- Registration Endpoint ---
// Default username and password for new users
const DEFAULT_USERNAME = 'Uaiagency';
const DEFAULT_PASSWORD = 'Uai@2025'; // Users must change this on first login

app.post('/api/admin/register', async (req, res) => {
  let { username, password, name, id_number, mobile, gmail, position, role } = req.body;
  // Set default username and password if not provided
  if (!username) username = DEFAULT_USERNAME;
  if (!password) password = DEFAULT_PASSWORD;
  if (!role) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const [exists] = await pool.query('SELECT id FROM admin_users WHERE username=? AND role=?', [username, role]);
    if (exists.length) return res.status(409).json({ error: 'Username already exists' });
    const hash = await bcrypt.hash(password, 10);
    // Set first_login=1 for new users
    await pool.query('INSERT INTO admin_users (username, password_hash, name, id_number, mobile, gmail, position, role, verified, rejected, first_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [username, hash, name, id_number, mobile, gmail, position, role, 0, 0, 1]);
    res.json({ success: true, defaultUsername: username, defaultPassword: password });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --- Login Endpoint (Role-based) ---
app.post('/api/admin/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM admin_users WHERE username=? AND role=?', [username, role]);
    if (!rows.length) {
      // Not registered
      return res.status(401).json({ error: 'Not yet registered' });
    }
    const user = rows[0];
    if (user.rejected) return res.status(403).json({ error: 'Access rejected by CEO' });
    if (role !== 'CEO' && !user.verified) return res.status(403).json({ error: 'Not yet verified by CEO' });

    if (role === 'CEO') {
      if (password !== 'Caroline') return res.status(401).json({ error: 'Invalid credentials' });
    } else {
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If admin is verified, always go to dashboard, ignore first_login
    if (user.verified) {
      return res.json({ userId: user.id, userRole: user.role, name: user.name });
    }

    // Only send to registration if not verified and first_login is true
    if (!user.verified && user.first_login) {
      return res.json({ firstLogin: true, userId: user.id, userRole: user.role, name: user.name });
    }

    // Default: go to dashboard
    res.json({ userId: user.id, userRole: user.role, name: user.name });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Complete Registration (Set New Password & Details) ---
app.post('/api/admin/complete-registration', async (req, res) => {
  const { userId, password, name, id_number, mobile, gmail, position } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE admin_users SET password_hash=?, name=?, id_number=?, mobile=?, gmail=?, position=?, first_login=0 WHERE id=?', [hash, name, id_number, mobile, gmail, position, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// --- Get All HR Managers (for dashboard) ---
app.get('/api/admin/hr-managers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, id_number, mobile, gmail, position, verified, rejected FROM admin_users WHERE role="HR Manager" AND rejected=0');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HR managers' });
  }
});

// --- CEO: Verify HR Manager ---
app.post('/api/admin/verify-hr', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing HR manager id' });
  try {
    await pool.query('UPDATE admin_users SET verified=1 WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify HR manager' });
  }
});

// --- CEO: Reject HR Manager ---
app.post('/api/admin/reject-hr', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing HR manager id' });
  try {
    await pool.query('UPDATE admin_users SET rejected=1 WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject HR manager' });
  }
});

// --- CEO: Change Worker Password (Demote/Discipline) ---
app.post('/api/admin/change-worker-password', async (req, res) => {
  const { workerId, newPassword } = req.body;
  if (!workerId || !newPassword) return res.status(400).json({ error: 'Missing workerId or newPassword' });
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, workerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change worker password' });
  }
});

// --- Admin User Details Endpoint ---
app.get('/api/admin/user-details', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'No user ID provided' });
  try {
    const [rows] = await pool.query('SELECT id, phone, name, bond_level, balance, referral_code, is_admin FROM users WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// --- Admin Change Password Endpoint ---
app.post('/api/admin/change-password', async (req, res) => {
  const { oldPassword, newPassword, targetRole } = req.body;
  if (!oldPassword || !newPassword || !targetRole) return res.status(400).json({ error: 'Missing fields' });
  try {
    if (targetRole === 'CEO') {
      // CEO password is stored in admin_settings
      const [rows] = await pool.query('SELECT value FROM admin_settings WHERE `key` = "admin_password"');
      if (!rows.length) return res.status(500).json({ error: 'Admin password not set in database' });
      const hash = rows[0].value;
      const match = await bcrypt.compare(oldPassword, hash);
      if (!match) return res.status(401).json({ error: 'Old password is incorrect' });
      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE admin_settings SET value=? WHERE `key`="admin_password"', [newHash]);
      return res.json({ success: true });
    } else {
      // Other roles: update in admin_users table
      const [users] = await pool.query('SELECT id, password_hash FROM admin_users WHERE role=? AND rejected=0 AND verified=1 LIMIT 1', [targetRole]);
      if (!users.length) return res.status(404).json({ error: `No active user found for role ${targetRole}` });
      const user = users[0];
      const match = await bcrypt.compare(oldPassword, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Old password is incorrect' });
      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE admin_users SET password_hash=? WHERE id=?', [newHash, user.id]);
      return res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// --- Admin User Count Endpoint ---
app.get('/api/admin/user-count', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// --- Admin Notifications Endpoint ---
app.get('/api/notifications', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const [rows] = await pool.query('SELECT id, message, type, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// --- Debug: Create notifications table and insert test notification ---
app.get('/api/debug-create-notifications-table', async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message VARCHAR(255) NOT NULL,
      type VARCHAR(20) DEFAULT 'info',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Insert a test notification for userId=1 (change as needed)
    await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)', [1, 'Test notification: Welcome to the admin portal!', 'info']);
    res.json({ success: true, message: 'Table created and test notification inserted for userId=1.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create table or insert notification', details: err.message });
  }
});

// --- Create Task ---
app.post('/api/admin/create-task', async (req, res) => {
  const { title, bond_level_required, reward, videoUrl, question, expected_answer } = req.body;
  if (!title || !bond_level_required || !reward) return res.status(400).json({ error: 'Missing required fields' });
  try {
    await pool.query('INSERT INTO tasks (title, bond_level_required, reward, videoUrl, question, expected_answer) VALUES (?, ?, ?, ?, ?, ?)', [title, bond_level_required, reward, videoUrl, question, expected_answer]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// --- Update Task (including videoUrl, question, expected_answer) ---
app.post('/api/admin/update-task', async (req, res) => {
  const { id, title, bond_level_required, reward, videoUrl, question, expected_answer } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing task id' });
  try {
    await pool.query('UPDATE tasks SET title=?, bond_level_required=?, reward=?, videoUrl=?, question=?, expected_answer=? WHERE id=?', [title, bond_level_required, reward, videoUrl, question, expected_answer, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// --- Delete Task ---
app.post('/api/admin/delete-task', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing task id' });
  try {
    await pool.query('DELETE FROM tasks WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Admin portal server running on http://localhost:${PORT}`);
});