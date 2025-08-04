const pool = require('../db');

async function deleteHRId3() {
  try {
    const [result] = await pool.query("DELETE FROM admin_users WHERE id = 3 AND role = 'HR Manager'");
    console.log(`Deleted HR Manager with id 3. Rows affected: ${result.affectedRows}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to delete HR Manager with id 3:', err);
    process.exit(1);
  }
}

deleteHRId3(); 