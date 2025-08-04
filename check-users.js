const pool = require('./db.js');

async function checkUsers() {
  try {
    console.log('👥 Checking users in database...');
    
    // Get all users
    const [users] = await pool.query(`
      SELECT id, phone, balance 
      FROM users 
      ORDER BY id
    `);
    
    console.log(`📊 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  ID: ${user.id}, Phone: ${user.phone}, Balance: KES ${user.balance || 0}`);
    });
    
    if (users.length === 0) {
      console.log('⚠️ No users found in database');
    } else {
      console.log(`✅ Use user ID ${users[0].id} for testing`);
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    process.exit(0);
  }
}

checkUsers(); 