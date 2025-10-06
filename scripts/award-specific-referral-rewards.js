const mysql = require('mysql2/promise');

async function awardSpecificReferralRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🎯 Awarding Specific Referral Rewards\n');
    
    // Define the two specific claims to award
    const specificClaims = [
      {
        inviterPhone: '0740285715',
        inviteePhone: '+254715817417',
        inviterName: 'Peter hezron',
        inviteeName: 'Sopian Nyongesa',
        description: 'Claim 1: Peter hezron → Sopian Nyongesa'
      },
      {
        inviterPhone: '0706609894',
        inviteePhone: '+254707128529',
        inviterName: 'Charles Ochoi',
        inviteeName: 'Douglas onduso',
        description: 'Claim 2: Charles Ochoi → Douglas onduso'
      }
    ];
    
    console.log('📋 Processing 2 specific claims:\n');
    
    for (const claim of specificClaims) {
      console.log(`🔍 Processing: ${claim.description}`);
      
      // Find inviter
      const [inviter] = await pool.query(`
        SELECT id, name, phone, level, wallet_balance
        FROM users 
        WHERE phone = ? OR phone = ? OR phone LIKE ?
      `, [claim.inviterPhone, `+254${claim.inviterPhone.substring(1)}`, `%${claim.inviterPhone.substring(2)}%`]);
      
      // Find invitee
      const [invitee] = await pool.query(`
        SELECT id, name, phone, level, referred_by, created_at
        FROM users 
        WHERE phone = ? OR phone = ? OR phone LIKE ?
      `, [claim.inviteePhone, claim.inviteePhone.replace('+254', '0'), `%${claim.inviteePhone.substring(4)}%`]);
      
      if (inviter.length === 0 || invitee.length === 0) {
        console.log(`   ❌ Could not find both users for ${claim.description}`);
        continue;
      }
      
      const inviterData = inviter[0];
      const inviteeData = invitee[0];
      
      // Verify the referral relationship
      if (inviteeData.referred_by !== inviterData.id) {
        console.log(`   ❌ Referral relationship not confirmed for ${claim.description}`);
        console.log(`   Invitee's referred_by: ${inviteeData.referred_by}, Inviter ID: ${inviterData.id}`);
        continue;
      }
      
      // Check if reward already exists
      const [existingReward] = await pool.query(`
        SELECT * FROM referral_rewards 
        WHERE inviter_id = ? AND user_id = ?
      `, [inviterData.id, inviteeData.id]);
      
      if (existingReward.length > 0) {
        console.log(`   ⚠️ Reward already exists: KES ${existingReward[0].reward_amount} (Status: ${existingReward[0].status})`);
        continue;
      }
      
      // Calculate reward amount based on invitee's level
      const levelRewards = {
        0: 0,    // Level 0 users get no reward
        1: 288,  // Level 1 user joins: KES 288
        2: 600,  // Level 2 user joins: KES 600
        3: 1200, // Level 3 user joins: KES 1200
        4: 1800, // Level 4 user joins: KES 1800
        5: 2400, // Level 5 user joins: KES 2400
      };
      
      const rewardAmount = levelRewards[inviteeData.level] || 0;
      
      if (rewardAmount === 0) {
        console.log(`   ⚠️ No reward for level ${inviteeData.level} invitee`);
        continue;
      }
      
      // Award the reward
      const newBalance = parseFloat(inviterData.wallet_balance) + rewardAmount;
      
      // Update inviter's wallet
      await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, inviterData.id]);
      
      // Create referral reward record
      await pool.query(
        'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [inviterData.id, inviteeData.id, inviterData.level, rewardAmount, 'completed', new Date()]
      );
      
      console.log(`   ✅ REWARD AWARDED: KES ${rewardAmount} to ${inviterData.name}`);
      console.log(`   Inviter: ${inviterData.name} (Level ${inviterData.level}) → Invitee: ${inviteeData.name} (Level ${inviteeData.level})`);
      console.log(`   New balance: KES ${newBalance.toFixed(2)}`);
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('📊 LISTING ALL OTHER MISSING REFERRAL REWARDS:\n');
    
    // Get all other missing rewards (excluding the two we just awarded)
    const [missingRewards] = await pool.query(`
      SELECT 
        u1.id as inviter_id,
        u1.name as inviter_name,
        u1.phone as inviter_phone,
        u1.level as inviter_level,
        u1.wallet_balance as inviter_balance,
        u2.id as invitee_id,
        u2.name as invitee_name,
        u2.phone as invitee_phone,
        u2.level as invitee_level,
        u2.created_at as invitee_created
      FROM users u1
      INNER JOIN users u2 ON u2.referred_by = u1.id
      LEFT JOIN referral_rewards rr ON rr.inviter_id = u1.id AND rr.user_id = u2.id
      WHERE rr.id IS NULL
      ORDER BY u2.created_at DESC
    `);
    
    console.log(`📋 Found ${missingRewards.length} other missing referral rewards:\n`);
    
    if (missingRewards.length > 0) {
      missingRewards.forEach((record, index) => {
        // Calculate expected reward amount
        const levelRewards = {
          0: 0,    // Level 0 users get no reward
          1: 288,  // Level 1 user joins: KES 288
          2: 600,  // Level 2 user joins: KES 600
          3: 1200, // Level 3 user joins: KES 1200
          4: 1800, // Level 4 user joins: KES 1800
          5: 2400, // Level 5 user joins: KES 2400
        };
        
        const expectedReward = levelRewards[record.invitee_level] || 0;
        
        console.log(`${index + 1}. ${record.inviter_name} (${record.inviter_phone}) → ${record.invitee_name} (${record.invitee_phone})`);
        console.log(`   Inviter Level: ${record.inviter_level}, Invitee Level: ${record.invitee_level}`);
        console.log(`   Expected Reward: KES ${expectedReward}`);
        console.log(`   Invitee joined: ${record.invitee_created}`);
        console.log(`   Inviter balance: KES ${parseFloat(record.inviter_balance).toFixed(2)}`);
        console.log('');
      });
      
      // Calculate total missing rewards value
      const totalMissingValue = missingRewards.reduce((sum, record) => {
        const levelRewards = { 0: 0, 1: 288, 2: 600, 3: 1200, 4: 1800, 5: 2400 };
        return sum + (levelRewards[record.invitee_level] || 0);
      }, 0);
      
      console.log(`💰 Total missing rewards value: KES ${totalMissingValue.toLocaleString()}`);
      console.log(`📊 Total missing referrals: ${missingRewards.length}`);
    } else {
      console.log('✅ No other missing referral rewards found!');
    }
    
  } catch (error) {
    console.error('❌ Error awarding referral rewards:', error.message);
  } finally {
    pool.end();
  }
}

awardSpecificReferralRewards();




