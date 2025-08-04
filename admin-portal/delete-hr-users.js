const pool = require('../db');

async function deleteHRUsers() {
  try {
    const [result] = await pool.query("DELETE FROM admin_users WHERE role = 'HR Manager'");
    console.log(`Deleted ${result.affectedRows} HR Manager(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to delete HR Managers:', err);
    process.exit(1);
  }
}

deleteHRUsers(); 