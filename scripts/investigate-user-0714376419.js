const mysql = require('mysql2/promise');

async function investigateUser0714376419() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Referral Claim for 0714376419\n');
    
    // Find the user
    const [user] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at
      FROM users 
      WHERE phone = '0714376419' OR phone = '+254714376419' OR phone LIKE '%714376419%'
    `);
    
    if (user.length === 0) {
      console.log('❌ User 0714376419 not found');
      return;
    }
    
    const userData = user[0];
    console.log('📋 USER DETAILS:');
    console.log(`   Name: ${userData.name} (ID: ${userData.id})`);
    console.log(`   Phone: ${userData.phone}`);
    console.log(`   Level: ${userData.level}`);
    console.log(`   Wallet Balance: KES ${parseFloat(userData.wallet_balance).toFixed(2)}`);
    console.log(`   Created: ${userData.created_at}`);
    
    // Find all users referred by this user
    const [referredUsers] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at
      FROM users 
      WHERE referred_by = ?
      ORDER BY created_at DESC
    `, [userData.id]);
    
    console.log(`\n📋 USERS REFERRED BY ${userData.name}:`);
    console.log(`   Total referred: ${referredUsers.length}`);
    
    if (referredUsers.length === 0) {
      console.log('   No users found referred by this user');
      return;
    }
    
    // Check for existing referral rewards
    const [existingRewards] = await pool.query(`
      SELECT rr.*, u.name as invitee_name, u.phone as invitee_phone, u.level as invitee_level
      FROM referral_rewards rr
      INNER JOIN users u ON rr.user_id = u.id
      WHERE rr.inviter_id = ? AND rr.status = 'completed'
      ORDER BY rr.created_at DESC
    `, [userData.id]);
    
    console.log(`\n📋 EXISTING REFERRAL REWARDS: ${existingRewards.length}`);
    existingRewards.forEach((reward, index) => {
      console.log(`   ${index + 1}. ${reward.invitee_name} (${reward.invitee_phone}) - Level ${reward.invitee_level}`);
      console.log(`      Reward: KES ${parseFloat(reward.reward_amount).toFixed(2)}`);
      console.log(`      Date: ${reward.created_at}`);
    });
    
    // Find missing referral rewards
    console.log(`\n🔍 CHECKING FOR MISSING REWARDS:`);
    
    const levelRewards = {
      0: 0,    // Level 0 users get no reward
      1: 288,  // Level 1 user joins: KES 288
      2: 600,  // Level 2 user joins: KES 600
      3: 1200, // Level 3 user joins: KES 1200
      4: 1800, // Level 4 user joins: KES 1800
      5: 2400, // Level 5 user joins: KES 2400
    };
    
    let missingRewards = [];
    let totalMissing = 0;
    
    for (const referredUser of referredUsers) {
      // Check if reward exists for this user
      const hasReward = existingRewards.some(reward => reward.user_id === referredUser.id);
      
      if (!hasReward) {
        const expectedReward = levelRewards[referredUser.level] || 0;
        if (expectedReward > 0) {
          missingRewards.push({
            invitee: referredUser,
            expectedReward: expectedReward
          });
          totalMissing += expectedReward;
        }
      }
    }
    
    if (missingRewards.length === 0) {
      console.log('✅ No missing referral rewards found');
      console.log('   All referred users either have rewards or are level 0 (no reward)');
    } else {
      console.log(`❌ Found ${missingRewards.length} missing referral rewards:`);
      console.log(`   Total missing: KES ${totalMissing.toFixed(2)}\n`);
      
      missingRewards.forEach((missing, index) => {
        console.log(`   ${index + 1}. ${missing.invitee.name} (${missing.invitee.phone})`);
        console.log(`      Level: ${missing.invitee.level}`);
        console.log(`      Expected Reward: KES ${missing.expectedReward}`);
        console.log(`      Joined: ${missing.invitee.created_at}`);
        console.log('');
      });
      
      // Award the missing rewards
      console.log('💰 AWARDING MISSING REWARDS...');
      let newBalance = parseFloat(userData.wallet_balance);
      
      for (const missing of missingRewards) {
        // Add reward to wallet
        newBalance += missing.expectedReward;
        
        // Create referral reward record
        await pool.query(
          'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [userData.id, missing.invitee.id, missing.invitee.level, missing.expectedReward, 'completed', new Date()]
        );
        
        console.log(`✅ Awarded KES ${missing.expectedReward} for ${missing.invitee.name} (Level ${missing.invitee.level})`);
      }
      
      // Update user's wallet balance
      await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userData.id]);
      
      console.log(`\n✅ ALL MISSING REWARDS AWARDED!`);
      console.log(`   Previous balance: KES ${parseFloat(userData.wallet_balance).toFixed(2)}`);
      console.log(`   New balance: KES ${newBalance.toFixed(2)}`);
      console.log(`   Total awarded: KES ${totalMissing.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error investigating user 0714376419:', error.message);
  } finally {
    pool.end();
  }
}

investigateUser0714376419();




