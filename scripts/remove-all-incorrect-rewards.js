const mysql = require('mysql2/promise');

async function removeAllIncorrectRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Removing All Incorrect Referral Rewards\n');
    
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
        inviter.name as inviter_name
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
    
    console.log(`❌ Found ${incorrectRewards.length} incorrect referral rewards to remove:`);
    console.log('=' .repeat(80));
    
    let totalIncorrectAmount = 0;
    let usersAffected = new Set();
    
    // Group by user for better display
    const rewardsByUser = {};
    incorrectRewards.forEach(reward => {
      if (!rewardsByUser[reward.user_id]) {
        rewardsByUser[reward.user_id] = [];
      }
      rewardsByUser[reward.user_id].push(reward);
      totalIncorrectAmount += parseFloat(reward.reward_amount);
      usersAffected.add(reward.user_id);
    });
    
    console.log(`Users affected: ${usersAffected.size}`);
    console.log(`Total incorrect amount: KES ${totalIncorrectAmount.toFixed(2)}\n`);
    
    // Show summary by user
    for (const [userId, userRewards] of Object.entries(rewardsByUser)) {
      const user = userRewards[0];
      const totalForUser = userRewards.reduce((sum, r) => sum + parseFloat(r.reward_amount), 0);
      
      console.log(`👤 ${user.user_name} (ID: ${user.user_id}, Phone: ${user.user_phone})`);
      console.log(`   Level: ${user.user_level}`);
      console.log(`   Current wallet: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
      console.log(`   Incorrect rewards: ${userRewards.length} (Total: KES ${totalForUser.toFixed(2)})`);
      
      // Calculate task earnings
      const [taskEarnings] = await pool.query(`
        SELECT COALESCE(SUM(reward_earned), 0) as total_earnings
        FROM user_tasks 
        WHERE user_id = ? AND is_complete = 1
      `, [userId]);
      
      const taskEarningsAmount = parseFloat(taskEarnings[0].total_earnings);
      const currentWallet = parseFloat(user.wallet_balance);
      const expectedWallet = taskEarningsAmount;
      const difference = currentWallet - expectedWallet;
      
      console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
      console.log(`   Expected wallet: KES ${expectedWallet.toFixed(2)}`);
      console.log(`   Difference: KES ${difference.toFixed(2)}`);
      
      if (Math.abs(difference) > 0.01) {
        if (difference > 0) {
          console.log(`   ⚠️  Has KES ${difference.toFixed(2)} MORE than expected`);
        } else {
          console.log(`   ⚠️  Has KES ${Math.abs(difference).toFixed(2)} LESS than expected`);
        }
      } else {
        console.log(`   ✅ Wallet balance is correct`);
      }
      console.log('');
    }
    
    // Remove all incorrect rewards
    console.log('🗑️  Removing all incorrect referral rewards...');
    console.log('=' .repeat(60));
    
    let rewardsRemoved = 0;
    let totalAmountRemoved = 0;
    
    for (const reward of incorrectRewards) {
      try {
        await pool.query('DELETE FROM referral_rewards WHERE id = ?', [reward.reward_id]);
        console.log(`✅ Removed reward ID ${reward.reward_id}: ${reward.user_name} - KES ${reward.reward_amount}`);
        rewardsRemoved++;
        totalAmountRemoved += parseFloat(reward.reward_amount);
      } catch (error) {
        console.error(`❌ Error removing reward ${reward.reward_id}:`, error.message);
      }
    }
    
    // Update wallet balances for affected users
    console.log('\n💰 Updating wallet balances...');
    console.log('=' .repeat(60));
    
    let walletsUpdated = 0;
    
    for (const userId of usersAffected) {
      try {
        // Calculate task earnings
        const [taskEarnings] = await pool.query(`
          SELECT COALESCE(SUM(reward_earned), 0) as total_earnings
          FROM user_tasks 
          WHERE user_id = ? AND is_complete = 1
        `, [userId]);
        
        const taskEarningsAmount = parseFloat(taskEarnings[0].total_earnings);
        
        // Update wallet to reflect only task earnings
        await pool.query(`
          UPDATE users 
          SET wallet_balance = ?
          WHERE id = ?
        `, [taskEarningsAmount, userId]);
        
        const user = incorrectRewards.find(r => r.user_id == userId);
        console.log(`✅ Updated ${user.user_name}: KES ${taskEarningsAmount.toFixed(2)} (task earnings only)`);
        walletsUpdated++;
        
      } catch (error) {
        console.error(`❌ Error updating wallet for user ${userId}:`, error.message);
      }
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(60));
    console.log(`Incorrect rewards removed: ${rewardsRemoved}`);
    console.log(`Total amount removed: KES ${totalAmountRemoved.toFixed(2)}`);
    console.log(`Wallets updated: ${walletsUpdated}`);
    console.log(`Users affected: ${usersAffected.size}`);
    
    // Verify the cleanup
    console.log('\n🔍 Verifying cleanup...');
    
    const [remainingRewards] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards 
      WHERE user_id IS NOT NULL
    `);
    
    console.log(`Remaining incorrect rewards: ${remainingRewards[0].count}`);
    
    if (remainingRewards[0].count === 0) {
      console.log('\n✅ All incorrect referral rewards have been successfully removed!');
      console.log('   - Only referrers should receive referral rewards');
      console.log('   - Invited users should only have task earnings in their wallets');
    } else {
      console.log('\n⚠️  Some incorrect rewards may still remain. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

removeAllIncorrectRewards();





