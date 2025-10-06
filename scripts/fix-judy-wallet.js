const mysql = require('mysql2/promise');

async function fixJudyWallet() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing Judy\'s Wallet Balance\n');
    
    // Get Judy's details
    const [judy] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by
      FROM users 
      WHERE name LIKE '%Judy%'
    `);
    
    if (judy.length === 0) {
      console.log('❌ Judy not found in database');
      return;
    }
    
    const judyData = judy[0];
    console.log(`👤 Judy Details:`);
    console.log(`   ID: ${judyData.id}`);
    console.log(`   Name: ${judyData.name}`);
    console.log(`   Phone: ${judyData.phone}`);
    console.log(`   Level: ${judyData.level}`);
    console.log(`   Current Wallet Balance: KES ${parseFloat(judyData.wallet_balance).toFixed(2)}`);
    console.log(`   Referred By: ${judyData.referred_by}`);
    
    // Calculate Judy's actual task earnings
    console.log('\n📊 Calculating Judy\'s task earnings...');
    
    const [completedTasks] = await pool.query(`
      SELECT 
        ut.id,
        ut.task_id,
        ut.app_task_id,
        ut.reward_earned,
        ut.completed_at,
        t.title as task_name,
        at.app_name as app_name
      FROM user_tasks ut
      LEFT JOIN tasks t ON t.id = ut.task_id
      LEFT JOIN app_tasks at ON at.id = ut.app_task_id
      WHERE ut.user_id = ? AND ut.is_complete = 1
      ORDER BY ut.completed_at DESC
    `, [judyData.id]);
    
    let totalTaskEarnings = 0;
    
    if (completedTasks.length > 0) {
      console.log(`\n📋 Found ${completedTasks.length} completed tasks`);
      
      completedTasks.forEach(task => {
        totalTaskEarnings += parseFloat(task.reward_earned || 0);
      });
      
      console.log(`   Total task earnings: KES ${totalTaskEarnings.toFixed(2)}`);
    } else {
      console.log('   No completed tasks found');
    }
    
    // Check for incorrect referral rewards received by Judy
    console.log('\n🎁 Checking for incorrect referral rewards...');
    
    const [referralRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        inviter.name as inviter_name
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.user_id = ?
      ORDER BY rr.created_at DESC
    `, [judyData.id]);
    
    if (referralRewards.length > 0) {
      console.log(`\n❌ Found ${referralRewards.length} incorrect referral rewards:`);
      
      let totalIncorrectRewards = 0;
      
      for (const reward of referralRewards) {
        console.log(`   Reward ID: ${reward.id}`);
        console.log(`   Amount: KES ${reward.reward_amount}`);
        console.log(`   Status: ${reward.status}`);
        console.log(`   From: ${reward.inviter_name}`);
        console.log(`   Date: ${new Date(reward.created_at).toLocaleDateString()}`);
        
        totalIncorrectRewards += parseFloat(reward.reward_amount);
      }
      
      console.log(`\n💰 Total incorrect amount: KES ${totalIncorrectRewards.toFixed(2)}`);
      
      // Remove the incorrect rewards
      console.log('\n🗑️  Removing incorrect referral rewards...');
      
      for (const reward of referralRewards) {
        try {
          await pool.query('DELETE FROM referral_rewards WHERE id = ?', [reward.id]);
          console.log(`   ✅ Deleted reward ID: ${reward.id}`);
        } catch (error) {
          console.error(`   ❌ Error deleting reward ${reward.id}:`, error.message);
        }
      }
      
      // Update Judy's wallet to reflect only task earnings
      console.log('\n💰 Updating Judy\'s wallet balance...');
      console.log(`   Current balance: KES ${parseFloat(judyData.wallet_balance).toFixed(2)}`);
      console.log(`   Task earnings: KES ${totalTaskEarnings.toFixed(2)}`);
      console.log(`   Incorrect rewards removed: KES ${totalIncorrectRewards.toFixed(2)}`);
      
      await pool.query(`
        UPDATE users 
        SET wallet_balance = ?
        WHERE id = ?
      `, [totalTaskEarnings, judyData.id]);
      
      console.log(`   New balance: KES ${totalTaskEarnings.toFixed(2)}`);
      
    } else {
      console.log('   No incorrect referral rewards found');
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(60));
    console.log(`Tasks completed: ${completedTasks.length}`);
    console.log(`Total task earnings: KES ${totalTaskEarnings.toFixed(2)}`);
    console.log(`Incorrect rewards removed: ${referralRewards.length}`);
    console.log(`Wallet updated to: KES ${totalTaskEarnings.toFixed(2)}`);
    console.log(`Previous balance: KES ${parseFloat(judyData.wallet_balance).toFixed(2)}`);
    console.log(`Difference: KES ${(totalTaskEarnings - parseFloat(judyData.wallet_balance)).toFixed(2)}`);
    
    // Verify the update
    console.log('\n🔍 Verifying update...');
    
    const [updatedJudy] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance
      FROM users 
      WHERE id = ?
    `, [judyData.id]);
    
    const [remainingRewards] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards 
      WHERE user_id = ?
    `, [judyData.id]);
    
    console.log(`\n✅ Verification Results:`);
    console.log(`   Judy's new wallet balance: KES ${parseFloat(updatedJudy[0].wallet_balance).toFixed(2)}`);
    console.log(`   Remaining referral rewards: ${remainingRewards[0].count}`);
    console.log(`   This now reflects only her task earnings`);
    
    if (remainingRewards[0].count === 0 && Math.abs(parseFloat(updatedJudy[0].wallet_balance) - totalTaskEarnings) < 0.01) {
      console.log('\n✅ Judy\'s wallet has been successfully corrected!');
      console.log('   - Removed incorrect referral rewards');
      console.log('   - Wallet now shows only task earnings');
    } else {
      console.log('\n⚠️  Some issues may still remain. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

fixJudyWallet();





