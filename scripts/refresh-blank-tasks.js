const pool = require('../backend/config/database');

async function ensureAppTasksSeeded(connection) {
  const [[cnt]] = await connection.query('SELECT COUNT(*) AS c FROM app_tasks WHERE is_active=1');
  if ((cnt.c || 0) > 0) return { seeded: false, count: cnt.c };

  const defaults = [
    { id: 1, app_name: 'TikTok', app_icon: '../assets/tiktok.png' },
    { id: 2, app_name: 'Instagram', app_icon: '../assets/social.png' },
    { id: 3, app_name: 'WhatsApp', app_icon: '../assets/whatsapp.png' },
    { id: 4, app_name: 'Spotify', app_icon: '../assets/spotify.png' },
    { id: 5, app_name: 'Netflix', app_icon: '../assets/video.png' },
    { id: 6, app_name: 'YouTube', app_icon: '../assets/play.png' },
    { id: 7, app_name: 'Facebook', app_icon: '../assets/facebook-messenger-logo.png' },
    { id: 8, app_name: 'Twitter', app_icon: '../assets/social (1).png' },
    { id: 9, app_name: 'Snapchat', app_icon: '../assets/social (2).png' },
    { id: 10, app_name: 'LinkedIn', app_icon: '../assets/social (3).png' }
  ];
  for (const t of defaults) {
    await connection.query(
      'INSERT INTO app_tasks (id, app_name, app_icon, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE is_active=VALUES(is_active), app_name=VALUES(app_name), app_icon=VALUES(app_icon)'
      , [t.id, t.app_name, t.app_icon]
    );
  }
  return { seeded: true, count: defaults.length };
}

async function refreshUsersWithBlankTasks() {
  let connection;
  const affected = [];
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const seedInfo = await ensureAppTasksSeeded(connection);

    // Fetch all non-admin users
    const [users] = await connection.query('SELECT id, level FROM users WHERE is_admin = 0');

    // Preload available tasks in DB
    let taskCountAll = { c: 0 };
    try {
      const [[row]] = await connection.query('SELECT COUNT(*) AS c FROM tasks');
      taskCountAll = row || { c: 0 };
    } catch (_) {
      taskCountAll = { c: 0 };
    }

    for (const user of users) {
      const effectiveLevel = user.level === 0 ? 1 : (user.level || 1);

      // Count available tasks for this level from tasks table
      let availDb = { c: 0 };
      try {
        const [[row]] = await connection.query(
          'SELECT COUNT(*) AS c FROM tasks WHERE (bond_level_required IS NULL OR bond_level_required <= ?)',
          [effectiveLevel]
        );
        availDb = row || { c: 0 };
      } catch (_) {
        // tasks table may not have bond_level_required; fallback to total count
        availDb = taskCountAll || { c: 0 };
      }

      // If tasks table is empty, rely on app_tasks/frontend defaults
      let availApp = { c: 0 };
      try {
        const [[row]] = await connection.query('SELECT COUNT(*) AS c FROM app_tasks WHERE is_active=1');
        availApp = row || { c: 0 };
      } catch (_) {
        try {
          const [[row2]] = await connection.query('SELECT COUNT(*) AS c FROM app_tasks');
          availApp = row2 || { c: 0 };
        } catch (_) {
          availApp = { c: 0 };
        }
      }

      // Completed today
      const [[completedToday]] = await connection.query(
        'SELECT COUNT(*) AS c FROM user_tasks WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()'
        , [user.id]
      );

      const available = Math.max(availDb.c || 0, availApp.c || 0);
      const ongoingEstimate = Math.max(0, available - (completedToday.c || 0));

      // Heuristic: if user has 0 available due to data issues, try fix; or if ongoing estimate is 0 while available > 0, try fix
      if (available > 0 && ongoingEstimate === 0) {
        // Cleanup any corrupt user_tasks rows for this user (null task_id)
        await connection.query('DELETE FROM user_tasks WHERE user_id=? AND (task_id IS NULL OR task_id=0)', [user.id]);

        // Make sure app_tasks are active as fallback
        await ensureAppTasksSeeded(connection);

        // Notify user to refresh tasks UI
        await connection.query(
          'INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, "info", NOW())',
          [user.id, 'Your daily tasks have been refreshed. If the page was blank, please reopen Tasks.']
        );

        affected.push(user.id);
      }
    }

    await connection.commit();
    return { affectedUsers: affected, seededAppTasks: seedInfo }; 
  } catch (e) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    throw e;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  (async () => {
    try {
      const result = await refreshUsersWithBlankTasks();
      console.log('Task refresh completed:', result);
    } catch (e) {
      console.error('Error:', e.message);
    } finally {
      pool.end();
    }
  })();
}

module.exports = { refreshUsersWithBlankTasks };


