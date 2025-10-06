const mysql = require('mysql2/promise');

async function generateMichaelFullReport() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('📊 MICHAEL NYANDIRI BIKUNDU - COMPLETE REPORT\n');
    console.log('=' .repeat(80));
    
    // Get Michael's basic details
    const [michael] = await pool.query(`
      SELECT 
        id, name, phone, level, wallet_balance, referred_by, invitation_code,
        created_at, is_active, trial_start_date, trial_end_date, trial_days_remaining
      FROM users 
      WHERE id = 202 AND phone = '+254111394208'
    `);
    
    if (michael.length === 0) {
      console.log('❌ Michael Nyandiri Bikundu not found');
      return;
    }
    
    const michaelData = michael[0];
    
    // 1. BASIC INFORMATION
    console.log('👤 BASIC INFORMATION');
    console.log('-' .repeat(40));
    console.log(`Name: ${michaelData.name}`);
    console.log(`Phone: ${michaelData.phone}`);
    console.log(`User ID: ${michaelData.id}`);
    console.log(`Level: ${michaelData.level}`);
    console.log(`Wallet Balance: KES ${parseFloat(michaelData.wallet_balance).toFixed(2)}`);
    console.log(`Invitation Code: ${michaelData.invitation_code}`);
    console.log(`Referred By: ${michaelData.referred_by || 'N/A'}`);
    console.log(`Account Status: ${michaelData.is_active ? 'Active' : 'Inactive'}`);
    console.log(`Joined Date: ${new Date(michaelData.created_at).toLocaleDateString()}`);
    
    if (michaelData.trial_start_date) {
      console.log(`Trial Start: ${new Date(michaelData.trial_start_date).toLocaleDateString()}`);
      console.log(`Trial End: ${new Date(michaelData.trial_end_date).toLocaleDateString()}`);
      console.log(`Trial Days Remaining: ${michaelData.trial_days_remaining}`);
    }
    
    // 2. TASK COMPLETION HISTORY
    console.log('\n📋 TASK COMPLETION HISTORY');
    console.log('-' .repeat(40));
    
    const [completedTasks] = await pool.query(`
      SELECT 
        ut.id,
        ut.task_id,
        ut.app_task_id,
        ut.reward_earned,
        ut.completed_at,
        t.title as task_name,
        at.app_name as app_name,
        at.reward as app_reward
      FROM user_tasks ut
      LEFT JOIN tasks t ON t.id = ut.task_id
      LEFT JOIN app_tasks at ON at.id = ut.app_task_id
      WHERE ut.user_id = ? AND ut.is_complete = 1
      ORDER BY ut.completed_at DESC
    `, [michaelData.id]);
    
    if (completedTasks.length > 0) {
      console.log(`Total Tasks Completed: ${completedTasks.length}`);
      
      // Group by date
      const tasksByDate = {};
      completedTasks.forEach(task => {
        const date = new Date(task.completed_at).toLocaleDateString();
        if (!tasksByDate[date]) {
          tasksByDate[date] = [];
        }
        tasksByDate[date].push(task);
      });
      
      let totalEarnings = 0;
      console.log('\n📅 Tasks by Date:');
      Object.keys(tasksByDate).sort().reverse().forEach(date => {
        const dayTasks = tasksByDate[date];
        const dayEarnings = dayTasks.reduce((sum, task) => sum + parseFloat(task.reward_earned), 0);
        totalEarnings += dayEarnings;
        
        console.log(`\n  ${date} (${dayTasks.length} tasks, KES ${dayEarnings.toFixed(2)}):`);
        dayTasks.forEach(task => {
          const taskName = task.task_name || task.app_name || 'Unknown Task';
          console.log(`    - ${taskName}: KES ${parseFloat(task.reward_earned).toFixed(2)}`);
        });
      });
      
      console.log(`\n💰 Total Task Earnings: KES ${totalEarnings.toFixed(2)}`);
      
      // Task statistics
      const [taskStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(reward_earned) as total_earnings,
          AVG(reward_earned) as avg_earning,
          MIN(reward_earned) as min_earning,
          MAX(reward_earned) as max_earning,
          MIN(completed_at) as first_task,
          MAX(completed_at) as last_task
        FROM user_tasks 
        WHERE user_id = ? AND is_complete = 1
      `, [michaelData.id]);
      
      const stats = taskStats[0];
      console.log('\n📊 Task Statistics:');
      console.log(`  Average per task: KES ${parseFloat(stats.avg_earning).toFixed(2)}`);
      console.log(`  Highest earning: KES ${parseFloat(stats.max_earning).toFixed(2)}`);
      console.log(`  Lowest earning: KES ${parseFloat(stats.min_earning).toFixed(2)}`);
      console.log(`  First task: ${new Date(stats.first_task).toLocaleDateString()}`);
      console.log(`  Last task: ${new Date(stats.last_task).toLocaleDateString()}`);
      
    } else {
      console.log('No completed tasks found');
    }
    
    // 3. REFERRAL ACTIVITY
    console.log('\n🎁 REFERRAL ACTIVITY');
    console.log('-' .repeat(40));
    
    // Check who referred Michael
    if (michaelData.referred_by) {
      const [referrer] = await pool.query(`
        SELECT name, phone, level
        FROM users 
        WHERE invitation_code = ? OR id = ?
      `, [michaelData.referred_by, michaelData.referred_by]);
      
      if (referrer.length > 0) {
        console.log(`Referred by: ${referrer[0].name} (${referrer[0].phone}, Level ${referrer[0].level})`);
      } else {
        console.log(`Referred by: ${michaelData.referred_by} (referrer not found)`);
      }
    } else {
      console.log('Referred by: No one (direct signup)');
    }
    
    // Check who Michael has referred
    const [referredUsers] = await pool.query(`
      SELECT 
        id, name, phone, level, created_at, wallet_balance
      FROM users 
      WHERE referred_by = ? OR referred_by = ?
      ORDER BY created_at DESC
    `, [michaelData.id, michaelData.invitation_code]);
    
    if (referredUsers.length > 0) {
      console.log(`\n👥 Users referred by Michael (${referredUsers.length}):`);
      referredUsers.forEach(user => {
        console.log(`  - ${user.name} (${user.phone}, Level ${user.level}, Joined: ${new Date(user.created_at).toLocaleDateString()}, Wallet: KES ${parseFloat(user.wallet_balance).toFixed(2)})`);
      });
    } else {
      console.log('\n👥 Users referred by Michael: None');
    }
    
    // Check referral rewards received
    const [referralRewardsReceived] = await pool.query(`
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
    `, [michaelData.id]);
    
    if (referralRewardsReceived.length > 0) {
      console.log(`\n🎁 Referral rewards received (${referralRewardsReceived.length}):`);
      let totalReceived = 0;
      referralRewardsReceived.forEach(reward => {
        totalReceived += parseFloat(reward.reward_amount);
        console.log(`  - KES ${reward.reward_amount} from ${reward.inviter_name} (${reward.inviter_phone}) - ${reward.status} on ${new Date(reward.created_at).toLocaleDateString()}`);
      });
      console.log(`  Total received: KES ${totalReceived.toFixed(2)}`);
    } else {
      console.log('\n🎁 Referral rewards received: None');
    }
    
    // Check referral rewards given
    const [referralRewardsGiven] = await pool.query(`
      SELECT 
        rr.id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level
      FROM referral_rewards rr
      LEFT JOIN users u ON u.id = rr.user_id
      WHERE rr.inviter_id = ?
      ORDER BY rr.created_at DESC
    `, [michaelData.id]);
    
    if (referralRewardsGiven.length > 0) {
      console.log(`\n🎁 Referral rewards given (${referralRewardsGiven.length}):`);
      let totalGiven = 0;
      referralRewardsGiven.forEach(reward => {
        totalGiven += parseFloat(reward.reward_amount);
        console.log(`  - KES ${reward.reward_amount} to ${reward.user_name} (${reward.user_phone}, Level ${reward.user_level}) - ${reward.status} on ${new Date(reward.created_at).toLocaleDateString()}`);
      });
      console.log(`  Total given: KES ${totalGiven.toFixed(2)}`);
    } else {
      console.log('\n🎁 Referral rewards given: None');
    }
    
    // 4. FINANCIAL TRANSACTIONS
    console.log('\n💰 FINANCIAL TRANSACTIONS');
    console.log('-' .repeat(40));
    
    // Withdrawals
    const [withdrawals] = await pool.query(`
      SELECT 
        id, amount, status, requested_at, processed_at, approved_by, rejected_by
      FROM withdrawals 
      WHERE user_id = ?
      ORDER BY requested_at DESC
    `, [michaelData.id]);
    
    if (withdrawals.length > 0) {
      console.log(`\n💸 Withdrawals (${withdrawals.length}):`);
      let totalWithdrawn = 0;
      withdrawals.forEach(withdrawal => {
        if (withdrawal.status === 'approved') {
          totalWithdrawn += parseFloat(withdrawal.amount);
        }
        console.log(`  - KES ${withdrawal.amount} (${withdrawal.status}) - Requested: ${new Date(withdrawal.requested_at).toLocaleDateString()}`);
        if (withdrawal.processed_at) {
          console.log(`    Processed: ${new Date(withdrawal.processed_at).toLocaleDateString()}`);
        }
        if (withdrawal.approved_by) {
          console.log(`    Approved by: ${withdrawal.approved_by}`);
        }
        if (withdrawal.rejected_by) {
          console.log(`    Rejected by: ${withdrawal.rejected_by}`);
        }
      });
      console.log(`  Total withdrawn: KES ${totalWithdrawn.toFixed(2)}`);
    } else {
      console.log('\n💸 Withdrawals: None');
    }
    
    // Payments
    const [payments] = await pool.query(`
      SELECT 
        id, amount, status, created_at, payment_method
      FROM payments 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [michaelData.id]);
    
    if (payments.length > 0) {
      console.log(`\n💰 Payments (${payments.length}):`);
      let totalPaid = 0;
      payments.forEach(payment => {
        if (payment.status === 'approved') {
          totalPaid += parseFloat(payment.amount);
        }
        console.log(`  - KES ${payment.amount} (${payment.status}) - ${new Date(payment.created_at).toLocaleDateString()}`);
        console.log(`    Method: ${payment.payment_method || 'N/A'}`);
      });
      console.log(`  Total paid: KES ${totalPaid.toFixed(2)}`);
    } else {
      console.log('\n💰 Payments: None');
    }
    
    // 5. FINANCIAL SUMMARY
    console.log('\n📊 FINANCIAL SUMMARY');
    console.log('-' .repeat(40));
    
    const taskEarnings = completedTasks.reduce((sum, task) => sum + parseFloat(task.reward_earned), 0);
    const referralReceived = referralRewardsReceived.reduce((sum, reward) => sum + parseFloat(reward.reward_amount), 0);
    const referralGiven = referralRewardsGiven.reduce((sum, reward) => sum + parseFloat(reward.reward_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const totalPaid = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    console.log(`Task Earnings: KES ${taskEarnings.toFixed(2)}`);
    console.log(`Referral Rewards Received: KES ${referralReceived.toFixed(2)}`);
    console.log(`Referral Rewards Given: KES ${referralGiven.toFixed(2)}`);
    console.log(`Payments Received: KES ${totalPaid.toFixed(2)}`);
    console.log(`Withdrawals Made: KES ${totalWithdrawn.toFixed(2)}`);
    console.log(`Current Wallet Balance: KES ${parseFloat(michaelData.wallet_balance).toFixed(2)}`);
    
    const expectedBalance = taskEarnings + referralReceived + totalPaid - totalWithdrawn;
    const difference = parseFloat(michaelData.wallet_balance) - expectedBalance;
    
    console.log(`\nExpected Balance: KES ${expectedBalance.toFixed(2)}`);
    console.log(`Actual Balance: KES ${parseFloat(michaelData.wallet_balance).toFixed(2)}`);
    console.log(`Difference: KES ${difference.toFixed(2)}`);
    
    if (Math.abs(difference) > 0.01) {
      if (difference > 0) {
        console.log(`Status: ⚠️  Has KES ${difference.toFixed(2)} MORE than expected`);
      } else {
        console.log(`Status: ⚠️  Has KES ${Math.abs(difference).toFixed(2)} LESS than expected`);
      }
    } else {
      console.log(`Status: ✅ Balance is accurate`);
    }
    
    // 6. LEVEL INFORMATION
    console.log('\n📈 LEVEL INFORMATION');
    console.log('-' .repeat(40));
    
    const [levelInfo] = await pool.query(`
      SELECT 
        level, name, cost, target, daily_tasks, daily_commission, 
        reward_per_task, invitation_rate_a, invitation_rate_b, invitation_rate_c
      FROM levels 
      WHERE level = ?
    `, [michaelData.level]);
    
    if (levelInfo.length > 0) {
      const level = levelInfo[0];
      console.log(`Current Level: ${level.level} (${level.name})`);
      console.log(`Level Cost: KES ${parseFloat(level.cost).toFixed(2)}`);
      console.log(`Target: KES ${parseFloat(level.target).toFixed(2)}`);
      console.log(`Daily Tasks: ${level.daily_tasks}`);
      console.log(`Daily Commission: KES ${parseFloat(level.daily_commission).toFixed(2)}`);
      console.log(`Reward per Task: KES ${parseFloat(level.reward_per_task).toFixed(2)}`);
      console.log(`Invitation Rate A: ${level.invitation_rate_a}%`);
      console.log(`Invitation Rate B: ${level.invitation_rate_b}%`);
      console.log(`Invitation Rate C: ${level.invitation_rate_c}%`);
    }
    
    // 7. RECENT ACTIVITY
    console.log('\n🕒 RECENT ACTIVITY (Last 7 days)');
    console.log('-' .repeat(40));
    
    const [recentActivity] = await pool.query(`
      SELECT 
        'task' as type,
        ut.completed_at as date,
        CONCAT('Completed task: ', COALESCE(t.title, at.app_name, 'Unknown')) as description,
        ut.reward_earned as amount
      FROM user_tasks ut
      LEFT JOIN tasks t ON t.id = ut.task_id
      LEFT JOIN app_tasks at ON at.id = ut.app_task_id
      WHERE ut.user_id = ? AND ut.is_complete = 1 AND ut.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'withdrawal' as type,
        w.requested_at as date,
        CONCAT('Withdrawal: KES ', w.amount, ' (', w.status, ')') as description,
        -w.amount as amount
      FROM withdrawals w
      WHERE w.user_id = ? AND w.requested_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'payment' as type,
        p.created_at as date,
        CONCAT('Payment: KES ', p.amount, ' (', p.status, ')') as description,
        p.amount as amount
      FROM payments p
      WHERE p.user_id = ? AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      ORDER BY date DESC
      LIMIT 20
    `, [michaelData.id, michaelData.id, michaelData.id]);
    
    if (recentActivity.length > 0) {
      recentActivity.forEach(activity => {
        const date = new Date(activity.date).toLocaleString();
        const amount = parseFloat(activity.amount);
        const amountStr = amount > 0 ? `+KES ${amount.toFixed(2)}` : `KES ${amount.toFixed(2)}`;
        console.log(`  ${date} - ${activity.description} (${amountStr})`);
      });
    } else {
      console.log('No recent activity found');
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('📊 REPORT COMPLETED');
    console.log('=' .repeat(80));
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
  } finally {
    pool.end();
  }
}

generateMichaelFullReport();
