const mysql = require('mysql2/promise');

async function findIncorrectReferralRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Finding All Users with Incorrect Referral Rewards\n');
    
    // Find all users who received referral rewards (they shouldn't)
    const [incorrectRewards] = await pool.query(`
      SELECT 
        rr.id as reward_id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        u.id as user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level,
        u.wallet_balance,
        u.referred_by,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone
      FROM referral_rewards rr
      LEFT JOIN users u ON u.id = rr.user_id
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.user_id IS NOT NULL
      ORDER BY rr.created_at DESC
    `);
    
    if (incorrectRewards.length === 0) {
      console.log('✅ No incorrect referral rewards found');
      return;
    }
    
    console.log(`❌ Found ${incorrectRewards.length} incorrect referral rewards:`);
    console.log('=' .repeat(100));
    console.log('Reward ID | User Name         | User Phone    | Level | Amount  | Status    | Inviter Name      | Date');
    console.log('-' .repeat(100));
    
    let totalIncorrectAmount = 0;
    let usersAffected = new Set();
    
    incorrectRewards.forEach(reward => {
      const id = reward.reward_id.toString().padEnd(9);
      const userName = (reward.user_name || 'N/A').substring(0, 16).padEnd(16);
      const userPhone = (reward.user_phone || 'N/A').substring(0, 12).padEnd(12);
      const level = reward.user_level.toString().padEnd(5);
      const amount = `KES ${reward.reward_amount}`.padEnd(7);
      const status = reward.status.padEnd(9);
      const inviterName = (reward.inviter_name || 'N/A').substring(0, 16).padEnd(16);
      const date = new Date(reward.created_at).toLocaleDateString();
      
      console.log(`${id} | ${userName} | ${userPhone} | ${level} | ${amount} | ${status} | ${inviterName} | ${date}`);
      
      totalIncorrectAmount += parseFloat(reward.reward_amount);
      usersAffected.add(reward.user_id);
    });
    
    console.log('\n📊 Summary:');
    console.log('=' .repeat(60));
    console.log(`Total incorrect rewards: ${incorrectRewards.length}`);
    console.log(`Total incorrect amount: KES ${totalIncorrectAmount.toFixed(2)}`);
    console.log(`Users affected: ${usersAffected.size}`);
    
    // Show detailed breakdown by user
    console.log('\n👥 Detailed breakdown by user:');
    console.log('=' .repeat(80));
    
    for (const userId of usersAffected) {
      const userRewards = incorrectRewards.filter(r => r.user_id === userId);
      const user = userRewards[0];
      const totalForUser = userRewards.reduce((sum, r) => sum + parseFloat(r.reward_amount), 0);
      
      console.log(`\n👤 ${user.user_name} (ID: ${user.user_id}, Phone: ${user.user_phone})`);
      console.log(`   Level: ${user.user_level}`);
      console.log(`   Current wallet: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
      console.log(`   Referred by: ${user.referred_by}`);
      console.log(`   Incorrect rewards: ${userRewards.length} (Total: KES ${totalForUser.toFixed(2)})`);
      
      userRewards.forEach(reward => {
        console.log(`     - Reward ID ${reward.reward_id}: KES ${reward.reward_amount} from ${reward.inviter_name} (${reward.status})`);
      });
    }
    
    // Check if these rewards were actually added to wallets
    console.log('\n💰 Checking if rewards were added to wallets...');
    console.log('=' .repeat(80));
    
    for (const userId of usersAffected) {
      const userRewards = incorrectRewards.filter(r => r.user_id === userId);
      const user = userRewards[0];
      const totalForUser = userRewards.reduce((sum, r) => sum + parseFloat(r.reward_amount), 0);
      
      // Calculate expected task earnings
      const [taskEarnings] = await pool.query(`
        SELECT COALESCE(SUM(reward_earned), 0) as total_earnings
        FROM user_tasks 
        WHERE user_id = ? AND is_complete = 1
      `, [userId]);
      
      const taskEarningsAmount = parseFloat(taskEarnings[0].total_earnings);
      const currentWallet = parseFloat(user.wallet_balance);
      const expectedWallet = taskEarningsAmount; // Should only have task earnings
      const difference = currentWallet - expectedWallet;
      
      console.log(`\n👤 ${user.user_name}:`);
      console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
      console.log(`   Current wallet: KES ${currentWallet.toFixed(2)}`);
      console.log(`   Expected wallet: KES ${expectedWallet.toFixed(2)}`);
      console.log(`   Difference: KES ${difference.toFixed(2)}`);
      
      if (Math.abs(difference) > 0.01) {
        if (difference > 0) {
          console.log(`   ⚠️  Has KES ${difference.toFixed(2)} MORE than expected (likely from incorrect rewards)`);
        } else {
          console.log(`   ⚠️  Has KES ${Math.abs(difference).toFixed(2)} LESS than expected`);
        }
      } else {
        console.log(`   ✅ Wallet balance is correct (rewards not added to wallet)`);
      }
    }
    
    // Ask if user wants to fix these issues
    console.log('\n🔧 Next Steps:');
    console.log('=' .repeat(60));
    console.log('1. Remove all incorrect referral rewards from database');
    console.log('2. Update wallet balances to reflect only task earnings');
    console.log('3. Verify that only referrers receive referral rewards');
    
    console.log('\n⚠️  These users should NOT have received referral rewards:');
    for (const userId of usersAffected) {
      const user = incorrectRewards.find(r => r.user_id === userId);
      console.log(`   - ${user.user_name} (${user.user_phone}) - KES ${userRewards.filter(r => r.user_id === userId).reduce((sum, r) => sum + parseFloat(r.reward_amount), 0).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

findIncorrectReferralRewards();





