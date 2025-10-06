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
    console.error('Usage: node scripts/revert-withdrawal.js <PHONE>');
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  let conn;
  try {
    const variants = phoneVariants(phone);
    const placeholders = variants.map(() => '?').join(',');
    const [users] = await pool.query(
      `SELECT id, name, phone, wallet_balance, total_withdrawn FROM users WHERE phone IN (${placeholders}) LIMIT 1`,
      variants
    );
    if (!users.length) {
      throw new Error('User not found for phone ' + phone);
    }
    const user = users[0];
    console.log('User:', { id: user.id, name: user.name, phone: user.phone, wallet_balance: user.wallet_balance, total_withdrawn: user.total_withdrawn });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [wdRows] = await conn.query(
      `SELECT id, amount, status, requested_at, processed_at FROM withdrawals 
       WHERE user_id = ? AND DATE(requested_at) = ? 
       ORDER BY requested_at DESC LIMIT 1`,
      [user.id, today]
    );
    if (!wdRows.length) {
      throw new Error('No withdrawal found for today');
    }
    const wd = wdRows[0];
    console.log('Found today withdrawal:', wd);

    if (wd.status === 'rejected') {
      // Undo refund: subtract same amount from wallet, add back to total_withdrawn
      await conn.query(
        'UPDATE users SET wallet_balance = wallet_balance - ?, total_withdrawn = total_withdrawn + ? WHERE id = ?',
        [wd.amount, wd.amount, user.id]
      );
      await conn.query(
        'UPDATE withdrawals SET status = "pending", processed_at = NULL, rejected_by = NULL, requested_at = NOW() WHERE id = ?',
        [wd.id]
      );

      const [payRows] = await conn.query(
        `SELECT id FROM payments 
         WHERE user_id = ? AND payment_method = 'withdrawal' AND status = 'rejected' 
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );
      if (payRows.length) {
        await conn.query('UPDATE payments SET status = "pending", processed_at = NULL WHERE id = ?', [payRows[0].id]);
      }

      await conn.query(
        'INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, "info", NOW())',
        [user.id, `Your withdrawal of KES ${wd.amount} has been restored to pending. Wallet adjusted accordingly.`]
      );

      await conn.commit();
      const [[after]] = await pool.query('SELECT wallet_balance, total_withdrawn FROM users WHERE id = ?', [user.id]);
      console.log('Reverted rejection. Balances after:', after);
    } else if (wd.status === 'approved') {
      throw new Error("Today's withdrawal is approved; manual review required to revert.");
    } else {
      // Pending: ensure requested_at is today
      const reqDate = (wd.requested_at instanceof Date ? wd.requested_at : new Date(wd.requested_at)).toISOString().slice(0,10);
      if (reqDate !== today) {
        await conn.query('UPDATE withdrawals SET requested_at = NOW(), processed_at = NULL WHERE id = ?', [wd.id]);
        // Also ensure related payment record is pending
        await conn.query(`UPDATE payments SET status='pending', processed_at=NULL WHERE user_id=? AND payment_method='withdrawal' AND status!='approved' ORDER BY created_at DESC LIMIT 1`, [user.id]);
        console.log('Normalized pending withdrawal date to today.');
      } else {
        console.log('Withdrawal already pending for today.');
      }
      await conn.commit();
    }
  } catch (e) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error('Error:', e.message);
  } finally {
    if (conn) conn.release();
    pool.end();
  }
}

main();


