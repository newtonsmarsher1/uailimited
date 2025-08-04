const pool = require('../db');

async function migrate() {
  try {
    // Check if the column already exists
    const [columns] = await pool.query("SHOW COLUMNS FROM admin_users LIKE 'first_login'");
    if (columns.length === 0) {
      await pool.query('ALTER TABLE admin_users ADD COLUMN first_login BOOLEAN DEFAULT 1');
      console.log("Migration complete: 'first_login' column added.");
    } else {
      console.log("Migration skipped: 'first_login' column already exists.");
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate(); 