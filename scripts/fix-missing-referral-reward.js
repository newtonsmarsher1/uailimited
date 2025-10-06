const mysql = require('mysql2/promise');

async function fixMissingReferralReward() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing Missing Referral Reward\n');
    
    const inviterId = 143; // Davies kind
    const inviteeId = 293; // AMOS KIPLANGAT KIPKALIA
    
    // Get both users' details
    const [inviter] = await pool.query(`
      SELECT id, name, phone, level, invitation_code, wallet_balance
      FROM users WHERE id = ?
    `, [inviterId]);
    
    const [invitee] = await pool.query(`
      SELECT id, name, phone, level, referred_by, created_at
      FROM users WHERE id = ?
    `, [inviteeId]);
    
    if (inviter.length === 0 || invitee.length === 0) {
      console.log('❌ Users not found');
      return;
    }
    
    const inviterData = inviter[0];
    const inviteeData = invitee[0];
    
    console.log('📋 USER DETAILS:');
    console.log(`Inviter: ${inviterData.name} (ID: ${inviterData.id})`);
    console.log(`  Phone: ${inviterData.phone}`);
    console.log(`  Level: ${inviterData.level}`);
    console.log(`  Current Wallet: KES ${parseFloat(inviterData.wallet_balance).toFixed(2)}`);
    
    console.log(`\nInvitee: ${inviteeData.name} (ID: ${inviteeData.id})`);
    console.log(`  Phone: ${inviteeData.phone}`);
    console.log(`  Level: ${inviteeData.level}`);
    console.log(`  Joined: ${new Date(inviteeData.created_at).toLocaleDateString()}`);
    
    // Check if referral reward already exists
    const [existingRewards] = await pool.query(`
      SELECT id, reward_amount, status, created_at
      FROM referral_rewards 
      WHERE inviter_id = ? AND user_id = ?
    `, [inviterId, inviteeId]);
    
    if (existingRewards.length > 0) {
      console.log('\n⚠️  Referral reward already exists:');
      existingRewards.forEach((reward, idx) => {
        console.log(`  ${idx + 1}. ID: ${reward.id}, Amount: KES ${reward.reward_amount}, Status: ${reward.status}`);
      });
      return;
    }
    
    // Define referral rewards based on level
    const referralRewards = {
      1: 288,  // Level 1: KES 288
      2: 600,  // Level 2: KES 600
      3: 1200  // Level 3: KES 1200
    };
    
    const rewardAmount = referralRewards[inviteeData.level];
    
    if (!rewardAmount) {
      console.log(`❌ No referral reward defined for level ${inviteeData.level}`);
      return;
    }
    
    console.log(`\n💰 CREATING REFERRAL REWARD: KES ${rewardAmount}`);
    
    // Check if inviter is a temporary worker (level 0)
    if (inviterData.level === 0) {
      // Temporary workers don't receive rewards immediately - hold them until upgrade
      await pool.query(`
        INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
        VALUES (?, ?, ?, ?, NOW(), 'pending')
      `, [inviterId, inviteeId, inviteeData.level, rewardAmount]);
      
      // Send notification to temporary worker about pending reward
      await pool.query(`
        INSERT INTO notifications (user_id, message, type, created_at)
        VALUES (?, ?, 'referral_reward', NOW())
      `, [inviterId, `🎁 Your invitee upgraded to Level ${inviteeData.level}! You'll receive KES ${rewardAmount} when you upgrade to Level 1 or above.`]);
      
      console.log(`⏳ Referral reward of KES ${rewardAmount} held for temporary worker ${inviterData.name} until upgrade`);
    } else {
      // Non-temporary workers receive rewards immediately
      const newBalance = parseFloat(inviterData.wallet_balance) + rewardAmount;
      
      await pool.query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [newBalance, inviterId]
      );
      
      // Record the referral reward as completed
      await pool.query(`
        INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
        VALUES (?, ?, ?, ?, NOW(), 'completed')
      `, [inviterId, inviteeId, inviteeData.level, rewardAmount]);
      
      // Send notification to inviter
      await pool.query(`
        INSERT INTO notifications (user_id, message, type, created_at)
        VALUES (?, ?, 'referral_reward', NOW())
      `, [inviterId, `🎉 Congratulations! Your invitee upgraded to Level ${inviteeData.level} and you earned KES ${rewardAmount} referral reward!`]);
      
      console.log(`✅ Referral reward of KES ${rewardAmount} given to inviter ${inviterData.name}`);
      console.log(`   New wallet balance: KES ${newBalance.toFixed(2)}`);
    }
    
    // Verify the fix
    console.log('\n🔍 VERIFICATION:');
    const [verifyRewards] = await pool.query(`
      SELECT id, reward_amount, status, created_at
      FROM referral_rewards 
      WHERE inviter_id = ? AND user_id = ?
    `, [inviterId, inviteeId]);
    
    if (verifyRewards.length > 0) {
      const reward = verifyRewards[0];
      console.log(`✅ Referral reward created successfully:`);
      console.log(`   ID: ${reward.id}`);
      console.log(`   Amount: KES ${reward.reward_amount}`);
      console.log(`   Status: ${reward.status}`);
      console.log(`   Created: ${new Date(reward.created_at).toLocaleString()}`);
    } else {
      console.log('❌ Referral reward creation failed');
    }
    
  } catch (error) {
    console.error('❌ Error fixing referral reward:', error.message);
  } finally {
    pool.end();
  }
}

fixMissingReferralReward();




