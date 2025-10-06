const mysql = require('mysql2/promise');

async function investigateReferralIssue2() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating referral issue #2...');
    console.log('📱 Claimed referrer: 0707582934');
    console.log('📱 Claimed referred user: +254112174452\n');

    // Check if the claimed referrer exists
    const [referrer] = await pool.query(
      'SELECT id, name, phone, invitation_code, referral_code, referred_by, level FROM users WHERE phone = ?',
      ['0707582934']
    );

    if (referrer.length === 0) {
      console.log('❌ Referrer 0707582934 not found in database');
      return;
    }

    const referrerData = referrer[0];
    console.log('👤 Referrer found:');
    console.log(`   ID: ${referrerData.id}`);
    console.log(`   Name: ${referrerData.name}`);
    console.log(`   Phone: ${referrerData.phone}`);
    console.log(`   Invitation Code: ${referrerData.invitation_code}`);
    console.log(`   Referral Code: ${referrerData.referral_code}`);
    console.log(`   Referred By: ${referrerData.referred_by}`);
    console.log(`   Level: ${referrerData.level}\n`);

    // Check if the claimed referred user exists
    const [referredUser] = await pool.query(
      'SELECT id, name, phone, referred_by, invitation_code, created_at, level FROM users WHERE phone = ?',
      ['+254112174452']
    );

    if (referredUser.length === 0) {
      console.log('❌ Referred user +254112174452 not found in database');
      return;
    }

    const referredData = referredUser[0];
    console.log('👤 Referred user found:');
    console.log(`   ID: ${referredData.id}`);
    console.log(`   Name: ${referredData.name}`);
    console.log(`   Phone: ${referredData.phone}`);
    console.log(`   Referred By: ${referredData.referred_by}`);
    console.log(`   Invitation Code: ${referredData.invitation_code}`);
    console.log(`   Level: ${referredData.level}`);
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
        u.phone as referred_user_phone,
        u.level as referred_user_level
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
        console.log(`   - KES ${reward.reward_amount} (${reward.status}) for ${reward.referred_user_name} (${reward.referred_user_phone}, Level ${reward.referred_user_level}) on ${reward.created_at}`);
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
      
      // Check if the referred user has reached level 1+ (which triggers referral rewards)
      if (referredData.level >= 1 && isCorrectReferrer) {
        console.log(`   ⚠️ ISSUE: Referral reward should have been created but is missing!`);
        console.log(`   Referred user is Level ${referredData.level} and properly linked.`);
      } else if (referredData.level === 0) {
        console.log(`   ℹ️ Referred user is still Level 0 (temporary worker) - no reward yet.`);
      }
    } else {
      console.log('   ✅ Reward found:');
      potentialReward.forEach(reward => {
        console.log(`      Amount: KES ${reward.reward_amount}`);
        console.log(`      Status: ${reward.status}`);
        console.log(`      Created: ${reward.created_at}`);
      });
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Referrer: ${referrerData.name} (${referrerData.phone})`);
    console.log(`   Referred User: ${referredData.name} (${referredData.phone})`);
    console.log(`   Referral Link: ${isCorrectReferrer ? '✅ Correct' : '❌ Incorrect'}`);
    console.log(`   Referred User Level: ${referredData.level}`);
    console.log(`   Reward Status: ${potentialReward.length > 0 ? '✅ Exists' : '❌ Missing'}`);

  } catch (error) {
    console.error('❌ Error investigating referral issue:', error.message);
  } finally {
    pool.end();
  }
}

investigateReferralIssue2();


