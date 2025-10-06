const mysql = require('mysql2/promise');

async function revertMichaelWallet() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 Reverting Michael Nyandiri Bikundu\'s Wallet\n');
    
    // Get Michael's details
    const [michael] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by
      FROM users 
      WHERE id = 202 AND phone = '+254111394208'
    `);
    
    if (michael.length === 0) {
      console.log('❌ Michael not found');
      return;
    }
    
    const michaelData = michael[0];
    console.log(`👤 Michael Details:`);
    console.log(`   ID: ${michaelData.id}`);
    console.log(`   Name: ${michaelData.name}`);
    console.log(`   Phone: ${michaelData.phone}`);
    console.log(`   Level: ${michaelData.level}`);
    console.log(`   Current Wallet Balance: KES ${parseFloat(michaelData.wallet_balance).toFixed(2)}`);
    
    // Calculate task earnings
    const [taskEarnings] = await pool.query(`
      SELECT COALESCE(SUM(reward_earned), 0) as total_earnings
      FROM user_tasks 
      WHERE user_id = ? AND is_complete = 1
    `, [michaelData.id]);
    
    const taskEarningsAmount = parseFloat(taskEarnings[0].total_earnings);
    const currentBalance = parseFloat(michaelData.wallet_balance);
    
    // Get withdrawals
    const [withdrawals] = await pool.query(`
      SELECT amount, status
      FROM withdrawals 
      WHERE user_id = ? AND status = 'approved'
    `, [michaelData.id]);
    
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);
    
    // Get payments
    const [payments] = await pool.query(`
      SELECT amount, status
      FROM payments 
      WHERE user_id = ? AND status = 'approved'
    `, [michaelData.id]);
    
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    console.log(`\n📊 Financial Analysis:`);
    console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
    console.log(`   Current wallet: KES ${currentBalance.toFixed(2)}`);
    console.log(`   Total withdrawals: KES ${totalWithdrawals.toFixed(2)}`);
    console.log(`   Total payments: KES ${totalPayments.toFixed(2)}`);
    
    // Calculate expected balance
    // Expected = Task earnings + Payments - Withdrawals
    const expectedBalance = taskEarningsAmount + totalPayments - totalWithdrawals;
    const difference = currentBalance - expectedBalance;
    
    console.log(`\n💡 Expected Balance Calculation:`);
    console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
    console.log(`   + Payments: KES ${totalPayments.toFixed(2)}`);
    console.log(`   - Withdrawals: KES ${totalWithdrawals.toFixed(2)}`);
    console.log(`   = Expected: KES ${expectedBalance.toFixed(2)}`);
    console.log(`   Current: KES ${currentBalance.toFixed(2)}`);
    console.log(`   Difference: KES ${difference.toFixed(2)}`);
    
    if (Math.abs(difference) > 0.01) {
      if (difference > 0) {
        console.log(`\n⚠️  Michael has KES ${difference.toFixed(2)} MORE than expected`);
        console.log('   This suggests his wallet was manually adjusted or has extra funds');
      } else {
        console.log(`\n⚠️  Michael has KES ${Math.abs(difference).toFixed(2)} LESS than expected`);
        console.log('   This suggests some funds are missing');
      }
    } else {
      console.log('\n✅ Michael\'s wallet balance is correct');
      return;
    }
    
    // Check if Michael was mentioned in our previous corrections
    console.log('\n🔍 Checking if Michael was affected by our corrections...');
    
    // Check for any referral rewards that might have been removed
    const [removedRewards] = await pool.query(`
      SELECT COUNT(*) as count
      FROM referral_rewards 
      WHERE user_id = ? AND status = 'completed'
    `, [michaelData.id]);
    
    if (removedRewards[0].count > 0) {
      console.log(`❌ Michael had ${removedRewards[0].count} referral reward(s) that were removed`);
      console.log('   His wallet was likely corrected to show only task earnings');
      console.log('   But he should have kept his original balance including payments and withdrawals');
    } else {
      console.log('✅ Michael was not affected by our corrections');
    }
    
    // Revert to expected balance
    console.log(`\n🔄 Reverting wallet balance...`);
    console.log(`   From: KES ${currentBalance.toFixed(2)}`);
    console.log(`   To: KES ${expectedBalance.toFixed(2)}`);
    console.log(`   Difference: KES ${(expectedBalance - currentBalance).toFixed(2)}`);
    
    await pool.query(`
      UPDATE users 
      SET wallet_balance = ?
      WHERE id = ?
    `, [expectedBalance, michaelData.id]);
    
    console.log(`\n✅ Michael's wallet has been reverted!`);
    console.log(`   New balance: KES ${expectedBalance.toFixed(2)}`);
    console.log(`   This includes:`);
    console.log(`   - Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
    console.log(`   - Payments received: KES ${totalPayments.toFixed(2)}`);
    console.log(`   - Withdrawals made: KES ${totalWithdrawals.toFixed(2)}`);
    
    // Verify the update
    console.log(`\n🔍 Verifying update...`);
    
    const [updatedMichael] = await pool.query(`
      SELECT id, name, phone, wallet_balance
      FROM users 
      WHERE id = ?
    `, [michaelData.id]);
    
    const newBalance = parseFloat(updatedMichael[0].wallet_balance);
    
    if (Math.abs(newBalance - expectedBalance) < 0.01) {
      console.log(`✅ Verification successful!`);
      console.log(`   Michael's wallet is now: KES ${newBalance.toFixed(2)}`);
    } else {
      console.log(`❌ Verification failed!`);
      console.log(`   Expected: KES ${expectedBalance.toFixed(2)}`);
      console.log(`   Actual: KES ${newBalance.toFixed(2)}`);
    }
    
    // Summary
    console.log(`\n📋 Summary:`);
    console.log(`   User: ${michaelData.name} (${michaelData.phone})`);
    console.log(`   Level: ${michaelData.level}`);
    console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
    console.log(`   Payments received: KES ${totalPayments.toFixed(2)}`);
    console.log(`   Withdrawals made: KES ${totalWithdrawals.toFixed(2)}`);
    console.log(`   Final balance: KES ${newBalance.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

revertMichaelWallet();





