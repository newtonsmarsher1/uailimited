const mysql = require('mysql2/promise');

async function updateWilliamRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Updating William Momanyi\'s Referral Rewards\n');
    
    // Get William's details
    const [william] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance
      FROM users 
      WHERE name LIKE '%William%Momanyi%' OR name LIKE '%William%momanyi%'
    `);
    
    if (william.length === 0) {
      console.log('❌ William Momanyi not found in database');
      return;
    }
    
    const williamData = william[0];
    console.log(`👤 Updating rewards for: ${williamData.name} (ID: ${williamData.id})`);
    console.log(`   Current wallet balance: KES ${parseFloat(williamData.wallet_balance).toFixed(2)}`);
    
    // Define correct referral rewards based on level
    const correctRewards = {
      1: 288,  // Level 1: KES 288
      2: 600,  // Level 2: KES 600
      3: 1200, // Level 3: KES 1200
      4: 1800, // Level 4: KES 1800
      5: 2400, // Level 5: KES 2400
    };
    
    // Get all William's referral rewards
    const [rewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level
      FROM referral_rewards rr
      LEFT JOIN users u ON u.id = rr.user_id
      WHERE rr.inviter_id = ?
      ORDER BY rr.created_at DESC
    `, [williamData.id]);
    
    if (rewards.length === 0) {
      console.log('❌ No referral rewards found for William');
      return;
    }
    
    console.log(`\n📊 Found ${rewards.length} rewards to update:\n`);
    
    let totalDifference = 0;
    let rewardsUpdated = 0;
    
    for (const reward of rewards) {
      const correctAmount = correctRewards[reward.user_level];
      
      if (!correctAmount) {
        console.log(`⚠️  No reward defined for level ${reward.user_level} - skipping ${reward.user_name}`);
        continue;
      }
      
      const currentAmount = parseFloat(reward.reward_amount);
      const difference = correctAmount - currentAmount;
      
      if (difference !== 0) {
        try {
          // Update the reward amount in the database
          await pool.query(`
            UPDATE referral_rewards 
            SET reward_amount = ?
            WHERE id = ?
          `, [correctAmount, reward.id]);
          
          console.log(`✅ Updated ${reward.user_name} (Level ${reward.user_level}):`);
          console.log(`   Old amount: KES ${currentAmount.toFixed(2)}`);
          console.log(`   New amount: KES ${correctAmount.toFixed(2)}`);
          console.log(`   Difference: KES ${difference.toFixed(2)}`);
          
          totalDifference += difference;
          rewardsUpdated++;
          
        } catch (error) {
          console.error(`❌ Error updating reward ${reward.id}:`, error.message);
        }
      } else {
        console.log(`✅ ${reward.user_name} (Level ${reward.user_level}) already has correct amount: KES ${currentAmount.toFixed(2)}`);
      }
    }
    
    // Update William's wallet balance
    if (totalDifference !== 0) {
      const newBalance = parseFloat(williamData.wallet_balance) + totalDifference;
      
      await pool.query(`
        UPDATE users 
        SET wallet_balance = ?
        WHERE id = ?
      `, [newBalance, williamData.id]);
      
      console.log(`\n💰 Updated William's wallet balance:`);
      console.log(`   Old balance: KES ${parseFloat(williamData.wallet_balance).toFixed(2)}`);
      console.log(`   New balance: KES ${newBalance.toFixed(2)}`);
      console.log(`   Added: KES ${totalDifference.toFixed(2)}`);
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(60));
    console.log(`Rewards updated: ${rewardsUpdated}`);
    console.log(`Total amount added to wallet: KES ${totalDifference.toFixed(2)}`);
    console.log(`New wallet balance: KES ${(parseFloat(williamData.wallet_balance) + totalDifference).toFixed(2)}`);
    
    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    
    const [updatedRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.reward_amount,
        u.name as user_name,
        u.level as user_level
      FROM referral_rewards rr
      LEFT JOIN users u ON u.id = rr.user_id
      WHERE rr.inviter_id = ?
      ORDER BY u.level DESC, rr.created_at DESC
    `, [williamData.id]);
    
    console.log('\n📊 Updated Reward Summary:');
    console.log('User Name         | Level | Amount  | Status');
    console.log('-' .repeat(50));
    
    let totalEarned = 0;
    updatedRewards.forEach(reward => {
      const name = (reward.user_name || 'N/A').substring(0, 16).padEnd(16);
      const level = reward.user_level.toString().padEnd(5);
      const amount = `KES ${reward.reward_amount}`.padEnd(7);
      
      console.log(`${name} | ${level} | ${amount} | completed`);
      totalEarned += parseFloat(reward.reward_amount);
    });
    
    console.log(`\nTotal earned: KES ${totalEarned.toFixed(2)}`);
    
    if (rewardsUpdated > 0) {
      console.log('\n✅ William\'s referral rewards have been updated successfully!');
    } else {
      console.log('\n✅ No updates needed - all rewards were already correct.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

updateWilliamRewards();





