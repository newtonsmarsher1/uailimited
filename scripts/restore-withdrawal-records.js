const mysql = require('mysql2/promise');

async function restoreWithdrawalRecords() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Restoring Withdrawal Records from Users\' Total Withdrawn\n');
    
    // Get all users with total_withdrawn > 0
    const [usersWithWithdrawals] = await pool.query(`
      SELECT 
        id, name, phone, total_withdrawn, created_at
      FROM users
      WHERE total_withdrawn > 0
      ORDER BY id ASC
    `);
    
    console.log(`📊 Found ${usersWithWithdrawals.length} users with withdrawal history`);
    console.log(`Total to restore: KES ${usersWithWithdrawals.reduce((sum, u) => sum + parseFloat(u.total_withdrawn), 0).toFixed(2)}\n`);
    
    let restored = 0;
    const now = new Date();
    
    for (const user of usersWithWithdrawals) {
      try {
        // Create a withdrawal record for this user
        const [result] = await pool.query(`
          INSERT INTO withdrawals (
            user_id, 
            amount, 
            status, 
            requested_at, 
            processed_at, 
            approved_by,
            admin_notes
          ) VALUES (?, ?, 'approved', ?, ?, 'System Recovery', 'Record restored from total_withdrawn field after accidental deletion')
        `, [
          user.id,
          user.total_withdrawn,
          user.created_at, // Use their join date as requested_at
          now // Use current time as processed_at
        ]);
        
        console.log(`✅ Restored: ${user.name} (ID: ${user.id}) - KES ${parseFloat(user.total_withdrawn).toFixed(2)}`);
        restored++;
        
      } catch (error) {
        console.log(`❌ Failed to restore for ${user.name}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 RESTORATION SUMMARY:`);
    console.log(`   Total users: ${usersWithWithdrawals.length}`);
    console.log(`   Records restored: ${restored}`);
    console.log(`   Failed: ${usersWithWithdrawals.length - restored}`);
    
    // Verify restoration
    const [verifyApproved] = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM withdrawals 
      WHERE status = 'approved'
    `);
    
    console.log(`\n✅ VERIFICATION:`);
    console.log(`   Approved withdrawals in database: ${verifyApproved[0].count}`);
    console.log(`   Total amount: KES ${parseFloat(verifyApproved[0].total || 0).toFixed(2)}`);
    
    console.log(`\n🎉 Withdrawal records restored successfully!`);
    console.log(`   You should now see ${restored} approved withdrawal records in the admin portal.`);
    
  } catch (error) {
    console.error('❌ Error restoring withdrawal records:', error.message);
  } finally {
    pool.end();
  }
}

restoreWithdrawalRecords();




