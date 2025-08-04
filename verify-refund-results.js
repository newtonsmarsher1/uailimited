const pool = require('./db.js');

async function verifyRefundResults() {
  try {
    console.log('🔍 Verifying refund results...\n');
    
    // Check remaining active investments
    const [activeInvestments] = await pool.query(`
      SELECT COUNT(*) as count FROM investments WHERE status = 'active'
    `);
    
    console.log(`📊 Active investments remaining: ${activeInvestments[0].count}`);
    
    // Check cancelled investments
    const [cancelledInvestments] = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total_amount 
      FROM investments WHERE status = 'cancelled'
    `);
    
    console.log(`📊 Cancelled investments: ${cancelledInvestments[0].count}`);
    console.log(`💰 Total amount cancelled: KES ${cancelledInvestments[0].total_amount || 0}`);
    
    // Check user balances
    const [users] = await pool.query(`
      SELECT id, phone, balance 
      FROM users 
      WHERE id IN (SELECT DISTINCT user_id FROM investments WHERE status = 'cancelled')
      ORDER BY id
    `);
    
    console.log(`\n👥 Users affected:`);
    users.forEach(user => {
      console.log(`   User ${user.id} (${user.phone}): KES ${user.balance}`);
    });
    
    // Check notifications sent
    const [notifications] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE message LIKE '%investment%' AND message LIKE '%cancelled%'
    `);
    
    console.log(`\n📢 Refund notifications sent: ${notifications[0].count}`);
    
    // Show recent notifications
    const [recentNotifications] = await pool.query(`
      SELECT user_id, message, created_at 
      FROM notifications 
      WHERE message LIKE '%investment%' AND message LIKE '%cancelled%'
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log(`\n📋 Recent notifications:`);
    recentNotifications.forEach(notif => {
      console.log(`   User ${notif.user_id} at ${notif.created_at}:`);
      console.log(`   ${notif.message.substring(0, 100)}...`);
    });
    
    console.log('\n✅ Verification completed!');
    
    if (activeInvestments[0].count === 0) {
      console.log('🎉 All investments have been successfully cancelled and refunded!');
    } else {
      console.log('⚠️ Some active investments still remain.');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyRefundResults(); 