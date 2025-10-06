const mysql = require('mysql2/promise');

async function revertWalletChanges() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 Reverting Wallet Changes for All Users\n');
    
    // List of users whose wallets were modified during our investigation
    const usersToRevert = [
      { id: 234, name: 'Lawine Omuse', phone: '+254758432064', originalBalance: 85.00 },
      { id: 241, name: 'Judy', phone: '+254798687444', originalBalance: 1108.00 },
      { id: 55, name: 'William momanyi', phone: '0720868337', originalBalance: 531.50 },
      // Add other users that were mentioned or modified
    ];
    
    console.log('📋 Users to revert:');
    console.log('=' .repeat(60));
    console.log('User ID | Name                | Phone           | Original Balance');
    console.log('-' .repeat(60));
    
    usersToRevert.forEach(user => {
      const id = user.id.toString().padEnd(7);
      const name = user.name.substring(0, 18).padEnd(18);
      const phone = user.phone.substring(0, 14).padEnd(14);
      const balance = `KES ${user.originalBalance.toFixed(2)}`.padEnd(15);
      
      console.log(`${id} | ${name} | ${phone} | ${balance}`);
    });
    
    console.log('\n🔄 Reverting wallet balances...');
    console.log('=' .repeat(60));
    
    let walletsReverted = 0;
    
    for (const user of usersToRevert) {
      try {
        // Get current balance
        const [currentUser] = await pool.query(`
          SELECT id, name, phone, wallet_balance
          FROM users 
          WHERE id = ?
        `, [user.id]);
        
        if (currentUser.length === 0) {
          console.log(`❌ User ${user.name} (ID: ${user.id}) not found`);
          continue;
        }
        
        const currentBalance = parseFloat(currentUser[0].wallet_balance);
        const originalBalance = user.originalBalance;
        
        if (Math.abs(currentBalance - originalBalance) < 0.01) {
          console.log(`✅ ${user.name}: Already at original balance (KES ${currentBalance.toFixed(2)})`);
          continue;
        }
        
        // Revert to original balance
        await pool.query(`
          UPDATE users 
          SET wallet_balance = ?
          WHERE id = ?
        `, [originalBalance, user.id]);
        
        console.log(`✅ ${user.name}: KES ${currentBalance.toFixed(2)} → KES ${originalBalance.toFixed(2)}`);
        walletsReverted++;
        
      } catch (error) {
        console.error(`❌ Error reverting ${user.name}:`, error.message);
      }
    }
    
    // Also check for any other users that might have been affected
    console.log('\n🔍 Checking for other users that might need reverting...');
    
    // Get all users and check if their current balance matches their task earnings
    const [allUsers] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.wallet_balance,
        COALESCE(SUM(ut.reward_earned), 0) as task_earnings
      FROM users u
      LEFT JOIN user_tasks ut ON ut.user_id = u.id AND ut.is_complete = 1
      GROUP BY u.id, u.name, u.phone, u.wallet_balance
      HAVING ABS(u.wallet_balance - COALESCE(SUM(ut.reward_earned), 0)) > 0.01
      ORDER BY u.id
    `);
    
    if (allUsers.length > 0) {
      console.log(`\n⚠️  Found ${allUsers.length} users with wallet discrepancies:`);
      console.log('User ID | Name                | Current Balance | Task Earnings | Difference');
      console.log('-' .repeat(70));
      
      allUsers.forEach(user => {
        const id = user.id.toString().padEnd(7);
        const name = (user.name || 'N/A').substring(0, 18).padEnd(18);
        const current = `KES ${parseFloat(user.wallet_balance).toFixed(2)}`.padEnd(15);
        const earnings = `KES ${parseFloat(user.task_earnings).toFixed(2)}`.padEnd(13);
        const diff = `KES ${(parseFloat(user.wallet_balance) - parseFloat(user.task_earnings)).toFixed(2)}`.padEnd(10);
        
        console.log(`${id} | ${name} | ${current} | ${earnings} | ${diff}`);
      });
      
      console.log('\n❓ Do you want to revert these users to their task earnings?');
      console.log('   (This would set their wallets to only show task earnings)');
    } else {
      console.log('✅ No other users found with wallet discrepancies');
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(60));
    console.log(`Wallets reverted: ${walletsReverted}`);
    console.log(`Users checked: ${usersToRevert.length}`);
    console.log(`Other discrepancies found: ${allUsers.length}`);
    
    if (walletsReverted > 0) {
      console.log('\n✅ Wallet reversions completed!');
    } else {
      console.log('\n✅ No wallets needed reverting - all were already at original balances');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

revertWalletChanges();





