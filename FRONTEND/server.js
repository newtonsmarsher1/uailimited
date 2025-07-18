 const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db.js');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());
app.use(cors());
const JWT_SECRET = "UAI_SECRET";

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

// Auth Routes
app.post('/api/register', async (req, res) => {
  const { phone, password, referral } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    let ref = null;
    if (referral) {
      const [rows] = await pool.query('SELECT referral_code FROM users WHERE referral_code=?', [referral]);
      if (rows.length) ref = referral;
    }
    const referral_code = Math.random().toString(36).substr(2,8);
    await pool.query(
      'INSERT INTO users (phone, password, referral_code, referred_by) VALUES (?, ?, ?, ?)',
      [phone, hash, referral_code, ref]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Registration failed. Phone may already exist.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE phone=?', [phone]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, phone: user.phone, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '2d' });
  res.json({ token, user: { id: user.id, phone: user.phone, is_admin: !!user.is_admin, bond_level: user.bond_level, balance: user.balance, referral_code: user.referral_code, referred_by: user.referred_by } });
});

// Language Switch
app.post('/api/set-lang', auth, async (req, res) => {
  const { lang } = req.body;
  await pool.query('UPDATE users SET language=? WHERE id=?', [lang, req.user.id]);
  res.json({ success: true });
});

// User Home Info
app.get('/api/home', auth, async (req, res) => {
  const [userRows] = await pool.query('SELECT phone, bond_level, balance, referral_code FROM users WHERE id=?', [req.user.id]);
  res.json(userRows[0]);
});

// Referral Reward Logic
app.get('/api/my-referrals', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT phone FROM users WHERE referred_by=(SELECT referral_code FROM users WHERE id=?)', [req.user.id]);
  res.json(rows);
});

// Payment (M-PESA C2B)
app.post('/api/pay', auth, async (req, res) => {
  // Here: receive a payment request and create a pending payment
  // You should integrate Safaricom Daraja here
  await pool.query('INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)', [req.user.id, req.body.amount, 'pending']);
  res.json({ status: "pending", message: "Pay to till 646875 and wait for confirmation." });
});

// Payment Callback for M-PESA (set as your C2B confirmation url)
app.post('/api/mpesa-callback', async (req, res) => {
  // Parse Safaricom payload, find user based on reference, update payment status, and user's bond level
  // (Implementation requires your Daraja credentials and signature validation)
  res.sendStatus(200);
});

// Task Management
app.get('/api/tasks', auth, async (req, res) => {
  const [[user]] = await pool.query('SELECT bond_level FROM users WHERE id=?', [req.user.id]);
  const [tasks] = await pool.query('SELECT * FROM tasks WHERE bond_level_required<=?', [user.bond_level]);
  const [done] = await pool.query('SELECT task_id FROM user_tasks WHERE user_id=? AND is_complete=1', [req.user.id]);
  const doneIds = new Set(done.map(r => r.task_id));
  res.json(tasks.map(t => ({ ...t, completed: doneIds.has(t.id) })));
});
app.post('/api/complete-task', auth, async (req, res) => {
  const { task_id } = req.body;
  const [[task]] = await pool.query('SELECT * FROM tasks WHERE id=?', [task_id]);
  if (!task) return res.status(400).json({ error: 'Invalid task' });
  const [rows] = await pool.query('SELECT * FROM user_tasks WHERE user_id=? AND task_id=?', [req.user.id, task_id]);
  if (rows.length && rows[0].is_complete) return res.status(400).json({ error: 'Task already completed' });
  await pool.query('INSERT INTO user_tasks (user_id, task_id, is_complete, completed_at) VALUES (?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE is_complete=1, completed_at=NOW()', [req.user.id, task_id]);
  await pool.query('UPDATE users SET balance=balance+? WHERE id=?', [task.reward, req.user.id]);
  res.json({ success: true, reward: task.reward });
});

// Withdrawals
app.post('/api/withdraw', auth, async (req, res) => {
  const { amount } = req.body;
  await pool.query('INSERT INTO withdrawals (user_id, amount) VALUES (?, ?)', [req.user.id, amount]);
  res.json({ status: "pending", message: "Withdrawal requested. Await admin approval." });
});

// Admin APIs
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
  res.json({ success: true });
});
app.post('/api/admin/reject-withdrawal', auth, admin, async (req, res) => {
  const { withdrawal_id } = req.body;
  await pool.query('UPDATE withdrawals SET status="rejected", processed_at=NOW() WHERE id=?', [withdrawal_id]);
  res.json({ success: true });
});

// Static files (Frontend)
app.use(express.static('public'));

app.listen(3000, () => console.log('Server running on http://localhost:3000'));