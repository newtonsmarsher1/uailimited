const mysql = require('mysql2/promise');

async function correctReferralReward() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Correcting referral reward amount...');
    console.log('📱 Referrer: +254703730012 (CORNELIUS RUTO LONIKA)');
    console.log('📱 Referred User: +254705878793 (DENIS PKIACH)\n');

    // Get the current incorrect reward
    const [currentReward] = await pool.query(
      `SELECT id, reward_amount, status FROM referral_rewards 
       WHERE inviter_id = (SELECT id FROM users WHERE phone = '+254703730012') 
       AND user_id = (SELECT id FROM users WHERE phone = '+254705878793')`
    );

    if (currentReward.length === 0) {
      console.log('❌ No referral reward found');
      return;
    }

    const rewardRecord = currentReward[0];
    console.log('📊 Current reward:');
    console.log(`   ID: ${rewardRecord.id}`);
    console.log(`   Amount: KES ${rewardRecord.reward_amount}`);
    console.log(`   Status: ${rewardRecord.status}`);

    // Correct reward amounts based on referred user's level
    const correctRewards = {
      1: 288,  // Level 1: KES 288
      2: 600,  // Level 2: KES 600
      3: 1200, // Level 3: KES 1200
      4: 1800, // Level 4: KES 1800
      5: 2400  // Level 5: KES 2400
    };

    // Get referred user's level
    const [referredUser] = await pool.query(
      'SELECT level FROM users WHERE phone = ?',
      ['+254705878793']
    );

    if (referredUser.length === 0) {
      console.log('❌ Referred user not found');
      return;
    }

    const referredUserLevel = referredUser[0].level;
    const correctAmount = correctRewards[referredUserLevel];

    console.log(`\n📊 Correction needed:`);
    console.log(`   Referred user level: ${referredUserLevel}`);
    console.log(`   Current amount: KES ${rewardRecord.reward_amount}`);
    console.log(`   Correct amount: KES ${correctAmount}`);

    if (correctAmount && correctAmount !== parseFloat(rewardRecord.reward_amount)) {
      const difference = correctAmount - parseFloat(rewardRecord.reward_amount);
      
      console.log(`   Difference: KES ${difference}`);

      // Update the referral reward amount
      await pool.query(
        'UPDATE referral_rewards SET reward_amount = ? WHERE id = ?',
        [correctAmount, rewardRecord.id]
      );

      // Update referrer's wallet balance
      await pool.query(
        'UPDATE users SET wallet_balance = wallet_balance + ? WHERE phone = ?',
        [difference, '+254703730012']
      );

      console.log(`\n✅ CORRECTION COMPLETED:`);
      console.log(`   Updated referral reward to KES ${correctAmount}`);
      console.log(`   Added KES ${difference} to referrer's wallet`);

      // Get updated balances
      const [updatedReward] = await pool.query(
        'SELECT reward_amount FROM referral_rewards WHERE id = ?',
        [rewardRecord.id]
      );

      const [updatedWallet] = await pool.query(
        'SELECT wallet_balance FROM users WHERE phone = ?',
        ['+254703730012']
      );

      console.log(`   New reward amount: KES ${updatedReward[0].reward_amount}`);
      console.log(`   New wallet balance: KES ${parseFloat(updatedWallet[0].wallet_balance).toFixed(2)}`);

    } else {
      console.log(`\n✅ Reward amount is already correct!`);
    }

  } catch (error) {
    console.error('❌ Error correcting referral reward:', error.message);
  } finally {
    pool.end();
  }
}

correctReferralReward();


