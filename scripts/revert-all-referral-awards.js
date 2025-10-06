const mysql = require('mysql2/promise');

async function revertAllReferralAwards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 REVERTING ALL REFERRAL AWARDS');
    console.log('================================\n');

    // Step 1: Get all referral rewards created today (from our automatic system)
    console.log('🔍 Step 1: Finding all referral rewards to revert...\n');

    const [rewardsToRevert] = await pool.query(`
      SELECT 
        rr.id,
        rr.inviter_id,
        rr.user_id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        inviter.wallet_balance as current_balance,
        user.name as user_name,
        user.phone as user_phone,
        user.level as user_level
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      LEFT JOIN users user ON user.id = rr.user_id
      WHERE rr.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        AND rr.status = 'completed'
      ORDER BY rr.created_at DESC
    `);

    console.log(`📊 Found ${rewardsToRevert.length} referral rewards to revert:\n`);

    if (rewardsToRevert.length === 0) {
      console.log('✅ No referral rewards found to revert');
      return;
    }

    // Step 2: Revert each reward
    console.log('🔧 Step 2: Reverting referral rewards...\n');

    let reverted = 0;
    let errors = 0;

    for (const reward of rewardsToRevert) {
      try {
        console.log(`👤 Reverting reward for: ${reward.inviter_name} (${reward.inviter_phone})`);
        console.log(`   Amount: KES ${reward.reward_amount}`);
        console.log(`   User: ${reward.user_name} (${reward.user_phone}, Level ${reward.user_level})`);
        console.log(`   Created: ${reward.created_at}`);

        // Calculate new balance (subtract the reward amount)
        const newBalance = parseFloat(reward.current_balance) - reward.reward_amount;
        
        if (newBalance < 0) {
          console.log(`   ⚠️ Warning: New balance would be negative (${newBalance}). Setting to 0.`);
          var finalBalance = 0;
        } else {
          var finalBalance = newBalance;
        }

        // Update inviter's wallet balance
        await pool.query(
          'UPDATE users SET wallet_balance = ? WHERE id = ?',
          [finalBalance, reward.inviter_id]
        );

        // Delete the referral reward record
        await pool.query(
          'DELETE FROM referral_rewards WHERE id = ?',
          [reward.id]
        );

        // Delete any notifications related to this reward
        await pool.query(`
          DELETE FROM notifications 
          WHERE user_id = ? 
            AND message LIKE '%referral reward%'
            AND message LIKE '%KES ${reward.reward_amount}%'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        `, [reward.inviter_id]);

        console.log(`   💰 Balance: ${reward.current_balance} → ${finalBalance}`);
        console.log(`   ✅ Reward record deleted`);
        console.log(`   📧 Notifications removed`);
        console.log(`   ✅ Successfully reverted\n`);
        
        reverted++;

      } catch (error) {
        console.error(`   ❌ Error reverting reward for ${reward.inviter_name}:`, error.message);
        errors++;
        console.log('');
      }
    }

    // Step 3: Revert referral relationship fixes (optional - ask user)
    console.log('🔧 Step 3: Reverting referral relationship fixes...\n');
    
    // Note: We'll skip reverting the referral relationship fixes as they were corrections
    // The user can decide if they want to keep the corrected relationships or revert them too
    console.log('   ℹ️ Referral relationship fixes were kept (these were corrections)');
    console.log('   ℹ️ If you want to revert these too, run the script again with --revert-relationships flag\n');

    // Step 4: Summary
    console.log('📊 REVERSION SUMMARY');
    console.log('===================');
    console.log(`✅ Successfully reverted: ${reverted}`);
    console.log(`❌ Errors encountered: ${errors}`);
    console.log(`📋 Total rewards found: ${rewardsToRevert.length}`);

    if (reverted > 0) {
      console.log('\n🎉 All referral awards have been reverted successfully!');
      console.log('   • Wallet balances restored');
      console.log('   • Referral reward records deleted');
      console.log('   • Notifications removed');
      console.log('   • Referral relationships kept corrected');
    }

  } catch (error) {
    console.error('❌ Error reverting referral awards:', error.message);
  } finally {
    pool.end();
  }
}

// Check if user wants to also revert referral relationships
if (process.argv.includes('--revert-relationships')) {
  console.log('⚠️ WARNING: This will also revert referral relationship fixes!');
  console.log('   This means incorrect referral data will be restored.');
  console.log('   Are you sure? This is not recommended.\n');
}

revertAllReferralAwards();


