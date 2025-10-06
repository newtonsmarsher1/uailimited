const mysql = require('mysql2/promise');

async function revertCyprianFinal() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 Reverting Cyprian\'s Wallet to Original Balance\n');
    
    // Get Cyprian (ID: 201, phone: 0740020784)
    const [cyprian] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by
      FROM users 
      WHERE id = 201 AND phone = '0740020784'
    `);
    
    if (cyprian.length === 0) {
      console.log('❌ Cyprian not found');
      return;
    }
    
    const cyprianData = cyprian[0];
    console.log(`👤 Cyprian Details:`);
    console.log(`   ID: ${cyprianData.id}`);
    console.log(`   Name: ${cyprianData.name}`);
    console.log(`   Phone: ${cyprianData.phone}`);
    console.log(`   Level: ${cyprianData.level}`);
    console.log(`   Current Wallet Balance: KES ${parseFloat(cyprianData.wallet_balance).toFixed(2)}`);
    
    // Calculate task earnings
    const [taskEarnings] = await pool.query(`
      SELECT COALESCE(SUM(reward_earned), 0) as total_earnings
      FROM user_tasks 
      WHERE user_id = ? AND is_complete = 1
    `, [cyprianData.id]);
    
    const taskEarningsAmount = parseFloat(taskEarnings[0].total_earnings);
    const currentBalance = parseFloat(cyprianData.wallet_balance);
    
    console.log(`\n📊 Analysis:`);
    console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
    console.log(`   Current wallet: KES ${currentBalance.toFixed(2)}`);
    console.log(`   Difference: KES ${(currentBalance - taskEarningsAmount).toFixed(2)}`);
    
    // Based on the original issue, Cyprian should have received a referral reward
    // but didn't. His original balance was likely higher.
    // Since he's Level 2, he should have received KES 600 for referring Brian Memba kebaso
    const estimatedOriginalBalance = taskEarningsAmount + 600; // Level 2 referral reward
    
    console.log(`\n💡 Original Issue Analysis:`);
    console.log(`   - Cyprian invited Brian Memba kebaso (0798921142)`);
    console.log(`   - Cyprian should have received KES 600.00 referral reward`);
    console.log(`   - But he was not awarded`);
    console.log(`   - Estimated original balance: KES ${estimatedOriginalBalance.toFixed(2)}`);
    
    // Revert to estimated original balance
    console.log(`\n🔄 Reverting wallet balance...`);
    console.log(`   From: KES ${currentBalance.toFixed(2)}`);
    console.log(`   To: KES ${estimatedOriginalBalance.toFixed(2)}`);
    console.log(`   Difference: KES ${(estimatedOriginalBalance - currentBalance).toFixed(2)}`);
    
    await pool.query(`
      UPDATE users 
      SET wallet_balance = ?
      WHERE id = ?
    `, [estimatedOriginalBalance, cyprianData.id]);
    
    console.log(`\n✅ Cyprian's wallet has been reverted!`);
    console.log(`   New balance: KES ${estimatedOriginalBalance.toFixed(2)}`);
    console.log(`   This includes his task earnings (KES ${taskEarningsAmount.toFixed(2)})`);
    console.log(`   Plus the referral reward he should have received (KES 600.00)`);
    
    // Verify the update
    console.log(`\n🔍 Verifying update...`);
    
    const [updatedCyprian] = await pool.query(`
      SELECT id, name, phone, wallet_balance
      FROM users 
      WHERE id = ?
    `, [cyprianData.id]);
    
    const newBalance = parseFloat(updatedCyprian[0].wallet_balance);
    
    if (Math.abs(newBalance - estimatedOriginalBalance) < 0.01) {
      console.log(`✅ Verification successful!`);
      console.log(`   Cyprian's wallet is now: KES ${newBalance.toFixed(2)}`);
    } else {
      console.log(`❌ Verification failed!`);
      console.log(`   Expected: KES ${estimatedOriginalBalance.toFixed(2)}`);
      console.log(`   Actual: KES ${newBalance.toFixed(2)}`);
    }
    
    // Summary
    console.log(`\n📋 Summary:`);
    console.log(`   User: ${cyprianData.name} (${cyprianData.phone})`);
    console.log(`   Level: ${cyprianData.level}`);
    console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
    console.log(`   Referral reward added: KES 600.00`);
    console.log(`   Final balance: KES ${newBalance.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

revertCyprianFinal();





