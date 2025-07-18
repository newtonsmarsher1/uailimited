 const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db.js');
const bcrypt = require('bcrypt');
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
function pushNotification(userId, message, type="info") {
  if (!notifications[userId]) notifications[userId] = [];
  notifications[userId].unshift({ message, type, timestamp: new Date().toISOString() });
  if (notifications[userId].length > 20) notifications[userId].length = 20; // Keep last 20
}

app.get('/api/notifications', auth, async (req, res) => {
  res.json(notifications[req.user.id] || []);
});

// --- Language APIs ---
app.post('/api/set-lang', auth, async (req, res) => {
  const { lang } = req.body;
  if (!LANGUAGES[lang]) return res.status(400).json({ error: "Unsupported language" });
  await pool.query('UPDATE users SET language=? WHERE id=?', [lang, req.user.id]);
  res.json({ success: true });
});
app.get('/api/get-lang', auth, async (req, res) => {
  const [[user]] = await pool.query('SELECT language FROM users WHERE id=?', [req.user.id]);
  res.json({ lang: user.language || 'en', translations: LANGUAGES[user.language || 'en'] });
});

// --- Auth Routes with notification and user level logic ---
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
  pushNotification(user.id, "Login successful", "success");
  res.json({ 
    token, 
    user: { id: user.id, phone: user.phone, is_admin: !!user.is_admin, bond_level: user.bond_level, balance: user.balance, referral_code: user.referral_code, referred_by: user.referred_by }
  });
});

// --- User Home Info, Level Detection ---
app.get('/api/home', auth, async (req, res) => {
  const [userRows] = await pool.query('SELECT phone, bond_level, balance, referral_code FROM users WHERE id=?', [req.user.id]);
  res.json(userRows[0]);
});

// --- User profile & stats ---
app.get('/api/user-stats', auth, async (req, res) => {
  // Fetch all relevant user info
  const [[user]] = await pool.query('SELECT phone, bond_level as level, avatar, balance as wallet_balance, referral_code, referred_by, bond_level as bond, is_admin FROM users WHERE id=?', [req.user.id]);
  // Earnings: today's, monthly, total, withdrawal, etc.
  // Today's earnings
  const [todayRows] = await pool.query(`
    SELECT SUM(t.reward) as today_earning
    FROM user_tasks ut
    JOIN tasks t ON ut.task_id=t.id
    WHERE ut.user_id=? AND DATE(ut.completed_at)=CURDATE()
  `, [req.user.id]);
  // This month's earnings
  const [monthRows] = await pool.query(`
    SELECT SUM(t.reward) as month_earning
    FROM user_tasks ut
    JOIN tasks t ON ut.task_id=t.id
    WHERE ut.user_id=? AND MONTH(ut.completed_at)=MONTH(CURDATE()) AND YEAR(ut.completed_at)=YEAR(CURDATE())
  `, [req.user.id]);
  // Total revenue
  const [totalRows] = await pool.query(`
    SELECT SUM(t.reward) as total_revenue
    FROM user_tasks ut
    JOIN tasks t ON ut.task_id=t.id
    WHERE ut.user_id=?
  `, [req.user.id]);
  // Total withdrawal
  const [withdrawRows] = await pool.query(`
    SELECT SUM(amount) as total_withdrawal FROM withdrawals WHERE user_id=? AND status='approved'
  `, [req.user.id]);
  // Bond (amount paid)
  // You could add more logic for bond value per level
  // Tasks done
  const [tasksDone] = await pool.query(`
    SELECT COUNT(*) as tasks_done FROM user_tasks WHERE user_id=? AND is_complete=1
  `, [req.user.id]);
  res.json({
    phone: user.phone,
    level: user.level,
    avatar: user.avatar,
    today_earning: todayRows[0].today_earning || 0,
    month_earning: monthRows[0].month_earning || 0,
    total_revenue: totalRows[0].total_revenue || 0,
    total_withdrawal: withdrawRows[0].total_withdrawal || 0,
    wallet_balance: user.wallet_balance || 0,
    bond: user.bond || 0,
    tasks_done: tasksDone[0].tasks_done || 0,
    referral_code: user.referral_code,
    referred_by: user.referred_by
  });
});

// --- Task APIs (level logic included) ---
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
  pushNotification(req.user.id, `Task ${task.title} completed. Reward KES ${task.reward} credited.`, "success");
  res.json({ success: true, reward: task.reward });
});

// --- Payment & Recharge APIs ---
app.post('/api/pay', auth, async (req, res) => {
  // Here: receive a payment request and create a pending payment
  await pool.query('INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)', [req.user.id, req.body.amount, 'pending']);
  pushNotification(req.user.id, "Recharge initiated. Please complete payment.", "info");
  res.json({ status: "pending", message: "Pay to till 646875 and wait for confirmation." });
});

// Recharge Method 1: STK Push
app.post('/api/recharge-method1', auth, async (req, res) => {
  const { number, amount } = req.body;
  // TODO: Safaricom Daraja STK Push integration here
  await pool.query('INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)', [req.user.id, amount, 'pending']);
  pushNotification(req.user.id, `Recharge request via STK Push for ${amount} sent.`, "info");
  res.json({ message: "STK push sent. Enter your Mpesa PIN to complete payment." });
});

// Recharge Method 2: STK Push (alternate)
app.post('/api/recharge-method2', auth, async (req, res) => {
  const { number, amount } = req.body;
  // TODO: Safaricom logic
  await pool.query('INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)', [req.user.id, amount, 'pending']);
  pushNotification(req.user.id, `Recharge Method 2 request for ${amount} received.`, "info");
  res.json({ message: "STK push sent. Enter your Mpesa PIN to complete payment." });
});

// Recharge Method 3: Paybill Message
app.post('/api/recharge-method3', auth, async (req, res) => {
  const { mpesa_message } = req.body;
  // TODO: Parse message, validate, update payment
  await pool.query('INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)', [req.user.id, 0, 'pending']);
  pushNotification(req.user.id, "Mpesa message received. Awaiting verification.", "info");
  res.json({ message: "Payment message received. We will verify and update your balance shortly." });
});

// Recharge Method 4: Till Direct Pay
app.post('/api/recharge-method4', auth, async (req, res) => {
  // Usually, frontend just instructs user to pay; backend could verify payment via callback
  pushNotification(req.user.id, "Pay to Till Number 654321 to recharge.", "info");
  res.json({ message: "Pay to Till Number 654321 to recharge." });
});

// Payment Callback for M-PESA (set as your C2B confirmation url)
app.post('/api/mpesa-callback', async (req, res) => {
  // Parse Safaricom payload, update payment status, user's bond level
  // TODO: Implementation for Safaricom Daraja
  res.sendStatus(200);
});

// --- Withdrawals ---
app.post('/api/withdraw', auth, async (req, res) => {
  const { amount, pin } = req.body;
  // TODO: Validate user's PIN and balance
  await pool.query('INSERT INTO withdrawals (user_id, amount) VALUES (?, ?)', [req.user.id, amount]);
  pushNotification(req.user.id, `Withdrawal request for ${amount} submitted. Await admin approval.`, "info");
  res.json({ status: "pending", message: "Withdrawal requested. Await admin approval." });
});

// --- Bind withdrawal details ---
app.post('/api/bind-details', auth, async (req, res) => {
  const { details } = req.body;
  // Store withdrawal details securely
  await pool.query('UPDATE users SET withdrawal_details=? WHERE id=?', [details, req.user.id]);
  pushNotification(req.user.id, "Withdrawal details bound successfully.", "success");
  res.json({ message: "Withdrawal details saved." });
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

// Static files (Frontend)
app.use(express.static('public'));

app.listen(3000, () => console.log('Server running on http://localhost:3000'));