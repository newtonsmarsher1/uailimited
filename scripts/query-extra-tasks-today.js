const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    const sql = `
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.level,
        COALESCE(l.daily_tasks, 5) AS daily_limit,
        COUNT(ut.id) AS completed_today
      FROM users u
      LEFT JOIN levels l ON l.level = u.level
      LEFT JOIN user_tasks ut 
        ON ut.user_id = u.id 
       AND ut.is_complete = 1 
       AND DATE(ut.completed_at) = CURDATE()
      GROUP BY u.id, u.name, u.phone, u.level, l.daily_tasks
      HAVING completed_today > COALESCE(l.daily_tasks, 5)
      ORDER BY completed_today DESC, u.id ASC
    `;

    const [rows] = await pool.query(sql);

    if (rows.length === 0) {
      console.log('No users exceeded today\'s task limit.');
      process.exit(0);
    }

    console.log('Users who exceeded today\'s task limit:');
    console.log('ID\tName\tPhone\tLevel\tLimit\tCompleted');
    rows.forEach(r => {
      console.log(`${r.id}\t${r.name}\t${r.phone}\t${r.level}\t${r.daily_limit}\t${r.completed_today}`);
    });
  } catch (e) {
    console.error('Query error:', e);
    process.exit(1);
  } finally {
    pool.end();
  }
})();





