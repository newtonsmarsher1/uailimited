const mysql = require('mysql2/promise');

async function fixReferralRelationship() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing referral relationship...');
    console.log('📱 Referrer: +254703730012 (CORNELIUS RUTO LONIKA)');
    console.log('📱 Referred User: +254705878793 (DENIS PKIACH)\n');

    // Get referrer details
    const [referrer] = await pool.query(
      'SELECT id, name, phone, invitation_code, level FROM users WHERE phone = ?',
      ['+254703730012']
    );

    if (referrer.length === 0) {
      console.log('❌ Referrer not found');
      return;
    }

    const referrerData = referrer[0];
    console.log('👤 Referrer details:');
    console.log(`   ID: ${referrerData.id}`);
    console.log(`   Name: ${referrerData.name}`);
    console.log(`   Invitation Code: ${referrerData.invitation_code}`);
    console.log(`   Level: ${referrerData.level}\n`);

    // Get referred user details
    const [referredUser] = await pool.query(
      'SELECT id, name, phone, referred_by, level FROM users WHERE phone = ?',
      ['+254705878793']
    );

    if (referredUser.length === 0) {
      console.log('❌ Referred user not found');
      return;
    }

    const referredData = referredUser[0];
    console.log('👤 Referred user details:');
    console.log(`   ID: ${referredData.id}`);
    console.log(`   Name: ${referredData.name}`);
    console.log(`   Current referred_by: ${referredData.referred_by}`);
    console.log(`   Level: ${referredData.level}\n`);

    // Fix the referral relationship
    console.log('🔧 Step 1: Fixing referral relationship...');
    await pool.query(
      'UPDATE users SET referred_by = ? WHERE id = ?',
      [referrerData.invitation_code, referredData.id]
    );
    console.log(`✅ Updated referred_by from "${referredData.referred_by}" to "${referrerData.invitation_code}"`);

    // Check completed tasks for the referred user
    const [completedTasks] = await pool.query(
      'SELECT COUNT(*) as task_count, SUM(reward_earned) as total_earnings FROM user_tasks WHERE user_id = ? AND is_complete = 1',
      [referredData.id]
    );

    const taskCount = completedTasks[0].task_count;
    const totalEarnings = parseFloat(completedTasks[0].total_earnings || 0);

    console.log(`\n📊 Referred user activity:`);
    console.log(`   Completed tasks: ${taskCount}`);
    console.log(`   Total earnings: KES ${totalEarnings.toFixed(2)}`);

    if (taskCount > 0) {
      // Calculate referral rewards based on referrer's level
      let referralRate = 0;
      if (referrerData.level >= 1 && referrerData.level <= 3) {
        referralRate = 0.15; // 15% for levels 1-3
      } else if (referrerData.level >= 4 && referrerData.level <= 6) {
        referralRate = 0.20; // 20% for levels 4-6
      } else if (referrerData.level >= 7) {
        referralRate = 0.25; // 25% for levels 7+
      }

      const referralReward = totalEarnings * referralRate;

      console.log(`\n💰 Referral reward calculation:`);
      console.log(`   Referrer level: ${referrerData.level}`);
      console.log(`   Referral rate: ${(referralRate * 100)}%`);
      console.log(`   Calculated reward: KES ${referralReward.toFixed(2)}`);

      if (referralReward > 0) {
        // Create referral reward record
        console.log(`\n🔧 Step 2: Creating referral reward...`);
        await pool.query(
          `INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) 
           VALUES (?, ?, ?, ?, 'completed', NOW())`,
          [referrerData.id, referredData.id, referrerData.level, referralReward]
        );

        // Update referrer's wallet balance
        console.log(`🔧 Step 3: Updating referrer's wallet balance...`);
        await pool.query(
          'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
          [referralReward, referrerData.id]
        );

        console.log(`✅ Referral reward created and wallet updated!`);
        console.log(`   Reward amount: KES ${referralReward.toFixed(2)}`);
        console.log(`   Status: approved`);
        console.log(`   Added to referrer's wallet balance`);

        // Get updated wallet balance
        const [updatedBalance] = await pool.query(
          'SELECT wallet_balance FROM users WHERE id = ?',
          [referrerData.id]
        );

        console.log(`   New wallet balance: KES ${parseFloat(updatedBalance[0].wallet_balance).toFixed(2)}`);
      }
    } else {
      console.log(`\n⚠️ No completed tasks found for referred user - no referral reward to create`);
    }

    // Verify the fix
    console.log(`\n🔍 Verification:`);
    const [verification] = await pool.query(
      'SELECT referred_by FROM users WHERE id = ?',
      [referredData.id]
    );
    
    const [rewardCheck] = await pool.query(
      'SELECT COUNT(*) as reward_count FROM referral_rewards WHERE inviter_id = ? AND user_id = ?',
      [referrerData.id, referredData.id]
    );

    console.log(`   Referred user's referred_by: ${verification[0].referred_by}`);
    console.log(`   Referral rewards created: ${rewardCheck[0].reward_count}`);

    if (verification[0].referred_by === referrerData.invitation_code && rewardCheck[0].reward_count > 0) {
      console.log(`\n✅ REFERRAL ISSUE FIXED SUCCESSFULLY!`);
    } else {
      console.log(`\n❌ Issue may still exist - please check manually`);
    }

  } catch (error) {
    console.error('❌ Error fixing referral relationship:', error.message);
  } finally {
    pool.end();
  }
}

fixReferralRelationship();
