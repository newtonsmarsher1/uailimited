const mysql = require('mysql2/promise');

async function fixLawineReward() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing Lawine Omuse\'s Incorrect Reward\n');
    
    // Get Lawine's details
    const [lawine] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by
      FROM users 
      WHERE phone = '+254758432064' OR phone = '0758432064'
    `);
    
    if (lawine.length === 0) {
      console.log('❌ Lawine Omuse not found in database');
      return;
    }
    
    const lawineData = lawine[0];
    console.log(`👤 Lawine Omuse Details:`);
    console.log(`   ID: ${lawineData.id}`);
    console.log(`   Name: ${lawineData.name}`);
    console.log(`   Phone: ${lawineData.phone}`);
    console.log(`   Level: ${lawineData.level}`);
    console.log(`   Wallet Balance: KES ${parseFloat(lawineData.wallet_balance).toFixed(2)}`);
    console.log(`   Referred By: ${lawineData.referred_by}`);
    
    // Check if Lawine has any referral rewards (she shouldn't)
    const [lawineRewards] = await pool.query(`
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
    `, [lawineData.id]);
    
    if (lawineRewards.length > 0) {
      console.log(`\n❌ Found ${lawineRewards.length} incorrect rewards for Lawine:`);
      
      let totalToRemove = 0;
      
      for (const reward of lawineRewards) {
        console.log(`   Reward ID: ${reward.id}`);
        console.log(`   Amount: KES ${reward.reward_amount}`);
        console.log(`   Status: ${reward.status}`);
        console.log(`   From: ${reward.inviter_name}`);
        console.log(`   Date: ${new Date(reward.created_at).toLocaleDateString()}`);
        
        totalToRemove += parseFloat(reward.reward_amount);
      }
      
      console.log(`\n💰 Total incorrect amount: KES ${totalToRemove.toFixed(2)}`);
      
      // Remove the incorrect rewards
      console.log('\n🗑️  Removing incorrect rewards...');
      
      for (const reward of lawineRewards) {
        try {
          await pool.query('DELETE FROM referral_rewards WHERE id = ?', [reward.id]);
          console.log(`   ✅ Deleted reward ID: ${reward.id}`);
        } catch (error) {
          console.error(`   ❌ Error deleting reward ${reward.id}:`, error.message);
        }
      }
      
      // Deduct the incorrect amount from Lawine's wallet
      const newBalance = parseFloat(lawineData.wallet_balance) - totalToRemove;
      
      await pool.query(`
        UPDATE users 
        SET wallet_balance = ?
        WHERE id = ?
      `, [newBalance, lawineData.id]);
      
      console.log(`\n💰 Updated Lawine's wallet balance:`);
      console.log(`   Old balance: KES ${parseFloat(lawineData.wallet_balance).toFixed(2)}`);
      console.log(`   New balance: KES ${newBalance.toFixed(2)}`);
      console.log(`   Removed: KES ${totalToRemove.toFixed(2)}`);
      
    } else {
      console.log('\n✅ No incorrect rewards found for Lawine');
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    
    const [updatedLawine] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance
      FROM users 
      WHERE id = ?
    `, [lawineData.id]);
    
    const [remainingRewards] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards 
      WHERE user_id = ?
    `, [lawineData.id]);
    
    console.log(`\n📊 Verification Results:`);
    console.log(`   Lawine's new wallet balance: KES ${parseFloat(updatedLawine[0].wallet_balance).toFixed(2)}`);
    console.log(`   Remaining rewards for Lawine: ${remainingRewards[0].count}`);
    
    if (remainingRewards[0].count === 0) {
      console.log('\n✅ Fix completed successfully!');
      console.log('   Lawine no longer has any referral rewards (as it should be)');
    } else {
      console.log('\n⚠️  Some rewards may still remain. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

fixLawineReward();





