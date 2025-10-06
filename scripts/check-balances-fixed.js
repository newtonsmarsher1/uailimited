const mysql = require('mysql2/promise');

async function checkBalancesFixed() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 CHECKING USER BALANCES - DETAILED');
    console.log('=====================================\n');

    // Check specific users mentioned in the referral issues
    const usersToCheck = [
      { phone: '0707582934', name: 'Eliezer Magati' },
      { phone: '+254703730012', name: 'CORNELIUS RUTO LONIKA' },
      { phone: '+254705878793', name: 'DENIS PKIACH' },
      { phone: '+254112174452', name: 'COSMAS SHIMWENYI MUSUNGU' },
      { phone: '+254716060176', name: 'Thaddeus Nyamache' },
      { phone: '0720868337', name: 'William momanyi' },
      { phone: '0106736692', name: 'Davies kind' }
    ];

    console.log('👤 SPECIFIC USERS CHECK:\n');

    for (const user of usersToCheck) {
      const [rows] = await pool.query(
        'SELECT id, name, phone, wallet_balance, level, referred_by FROM users WHERE phone = ?',
        [user.phone]
      );

      if (rows.length > 0) {
        const userData = rows[0];
        console.log(`👤 ${userData.name} (${userData.phone})`);
        console.log(`   ID: ${userData.id}`);
        console.log(`   Wallet Balance: KES ${userData.wallet_balance}`);
        console.log(`   Level: ${userData.level}`);
        console.log(`   Referred By: ${userData.referred_by || 'None'}`);
        
        // Check if this user has any referral rewards
        const [rewards] = await pool.query(
          'SELECT COUNT(*) as count FROM referral_rewards WHERE inviter_id = ?',
          [userData.id]
        );
        console.log(`   Referral Rewards Given: ${rewards[0].count}`);
        
        const [receivedRewards] = await pool.query(
          'SELECT COUNT(*) as count FROM referral_rewards WHERE user_id = ?',
          [userData.id]
        );
        console.log(`   Referral Rewards Received: ${receivedRewards[0].count}`);
        console.log('');
      } else {
        console.log(`❌ User not found: ${user.name} (${user.phone})\n`);
      }
    }

    // Check for any remaining referral rewards
    console.log('🔍 REFERRAL REWARDS CHECK:\n');
    
    const [remainingRewards] = await pool.query(
      'SELECT COUNT(*) as count FROM referral_rewards'
    );
    
    console.log(`📊 Total remaining referral reward records: ${remainingRewards[0].count}`);

    if (remainingRewards[0].count > 0) {
      const [rewards] = await pool.query(`
        SELECT 
          rr.id,
          rr.reward_amount,
          rr.status,
          rr.created_at,
          inviter.name as inviter_name,
          inviter.phone as inviter_phone,
          user.name as user_name,
          user.phone as user_phone
        FROM referral_rewards rr
        LEFT JOIN users inviter ON inviter.id = rr.inviter_id
        LEFT JOIN users user ON user.id = rr.user_id
        ORDER BY rr.created_at DESC
        LIMIT 10
      `);

      console.log('\n📋 Recent referral rewards:');
      rewards.forEach(reward => {
        console.log(`   • KES ${reward.reward_amount} - ${reward.inviter_name} → ${reward.user_name} (${reward.status})`);
      });
    } else {
      console.log('✅ No referral reward records found - all cleaned up!');
    }

    // Check wallet balance distribution
    console.log('\n📊 WALLET BALANCE ANALYSIS:\n');
    
    const [balanceStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        MIN(CAST(wallet_balance AS DECIMAL(10,2))) as min_balance,
        MAX(CAST(wallet_balance AS DECIMAL(10,2))) as max_balance,
        AVG(CAST(wallet_balance AS DECIMAL(10,2))) as avg_balance,
        SUM(CAST(wallet_balance AS DECIMAL(10,2))) as total_balance
      FROM users
    `);

    const stats = balanceStats[0];
    console.log(`📈 Balance Statistics:`);
    console.log(`   Total Users: ${stats.total_users}`);
    console.log(`   Min Balance: KES ${stats.min_balance}`);
    console.log(`   Max Balance: KES ${stats.max_balance}`);
    console.log(`   Average Balance: KES ${parseFloat(stats.avg_balance).toFixed(2)}`);
    console.log(`   Total Balance: KES ${stats.total_balance}`);

    // Check users with highest balances
    console.log('\n💰 TOP 10 USERS BY BALANCE:\n');
    
    const [topUsers] = await pool.query(`
      SELECT name, phone, wallet_balance, level
      FROM users 
      ORDER BY CAST(wallet_balance AS DECIMAL(10,2)) DESC 
      LIMIT 10
    `);

    topUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.phone}) - KES ${user.wallet_balance} (Level ${user.level})`);
    });

    // Check users with negative balances
    console.log('\n⚠️ USERS WITH NEGATIVE BALANCES:\n');
    
    const [negativeUsers] = await pool.query(`
      SELECT name, phone, wallet_balance, level
      FROM users 
      WHERE CAST(wallet_balance AS DECIMAL(10,2)) < 0
      ORDER BY CAST(wallet_balance AS DECIMAL(10,2)) ASC
    `);

    if (negativeUsers.length > 0) {
      negativeUsers.forEach(user => {
        console.log(`❌ ${user.name} (${user.phone}) - KES ${user.wallet_balance} (Level ${user.level})`);
      });
    } else {
      console.log('✅ No users with negative balances found');
    }

  } catch (error) {
    console.error('❌ Error checking balances:', error.message);
  } finally {
    pool.end();
  }
}

checkBalancesFixed();


