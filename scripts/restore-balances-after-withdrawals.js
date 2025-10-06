const mysql = require('mysql2/promise');

async function restoreBalancesAfterWithdrawals() {
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

    // Get all withdrawals made today
    console.log('🔍 Step 1: Finding withdrawals made today...\n');

    const [todaysWithdrawals] = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.status,
        w.created_at,
        u.name,
        u.phone,
        u.wallet_balance
      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      WHERE DATE(w.created_at) = CURDATE()
        AND w.status IN ('approved', 'completed')
      ORDER BY w.created_at DESC
    `);

    console.log(`📊 Found ${todaysWithdrawals.length} approved withdrawals today:\n`);

    if (todaysWithdrawals.length > 0) {
      todaysWithdrawals.forEach(withdrawal => {
        console.log(`💰 ${withdrawal.name} (${withdrawal.phone})`);
        console.log(`   Amount: KES ${withdrawal.amount}`);
        console.log(`   Status: ${withdrawal.status}`);
        console.log(`   Time: ${withdrawal.created_at}`);
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

    // Also restore users who didn't make withdrawals but had referral rewards
    console.log('🔧 Step 3: Restoring users who had referral rewards but no withdrawals...\n');

    // Get users who had referral rewards but didn't withdraw today
    const [usersWithRewards] = await pool.query(`
      SELECT DISTINCT
        u.id,
        u.name,
        u.phone,
        u.wallet_balance,
        u.level
      FROM users u
      WHERE u.phone IN ('0707582934', '+254703730012', '+254705878793', '+254112174452')
        AND u.id NOT IN (${Object.keys(userWithdrawals).length > 0 ? Object.keys(userWithdrawals).join(',') : '0'})
    `);

    console.log(`📊 Found ${usersWithRewards.length} users without withdrawals today:\n`);

    for (const user of usersWithRewards) {
      console.log(`👤 ${user.name} (${user.phone})`);
      console.log(`   Current Balance: KES ${user.wallet_balance}`);
      
      // These users should have their referral rewards added back
      // Calculate what referral rewards they should have
      
      // Check who they referred
      const [referredUsers] = await pool.query(`
        SELECT u2.id, u2.name, u2.level
        FROM users u2
        WHERE u2.referred_by = ? AND u2.level >= 1
      `, [user.id.toString()]);

      let referralRewards = 0;
      const rewardRates = { 1: 288, 2: 600, 3: 1200 };

      referredUsers.forEach(referred => {
        const reward = rewardRates[referred.level] || 0;
        referralRewards += reward;
        console.log(`   Referred: ${referred.name} (Level ${referred.level}) → KES ${reward}`);
      });

      const newBalance = parseFloat(user.wallet_balance) + referralRewards;
      
      console.log(`   Referral Rewards: KES ${referralRewards}`);
      console.log(`   New Balance: KES ${newBalance}`);

      await pool.query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [newBalance, user.id]
      );

      console.log(`   ✅ Balance updated to KES ${newBalance}\n`);
      restored++;
    }

    // Summary
    console.log('📊 RESTORATION SUMMARY');
    console.log('======================');
    console.log(`✅ Users with withdrawals restored: ${Object.keys(userWithdrawals).length}`);
    console.log(`✅ Users with referral rewards restored: ${usersWithRewards.length}`);
    console.log(`📋 Total users processed: ${restored}`);

    console.log('\n🎉 Balances restored to post-withdrawal state!');
    console.log('   • Users who withdrew today now have their balances as they were after withdrawals');
    console.log('   • Users with referral rewards have their rewards restored');

  } catch (error) {
    console.error('❌ Error restoring balances:', error.message);
  } finally {
    pool.end();
  }
}

restoreBalancesAfterWithdrawals();


