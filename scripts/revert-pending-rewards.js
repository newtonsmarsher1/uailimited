const mysql = require('mysql2/promise');

async function revertPendingRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 Reverting Pending Rewards to Correct Status\n');
    
    // First, let's see what rewards were processed today that should be reverted
    const [todayRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.inviter_id,
        rr.user_id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        inviter.level as inviter_level,
        inviter.wallet_balance as inviter_wallet
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE DATE(rr.created_at) = CURDATE()
        AND rr.status = 'completed'
      ORDER BY rr.created_at DESC
    `);
    
    console.log(`📊 Found ${todayRewards.length} rewards processed today that need review:\n`);
    
    let rewardsReverted = 0;
    let totalAmountReverted = 0;
    
    for (const reward of todayRewards) {
      // Check if the referrer is still at level 0 (temporary worker)
      if (reward.inviter_level === 0) {
        try {
          // Revert the wallet balance
          const currentBalance = parseFloat(reward.inviter_wallet);
          const newBalance = currentBalance - reward.reward_amount;
          
          // Update referrer's wallet (remove the reward)
          await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, reward.inviter_id]);
          
          // Change reward status back to pending
          await pool.query(`
            UPDATE referral_rewards 
            SET status = 'pending', processed_at = NULL
            WHERE id = ?
          `, [reward.id]);
          
          console.log(`⏳ Reverted reward to PENDING: ${reward.inviter_name} (Level 0) → KES ${reward.reward_amount}`);
          console.log(`   Wallet reverted: KES ${currentBalance.toFixed(2)} → KES ${newBalance.toFixed(2)}`);
          
          rewardsReverted++;
          totalAmountReverted += reward.reward_amount;
          
        } catch (error) {
          console.error(`❌ Error reverting reward ${reward.id}:`, error.message);
        }
      } else {
        console.log(`✅ Reward correctly COMPLETED: ${reward.inviter_name} (Level ${reward.inviter_level}) → KES ${reward.reward_amount}`);
      }
    }
    
    // Now check for any users who should have pending rewards but don't
    console.log('\n🔍 Checking for missing pending rewards...');
    
    const [missingPendingRewards] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level,
        u.referred_by,
        ref.id as referrer_id,
        ref.name as referrer_name,
        ref.phone as referrer_phone,
        ref.level as referrer_level,
        ref.wallet_balance as referrer_wallet
      FROM users u
      LEFT JOIN users ref ON (ref.id = u.referred_by OR ref.invitation_code = u.referred_by)
      LEFT JOIN referral_rewards rr ON rr.user_id = u.id AND rr.inviter_id = ref.id
      WHERE u.referred_by IS NOT NULL 
        AND ref.id IS NOT NULL
        AND u.level > 0
        AND ref.level = 0
        AND rr.id IS NULL
      ORDER BY u.created_at DESC
    `);
    
    if (missingPendingRewards.length > 0) {
      console.log(`📊 Found ${missingPendingRewards.length} missing pending rewards for Level 0 referrers:\n`);
      
      // Define referral rewards based on level
      const referralRewards = {
        1: 288,  // Level 1: KES 288
        2: 600,  // Level 2: KES 600
        3: 1200, // Level 3: KES 1200
        4: 1800, // Level 4: KES 1800
        5: 2400, // Level 5: KES 2400
      };
      
      for (const user of missingPendingRewards) {
        const rewardAmount = referralRewards[user.user_level];
        
        if (!rewardAmount) {
          console.log(`⚠️  No reward defined for level ${user.user_level} - skipping ${user.user_name}`);
          continue;
        }
        
        try {
          // Create pending reward for temporary worker
          await pool.query(`
            INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', NOW())
          `, [user.referrer_id, user.user_id, user.user_level, rewardAmount]);
          
          console.log(`⏳ Created PENDING reward: ${user.referrer_name} (Level 0) → ${user.user_name} (Level ${user.user_level}, KES ${rewardAmount})`);
          
        } catch (error) {
          console.error(`❌ Error creating pending reward for ${user.user_name}:`, error.message);
        }
      }
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(80));
    console.log(`Rewards reverted to pending: ${rewardsReverted}`);
    console.log(`Amount reverted: KES ${totalAmountReverted.toFixed(2)}`);
    console.log(`Missing pending rewards created: ${missingPendingRewards.length}`);
    
    // Verify the current state
    console.log('\n🔍 Current state verification:');
    
    const [currentPending] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.status = 'pending'
    `);
    
    const [currentCompleted] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.status = 'completed'
        AND inviter.level > 0
    `);
    
    console.log(`Pending rewards (Level 0 referrers): ${currentPending[0].count}`);
    console.log(`Completed rewards (Level 1+ referrers): ${currentCompleted[0].count}`);
    
    if (rewardsReverted > 0 || missingPendingRewards.length > 0) {
      console.log('\n✅ Pending rewards have been properly configured!');
      console.log('   Rewards will now persist until referrers reach Level 1.');
    } else {
      console.log('\n✅ No changes needed - pending rewards are already correctly configured.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

revertPendingRewards();





