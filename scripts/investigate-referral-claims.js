const mysql = require('mysql2/promise');

async function investigateReferralClaims() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Referral Claims and System Issues\n');
    
    // Claim 1: 0740285715 invited Sopian Nyongesa +254715817417
    console.log('📋 CLAIM 1: 0740285715 → Sopian Nyongesa (+254715817417)');
    console.log('=' .repeat(60));
    
    // Find inviter
    const [inviter1] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at
      FROM users 
      WHERE phone = '0740285715' OR phone = '+254740285715' OR phone LIKE '%740285715%'
    `);
    
    // Find invitee
    const [invitee1] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at, referred_by
      FROM users 
      WHERE phone = '+254715817417' OR phone = '0715817417' OR phone LIKE '%715817417%'
    `);
    
    if (inviter1.length > 0 && invitee1.length > 0) {
      const inviter = inviter1[0];
      const invitee = invitee1[0];
      
      console.log(`✅ INVITER FOUND: ${inviter.name} (ID: ${inviter.id})`);
      console.log(`   Phone: ${inviter.phone}`);
      console.log(`   Level: ${inviter.level}`);
      console.log(`   Wallet: KES ${parseFloat(inviter.wallet_balance).toFixed(2)}`);
      console.log(`   Created: ${inviter.created_at}`);
      
      console.log(`\n✅ INVITEE FOUND: ${invitee.name} (ID: ${invitee.id})`);
      console.log(`   Phone: ${invitee.phone}`);
      console.log(`   Level: ${invitee.level}`);
      console.log(`   Wallet: KES ${parseFloat(invitee.wallet_balance).toFixed(2)}`);
      console.log(`   Created: ${invitee.created_at}`);
      console.log(`   Referred By: ${invitee.referred_by}`);
      
      // Check if referral relationship exists
      if (invitee.referred_by == inviter.id) {
        console.log(`\n✅ REFERRAL RELATIONSHIP CONFIRMED: ${inviter.name} → ${invitee.name}`);
        
        // Check for existing referral reward
        const [reward1] = await pool.query(`
          SELECT * FROM referral_rewards 
          WHERE inviter_id = ? AND user_id = ? AND status = 'completed'
        `, [inviter.id, invitee.id]);
        
        if (reward1.length > 0) {
          console.log(`✅ REWARD ALREADY EXISTS: KES ${parseFloat(reward1[0].reward_amount).toFixed(2)}`);
        } else {
          console.log(`❌ NO REWARD FOUND - MISSING REFERRAL REWARD!`);
          
          // Calculate expected reward based on invitee's level
          const levelRewards = {
            0: 0,    // Level 0 users get no reward
            1: 288,  // Level 1 user joins: KES 288
            2: 600,  // Level 2 user joins: KES 600
            3: 1200, // Level 3 user joins: KES 1200
            4: 1800, // Level 4 user joins: KES 1800
            5: 2400, // Level 5 user joins: KES 2400
          };
          
          const expectedReward = levelRewards[invitee.level] || 0;
          console.log(`💰 EXPECTED REWARD: KES ${expectedReward} (based on invitee level ${invitee.level})`);
          
          if (expectedReward > 0) {
            // Award the missing reward
            const newBalance = parseFloat(inviter.wallet_balance) + expectedReward;
            
            await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, inviter.id]);
            
            await pool.query(
              'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              [inviter.id, invitee.id, invitee.level, expectedReward, 'completed', new Date()]
            );
            
            console.log(`✅ REWARD AWARDED: KES ${expectedReward} to ${inviter.name}`);
            console.log(`   New balance: KES ${newBalance.toFixed(2)}`);
          }
        }
      } else {
        console.log(`❌ REFERRAL RELATIONSHIP NOT FOUND`);
        console.log(`   Invitee's referred_by: ${invitee.referred_by}`);
        console.log(`   Expected: ${inviter.id}`);
      }
    } else {
      console.log('❌ Users not found for claim 1');
      if (inviter1.length === 0) console.log('   Inviter 0740285715 not found');
      if (invitee1.length === 0) console.log('   Invitee +254715817417 not found');
    }
    
    console.log('\n' + '=' .repeat(80) + '\n');
    
    // Claim 2: 0706609894 invited 0707128529
    console.log('📋 CLAIM 2: 0706609894 → 0707128529');
    console.log('=' .repeat(60));
    
    // Find inviter
    const [inviter2] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at
      FROM users 
      WHERE phone = '0706609894' OR phone = '+254706609894' OR phone LIKE '%706609894%'
    `);
    
    // Find invitee
    const [invitee2] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, created_at, referred_by
      FROM users 
      WHERE phone = '0707128529' OR phone = '+254707128529' OR phone LIKE '%707128529%'
    `);
    
    if (inviter2.length > 0 && invitee2.length > 0) {
      const inviter = inviter2[0];
      const invitee = invitee2[0];
      
      console.log(`✅ INVITER FOUND: ${inviter.name} (ID: ${inviter.id})`);
      console.log(`   Phone: ${inviter.phone}`);
      console.log(`   Level: ${inviter.level}`);
      console.log(`   Wallet: KES ${parseFloat(inviter.wallet_balance).toFixed(2)}`);
      console.log(`   Created: ${inviter.created_at}`);
      
      console.log(`\n✅ INVITEE FOUND: ${invitee.name} (ID: ${invitee.id})`);
      console.log(`   Phone: ${invitee.phone}`);
      console.log(`   Level: ${invitee.level}`);
      console.log(`   Wallet: KES ${parseFloat(invitee.wallet_balance).toFixed(2)}`);
      console.log(`   Created: ${invitee.created_at}`);
      console.log(`   Referred By: ${invitee.referred_by}`);
      
      // Check if referral relationship exists
      if (invitee.referred_by == inviter.id) {
        console.log(`\n✅ REFERRAL RELATIONSHIP CONFIRMED: ${inviter.name} → ${invitee.name}`);
        
        // Check for existing referral reward
        const [reward2] = await pool.query(`
          SELECT * FROM referral_rewards 
          WHERE inviter_id = ? AND user_id = ? AND status = 'completed'
        `, [inviter.id, invitee.id]);
        
        if (reward2.length > 0) {
          console.log(`✅ REWARD ALREADY EXISTS: KES ${parseFloat(reward2[0].reward_amount).toFixed(2)}`);
        } else {
          console.log(`❌ NO REWARD FOUND - MISSING REFERRAL REWARD!`);
          
          // Calculate expected reward based on invitee's level
          const levelRewards = {
            0: 0,    // Level 0 users get no reward
            1: 288,  // Level 1 user joins: KES 288
            2: 600,  // Level 2 user joins: KES 600
            3: 1200, // Level 3 user joins: KES 1200
            4: 1800, // Level 4 user joins: KES 1800
            5: 2400, // Level 5 user joins: KES 2400
          };
          
          const expectedReward = levelRewards[invitee.level] || 0;
          console.log(`💰 EXPECTED REWARD: KES ${expectedReward} (based on invitee level ${invitee.level})`);
          
          if (expectedReward > 0) {
            // Award the missing reward
            const newBalance = parseFloat(inviter.wallet_balance) + expectedReward;
            
            await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, inviter.id]);
            
            await pool.query(
              'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              [inviter.id, invitee.id, invitee.level, expectedReward, 'completed', new Date()]
            );
            
            console.log(`✅ REWARD AWARDED: KES ${expectedReward} to ${inviter.name}`);
            console.log(`   New balance: KES ${newBalance.toFixed(2)}`);
          }
        }
      } else {
        console.log(`❌ REFERRAL RELATIONSHIP NOT FOUND`);
        console.log(`   Invitee's referred_by: ${invitee.referred_by}`);
        console.log(`   Expected: ${inviter.id}`);
      }
    } else {
      console.log('❌ Users not found for claim 2');
      if (inviter2.length === 0) console.log('   Inviter 0706609894 not found');
      if (invitee2.length === 0) console.log('   Invitee 0707128529 not found');
    }
    
    console.log('\n' + '=' .repeat(80) + '\n');
    
    // System-wide audit for missing referral rewards (list only, no awarding)
    console.log('🔍 SYSTEM-WIDE AUDIT: Missing Referral Rewards (LIST ONLY)');
    console.log('=' .repeat(80));
    
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
      INNER JOIN users u2 ON u1.id = u2.referred_by
      LEFT JOIN referral_rewards rr ON u1.id = rr.inviter_id AND u2.id = rr.user_id AND rr.status = 'completed'
      WHERE rr.id IS NULL
      ORDER BY u2.created_at DESC
    `);
    
    console.log(`📊 Found ${missingRewards.length} missing referral rewards:\n`);
    
    if (missingRewards.length > 0) {
      let totalMissing = 0;
      
      missingRewards.forEach((record, index) => {
        const levelRewards = {
          0: 0,    // Level 0 users get no reward
          1: 288,  // Level 1 user joins: KES 288
          2: 600,  // Level 2 user joins: KES 600
          3: 1200, // Level 3 user joins: KES 1200
          4: 1800, // Level 4 user joins: KES 1800
          5: 2400, // Level 5 user joins: KES 2400
        };
        
        const expectedReward = levelRewards[record.invitee_level] || 0;
        totalMissing += expectedReward;
        
        console.log(`${index + 1}. ${record.inviter_name} (${record.inviter_phone}) → ${record.invitee_name} (${record.invitee_phone})`);
        console.log(`   Inviter Level: ${record.inviter_level} | Invitee Level: ${record.invitee_level}`);
        console.log(`   Expected Reward: KES ${expectedReward}`);
        console.log(`   Invitee Created: ${record.invitee_created}`);
        console.log(`   Inviter Balance: KES ${parseFloat(record.inviter_balance).toFixed(2)}`);
        console.log('');
      });
      
      console.log(`💰 TOTAL MISSING REWARDS: KES ${totalMissing.toFixed(2)}`);
      console.log(`📊 AFFECTED INVITERS: ${missingRewards.length}`);
    } else {
      console.log('✅ No missing referral rewards found!');
    }
    
  } catch (error) {
    console.error('❌ Error investigating referral claims:', error.message);
  } finally {
    pool.end();
  }
}

investigateReferralClaims();