const pool = require('./db.js');

async function checkUsersTable() {
  try {
    console.log('📋 Checking users table structure...');
    
    // Get table structure
    const [columns] = await pool.query(`DESCRIBE users`);
    console.log('📊 Users table columns:');
    columns.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Get sample user data
    const [users] = await pool.query(`
      SELECT * FROM users LIMIT 1
    `);
    
    if (users.length > 0) {
      console.log('\n📋 Sample user data:');
      const user = users[0];
      Object.keys(user).forEach(key => {
        console.log(`  ${key}: ${user[key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users table:', error);
  } finally {
    process.exit(0);
  }
}

checkUsersTable(); 