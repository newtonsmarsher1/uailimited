const mysql = require('mysql2/promise');

// Automatic Referral Reward System
// This script processes missing referral rewards and ensures the system works automatically

async function processMissingReferralRewards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🤖 AUTOMATIC REFERRAL REWARD SYSTEM');
    console.log('=====================================\n');

    // Step 1: Find users who should have referral rewards but don't
    console.log('🔍 Step 1: Scanning for missing referral rewards...\n');

    const [missingRewards] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level,
        u.referred_by,
        inviter.id as inviter_id,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        inviter.level as inviter_level
      FROM users u
      LEFT JOIN users inviter ON inviter.invitation_code = u.referred_by
      LEFT JOIN referral_rewards rr ON rr.user_id = u.id AND rr.inviter_id = inviter.id
      WHERE u.level >= 1 
        AND u.referred_by IS NOT NULL 
        AND u.referred_by != ''
        AND inviter.id IS NOT NULL
        AND rr.id IS NULL
      ORDER BY u.id
    `);

    console.log(`📊 Found ${missingRewards.length} users with missing referral rewards:\n`);

    if (missingRewards.length === 0) {
      console.log('✅ No missing referral rewards found!');
      return;
    }

    // Step 2: Process each missing reward
    console.log('🔧 Step 2: Processing missing rewards...\n');

    let processed = 0;
    let errors = 0;

    for (const user of missingRewards) {
      try {
        console.log(`👤 Processing: ${user.user_name} (${user.user_phone})`);
        console.log(`   Level: ${user.user_level}`);
        console.log(`   Referred by: ${user.inviter_name} (${user.inviter_phone})`);
        console.log(`   Inviter Level: ${user.inviter_level}`);

        // Define referral rewards based on level
        const referralRewards = {
          1: 288,  // Level 1: KES 288
          2: 600,  // Level 2: KES 600
          3: 1200  // Level 3: KES 1200
        };

        const rewardAmount = referralRewards[user.user_level];
        
        if (!rewardAmount) {
          console.log(`   ⚠️ No reward defined for level ${user.user_level}`);
          continue;
        }

        console.log(`   💰 Reward Amount: KES ${rewardAmount}`);

        // Check if inviter is a temporary worker (level 0)
        if (user.inviter_level === 0) {
          // Temporary workers don't receive rewards immediately - hold them until upgrade
          await pool.query(`
            INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
            VALUES (?, ?, ?, ?, NOW(), 'pending')
          `, [user.inviter_id, user.user_id, user.user_level, rewardAmount]);
          
          console.log(`   ⏳ Reward held as PENDING for temporary worker until upgrade`);
        } else {
          // Non-temporary workers receive rewards immediately
          await pool.query(
            'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [rewardAmount, user.inviter_id]
          );
          
          // Record the referral reward as completed
          await pool.query(`
            INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
            VALUES (?, ?, ?, ?, NOW(), 'completed')
          `, [user.inviter_id, user.user_id, user.user_level, rewardAmount]);
          
          console.log(`   ✅ Reward awarded immediately to inviter`);
        }

        // Send notification to inviter
        await pool.query(`
          INSERT INTO notifications (user_id, message, type, created_at)
          VALUES (?, ?, 'referral_reward', NOW())
        `, [user.inviter_id, `🎉 Your invitee ${user.user_name} (Level ${user.user_level}) earned you KES ${rewardAmount} referral reward!`]);
        
        console.log(`   📧 Notification sent to inviter`);
        console.log(`   ✅ Processed successfully\n`);
        
        processed++;

      } catch (error) {
        console.error(`   ❌ Error processing ${user.user_name}:`, error.message);
        errors++;
        console.log('');
      }
    }

    // Step 3: Summary
    console.log('📊 PROCESSING SUMMARY');
    console.log('====================');
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Errors encountered: ${errors}`);
    console.log(`📋 Total users checked: ${missingRewards.length}`);

    if (processed > 0) {
      console.log('\n🎉 Automatic referral reward system completed successfully!');
      console.log('   All missing rewards have been processed.');
    }

  } catch (error) {
    console.error('❌ Error in automatic referral reward system:', error.message);
  } finally {
    pool.end();
  }
}

// Function to check and fix incorrect referral relationships
async function fixIncorrectReferralRelationships() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('\n🔧 CHECKING REFERRAL RELATIONSHIPS');
    console.log('===================================\n');

    // Find users with incorrect referral relationships (referred_by = user ID instead of invitation code)
    const [incorrectRelations] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.referred_by,
        inviter.id as inviter_id,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        inviter.invitation_code
      FROM users u
      LEFT JOIN users inviter ON inviter.id = CAST(u.referred_by AS UNSIGNED)
      WHERE u.referred_by IS NOT NULL 
        AND u.referred_by != ''
        AND u.referred_by REGEXP '^[0-9]+$'
        AND inviter.id IS NOT NULL
    `);

    console.log(`🔍 Found ${incorrectRelations.length} incorrect referral relationships:\n`);

    if (incorrectRelations.length === 0) {
      console.log('✅ All referral relationships are correct!');
      return;
    }

    let fixed = 0;

    for (const relation of incorrectRelations) {
      try {
        console.log(`🔧 Fixing: ${relation.user_name} (${relation.user_phone})`);
        console.log(`   Current referred_by: ${relation.referred_by} (user ID)`);
        console.log(`   Should be: ${relation.invitation_code} (invitation code)`);
        console.log(`   Inviter: ${relation.inviter_name} (${relation.inviter_phone})`);

        // Fix the referral relationship
        await pool.query(
          'UPDATE users SET referred_by = ? WHERE id = ?',
          [relation.invitation_code, relation.user_id]
        );

        console.log(`   ✅ Fixed referral relationship\n`);
        fixed++;

      } catch (error) {
        console.error(`   ❌ Error fixing ${relation.user_name}:`, error.message);
      }
    }

    console.log(`📊 RELATIONSHIP FIX SUMMARY`);
    console.log(`✅ Fixed relationships: ${fixed}`);
    console.log(`📋 Total incorrect relationships: ${incorrectRelations.length}`);

  } catch (error) {
    console.error('❌ Error fixing referral relationships:', error.message);
  } finally {
    pool.end();
  }
}

// Main execution
async function runAutomaticSystem() {
  console.log('🚀 Starting Automatic Referral Reward System...\n');
  
  // Step 1: Fix incorrect referral relationships
  await fixIncorrectReferralRelationships();
  
  // Step 2: Process missing referral rewards
  await processMissingReferralRewards();
  
  console.log('\n🎉 Automatic Referral Reward System completed!');
  console.log('💡 Run this script regularly to ensure all rewards are processed.');
}

// Run the system
runAutomaticSystem();


