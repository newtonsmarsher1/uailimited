const pool = require('./db.js');

async function checkUserBalance() {
  try {
    console.log('💰 Checking user balance...\n');
    
    const userId = 7;
    
    // Get user details
    const [userRows] = await pool.query(`
      SELECT id, phone, balance 
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    if (userRows.length > 0) {
      const user = userRows[0];
      console.log(`👤 User ${user.id} (${user.phone})`);
      console.log(`💰 Current Balance: KES ${user.balance}`);
    }
    
    // Check the completed investment
    const [investments] = await pool.query(`
      SELECT id, amount, roi_percentage, duration_days, status, paid_out, paid_at
      FROM investments 
      WHERE user_id = ? AND status = 'completed'
      ORDER BY id DESC
    `, [userId]);
    
    if (investments.length > 0) {
      console.log('\n📊 Completed Investment Details:');
      investments.forEach(inv => {
        const principal = parseFloat(inv.amount);
        const dailyROI = inv.roi_percentage / 100;
        const totalROI = dailyROI * inv.duration_days;
        const interest = principal * totalROI;
        const totalPayout = principal + interest;
        
        console.log(`   Investment ID: ${inv.id}`);
        console.log(`   Principal: KES ${principal.toFixed(2)}`);
        console.log(`   Interest: KES ${interest.toFixed(2)}`);
        console.log(`   Total Payout: KES ${totalPayout.toFixed(2)}`);
        console.log(`   Paid At: ${inv.paid_at ? new Date(inv.paid_at).toLocaleString() : 'Not paid'}`);
      });
    }
    
    // Check recent notifications
    console.log('\n📢 Recent Notifications:');
    const [notifications] = await pool.query(`
      SELECT message, created_at 
      FROM notifications 
      WHERE user_id = ? AND message LIKE '%Investment matured%'
      ORDER BY created_at DESC 
      LIMIT 3
    `, [userId]);
    
    notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. [${notif.created_at}] ${notif.message}`);
    });
    
    console.log('\n✅ Balance check completed!');
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUserBalance(); 