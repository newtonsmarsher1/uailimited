const mysql = require('mysql2/promise');

async function fixMissingReferralRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing Missing Referral Rewards\n');
    
    // Get all users who should have received rewards but didn't
    const [missingRewards] = await pool.query(`
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
        AND rr.id IS NULL
      ORDER BY u.created_at DESC
    `);
    
    if (missingRewards.length === 0) {
      console.log('✅ No missing referral rewards found');
      return;
    }
    
    console.log(`📊 Found ${missingRewards.length} missing referral rewards to process:\n`);
    
    // Define referral rewards based on level
    const referralRewards = {
      1: 288,  // Level 1: KES 288
      2: 600,  // Level 2: KES 600
      3: 1200, // Level 3: KES 1200
      4: 1800, // Level 4: KES 1800
      5: 2400, // Level 5: KES 2400
    };
    
    let totalRewardsProcessed = 0;
    let totalAmountAwarded = 0;
    
    for (const user of missingRewards) {
      const rewardAmount = referralRewards[user.user_level];
      
      if (!rewardAmount) {
        console.log(`⚠️  No reward defined for level ${user.user_level} - skipping ${user.user_name}`);
        continue;
      }
      
      try {
        // Check if referrer is temporary worker (level 0)
        if (user.referrer_level === 0) {
          // Create pending reward for temporary worker
          await pool.query(`
            INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', NOW())
          `, [user.referrer_id, user.user_id, user.user_level, rewardAmount]);
          
          console.log(`⏳ Created PENDING reward: ${user.referrer_name} → ${user.user_name} (Level ${user.user_level}, KES ${rewardAmount})`);
        } else {
          // Award immediate reward to non-temporary worker
          const newBalance = parseFloat(user.referrer_wallet) + rewardAmount;
          
          // Update referrer's wallet
          await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, user.referrer_id]);
          
          // Create completed reward record
          await pool.query(`
            INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at, processed_at)
            VALUES (?, ?, ?, ?, 'completed', NOW(), NOW())
          `, [user.referrer_id, user.user_id, user.user_level, rewardAmount]);
          
          console.log(`✅ Awarded COMPLETED reward: ${user.referrer_name} → ${user.user_name} (Level ${user.user_level}, KES ${rewardAmount})`);
          console.log(`   Referrer wallet updated: KES ${user.referrer_wallet} → KES ${newBalance.toFixed(2)}`);
          
          totalAmountAwarded += rewardAmount;
        }
        
        totalRewardsProcessed++;
        
      } catch (error) {
        console.error(`❌ Error processing reward for ${user.user_name}:`, error.message);
      }
    }
    
    // Process any pending rewards for users who have upgraded
    console.log('\n🔄 Processing pending rewards for upgraded users...');
    
    const [pendingRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.inviter_id,
        rr.user_id,
        rr.reward_amount,
        rr.created_at,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        inviter.level as inviter_level,
        inviter.wallet_balance as inviter_wallet
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.status = 'pending'
        AND inviter.level > 0
      ORDER BY rr.created_at ASC
    `);
    
    let pendingProcessed = 0;
    let pendingAmountAwarded = 0;
    
    for (const reward of pendingRewards) {
      try {
        const newBalance = parseFloat(reward.inviter_wallet) + reward.reward_amount;
        
        // Update referrer's wallet
        await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, reward.inviter_id]);
        
        // Update reward status to completed
        await pool.query(`
          UPDATE referral_rewards 
          SET status = 'completed', processed_at = NOW()
          WHERE id = ?
        `, [reward.id]);
        
        console.log(`✅ Processed PENDING reward: ${reward.inviter_name} (KES ${reward.reward_amount})`);
        console.log(`   Wallet updated: KES ${reward.inviter_wallet} → KES ${newBalance.toFixed(2)}`);
        
        pendingProcessed++;
        pendingAmountAwarded += reward.reward_amount;
        
      } catch (error) {
        console.error(`❌ Error processing pending reward ${reward.id}:`, error.message);
      }
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(80));
    console.log(`New rewards processed: ${totalRewardsProcessed}`);
    console.log(`Pending rewards processed: ${pendingProcessed}`);
    console.log(`Total amount awarded today: KES ${(totalAmountAwarded + pendingAmountAwarded).toFixed(2)}`);
    console.log(`New rewards amount: KES ${totalAmountAwarded.toFixed(2)}`);
    console.log(`Pending rewards amount: KES ${pendingAmountAwarded.toFixed(2)}`);
    
    // Verify the fixes
    console.log('\n🔍 Verifying fixes...');
    
    const [remainingMissing] = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN users ref ON (ref.id = u.referred_by OR ref.invitation_code = u.referred_by)
      LEFT JOIN referral_rewards rr ON rr.user_id = u.id AND rr.inviter_id = ref.id
      WHERE u.referred_by IS NOT NULL 
        AND ref.id IS NOT NULL
        AND u.level > 0
        AND rr.id IS NULL
    `);
    
    const [remainingPending] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.status = 'pending'
        AND inviter.level > 0
    `);
    
    console.log(`Remaining missing rewards: ${remainingMissing[0].count}`);
    console.log(`Remaining pending rewards: ${remainingPending[0].count}`);
    
    if (remainingMissing[0].count === 0 && remainingPending[0].count === 0) {
      console.log('\n✅ All referral reward issues have been fixed!');
    } else {
      console.log('\n⚠️  Some issues may still remain. Please review the results above.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

fixMissingReferralRewards();





