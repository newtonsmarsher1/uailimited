const mysql = require('mysql2/promise');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateSteveBikoReportPDF() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('📊 Generating Report for Steve Biko\n');
    
    // Get user details
    const [user] = await pool.query(`
      SELECT 
        id, name, phone, level, wallet_balance, referred_by, invitation_code,
        created_at, is_active, trial_start_date, trial_end_date, trial_days_remaining
      FROM users 
      WHERE name LIKE '%Steve%Biko%'
    `);
    
    if (user.length === 0) {
      console.log('❌ User Steve Biko not found');
      return;
    }
    
    const userData = user[0];
    const joinDate = new Date(userData.created_at);
    console.log(`   Found: ${userData.name} (${userData.phone})`);
    console.log(`   Joined: ${joinDate.toLocaleDateString()}`);
    
    // Get task completion history since join date
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
      WHERE ut.user_id = ? AND ut.is_complete = 1 AND ut.completed_at >= ?
      ORDER BY ut.completed_at DESC
    `, [userData.id, userData.created_at]);
    
    // Get daily task statistics since join date
    const [dailyStats] = await pool.query(`
      SELECT 
        DATE(ut.completed_at) as task_date,
        COUNT(*) as tasks_completed,
        SUM(ut.reward_earned) as daily_earnings
      FROM user_tasks ut
      WHERE ut.user_id = ? AND ut.is_complete = 1 AND ut.completed_at >= ?
      GROUP BY DATE(ut.completed_at)
      ORDER BY task_date DESC
    `, [userData.id, userData.created_at]);
    
    // Get referral activity since join date
    const [referredUsers] = await pool.query(`
      SELECT 
        id, name, phone, level, created_at, wallet_balance
      FROM users 
      WHERE (referred_by = ? OR referred_by = ?) AND created_at >= ?
      ORDER BY created_at DESC
    `, [userData.id, userData.invitation_code, userData.created_at]);
    
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
      WHERE rr.user_id = ? AND rr.created_at >= ?
      ORDER BY rr.created_at DESC
    `, [userData.id, userData.created_at]);
    
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
      WHERE rr.inviter_id = ? AND rr.created_at >= ?
      ORDER BY rr.created_at DESC
    `, [userData.id, userData.created_at]);
    
    // Get financial transactions since join date
    const [withdrawals] = await pool.query(`
      SELECT 
        id, amount, status, requested_at, processed_at, approved_by, rejected_by
      FROM withdrawals 
      WHERE user_id = ? AND requested_at >= ?
      ORDER BY requested_at DESC
    `, [userData.id, userData.created_at]);
    
    const [payments] = await pool.query(`
      SELECT 
        id, amount, status, created_at, payment_method
      FROM payments 
      WHERE user_id = ? AND created_at >= ?
      ORDER BY created_at DESC
    `, [userData.id, userData.created_at]);
    
    // Get level information
    const [levelInfo] = await pool.query(`
      SELECT 
        level, name, cost, target, daily_tasks, daily_commission, 
        reward_per_task, invitation_rate_a, invitation_rate_b, invitation_rate_c
      FROM levels 
      WHERE level = ?
    `, [userData.level]);
    
    // Calculate financial summary
    const taskEarnings = completedTasks.reduce((sum, task) => sum + parseFloat(task.reward_earned), 0);
    const referralReceived = referralRewardsReceived.reduce((sum, reward) => sum + parseFloat(reward.reward_amount), 0);
    const referralGiven = referralRewardsGiven.reduce((sum, reward) => sum + parseFloat(reward.reward_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const totalPaid = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const expectedBalance = taskEarnings + referralReceived + totalPaid - totalWithdrawn;
    const difference = parseFloat(userData.wallet_balance) - expectedBalance;
    
    // Calculate days since joining
    const daysSinceJoining = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24));
    const activeDays = dailyStats.length;
    const avgTasksPerDay = activeDays > 0 ? (completedTasks.length / activeDays).toFixed(2) : 0;
    const avgEarningsPerDay = activeDays > 0 ? (taskEarnings / activeDays).toFixed(2) : 0;
    
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir);
    }
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const fileName = `${userData.name.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0,10)}.pdf`;
    const filePath = path.join(exportsDir, fileName);
    
    doc.pipe(fs.createWriteStream(filePath));
    
    // Header
    doc.fontSize(20).text(`${userData.name.toUpperCase()} - COMPLETE REPORT`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);
    
    // Basic Information
    doc.fontSize(16).text('BASIC INFORMATION', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Name: ${userData.name}`);
    doc.text(`Phone: ${userData.phone}`);
    doc.text(`User ID: ${userData.id}`);
    doc.text(`Level: ${userData.level}`);
    doc.text(`Wallet Balance: KES ${parseFloat(userData.wallet_balance).toFixed(2)}`);
    doc.text(`Invitation Code: ${userData.invitation_code}`);
    doc.text(`Referred By: ${userData.referred_by || 'N/A'}`);
    doc.text(`Account Status: ${userData.is_active ? 'Active' : 'Inactive'}`);
    doc.text(`Joined Date: ${joinDate.toLocaleDateString()}`);
    doc.text(`Days Since Joining: ${daysSinceJoining} days`);
    if (userData.trial_start_date) {
      doc.text(`Trial Start: ${new Date(userData.trial_start_date).toLocaleDateString()}`);
      doc.text(`Trial End: ${new Date(userData.trial_end_date).toLocaleDateString()}`);
      doc.text(`Trial Days Remaining: ${userData.trial_days_remaining}`);
    }
    doc.moveDown();
    
    // Activity Summary Since Join
    doc.fontSize(16).text('ACTIVITY SUMMARY SINCE JOIN', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Total Days Since Joining: ${daysSinceJoining}`);
    doc.text(`Active Days (days with tasks): ${activeDays}`);
    doc.text(`Activity Rate: ${((activeDays / daysSinceJoining) * 100).toFixed(1)}%`);
    doc.text(`Total Tasks Completed: ${completedTasks.length}`);
    doc.text(`Average Tasks per Active Day: ${avgTasksPerDay}`);
    doc.text(`Average Tasks per Day (overall): ${(completedTasks.length / daysSinceJoining).toFixed(2)}`);
    doc.text(`Total Task Earnings: KES ${taskEarnings.toFixed(2)}`);
    doc.text(`Average Earnings per Active Day: KES ${avgEarningsPerDay}`);
    doc.text(`Average Earnings per Day (overall): KES ${(taskEarnings / daysSinceJoining).toFixed(2)}`);
    doc.moveDown();
    
    // Daily Activity Breakdown
    doc.fontSize(16).text('DAILY ACTIVITY BREAKDOWN', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    
    if (dailyStats.length > 0) {
      doc.text('Date       | Tasks | Earnings');
      doc.text('--------------------------------');
      dailyStats.forEach(stat => {
        const date = new Date(stat.task_date).toLocaleDateString();
        doc.text(`${date.padEnd(10)} | ${stat.tasks_completed.toString().padEnd(5)} | KES ${parseFloat(stat.daily_earnings).toFixed(2)}`);
      });
      
      // Weekly summary
      const weeklyStats = {};
      dailyStats.forEach(stat => {
        const weekStart = new Date(stat.task_date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().slice(0, 10);
        
        if (!weeklyStats[weekKey]) {
          weeklyStats[weekKey] = { tasks: 0, earnings: 0, days: 0 };
        }
        weeklyStats[weekKey].tasks += stat.tasks_completed;
        weeklyStats[weekKey].earnings += parseFloat(stat.daily_earnings);
        weeklyStats[weekKey].days += 1;
      });
      
      doc.moveDown();
      doc.text('Weekly Summary:');
      Object.keys(weeklyStats).sort().reverse().forEach(week => {
        const stat = weeklyStats[week];
        const weekEnd = new Date(week);
        weekEnd.setDate(weekEnd.getDate() + 6);
        doc.text(`  Week of ${new Date(week).toLocaleDateString()} - ${weekEnd.toLocaleDateString()}: ${stat.tasks} tasks, KES ${stat.earnings.toFixed(2)} (${stat.days} active days)`, { indent: 20 });
      });
    } else {
      doc.text('No task activity recorded since joining.');
    }
    doc.moveDown();
    
    // Task Completion History
    doc.fontSize(16).text('TASK COMPLETION HISTORY', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    
    if (completedTasks.length > 0) {
      // Group tasks by date
      const tasksByDate = {};
      completedTasks.forEach(task => {
        const date = new Date(task.completed_at).toLocaleDateString();
        if (!tasksByDate[date]) {
          tasksByDate[date] = [];
        }
        tasksByDate[date].push(task);
      });
      
      doc.text('Tasks by Date:');
      Object.keys(tasksByDate).sort().reverse().forEach(date => {
        const dayTasks = tasksByDate[date];
        const dayEarnings = dayTasks.reduce((sum, task) => sum + parseFloat(task.reward_earned), 0);
        
        doc.moveDown(0.5);
        doc.text(`${date} (${dayTasks.length} tasks, KES ${dayEarnings.toFixed(2)}):`);
        dayTasks.forEach(task => {
          const taskName = task.task_name || task.app_name || 'Unknown Task';
          doc.text(`  - ${taskName}: KES ${parseFloat(task.reward_earned).toFixed(2)}`, { indent: 20 });
        });
      });
      
      // Task statistics
      const avgEarning = taskEarnings / completedTasks.length;
      const maxEarning = Math.max(...completedTasks.map(t => parseFloat(t.reward_earned)));
      const minEarning = Math.min(...completedTasks.map(t => parseFloat(t.reward_earned)));
      const firstTask = new Date(Math.min(...completedTasks.map(t => new Date(t.completed_at)))).toLocaleDateString();
      const lastTask = new Date(Math.max(...completedTasks.map(t => new Date(t.completed_at)))).toLocaleDateString();
      
      doc.moveDown();
      doc.text('Task Statistics:');
      doc.text(`  Average per task: KES ${avgEarning.toFixed(2)}`);
      doc.text(`  Highest earning: KES ${maxEarning.toFixed(2)}`);
      doc.text(`  Lowest earning: KES ${minEarning.toFixed(2)}`);
      doc.text(`  First task: ${firstTask}`);
      doc.text(`  Last task: ${lastTask}`);
    } else {
      doc.text('No tasks completed since joining.');
    }
    doc.moveDown();
    
    // Referral Activity
    doc.fontSize(16).text('REFERRAL ACTIVITY', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    
    if (userData.referred_by) {
      const [referrer] = await pool.query(`
        SELECT name, phone, level
        FROM users 
        WHERE invitation_code = ? OR id = ?
      `, [userData.referred_by, userData.referred_by]);
      
      if (referrer.length > 0) {
        doc.text(`Referred by: ${referrer[0].name} (${referrer[0].phone}, Level ${referrer[0].level})`);
      } else {
        doc.text(`Referred by: ${userData.referred_by} (referrer not found)`);
      }
    } else {
      doc.text('Referred by: No one (direct signup)');
    }
    
    doc.moveDown();
    doc.text(`Users referred by ${userData.name} (${referredUsers.length}):`);
    if (referredUsers.length > 0) {
      referredUsers.forEach(user => {
        doc.text(`  - ${user.name} (${user.phone}, Level ${user.level}, Joined: ${new Date(user.created_at).toLocaleDateString()}, Wallet: KES ${parseFloat(user.wallet_balance).toFixed(2)})`, { indent: 20 });
      });
    } else {
      doc.text('  None', { indent: 20 });
    }
    
    doc.moveDown();
    doc.text(`Referral rewards received: ${referralRewardsReceived.length}`);
    if (referralRewardsReceived.length > 0) {
      let totalReceived = 0;
      referralRewardsReceived.forEach(reward => {
        totalReceived += parseFloat(reward.reward_amount);
        doc.text(`  - KES ${reward.reward_amount} from ${reward.inviter_name} (${reward.inviter_phone}) - ${reward.status} on ${new Date(reward.created_at).toLocaleDateString()}`, { indent: 20 });
      });
      doc.text(`  Total received: KES ${totalReceived.toFixed(2)}`, { indent: 20 });
    }
    
    doc.moveDown();
    doc.text(`Referral rewards given: ${referralRewardsGiven.length}`);
    if (referralRewardsGiven.length > 0) {
      let totalGiven = 0;
      referralRewardsGiven.forEach(reward => {
        totalGiven += parseFloat(reward.reward_amount);
        doc.text(`  - KES ${reward.reward_amount} to ${reward.user_name} (${reward.user_phone}, Level ${reward.user_level}) - ${reward.status} on ${new Date(reward.created_at).toLocaleDateString()}`, { indent: 20 });
      });
      doc.text(`  Total given: KES ${totalGiven.toFixed(2)}`, { indent: 20 });
    }
    doc.moveDown();
    
    // Financial Transactions
    doc.fontSize(16).text('FINANCIAL TRANSACTIONS', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    
    doc.text(`Withdrawals (${withdrawals.length}):`);
    if (withdrawals.length > 0) {
      withdrawals.forEach(withdrawal => {
        doc.text(`  - KES ${withdrawal.amount} (${withdrawal.status}) - Requested: ${new Date(withdrawal.requested_at).toLocaleDateString()}`, { indent: 20 });
        if (withdrawal.processed_at) {
          doc.text(`    Processed: ${new Date(withdrawal.processed_at).toLocaleDateString()}`, { indent: 40 });
        }
      });
      doc.text(`  Total withdrawn: KES ${totalWithdrawn.toFixed(2)}`, { indent: 20 });
    } else {
      doc.text('  None', { indent: 20 });
    }
    
    doc.moveDown();
    doc.text(`Payments (${payments.length}):`);
    if (payments.length > 0) {
      payments.forEach(payment => {
        doc.text(`  - KES ${payment.amount} (${payment.status}) - ${new Date(payment.created_at).toLocaleDateString()}`, { indent: 20 });
        doc.text(`    Method: ${payment.payment_method || 'N/A'}`, { indent: 40 });
      });
      doc.text(`  Total paid: KES ${totalPaid.toFixed(2)}`, { indent: 20 });
    } else {
      doc.text('  None', { indent: 20 });
    }
    doc.moveDown();
    
    // Financial Summary
    doc.fontSize(16).text('FINANCIAL SUMMARY', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Task Earnings: KES ${taskEarnings.toFixed(2)}`);
    doc.text(`Referral Rewards Received: KES ${referralReceived.toFixed(2)}`);
    doc.text(`Referral Rewards Given: KES ${referralGiven.toFixed(2)}`);
    doc.text(`Payments Received: KES ${totalPaid.toFixed(2)}`);
    doc.text(`Withdrawals Made: KES ${totalWithdrawn.toFixed(2)}`);
    doc.text(`Current Wallet Balance: KES ${parseFloat(userData.wallet_balance).toFixed(2)}`);
    doc.moveDown();
    doc.text(`Expected Balance: KES ${expectedBalance.toFixed(2)}`);
    doc.text(`Actual Balance: KES ${parseFloat(userData.wallet_balance).toFixed(2)}`);
    doc.text(`Difference: KES ${difference.toFixed(2)}`);
    
    if (Math.abs(difference) > 0.01) {
      if (difference > 0) {
        doc.text(`Status: ⚠️  Has KES ${difference.toFixed(2)} MORE than expected`);
      } else {
        doc.text(`Status: ⚠️  Has KES ${Math.abs(difference).toFixed(2)} LESS than expected`);
      }
    } else {
      doc.text(`Status: ✅ Balance is accurate`);
    }
    doc.moveDown();
    
    // Level Information
    if (levelInfo.length > 0) {
      doc.fontSize(16).text('LEVEL INFORMATION', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      const level = levelInfo[0];
      doc.text(`Current Level: ${level.level} (${level.name})`);
      doc.text(`Level Cost: KES ${parseFloat(level.cost).toFixed(2)}`);
      doc.text(`Target: KES ${parseFloat(level.target).toFixed(2)}`);
      doc.text(`Daily Tasks: ${level.daily_tasks}`);
      doc.text(`Daily Commission: KES ${parseFloat(level.daily_commission).toFixed(2)}`);
      doc.text(`Reward per Task: KES ${parseFloat(level.reward_per_task).toFixed(2)}`);
      doc.text(`Invitation Rate A: ${level.invitation_rate_a}%`);
      doc.text(`Invitation Rate B: ${level.invitation_rate_b}%`);
      doc.text(`Invitation Rate C: ${level.invitation_rate_c}%`);
      doc.moveDown();
    }
    
    // Footer
    doc.fontSize(10).text(`Report generated on ${new Date().toLocaleString()}`, { align: 'center' });
    
    doc.end();
    
    console.log(`✅ PDF report generated: ${fileName}`);
    console.log(`\n📁 Report saved in: ${path.join(process.cwd(), 'exports')}`);
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
  } finally {
    pool.end();
  }
}

generateSteveBikoReportPDF();





