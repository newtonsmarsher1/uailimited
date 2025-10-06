const mysql = require('mysql2/promise');

async function reconstructWithdrawalsFromUsers() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Reconstructing Withdrawal Data from Users Table\n');
    
    // Get all users with total_withdrawn > 0
    const [usersWithWithdrawals] = await pool.query(`
      SELECT 
        id, name, phone, total_withdrawn, wallet_balance, created_at
      FROM users
      WHERE total_withdrawn > 0
      ORDER BY total_withdrawn DESC
    `);
    
    console.log(`📊 USERS WITH WITHDRAWAL HISTORY: ${usersWithWithdrawals.length}`);
    console.log(`Total withdrawn across all users: KES ${usersWithWithdrawals.reduce((sum, u) => sum + parseFloat(u.total_withdrawn), 0).toFixed(2)}\n`);
    
    console.log('📋 USERS WITH WITHDRAWALS (sorted by amount):');
    usersWithWithdrawals.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name} (ID: ${user.id}, Phone: ${user.phone})`);
      console.log(`   Total Withdrawn: KES ${parseFloat(user.total_withdrawn).toFixed(2)}`);
      console.log(`   Current Balance: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
      console.log(`   Joined: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    // Check if there are any existing withdrawal records for these users
    console.log('\n🔍 CHECKING FOR REMAINING WITHDRAWAL RECORDS:');
    for (const user of usersWithWithdrawals.slice(0, 5)) {
      const [withdrawals] = await pool.query(`
        SELECT id, amount, status, requested_at, processed_at
        FROM withdrawals 
        WHERE id IN (
          SELECT id FROM withdrawals ORDER BY id DESC
        )
        LIMIT 100
      `);
      
      if (withdrawals.length > 0) {
        console.log(`User ${user.name}: Found ${withdrawals.length} withdrawal records`);
      }
    }
    
    // Get the structure of withdrawals table
    const [tableStructure] = await pool.query(`
      DESCRIBE withdrawals
    `);
    
    console.log('\n📊 WITHDRAWALS TABLE STRUCTURE:');
    tableStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(required)'} ${col.Key ? `[${col.Key}]` : ''}`);
    });
    
    console.log('\n⚠️  RECOVERY OPTIONS:');
    console.log('\n1. DATABASE BACKUP RESTORATION:');
    console.log('   - Check if you have a MySQL database backup from before the deletion');
    console.log('   - Restore from .sql dump file or backup software');
    
    console.log('\n2. MANUAL RECONSTRUCTION:');
    console.log('   - Can create withdrawal records based on users\' total_withdrawn field');
    console.log('   - Will lose specific dates and approval details');
    console.log(`   - Would create ${usersWithWithdrawals.length} consolidated records`);
    
    console.log('\n3. APPLICATION LOGS:');
    console.log('   - Check server logs for withdrawal approval activity');
    console.log('   - May contain user IDs, amounts, and timestamps');
    
    console.log('\n4. ADMIN PORTAL LOGS:');
    console.log('   - Check browser console or network logs');
    console.log('   - May show recent withdrawal data before deletion');
    
  } catch (error) {
    console.error('❌ Error reconstructing data:', error.message);
  } finally {
    pool.end();
  }
}

reconstructWithdrawalsFromUsers();




