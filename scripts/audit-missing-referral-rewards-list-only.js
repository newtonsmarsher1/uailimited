const mysql = require('mysql2/promise');

async function auditMissingReferralRewardsListOnly() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Auditing Missing Referral Rewards (List Only)\n');
    
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
    
    missingRewards.forEach((missing, index) => {
      const expectedReward = referralRewards[missing.invitee_level];
      
      console.log(`${index + 1}. MISSING REFERRAL REWARD:`);
      console.log(`   Inviter: ${missing.inviter_name} (ID: ${missing.inviter_id})`);
      console.log(`   Phone: ${missing.inviter_phone}`);
      console.log(`   Level: ${missing.inviter_level}`);
      console.log(`   Current Balance: KES ${parseFloat(missing.inviter_balance).toFixed(2)}`);
      console.log(`   `);
      console.log(`   Invitee: ${missing.invitee_name} (ID: ${missing.invitee_id})`);
      console.log(`   Phone: ${missing.invitee_phone}`);
      console.log(`   Level: ${missing.invitee_level}`);
      console.log(`   Joined: ${new Date(missing.invitee_joined).toLocaleDateString()}`);
      console.log(`   `);
      console.log(`   Expected Reward: KES ${expectedReward || 'N/A'}`);
      console.log(`   Status: ${missing.inviter_level === 0 ? 'Would be PENDING (inviter is temp worker)' : 'Would be COMPLETED'}`);
      
      if (expectedReward) {
        totalMissingAmount += expectedReward;
      }
      
      console.log('   ' + '─'.repeat(60));
      console.log('');
    });
    
    console.log(`📊 SUMMARY:`);
    console.log(`   Total missing rewards: ${missingRewards.length}`);
    console.log(`   Total missing amount: KES ${totalMissingAmount.toFixed(2)}`);
    
    // Group by inviter
    console.log(`\n👥 GROUPED BY INVITER:`);
    const inviterGroups = {};
    missingRewards.forEach(missing => {
      const key = `${missing.inviter_name} (${missing.inviter_phone})`;
      if (!inviterGroups[key]) {
        inviterGroups[key] = {
          inviter_id: missing.inviter_id,
          inviter_level: missing.inviter_level,
          inviter_balance: missing.inviter_balance,
          missing_rewards: []
        };
      }
      inviterGroups[key].missing_rewards.push({
        invitee_name: missing.invitee_name,
        invitee_phone: missing.invitee_phone,
        invitee_level: missing.invitee_level,
        expected_reward: referralRewards[missing.invitee_level] || 0
      });
    });
    
    Object.entries(inviterGroups).forEach(([inviterName, data], index) => {
      const totalForInviter = data.missing_rewards.reduce((sum, reward) => sum + reward.expected_reward, 0);
      
      console.log(`${index + 1}. ${inviterName}`);
      console.log(`   ID: ${data.inviter_id}, Level: ${data.inviter_level}`);
      console.log(`   Current Balance: KES ${parseFloat(data.inviter_balance).toFixed(2)}`);
      console.log(`   Missing Rewards: ${data.missing_rewards.length} (Total: KES ${totalForInviter.toFixed(2)})`);
      
      data.missing_rewards.forEach((reward, idx) => {
        console.log(`     ${idx + 1}. ${reward.invitee_name} (${reward.invitee_phone}) - Level ${reward.invitee_level} - KES ${reward.expected_reward}`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error auditing referral rewards:', error.message);
  } finally {
    pool.end();
  }
}

auditMissingReferralRewardsListOnly();




