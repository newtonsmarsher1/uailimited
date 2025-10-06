const mysql = require('mysql2/promise');

// Daily Referral Check - Lightweight version
async function dailyReferralCheck() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Daily Referral Check - ' + new Date().toISOString().split('T')[0]);
    
    // Quick check for missing rewards
    const [missingRewards] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone
      FROM users u
      LEFT JOIN users inviter ON inviter.invitation_code = u.referred_by
      LEFT JOIN referral_rewards rr ON rr.user_id = u.id AND rr.inviter_id = inviter.id
      WHERE u.level >= 1 
        AND u.referred_by IS NOT NULL 
        AND u.referred_by != ''
        AND inviter.id IS NOT NULL
        AND rr.id IS NULL
        AND u.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY u.id
    `);

    if (missingRewards.length === 0) {
      console.log('✅ No new missing referral rewards found');
      return;
    }

    console.log(`📊 Found ${missingRewards.length} new users with missing referral rewards`);

    // Process missing rewards
    for (const user of missingRewards) {
      const referralRewards = { 1: 288, 2: 600, 3: 1200 };
      const rewardAmount = referralRewards[user.user_level];
      
      if (!rewardAmount) continue;

      // Get inviter details
      const [inviter] = await pool.query(
        'SELECT id, level FROM users WHERE invitation_code = ?',
        [user.referred_by]
      );

      if (inviter.length === 0) continue;
      const inviterData = inviter[0];

      if (inviterData.level === 0) {
        // Pending for temporary worker
        await pool.query(`
          INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
          VALUES (?, ?, ?, ?, NOW(), 'pending')
        `, [inviterData.id, user.user_id, user.user_level, rewardAmount]);
      } else {
        // Immediate reward
        await pool.query(
          'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
          [rewardAmount, inviterData.id]
        );
        
        await pool.query(`
          INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
          VALUES (?, ?, ?, ?, NOW(), 'completed')
        `, [inviterData.id, user.user_id, user.user_level, rewardAmount]);
      }

      console.log(`✅ Processed reward for ${user.user_name} (Level ${user.user_level}) - KES ${rewardAmount}`);
    }

    console.log(`🎉 Daily check completed - processed ${missingRewards.length} rewards`);

  } catch (error) {
    console.error('❌ Error in daily referral check:', error.message);
  } finally {
    pool.end();
  }
}

dailyReferralCheck();
