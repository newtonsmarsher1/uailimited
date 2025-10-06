const mysql = require('mysql2/promise');

async function fixReferralRelationship2() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing referral relationship #2...');
    console.log('📱 Referrer: 0707582934 (Eliezer Magati)');
    console.log('📱 Referred User: +254112174452 (COSMAS SHIMWENYI MUSUNGU)\n');

    // Get referrer details
    const [referrer] = await pool.query(
      'SELECT id, name, phone, invitation_code, level FROM users WHERE phone = ?',
      ['0707582934']
    );

    if (referrer.length === 0) {
      console.log('❌ Referrer not found');
      return;
    }

    const referrerData = referrer[0];
    console.log('👤 Referrer details:');
    console.log(`   ID: ${referrerData.id}`);
    console.log(`   Name: ${referrerData.name}`);
    console.log(`   Phone: ${referrerData.phone}`);
    console.log(`   Invitation Code: ${referrerData.invitation_code}`);
    console.log(`   Level: ${referrerData.level}\n`);

    // Get referred user details
    const [referred] = await pool.query(
      'SELECT id, name, phone, referred_by, level FROM users WHERE phone = ?',
      ['+254112174452']
    );

    if (referred.length === 0) {
      console.log('❌ Referred user not found');
      return;
    }

    const referredData = referred[0];
    console.log('👤 Referred user details:');
    console.log(`   ID: ${referredData.id}`);
    console.log(`   Name: ${referredData.name}`);
    console.log(`   Phone: ${referredData.phone}`);
    console.log(`   Current referred_by: ${referredData.referred_by}`);
    console.log(`   Level: ${referredData.level}\n`);

    // Step 1: Fix the referral relationship
    console.log('🔧 Step 1: Fixing referral relationship...');
    await pool.query(
      'UPDATE users SET referred_by = ? WHERE phone = ?',
      [referrerData.invitation_code, '+254112174452']
    );
    console.log(`   ✅ Updated referred_by from "${referredData.referred_by}" to "${referrerData.invitation_code}"`);

    // Step 2: Calculate and award referral reward
    const referralReward = 288; // Level 1 standard reward
    console.log(`\n🔧 Step 2: Creating referral reward...`);
    console.log(`   Referred user level: ${referredData.level}`);
    console.log(`   Referral reward amount: KES ${referralReward}`);

    // Create referral reward record
    await pool.query(
      `INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) 
       VALUES (?, ?, ?, ?, 'completed', NOW())`,
      [referrerData.id, referredData.id, referredData.level, referralReward]
    );
    console.log(`   ✅ Created referral reward record`);

    // Step 3: Update referrer's wallet balance
    const [currentBalance] = await pool.query(
      'SELECT wallet_balance FROM users WHERE id = ?',
      [referrerData.id]
    );

    const oldBalance = currentBalance[0].wallet_balance;
    const newBalance = oldBalance + referralReward;

    await pool.query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [newBalance, referrerData.id]
    );

    console.log(`\n💰 Updated referrer's wallet:`);
    console.log(`   Old balance: KES ${oldBalance}`);
    console.log(`   Reward added: KES ${referralReward}`);
    console.log(`   New balance: KES ${newBalance}`);

    console.log('\n✅ REFERRAL RELATIONSHIP FIXED AND REWARD AWARDED!');

  } catch (error) {
    console.error('❌ Error fixing referral relationship:', error.message);
  } finally {
    pool.end();
  }
}

fixReferralRelationship2();


