const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root', // change if needed
    password: 'Caroline', // change if needed
    database: 'uai',
    waitForConnections: true,
    connectionLimit: 10,
  });

  const password = 'admin123'; // initial password
  const hash = await bcrypt.hash(password, 10);

  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      \`key\` VARCHAR(64) PRIMARY KEY,
      value TEXT
    )
  `);

  // Insert or update the admin password
  await pool.query(
    'INSERT INTO admin_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
    ['admin_password', hash]
  );

  console.log('Admin password initialized!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 