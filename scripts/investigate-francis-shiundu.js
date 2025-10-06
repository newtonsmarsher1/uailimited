const mysql = require('mysql2/promise');

async function investigateFrancisShiundu() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Francis Shiundu\'s Missing Invitation Code\n');
    
    // Find Francis Shiundu
    const [francis] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at, referred_by, referral_code
      FROM users 
      WHERE name LIKE '%Francis%' AND name LIKE '%Shiundu%'
    `);
    
    if (francis.length === 0) {
      console.log('❌ Francis Shiundu not found');
      
      // Try broader search
      const [francisSearch] = await pool.query(`
        SELECT id, name, phone, level, wallet_balance, created_at, referred_by, referral_code
        FROM users 
        WHERE name LIKE '%Francis%' OR name LIKE '%Shiundu%'
      `);
      
      if (francisSearch.length > 0) {
        console.log('\n🔍 Found users with similar names:');
        francisSearch.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.phone}) - ID: ${user.id}`);
        });
      }
      
      return;
    }
    
    const francisData = francis[0];
    console.log('📋 FRANCIS SHIUNDU DETAILS:');
    console.log(`   Name: ${francisData.name}`);
    console.log(`   ID: ${francisData.id}`);
    console.log(`   Phone: ${francisData.phone}`);
    console.log(`   Level: ${francisData.level}`);
    console.log(`   Wallet Balance: KES ${parseFloat(francisData.wallet_balance).toFixed(2)}`);
    console.log(`   Created: ${francisData.created_at}`);
    console.log(`   Referred By: ${francisData.referred_by}`);
    console.log(`   Referral Code: ${francisData.referral_code || 'NULL'}`);
    
    // Check who invited Francis
    if (francisData.referred_by) {
      const [inviter] = await pool.query(`
        SELECT id, name, phone, referral_code
        FROM users 
        WHERE id = ?
      `, [francisData.referred_by]);
      
      if (inviter.length > 0) {
        console.log(`\n📋 INVITER DETAILS:`);
        console.log(`   Name: ${inviter[0].name}`);
        console.log(`   Phone: ${inviter[0].phone}`);
        console.log(`   Referral Code: ${inviter[0].referral_code}`);
      }
    }
    
    // Check if Francis has any invitation rewards
    const [invitationRewards] = await pool.query(`
      SELECT * FROM referral_rewards 
      WHERE inviter_id = ? AND status = 'completed'
    `, [francisData.id]);
    
    console.log(`\n📋 FRANCIS'S INVITATION REWARDS: ${invitationRewards.length}`);
    if (invitationRewards.length > 0) {
      invitationRewards.forEach((reward, index) => {
        console.log(`   ${index + 1}. User ID: ${reward.user_id}`);
        console.log(`      Reward: KES ${parseFloat(reward.reward_amount).toFixed(2)}`);
        console.log(`      Date: ${reward.created_at}`);
      });
    }
    
    // Check users referred by Francis
    const [referredUsers] = await pool.query(`
      SELECT id, name, phone, level, created_at
      FROM users 
      WHERE referred_by = ?
      ORDER BY created_at DESC
    `, [francisData.id]);
    
    console.log(`\n📋 USERS REFERRED BY FRANCIS: ${referredUsers.length}`);
    referredUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.phone}) - Level ${user.level}`);
      console.log(`      Joined: ${user.created_at}`);
    });
    
    // Check if referral code is missing
    console.log(`\n🔍 INVITATION CODE ANALYSIS:`);
    
    if (!francisData.referral_code) {
      console.log('❌ REFERRAL CODE MISSING!');
      console.log('   Francis Shiundu does not have a referral code');
      
      // Generate referral code (same as user ID for consistency)
      const referralCode = francisData.id.toString();
      
      // Update user with referral code
      await pool.query(`
        UPDATE users 
        SET referral_code = ?
        WHERE id = ?
      `, [referralCode, francisData.id]);
      
      console.log(`✅ REFERRAL CODE GENERATED: ${referralCode}`);
      console.log(`   Francis can now share this code: ${referralCode}`);
    } else {
      console.log(`✅ REFERRAL CODE EXISTS: ${francisData.referral_code}`);
      console.log(`   Francis can share this code for invitations`);
    }
    
    // Check if Francis should have received invitation rewards
    console.log(`\n🔍 MISSING INVITATION REWARDS CHECK:`);
    
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
      const hasReward = invitationRewards.some(reward => reward.user_id === referredUser.id);
      
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
      console.log('✅ No missing invitation rewards');
    } else {
      console.log(`❌ Missing ${missingRewards.length} invitation rewards:`);
      missingRewards.forEach((missing, index) => {
        console.log(`   ${index + 1}. ${missing.invitee.name} - Level ${missing.invitee.level}`);
        console.log(`      Expected Reward: KES ${missing.expectedReward}`);
      });
      console.log(`   Total missing: KES ${totalMissing.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error investigating Francis Shiundu:', error.message);
  } finally {
    pool.end();
  }
}

investigateFrancisShiundu();




