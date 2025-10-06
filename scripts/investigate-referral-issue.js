const mysql = require('mysql2/promise');

async function investigateReferralIssue() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating referral issue...');
    console.log('📱 Claimed referrer: +254703730012');
    console.log('📱 Claimed referred user: +254705878793\n');

    // Check if the claimed referrer exists
    const [referrer] = await pool.query(
      'SELECT id, name, phone, invitation_code, referral_code, referred_by FROM users WHERE phone = ?',
      ['+254703730012']
    );

    if (referrer.length === 0) {
      console.log('❌ Referrer +254703730012 not found in database');
      return;
    }

    const referrerData = referrer[0];
    console.log('👤 Referrer found:');
    console.log(`   ID: ${referrerData.id}`);
    console.log(`   Name: ${referrerData.name}`);
    console.log(`   Phone: ${referrerData.phone}`);
    console.log(`   Invitation Code: ${referrerData.invitation_code}`);
    console.log(`   Referral Code: ${referrerData.referral_code}`);
    console.log(`   Referred By: ${referrerData.referred_by}\n`);

    // Check if the claimed referred user exists
    const [referredUser] = await pool.query(
      'SELECT id, name, phone, referred_by, invitation_code, created_at FROM users WHERE phone = ?',
      ['+254705878793']
    );

    if (referredUser.length === 0) {
      console.log('❌ Referred user +254705878793 not found in database');
      return;
    }

    const referredData = referredUser[0];
    console.log('👤 Referred user found:');
    console.log(`   ID: ${referredData.id}`);
    console.log(`   Name: ${referredData.name}`);
    console.log(`   Phone: ${referredData.phone}`);
    console.log(`   Referred By: ${referredData.referred_by}`);
    console.log(`   Invitation Code: ${referredData.invitation_code}`);
    console.log(`   Created At: ${referredData.created_at}\n`);

    // Check if the referral relationship exists
    const isCorrectReferrer = referredData.referred_by === referrerData.invitation_code;
    console.log('🔗 Referral relationship check:');
    console.log(`   Referred user's "referred_by": ${referredData.referred_by}`);
    console.log(`   Referrer's "invitation_code": ${referrerData.invitation_code}`);
    console.log(`   Match: ${isCorrectReferrer ? '✅ YES' : '❌ NO'}\n`);

    if (!isCorrectReferrer) {
      console.log('⚠️ ISSUE FOUND: Referral relationship is incorrect!');
      console.log('   The referred user is not properly linked to the claimed referrer.\n');
    }

    // Check referral rewards for the referrer
    const [referralRewards] = await pool.query(
      `SELECT 
        rr.id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        u.name as referred_user_name,
        u.phone as referred_user_phone
       FROM referral_rewards rr
       LEFT JOIN users u ON u.id = rr.user_id
       WHERE rr.inviter_id = ?
       ORDER BY rr.created_at DESC`,
      [referrerData.id]
    );

    console.log('💰 Referral rewards for referrer:');
    if (referralRewards.length === 0) {
      console.log('   No referral rewards found');
    } else {
      referralRewards.forEach(reward => {
        console.log(`   - KES ${reward.reward_amount} (${reward.status}) for ${reward.referred_user_name} (${reward.referred_user_phone}) on ${reward.created_at}`);
      });
    }
    console.log();

    // Check if there should be a reward for this specific referral
    const [potentialReward] = await pool.query(
      `SELECT 
        rr.id,
        rr.reward_amount,
        rr.status,
        rr.created_at
       FROM referral_rewards rr
       WHERE rr.inviter_id = ? AND rr.user_id = ?`,
      [referrerData.id, referredData.id]
    );

    console.log('🎯 Specific referral reward check:');
    if (potentialReward.length === 0) {
      console.log('   ❌ No reward found for this specific referral');
      
      // Check if the referred user has completed any tasks (which would trigger referral rewards)
      const [userTasks] = await pool.query(
        'SELECT COUNT(*) as task_count FROM user_tasks WHERE user_id = ? AND is_complete = 1',
        [referredData.id]
      );
      
      const taskCount = userTasks[0].task_count;
      console.log(`   📊 Referred user has completed ${taskCount} tasks`);
      
      if (taskCount > 0 && isCorrectReferrer) {
        console.log('   ⚠️ ISSUE: Referral reward should have been created but is missing!');
      }
    } else {
      console.log('   ✅ Reward found:');
      potentialReward.forEach(reward => {
        console.log(`      Amount: KES ${reward.reward_amount}`);
        console.log(`      Status: ${reward.status}`);
        console.log(`      Created: ${reward.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error investigating referral issue:', error.message);
  } finally {
    pool.end();
  }
}

investigateReferralIssue();


