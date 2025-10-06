const mysql = require('mysql2/promise');

async function revertAllWalletBalances() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 REVERTING ALL WALLET BALANCES TO ORIGINAL STATE');
    console.log('==================================================\n');

    // Step 1: Get all users and their current balances
    console.log('🔍 Step 1: Getting all users and current balances...\n');

    const [users] = await pool.query(`
      SELECT 
        id,
        name,
        phone,
        wallet_balance,
        referred_by,
        level
      FROM users 
      ORDER BY id
    `);

    console.log(`📊 Found ${users.length} users to process\n`);

    // Step 2: Calculate original balances by subtracting all referral rewards
    console.log('🔧 Step 2: Calculating original balances...\n');

    let processed = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Get all referral rewards this user has received (as inviter)
        const [referralRewards] = await pool.query(`
          SELECT SUM(reward_amount) as total_rewards
          FROM referral_rewards 
          WHERE inviter_id = ? AND status = 'completed'
        `, [user.id]);

        const totalReferralRewards = parseFloat(referralRewards[0].total_rewards) || 0;
        
        // Calculate original balance (current - referral rewards received)
        const currentBalance = parseFloat(user.wallet_balance) || 0;
        const originalBalance = currentBalance - totalReferralRewards;

        console.log(`👤 ${user.name} (${user.phone})`);
        console.log(`   Current Balance: KES ${currentBalance}`);
        console.log(`   Referral Rewards Received: KES ${totalReferralRewards}`);
        console.log(`   Original Balance: KES ${originalBalance}`);

        // Update wallet balance to original amount
        await pool.query(
          'UPDATE users SET wallet_balance = ? WHERE id = ?',
          [originalBalance, user.id]
        );

        console.log(`   ✅ Balance restored to KES ${originalBalance}\n`);
        
        processed++;

      } catch (error) {
        console.error(`   ❌ Error processing ${user.name}:`, error.message);
        errors++;
        console.log('');
      }
    }

    // Step 3: Delete all referral reward records
    console.log('🔧 Step 3: Deleting all referral reward records...\n');

    const [deleteResult] = await pool.query('DELETE FROM referral_rewards');
    console.log(`✅ Deleted ${deleteResult.affectedRows} referral reward records`);

    // Step 4: Delete all referral-related notifications
    console.log('\n🔧 Step 4: Deleting referral notifications...\n');

    const [notifResult] = await pool.query(`
      DELETE FROM notifications 
      WHERE message LIKE '%referral%' OR message LIKE '%invitee%' OR message LIKE '%invitation%'
    `);
    console.log(`✅ Deleted ${notifResult.affectedRows} referral notifications`);

    // Step 5: Revert referral relationships to original state (user IDs instead of invitation codes)
    console.log('\n🔧 Step 5: Reverting referral relationships to original state...\n');

    // Find users with invitation codes in referred_by (corrected relationships)
    const [correctedRelations] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.referred_by,
        inviter.id as inviter_id
      FROM users u
      LEFT JOIN users inviter ON inviter.invitation_code = u.referred_by
      WHERE u.referred_by IS NOT NULL 
        AND u.referred_by != ''
        AND u.referred_by NOT REGEXP '^[0-9]+$'
        AND inviter.id IS NOT NULL
    `);

    console.log(`🔍 Found ${correctedRelations.length} corrected relationships to revert\n`);

    let relationshipsReverted = 0;

    for (const relation of correctedRelations) {
      try {
        console.log(`🔧 Reverting: ${relation.name} (${relation.phone})`);
        console.log(`   From: ${relation.referred_by} (invitation code)`);
        console.log(`   To: ${relation.inviter_id} (user ID)`);

        await pool.query(
          'UPDATE users SET referred_by = ? WHERE id = ?',
          [relation.inviter_id.toString(), relation.id]
        );

        console.log(`   ✅ Relationship reverted\n`);
        relationshipsReverted++;

      } catch (error) {
        console.error(`   ❌ Error reverting ${relation.name}:`, error.message);
      }
    }

    // Step 6: Summary
    console.log('📊 COMPLETE REVERSION SUMMARY');
    console.log('=============================');
    console.log(`✅ Users processed: ${processed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`💰 Referral reward records deleted: ${deleteResult.affectedRows}`);
    console.log(`📧 Notifications deleted: ${notifResult.affectedRows}`);
    console.log(`🔗 Referral relationships reverted: ${relationshipsReverted}`);

    console.log('\n🎉 ALL WALLET BALANCES REVERTED TO ORIGINAL STATE!');
    console.log('   • All balances restored to pre-referral state');
    console.log('   • All referral reward records deleted');
    console.log('   • All referral notifications removed');
    console.log('   • All referral relationships reverted to original format');
    console.log('   • System is now in original state before any referral processing');

  } catch (error) {
    console.error('❌ Error reverting wallet balances:', error.message);
  } finally {
    pool.end();
  }
}

revertAllWalletBalances();


