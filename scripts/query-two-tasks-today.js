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
        COUNT(ut.id) AS completed_today
      FROM user_tasks ut
      JOIN users u ON u.id = ut.user_id
      WHERE ut.is_complete = 1
        AND DATE(ut.completed_at) = CURDATE()
      GROUP BY ut.user_id
      HAVING completed_today = 2
      ORDER BY u.id ASC
    `;

    const [rows] = await pool.query(sql);

    if (rows.length === 0) {
      console.log('No users found with exactly 2 tasks completed today.');
      process.exit(0);
    }

    console.log('Users with exactly 2 tasks completed today:');
    rows.forEach(r => {
      console.log(`${r.id}\t${r.name}\t${r.phone}\t${r.completed_today}`);
    });
  } catch (e) {
    console.error('Query error:', e);
    process.exit(1);
  } finally {
    pool.end();
  }
})();





