const pool = require('./db.js');

async function checkInvestmentStatus() {
  try {
    console.log('🔍 Checking current investment status...\n');
    
    // Check total investment records
    const [totalInvestments] = await pool.query('SELECT COUNT(*) as count FROM investments');
    console.log(`📊 Total investment records in database: ${totalInvestments[0].count}`);
    
    if (totalInvestments[0].count === 0) {
      console.log('✅ Database is clean - no investment records found');
    } else {
      console.log('⚠️ Investment records still exist in database');
      
      // Show all investments
      const [investments] = await pool.query(`
        SELECT id, user_id, fund_name, amount, status, created_at
        FROM investments
        ORDER BY id
      `);
      
      investments.forEach(inv => {
        console.log(`   ID: ${inv.id}, User: ${inv.user_id}, Fund: ${inv.fund_name}, Amount: ${inv.amount}, Status: ${inv.status}`);
      });
    }
    
    // Check user balances
    console.log('\n💰 Current user balances:');
    const [users] = await pool.query(`
      SELECT id, phone, balance 
      FROM users 
      ORDER BY id
    `);
    
    users.forEach(user => {
      console.log(`   User ${user.id} (${user.phone}): KES ${user.balance}`);
    });
    
    // Check if there are any recent notifications about refunds
    console.log('\n📢 Recent refund notifications:');
    const [notifications] = await pool.query(`
      SELECT user_id, message, created_at 
      FROM notifications 
      WHERE message LIKE '%cancelled%' AND message LIKE '%refunded%'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (notifications.length > 0) {
      notifications.forEach(notif => {
        console.log(`   User ${notif.user_id} at ${notif.created_at}:`);
        console.log(`   ${notif.message.substring(0, 80)}...`);
      });
    } else {
      console.log('   No refund notifications found');
    }
    
    console.log('\n✅ Status check completed!');
    
    if (totalInvestments[0].count === 0) {
      console.log('🎉 All investment records have been successfully removed!');
      console.log('💡 If you still see records in the frontend, try:');
      console.log('   1. Refresh the page (Ctrl+F5)');
      console.log('   2. Clear browser cache');
      console.log('   3. Check if you\'re looking at a different page');
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  } finally {
    process.exit(0);
  }
}

checkInvestmentStatus(); 