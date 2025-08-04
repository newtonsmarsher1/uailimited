const pool = require('../db');

async function migrate() {
  try {
    // Add 'question' column if it doesn't exist
    const [qCol] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'question'");
    if (qCol.length === 0) {
      await pool.query("ALTER TABLE tasks ADD COLUMN question VARCHAR(255) DEFAULT NULL");
      console.log("Added 'question' column to tasks table.");
    }
    // Add 'expected_answer' column if it doesn't exist
    const [aCol] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'expected_answer'");
    if (aCol.length === 0) {
      await pool.query("ALTER TABLE tasks ADD COLUMN expected_answer VARCHAR(255) DEFAULT NULL");
      console.log("Added 'expected_answer' column to tasks table.");
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate(); 