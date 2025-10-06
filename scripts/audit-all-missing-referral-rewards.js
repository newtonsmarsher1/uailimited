const mysql = require('mysql2/promise');

async function auditAllMissingReferralRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Auditing All Missing Referral Rewards\n');
    
    // Find all users who are Level 1+ and have a referrer but no referral reward
    const [missingRewards] = await pool.query(`
      SELECT 
        u.id as invitee_id,
        u.name as invitee_name,
        u.phone as invitee_phone,
        u.level as invitee_level,
        u.referred_by,
        u.created_at as invitee_joined,
        referrer.id as inviter_id,
        referrer.name as inviter_name,
        referrer.phone as inviter_phone,
        referrer.level as inviter_level,
        referrer.wallet_balance as inviter_balance
      FROM users u
      LEFT JOIN users referrer ON (u.referred_by = referrer.invitation_code OR u.referred_by = referrer.id)
      LEFT JOIN referral_rewards rr ON (rr.inviter_id = referrer.id AND rr.user_id = u.id)
      WHERE u.level > 0 
        AND u.referred_by IS NOT NULL 
        AND referrer.id IS NOT NULL
        AND rr.id IS NULL
      ORDER BY u.created_at DESC
    `);
    
    if (missingRewards.length === 0) {
      console.log('✅ No missing referral rewards found!');
      return;
    }
    
    console.log(`❌ Found ${missingRewards.length} missing referral reward(s):\n`);
    
    const referralRewards = {
      1: 288,  // Level 1: KES 288
      2: 600,  // Level 2: KES 600
      3: 1200  // Level 3: KES 1200
    };
    
    let totalMissingAmount = 0;
    let fixedCount = 0;
    
    for (const missing of missingRewards) {
      const expectedReward = referralRewards[missing.invitee_level];
      
      console.log(`📋 Missing Reward #${fixedCount + 1}:`);
      console.log(`   Inviter: ${missing.inviter_name} (ID: ${missing.inviter_id})`);
      console.log(`   Invitee: ${missing.invitee_name} (ID: ${missing.invitee_id})`);
      console.log(`   Invitee Level: ${missing.invitee_level}`);
      console.log(`   Expected Reward: KES ${expectedReward}`);
      console.log(`   Invitee Joined: ${new Date(missing.invitee_joined).toLocaleDateString()}`);
      console.log(`   Inviter Level: ${missing.inviter_level}`);
      console.log(`   Inviter Balance: KES ${parseFloat(missing.inviter_balance).toFixed(2)}`);
      
      if (expectedReward) {
        try {
          // Check if inviter is a temporary worker (level 0)
          if (missing.inviter_level === 0) {
            // Temporary workers don't receive rewards immediately - hold them until upgrade
            await pool.query(`
              INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
              VALUES (?, ?, ?, ?, NOW(), 'pending')
            `, [missing.inviter_id, missing.invitee_id, missing.invitee_level, expectedReward]);
            
            console.log(`   ⏳ Created PENDING reward (inviter is temporary worker)`);
          } else {
            // Non-temporary workers receive rewards immediately
            const newBalance = parseFloat(missing.inviter_balance) + expectedReward;
            
            await pool.query(
              'UPDATE users SET wallet_balance = ? WHERE id = ?',
              [newBalance, missing.inviter_id]
            );
            
            // Record the referral reward as completed
            await pool.query(`
              INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
              VALUES (?, ?, ?, ?, NOW(), 'completed')
            `, [missing.inviter_id, missing.invitee_id, missing.invitee_level, expectedReward]);
            
            // Send notification to inviter
            await pool.query(`
              INSERT INTO notifications (user_id, message, type, created_at)
              VALUES (?, ?, 'referral_reward', NOW())
            `, [missing.inviter_id, `🎉 Congratulations! Your invitee upgraded to Level ${missing.invitee_level} and you earned KES ${expectedReward} referral reward!`]);
            
            console.log(`   ✅ Created COMPLETED reward - New balance: KES ${newBalance.toFixed(2)}`);
          }
          
          totalMissingAmount += expectedReward;
          fixedCount++;
          
        } catch (error) {
          console.log(`   ❌ Error creating reward: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  No reward defined for level ${missing.invitee_level}`);
      }
      
      console.log('');
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Missing rewards found: ${missingRewards.length}`);
    console.log(`   Rewards fixed: ${fixedCount}`);
    console.log(`   Total amount awarded: KES ${totalMissingAmount.toFixed(2)}`);
    
    if (fixedCount > 0) {
      console.log(`\n✅ Referral reward system audit and fix completed!`);
    }
    
  } catch (error) {
    console.error('❌ Error auditing referral rewards:', error.message);
  } finally {
    pool.end();
  }
}

auditAllMissingReferralRewards();




