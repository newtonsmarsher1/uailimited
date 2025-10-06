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

async function ensureAppTasksSeeded(connection) {
  try {
    const [[row]] = await connection.query('SELECT COUNT(*) AS c FROM app_tasks WHERE is_active=1');
    if ((row.c || 0) > 0) return { seeded: false, count: row.c };
  } catch (_) {}

  const defaults = [];
  // Seed 1..10 minimal set if table empty
  for (let i = 1; i <= 10; i++) {
    const names = {
      1: { n: 'TikTok', icon: '../assets/tiktok.png' },
      2: { n: 'Instagram', icon: '../assets/social.png' },
      3: { n: 'WhatsApp', icon: '../assets/whatsapp.png' },
      4: { n: 'Spotify', icon: '../assets/spotify.png' },
      5: { n: 'Netflix', icon: '../assets/video.png' },
      6: { n: 'YouTube', icon: '../assets/play.png' },
      7: { n: 'Facebook', icon: '../assets/facebook-messenger-logo.png' },
      8: { n: 'Twitter', icon: '../assets/social (1).png' },
      9: { n: 'Snapchat', icon: '../assets/social (2).png' },
      10: { n: 'LinkedIn', icon: '../assets/social (3).png' }
    }[i];
    defaults.push({ id: i, app_name: names.n, app_icon: names.icon });
  }
  for (const t of defaults) {
    await connection.query(
      'INSERT INTO app_tasks (id, app_name, app_icon, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE is_active=VALUES(is_active), app_name=VALUES(app_name), app_icon=VALUES(app_icon)'
      , [t.id, t.app_name, t.app_icon]
    );
  }
  return { seeded: true, count: defaults.length };
}

async function refreshUserByPhone(phone) {
  let connection;
  try {
    const variants = phoneVariants(phone);
    const placeholders = variants.map(() => '?').join(',');
    const [users] = await pool.query(
      `SELECT id, name, phone, level FROM users WHERE phone IN (${placeholders}) LIMIT 1`,
      variants
    );
    if (!users.length) throw new Error('User not found');
    const user = users[0];
    const effectiveLevel = user.level === 0 ? 1 : (user.level || 1);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const seedInfo = await ensureAppTasksSeeded(connection);

    // Available DB tasks by level
    let dbAvailable = 0;
    try {
      const [[row]] = await connection.query(
        'SELECT COUNT(*) AS c FROM tasks WHERE (bond_level_required IS NULL OR bond_level_required <= ?)',
        [effectiveLevel]
      );
      dbAvailable = row.c || 0;
    } catch (_) {
      const [[row2]] = await connection.query('SELECT COUNT(*) AS c FROM tasks');
      dbAvailable = row2.c || 0;
    }

    // App tasks
    let appAvailable = 0;
    try {
      const [[row]] = await connection.query('SELECT COUNT(*) AS c FROM app_tasks WHERE is_active=1');
      appAvailable = row.c || 0;
    } catch (_) {
      const [[row2]] = await connection.query('SELECT COUNT(*) AS c FROM app_tasks');
      appAvailable = row2.c || 0;
    }

    const available = Math.max(dbAvailable, appAvailable);
    const [[completedToday]] = await connection.query(
      'SELECT COUNT(*) AS c FROM user_tasks WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()',
      [user.id]
    );
    const ongoingEstimate = Math.max(0, available - (completedToday.c || 0));

    // If user appears to have zero ongoing despite available tasks, clean and notify
    if (available > 0 && ongoingEstimate === 0) {
      // Remove corrupt rows
      await connection.query('DELETE FROM user_tasks WHERE user_id=? AND (task_id IS NULL OR task_id=0)', [user.id]);

      // Ensure app tasks present
      await ensureAppTasksSeeded(connection);

      // Notify user to reopen Tasks
      await connection.query(
        'INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, "info", NOW())',
        [user.id, 'Your tasks were refreshed. Please reopen Tasks to see updates.']
      );
    }

    await connection.commit();

    // Recompute quick summary
    const [[completedTodayAfter]] = await pool.query(
      'SELECT COUNT(*) AS c FROM user_tasks WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()',
      [user.id]
    );

    return {
      user: { id: user.id, phone: user.phone, level: user.level },
      available,
      completedToday: completedTodayAfter.c || 0,
      seededAppTasks: seedInfo
    };
  } catch (e) {
    if (connection) { try { await connection.rollback(); } catch (_) {} }
    throw e;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  (async () => {
    try {
      const phone = process.argv[2];
      if (!phone) {
        console.error('Usage: node scripts/refresh-user-tasks.js <PHONE>');
        process.exit(1);
      }
      const result = await refreshUserByPhone(phone);
      console.log('Refresh result:', result);
    } catch (e) {
      console.error('Error:', e.message);
    } finally {
      pool.end();
    }
  })();
}

module.exports = { refreshUserByPhone };












