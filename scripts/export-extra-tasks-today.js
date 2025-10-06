const fs = require('fs');
const path = require('path');
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
    const baseSql = `
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
    `;

    const [allRows] = await pool.query(baseSql + ` ORDER BY completed_today DESC, u.id ASC`);
    const [exceededRows] = await pool.query(baseSql + ` HAVING completed_today > COALESCE(l.daily_tasks, 5) ORDER BY completed_today DESC, u.id ASC`);

    const outDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    // Export exceeded list
    const exceededCsvPath = path.join(outDir, `extra_tasks_today.csv`);
    const header = 'id,name,phone,level,daily_limit,completed_today\n';
    const exceededCsv = header + exceededRows.map(r => [r.id, JSON.stringify(r.name), JSON.stringify(r.phone), r.level, r.daily_limit, r.completed_today].join(',')).join('\n');
    fs.writeFileSync(exceededCsvPath, exceededCsv);

    // Export full list
    const fullCsvPath = path.join(outDir, `all_users_tasks_today.csv`);
    const fullCsv = header + allRows.map(r => [r.id, JSON.stringify(r.name), JSON.stringify(r.phone), r.level, r.daily_limit, r.completed_today].join(',')).join('\n');
    fs.writeFileSync(fullCsvPath, fullCsv);

    console.log('Exported:');
    console.log(' -', exceededCsvPath);
    console.log(' -', fullCsvPath);
  } catch (e) {
    console.error('Export error:', e);
    process.exit(1);
  } finally {
    pool.end();
  }
})();





