const mysql = require('mysql2/promise');

async function investigateReferralClaim() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Referral Claim: 0106736692 → 0710646811\n');
    
    // Get both users' details
    const [inviter] = await pool.query(`
      SELECT id, name, phone, level, invitation_code, referred_by, wallet_balance, created_at
      FROM users WHERE phone = '0106736692'
    `);
    
    const [invitee] = await pool.query(`
      SELECT id, name, phone, level, invitation_code, referred_by, wallet_balance, created_at
      FROM users WHERE phone = '0710646811'
    `);
    
    if (inviter.length === 0) {
      console.log('❌ Inviter 0106736692 not found in database');
      return;
    }
    
    if (invitee.length === 0) {
      console.log('❌ Invitee 0710646811 not found in database');
      return;
    }
    
    const inviterData = inviter[0];
    const inviteeData = invitee[0];
    
    console.log('📋 USER DETAILS:');
    console.log(`Inviter: ${inviterData.name} (ID: ${inviterData.id})`);
    console.log(`  Phone: ${inviterData.phone}`);
    console.log(`  Level: ${inviterData.level}`);
    console.log(`  Invitation Code: ${inviterData.invitation_code}`);
    console.log(`  Wallet Balance: KES ${parseFloat(inviterData.wallet_balance).toFixed(2)}`);
    console.log(`  Joined: ${new Date(inviterData.created_at).toLocaleDateString()}`);
    
    console.log(`\nInvitee: ${inviteeData.name} (ID: ${inviteeData.id})`);
    console.log(`  Phone: ${inviteeData.phone}`);
    console.log(`  Level: ${inviteeData.level}`);
    console.log(`  Invitation Code: ${inviteeData.invitation_code}`);
    console.log(`  Referred By: ${inviteeData.referred_by}`);
    console.log(`  Wallet Balance: KES ${parseFloat(inviteeData.wallet_balance).toFixed(2)}`);
    console.log(`  Joined: ${new Date(inviteeData.created_at).toLocaleDateString()}`);
    
    // Check referral relationship
    console.log('\n🔗 REFERRAL RELATIONSHIP CHECK:');
    const isReferredByInviter = inviteeData.referred_by === inviterData.invitation_code;
    const isReferredByInviterId = inviteeData.referred_by === inviterData.id.toString();
    
    console.log(`Invitee's referred_by field: "${inviteeData.referred_by}"`);
    console.log(`Inviter's invitation_code: "${inviterData.invitation_code}"`);
    console.log(`Inviter's ID: ${inviterData.id}`);
    console.log(`Match by invitation_code: ${isReferredByInviter ? '✅ YES' : '❌ NO'}`);
    console.log(`Match by ID: ${isReferredByInviterId ? '✅ YES' : '❌ NO'}`);
    
    if (!isReferredByInviter && !isReferredByInviterId) {
      console.log('\n❌ REFERRAL RELATIONSHIP NOT FOUND!');
      console.log('The invitee is not properly linked to the inviter in the database.');
      return;
    }
    
    // Check for referral rewards
    console.log('\n💰 REFERRAL REWARDS CHECK:');
    const [rewards] = await pool.query(`
      SELECT 
        id, inviter_id, user_id, level, reward_amount, status, created_at, processed_at
      FROM referral_rewards 
      WHERE inviter_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `, [inviterData.id, inviteeData.id]);
    
    if (rewards.length === 0) {
      console.log('❌ NO REFERRAL REWARDS FOUND for this relationship');
      
      // Check if invitee has upgraded from level 0
      if (inviteeData.level > 0) {
        console.log(`\n⚠️  ISSUE: Invitee is Level ${inviteeData.level} but no referral reward was created!`);
        console.log('This suggests the referral reward system failed when the invitee upgraded.');
        
        // Check what level rewards should be given
        const levelRewards = {
          1: 288,  // Level 1: KES 288
          2: 600,  // Level 2: KES 600
          3: 1200  // Level 3: KES 1200
        };
        
        const expectedReward = levelRewards[inviteeData.level];
        if (expectedReward) {
          console.log(`Expected reward for Level ${inviteeData.level}: KES ${expectedReward}`);
        }
      } else {
        console.log('ℹ️  Invitee is still Level 0 (temporary worker), so no reward yet.');
      }
    } else {
      console.log(`Found ${rewards.length} referral reward(s):`);
      rewards.forEach((reward, idx) => {
        console.log(`  ${idx + 1}. ID: ${reward.id}`);
        console.log(`     Amount: KES ${parseFloat(reward.reward_amount).toFixed(2)}`);
        console.log(`     Status: ${reward.status}`);
        console.log(`     Created: ${new Date(reward.created_at).toLocaleString()}`);
        if (reward.processed_at) {
          console.log(`     Processed: ${new Date(reward.processed_at).toLocaleString()}`);
        }
      });
    }
    
    // Check if inviter has any pending rewards
    console.log('\n⏳ PENDING REWARDS CHECK:');
    const [pendingRewards] = await pool.query(`
      SELECT 
        id, user_id, level, reward_amount, created_at
      FROM referral_rewards 
      WHERE inviter_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `, [inviterData.id]);
    
    if (pendingRewards.length > 0) {
      console.log(`Found ${pendingRewards.length} pending reward(s) for inviter:`);
      pendingRewards.forEach((reward, idx) => {
        console.log(`  ${idx + 1}. User ID: ${reward.user_id}, Level: ${reward.level}, Amount: KES ${parseFloat(reward.reward_amount).toFixed(2)}`);
        console.log(`     Created: ${new Date(reward.created_at).toLocaleString()}`);
      });
    } else {
      console.log('No pending rewards found for inviter.');
    }
    
    // Check inviter's total referral earnings
    console.log('\n📊 INVITER REFERRAL EARNINGS SUMMARY:');
    const [totalEarnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_rewards,
        SUM(CASE WHEN status = 'completed' THEN reward_amount ELSE 0 END) as completed_earnings,
        SUM(CASE WHEN status = 'pending' THEN reward_amount ELSE 0 END) as pending_earnings
      FROM referral_rewards 
      WHERE inviter_id = ?
    `, [inviterData.id]);
    
    const earnings = totalEarnings[0];
    console.log(`Total referral rewards: ${earnings.total_rewards}`);
    console.log(`Completed earnings: KES ${parseFloat(earnings.completed_earnings || 0).toFixed(2)}`);
    console.log(`Pending earnings: KES ${parseFloat(earnings.pending_earnings || 0).toFixed(2)}`);
    
    // Check if inviter is temporary worker (level 0)
    if (inviterData.level === 0) {
      console.log('\n⚠️  INVITER IS TEMPORARY WORKER (Level 0)');
      console.log('Temporary workers receive rewards only when they upgrade to Level 1+');
      console.log('This is working as designed - rewards are held until inviter upgrades.');
    }
    
  } catch (error) {
    console.error('❌ Error investigating referral claim:', error.message);
  } finally {
    pool.end();
  }
}

investigateReferralClaim();




