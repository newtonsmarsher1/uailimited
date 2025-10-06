const mysql = require('mysql2/promise');

async function restoreBalancesAfterWithdrawalsFixed() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 RESTORING BALANCES AFTER TODAY\'S WITHDRAWALS');
    console.log('===============================================\n');

    // Get all withdrawals made today (approved ones)
    console.log('🔍 Step 1: Finding withdrawals made today...\n');

    const [todaysWithdrawals] = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.status,
        w.requested_at,
        w.processed_at,
        u.name,
        u.phone,
        u.wallet_balance
      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      WHERE DATE(w.requested_at) = CURDATE()
        AND w.status = 'approved'
      ORDER BY w.requested_at DESC
    `);

    console.log(`📊 Found ${todaysWithdrawals.length} approved withdrawals today:\n`);

    if (todaysWithdrawals.length > 0) {
      todaysWithdrawals.forEach(withdrawal => {
        console.log(`💰 ${withdrawal.name} (${withdrawal.phone})`);
        console.log(`   Amount: KES ${withdrawal.amount}`);
        console.log(`   Status: ${withdrawal.status}`);
        console.log(`   Requested: ${withdrawal.requested_at}`);
        console.log(`   Current Balance: KES ${withdrawal.wallet_balance}`);
        console.log('');
      });
    } else {
      console.log('❌ No approved withdrawals found for today\n');
    }

    // Calculate the balance each user should have after their withdrawals
    console.log('🔧 Step 2: Calculating correct balances after withdrawals...\n');

    // Group withdrawals by user
    const userWithdrawals = {};
    todaysWithdrawals.forEach(withdrawal => {
      if (!userWithdrawals[withdrawal.user_id]) {
        userWithdrawals[withdrawal.user_id] = {
          name: withdrawal.name,
          phone: withdrawal.phone,
          current_balance: parseFloat(withdrawal.wallet_balance),
          total_withdrawn: 0
        };
      }
      userWithdrawals[withdrawal.user_id].total_withdrawn += parseFloat(withdrawal.amount);
    });

    let restored = 0;

    for (const userId in userWithdrawals) {
      const user = userWithdrawals[userId];
      
      console.log(`👤 ${user.name} (${user.phone})`);
      console.log(`   Current Balance: KES ${user.current_balance}`);
      console.log(`   Total Withdrawn Today: KES ${user.total_withdrawn}`);
      
      // The balance should be current balance + total withdrawn (since withdrawals were deducted)
      const correctBalance = user.current_balance + user.total_withdrawn;
      
      console.log(`   Correct Balance: KES ${correctBalance}`);

      // Update the balance
      await pool.query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [correctBalance, userId]
      );

      console.log(`   ✅ Balance restored to KES ${correctBalance}\n`);
      restored++;
    }

    // Summary
    console.log('📊 RESTORATION SUMMARY');
    console.log('======================');
    console.log(`✅ Users with withdrawals restored: ${Object.keys(userWithdrawals).length}`);
    console.log(`📋 Total users processed: ${restored}`);

    if (restored > 0) {
      console.log('\n🎉 Balances restored to post-withdrawal state!');
      console.log('   • Users who withdrew today now have their balances as they were after withdrawals');
      console.log('   • Withdrawal amounts have been added back to their wallets');
    } else {
      console.log('\n⚠️ No withdrawals found to restore balances for');
    }

  } catch (error) {
    console.error('❌ Error restoring balances:', error.message);
  } finally {
    pool.end();
  }
}

restoreBalancesAfterWithdrawalsFixed();


