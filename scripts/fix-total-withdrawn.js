const pool = require('../backend/config/database');

function normalizeDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function phoneVariants(phone) {
  const d = normalizeDigits(phone);
  const v = new Set();
  if (d.startsWith('0') && d.length === 10) {
    v.add('+254' + d.slice(1));
    v.add('254' + d.slice(1));
    v.add(d);
    v.add(d.slice(1));
  } else if (d.startsWith('254') && d.length === 12) {
    v.add('+' + d);
    v.add(d);
    v.add('0' + d.slice(3));
    v.add(d.slice(3));
  } else if ((d.startsWith('7') || d.startsWith('1')) && d.length === 9) {
    v.add('0' + d);
    v.add('+254' + d);
    v.add('254' + d);
    v.add(d);
  } else {
    v.add(phone);
    v.add(d);
  }
  return Array.from(v);
}

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: node scripts/fix-total-withdrawn.js <PHONE>');
    process.exit(1);
  }
  try {
    const variants = phoneVariants(phone);
    const placeholders = variants.map(() => '?').join(',');
    const [users] = await pool.query(
      `SELECT id, name, phone, wallet_balance, total_withdrawn FROM users WHERE phone IN (${placeholders}) LIMIT 1`,
      variants
    );
    if (!users.length) throw new Error('User not found');
    const user = users[0];
    const [sumRows] = await pool.query(
      'SELECT COALESCE(SUM(amount),0) AS sumApproved FROM withdrawals WHERE user_id = ? AND status = "approved"',
      [user.id]
    );
    const sumApproved = Math.max(0, parseFloat(sumRows[0].sumApproved || 0));
    await pool.query('UPDATE users SET total_withdrawn = ? WHERE id = ?', [sumApproved, user.id]);
    const [[after]] = await pool.query('SELECT wallet_balance, total_withdrawn FROM users WHERE id = ?', [user.id]);
    console.log({ user: { id: user.id, phone: user.phone }, recalculated_total_withdrawn: sumApproved, after });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

main();















