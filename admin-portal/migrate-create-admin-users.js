const pool = require('../db');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        name VARCHAR(100),
        id_number VARCHAR(100),
        mobile VARCHAR(100),
        gmail VARCHAR(100),
        position VARCHAR(100),
        role VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        verified BOOLEAN DEFAULT 0,
        rejected BOOLEAN DEFAULT 0,
        first_login BOOLEAN DEFAULT 1
      )
    `);
    console.log("admin_users table created or already exists.");
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate(); 