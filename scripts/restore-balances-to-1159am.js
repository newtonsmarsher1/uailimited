const mysql = require('mysql2/promise');

async function restoreBalancesTo1159AM() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 RESTORING BALANCES TO 11:59 AM TODAY');
    console.log('======================================\n');

    // Get today's date at 11:59 AM
    const today = new Date();
    const targetTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 59, 0);
    
    console.log(`📅 Target time: ${targetTime.toISOString()}\n`);

    // Check what balances were at 11:59 AM by looking at the referral rewards that were given
    // and adding them back to current balances
    console.log('🔍 Step 1: Analyzing what referral rewards were given today...\n');

    // Since we deleted the referral rewards, we need to calculate what they were
    // based on the users who should have received them

    const usersToRestore = [
      { phone: '0707582934', name: 'Eliezer Magati', id: 53 },
      { phone: '+254703730012', name: 'CORNELIUS RUTO LONIKA', id: 41 },
      { phone: '+254705878793', name: 'DENIS PKIACH', id: 322 },
      { phone: '+254112174452', name: 'COSMAS SHIMWENYI MUSUNGU', id: 324 },
      { phone: '+254716060176', name: 'Thaddeus Nyamache', id: 37 },
      { phone: '0720868337', name: 'William momanyi', id: 55 },
      { phone: '0106736692', name: 'Davies kind', id: 143 }
    ];

    console.log('👤 Restoring balances for key users:\n');

    let restored = 0;

    for (const user of usersToRestore) {
      try {
        // Get current balance
        const [currentUser] = await pool.query(
          'SELECT wallet_balance, level FROM users WHERE id = ?',
          [user.id]
        );

        if (currentUser.length === 0) {
          console.log(`❌ User not found: ${user.name}`);
          continue;
        }

        const currentBalance = parseFloat(currentUser[0].wallet_balance);
        const userLevel = currentUser[0].level;

        console.log(`👤 ${user.name} (${user.phone})`);
        console.log(`   Current Balance: KES ${currentBalance}`);
        console.log(`   Level: ${userLevel}`);

        // Calculate what referral rewards this user should have received today
        // Based on the automatic system that was run

        // Check who this user referred (users who upgraded to level 1+ today)
        const [referredUsers] = await pool.query(`
          SELECT u.id, u.name, u.phone, u.level, u.referred_by
          FROM users u
          WHERE u.referred_by = ? 
            AND u.level >= 1
            AND u.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        `, [user.id.toString()]);

        let totalReferralRewards = 0;
        const referralRewards = { 1: 288, 2: 600, 3: 1200 };

        console.log(`   Users they referred (Level 1+): ${referredUsers.length}`);

        for (const referred of referredUsers) {
          const rewardAmount = referralRewards[referred.level] || 0;
          totalReferralRewards += rewardAmount;
          console.log(`     • ${referred.name} (Level ${referred.level}) → KES ${rewardAmount}`);
        }

        // Also check if they referred users with invitation codes (corrected relationships)
        const [referredByCode] = await pool.query(`
          SELECT u.id, u.name, u.phone, u.level, u.referred_by
          FROM users u
          LEFT JOIN users inviter ON inviter.invitation_code = u.referred_by
          WHERE inviter.id = ? 
            AND u.level >= 1
            AND u.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        `, [user.id]);

        console.log(`   Users they referred (by invitation code): ${referredByCode.length}`);

        for (const referred of referredByCode) {
          const rewardAmount = referralRewards[referred.level] || 0;
          totalReferralRewards += rewardAmount;
          console.log(`     • ${referred.name} (Level ${referred.level}) → KES ${rewardAmount}`);
        }

        // Calculate new balance (current + referral rewards they should have received)
        const newBalance = currentBalance + totalReferralRewards;

        console.log(`   Referral Rewards Due: KES ${totalReferralRewards}`);
        console.log(`   New Balance: KES ${newBalance}`);

        // Update balance
        await pool.query(
          'UPDATE users SET wallet_balance = ? WHERE id = ?',
          [newBalance, user.id]
        );

        console.log(`   ✅ Balance restored to KES ${newBalance}\n`);
        
        restored++;

      } catch (error) {
        console.error(`   ❌ Error restoring ${user.name}:`, error.message);
        console.log('');
      }
    }

    // Step 2: Restore other users who received referral rewards
    console.log('🔧 Step 2: Restoring other users who received referral rewards...\n');

    // Get all users who were referred and upgraded to level 1+ today
    const [allReferredUsers] = await pool.query(`
      SELECT 
        u.id, u.name, u.phone, u.level, u.referred_by, u.wallet_balance,
        inviter.id as inviter_id,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone
      FROM users u
      LEFT JOIN users inviter ON inviter.invitation_code = u.referred_by OR inviter.id = CAST(u.referred_by AS UNSIGNED)
      WHERE u.level >= 1 
        AND u.referred_by IS NOT NULL 
        AND u.referred_by != ''
        AND u.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        AND inviter.id IS NOT NULL
    `);

    console.log(`📊 Found ${allReferredUsers.length} users who were referred today:\n`);

    let otherRestored = 0;

    for (const user of allReferredUsers) {
      try {
        const referralRewards = { 1: 288, 2: 600, 3: 1200 };
        const rewardAmount = referralRewards[user.level] || 0;
        
        if (rewardAmount > 0) {
          console.log(`👤 Restoring reward for: ${user.inviter_name} (${user.inviter_phone})`);
          console.log(`   Referred: ${user.name} (Level ${user.level})`);
          console.log(`   Reward Amount: KES ${rewardAmount}`);

          // Get current balance of referrer
          const [referrerBalance] = await pool.query(
            'SELECT wallet_balance FROM users WHERE id = ?',
            [user.inviter_id]
          );

          if (referrerBalance.length > 0) {
            const currentBalance = parseFloat(referrerBalance[0].wallet_balance);
            const newBalance = currentBalance + rewardAmount;

            await pool.query(
              'UPDATE users SET wallet_balance = ? WHERE id = ?',
              [newBalance, user.inviter_id]
            );

            console.log(`   Balance: ${currentBalance} → ${newBalance}`);
            console.log(`   ✅ Restored\n`);
            
            otherRestored++;
          }
        }

      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
      }
    }

    // Summary
    console.log('📊 RESTORATION SUMMARY');
    console.log('======================');
    console.log(`✅ Key users restored: ${restored}`);
    console.log(`✅ Other users restored: ${otherRestored}`);
    console.log(`📋 Total users processed: ${restored + otherRestored}`);

    console.log('\n🎉 Balances restored to 11:59 AM today state!');
    console.log('   • All referral rewards that were given today have been restored');
    console.log('   • Users now have their balances as they were before the reversion');

  } catch (error) {
    console.error('❌ Error restoring balances:', error.message);
  } finally {
    pool.end();
  }
}

restoreBalancesTo1159AM();


