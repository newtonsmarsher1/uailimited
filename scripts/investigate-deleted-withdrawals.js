const mysql = require('mysql2/promise');

async function investigateDeletedWithdrawals() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Deleted Withdrawal Records\n');
    
    // Check current approved withdrawals
    const [currentApproved] = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM withdrawals 
      WHERE status = 'approved'
    `);
    
    console.log('📊 CURRENT APPROVED WITHDRAWALS:');
    console.log(`   Count: ${currentApproved[0].count}`);
    console.log(`   Total Amount: KES ${parseFloat(currentApproved[0].total || 0).toFixed(2)}`);
    
    // Check all withdrawals
    const [allWithdrawals] = await pool.query(`
      SELECT status, COUNT(*) as count, SUM(amount) as total
      FROM withdrawals 
      GROUP BY status
    `);
    
    console.log('\n📊 ALL WITHDRAWALS BY STATUS:');
    allWithdrawals.forEach(row => {
      console.log(`   ${row.status}: ${row.count} records, KES ${parseFloat(row.total || 0).toFixed(2)}`);
    });
    
    // Check if there's a withdrawals_backup or audit table
    const [tables] = await pool.query(`
      SHOW TABLES LIKE '%withdrawal%'
    `);
    
    console.log('\n📋 WITHDRAWAL-RELATED TABLES:');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });
    
    // Check users' total_withdrawn field to estimate what was approved
    const [userTotals] = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as users_with_withdrawals,
        SUM(total_withdrawn) as total_withdrawn_sum
      FROM users
      WHERE total_withdrawn > 0
    `);
    
    console.log('\n👥 USERS WITH WITHDRAWAL HISTORY:');
    console.log(`   Users: ${userTotals[0].users_with_withdrawals}`);
    console.log(`   Total Withdrawn (from users table): KES ${parseFloat(userTotals[0].total_withdrawn_sum || 0).toFixed(2)}`);
    
    // Get detailed list of users with total_withdrawn
    const [usersWithWithdrawals] = await pool.query(`
      SELECT 
        id, name, phone, total_withdrawn, wallet_balance
      FROM users
      WHERE total_withdrawn > 0
      ORDER BY total_withdrawn DESC
      LIMIT 20
    `);
    
    console.log('\n📋 TOP USERS BY TOTAL_WITHDRAWN (from users table):');
    usersWithWithdrawals.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.name} (${user.phone})`);
      console.log(`      Total Withdrawn: KES ${parseFloat(user.total_withdrawn).toFixed(2)}`);
      console.log(`      Current Balance: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
    });
    
    // Check if we can find recent deletions in binary logs or general log
    console.log('\n⚠️  RECOVERY OPTIONS:');
    console.log('   1. If withdrawals table still has records with status "approved", they are intact');
    console.log('   2. If records were deleted, check for:');
    console.log('      - Database backups');
    console.log('      - Binary logs (if enabled)');
    console.log('      - Application logs with withdrawal data');
    console.log('   3. Users\' total_withdrawn field can help reconstruct some data');
    
    // Check for any recent pending/rejected withdrawals that might give us clues
    const [recentWithdrawals] = await pool.query(`
      SELECT 
        id, user_id, amount, status, requested_at, processed_at, approved_by, rejected_by
      FROM withdrawals 
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log('\n📋 MOST RECENT WITHDRAWAL RECORDS:');
    recentWithdrawals.forEach(w => {
      console.log(`   ID: ${w.id}, User: ${w.user_id}, Amount: KES ${w.amount}, Status: ${w.status}`);
      console.log(`      Requested: ${w.requested_at}, Processed: ${w.processed_at || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error investigating withdrawals:', error.message);
  } finally {
    pool.end();
  }
}

investigateDeletedWithdrawals();




