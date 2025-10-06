const mysql = require('mysql2/promise');

async function investigateJudyWallet() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Judy\'s Wallet Balance\n');
    
    // Get Judy's details
    const [judy] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by, invitation_code
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
    console.log(`   Wallet Balance: KES ${parseFloat(judyData.wallet_balance).toFixed(2)}`);
    console.log(`   Referred By: ${judyData.referred_by || 'N/A'}`);
    console.log(`   Invitation Code: ${judyData.invitation_code}`);
    
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
    
    console.log(`\n📋 Found ${completedTasks.length} completed tasks:`);
    
    let totalTaskEarnings = 0;
    let taskCount = 0;
    
    if (completedTasks.length > 0) {
      console.log('Task ID | Task Name/App        | Earning  | Completed Date');
      console.log('-' .repeat(60));
      
      completedTasks.forEach(task => {
        const taskId = task.id.toString().padEnd(7);
        const taskName = (task.task_name || task.app_name || 'Unknown').substring(0, 20).padEnd(20);
        const earning = `KES ${parseFloat(task.reward_earned || 0).toFixed(2)}`.padEnd(8);
        const date = new Date(task.completed_at).toLocaleDateString();
        
        console.log(`${taskId} | ${taskName} | ${earning} | ${date}`);
        
        totalTaskEarnings += parseFloat(task.reward_earned || 0);
        taskCount++;
      });
    } else {
      console.log('   No completed tasks found');
    }
    
    // Check for referral rewards received by Judy
    console.log('\n🎁 Checking referral rewards received by Judy...');
    
    const [referralRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      WHERE rr.user_id = ?
      ORDER BY rr.created_at DESC
    `, [judyData.id]);
    
    let totalReferralRewards = 0;
    
    if (referralRewards.length > 0) {
      console.log(`\n📋 Found ${referralRewards.length} referral rewards received:`);
      console.log('Reward ID | Inviter Name        | Amount  | Status    | Date');
      console.log('-' .repeat(60));
      
      referralRewards.forEach(reward => {
        const id = reward.id.toString().padEnd(9);
        const inviterName = (reward.inviter_name || 'N/A').substring(0, 18).padEnd(18);
        const amount = `KES ${reward.reward_amount}`.padEnd(7);
        const status = reward.status.padEnd(9);
        const date = new Date(reward.created_at).toLocaleDateString();
        
        console.log(`${id} | ${inviterName} | ${amount} | ${status} | ${date}`);
        
        if (reward.status === 'completed') {
          totalReferralRewards += parseFloat(reward.reward_amount);
        }
      });
    } else {
      console.log('   No referral rewards received');
    }
    
    // Check for payments received by Judy
    console.log('\n💰 Checking payments received by Judy...');
    
    const [payments] = await pool.query(`
      SELECT 
        id,
        amount,
        status,
        created_at,
        payment_method
      FROM payments 
      WHERE user_id = ? AND status = 'completed'
      ORDER BY created_at DESC
    `, [judyData.id]);
    
    let totalPayments = 0;
    
    if (payments.length > 0) {
      console.log(`\n📋 Found ${payments.length} completed payments:`);
      console.log('Payment ID | Amount  | Method   | Date');
      console.log('-' .repeat(40));
      
      payments.forEach(payment => {
        const id = payment.id.toString().padEnd(10);
        const amount = `KES ${payment.amount}`.padEnd(7);
        const method = (payment.payment_method || 'N/A').substring(0, 8).padEnd(8);
        const date = new Date(payment.created_at).toLocaleDateString();
        
        console.log(`${id} | ${amount} | ${method} | ${date}`);
        
        totalPayments += parseFloat(payment.amount);
      });
    } else {
      console.log('   No completed payments found');
    }
    
    // Check for withdrawals made by Judy
    console.log('\n💸 Checking withdrawals made by Judy...');
    
    const [withdrawals] = await pool.query(`
      SELECT 
        id,
        amount,
        status,
        requested_at,
        processed_at
      FROM withdrawals 
      WHERE user_id = ?
      ORDER BY requested_at DESC
    `, [judyData.id]);
    
    let totalWithdrawals = 0;
    
    if (withdrawals.length > 0) {
      console.log(`\n📋 Found ${withdrawals.length} withdrawals:`);
      console.log('Withdrawal ID | Amount  | Status    | Requested Date | Processed Date');
      console.log('-' .repeat(70));
      
      withdrawals.forEach(withdrawal => {
        const id = withdrawal.id.toString().padEnd(13);
        const amount = `KES ${withdrawal.amount}`.padEnd(7);
        const status = withdrawal.status.padEnd(9);
        const requested = new Date(withdrawal.requested_at).toLocaleDateString();
        const processed = withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleDateString() : 'N/A';
        
        console.log(`${id} | ${amount} | ${status} | ${requested} | ${processed}`);
        
        if (withdrawal.status === 'approved') {
          totalWithdrawals += parseFloat(withdrawal.amount);
        }
      });
    } else {
      console.log('   No withdrawals found');
    }
    
    // Calculate expected wallet balance
    const expectedBalance = totalTaskEarnings + totalReferralRewards + totalPayments - totalWithdrawals;
    const actualBalance = parseFloat(judyData.wallet_balance);
    const difference = actualBalance - expectedBalance;
    
    // Summary
    console.log('\n📊 Financial Summary:');
    console.log('=' .repeat(60));
    console.log(`Task earnings: KES ${totalTaskEarnings.toFixed(2)}`);
    console.log(`Referral rewards received: KES ${totalReferralRewards.toFixed(2)}`);
    console.log(`Payments received: KES ${totalPayments.toFixed(2)}`);
    console.log(`Withdrawals made: KES ${totalWithdrawals.toFixed(2)}`);
    console.log(`Expected balance: KES ${expectedBalance.toFixed(2)}`);
    console.log(`Actual balance: KES ${actualBalance.toFixed(2)}`);
    console.log(`Difference: KES ${difference.toFixed(2)}`);
    
    if (Math.abs(difference) > 0.01) {
      console.log('\n⚠️  DISCREPANCY FOUND!');
      if (difference > 0) {
        console.log(`   Judy has KES ${difference.toFixed(2)} MORE than expected`);
        console.log('   This could be due to:');
        console.log('   - Manual wallet adjustments');
        console.log('   - System errors');
        console.log('   - Unrecorded transactions');
        console.log('   - Referral rewards given incorrectly');
      } else {
        console.log(`   Judy has KES ${Math.abs(difference).toFixed(2)} LESS than expected`);
        console.log('   This could be due to:');
        console.log('   - Pending transactions');
        console.log('   - System errors');
        console.log('   - Unrecorded deductions');
      }
    } else {
      console.log('\n✅ Wallet balance is accurate');
    }
    
    // Check if Judy has any referral rewards that shouldn't exist
    if (referralRewards.length > 0) {
      console.log('\n🚨 ISSUE FOUND: Judy has received referral rewards!');
      console.log('   As an invited user, she should NOT receive referral rewards.');
      console.log('   Only the referrer should receive rewards.');
      console.log('   This explains the extra money in her wallet.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

investigateJudyWallet();





