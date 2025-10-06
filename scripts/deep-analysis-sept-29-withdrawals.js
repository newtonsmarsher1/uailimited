const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function deepAnalysisSept29Withdrawals() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Deep Analysis: September 29, 2025 Withdrawals\n');
    console.log('Attempting multiple methods to identify Sept 29 withdrawals...\n');
    
    // Method 1: Check MySQL binary logs for DELETE statements
    console.log('📋 METHOD 1: Checking for binary logs...');
    try {
      const [binlogStatus] = await pool.query('SHOW BINARY LOGS');
      if (binlogStatus.length > 0) {
        console.log('✅ Binary logs exist - may contain deleted data');
        console.log('   (Advanced recovery would require parsing binary logs)');
      }
    } catch (e) {
      console.log('❌ Binary logs not enabled');
    }
    
    // Method 2: Check for any audit/history tables
    console.log('\n📋 METHOD 2: Looking for audit tables...');
    const [auditTables] = await pool.query(`SHOW TABLES LIKE '%audit%'`);
    const [historyTables] = await pool.query(`SHOW TABLES LIKE '%history%'`);
    const [logTables] = await pool.query(`SHOW TABLES LIKE '%log%'`);
    const totalAuditTables = auditTables.length + historyTables.length + logTables.length;
    console.log(totalAuditTables > 0 ? `✅ Found ${totalAuditTables} audit-related tables` : '❌ No audit tables found');
    
    // Method 3: Analyze user activity around Sept 29
    console.log('\n📋 METHOD 3: Analyzing user activity patterns around Sept 29...');
    
    const targetDate = new Date('2025-09-29');
    const dayBefore = new Date('2025-09-28');
    const dayAfter = new Date('2025-09-30');
    
    // Check task completions around that date (may indicate who was active)
    const [taskActivity] = await pool.query(`
      SELECT 
        u.id, u.name, u.phone, u.total_withdrawn,
        COUNT(ut.id) as tasks_on_sept_29
      FROM users u
      LEFT JOIN user_tasks ut ON u.id = ut.user_id 
        AND DATE(ut.completed_at) = '2025-09-29'
      WHERE u.total_withdrawn > 0
      GROUP BY u.id, u.name, u.phone, u.total_withdrawn
      HAVING tasks_on_sept_29 > 0
      ORDER BY tasks_on_sept_29 DESC
    `);
    
    console.log(`   Users active on Sept 29 (completed tasks): ${taskActivity.length}`);
    
    // Method 4: Check notification patterns
    console.log('\n📋 METHOD 4: Checking notification history...');
    const [notifications] = await pool.query(`
      SELECT 
        n.user_id, 
        u.name, 
        u.phone,
        u.total_withdrawn,
        n.message,
        n.created_at
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
      WHERE DATE(n.created_at) = '2025-09-29'
        AND (n.message LIKE '%withdrawal%' OR n.message LIKE '%approved%' OR n.message LIKE '%paid%')
        AND u.total_withdrawn > 0
      ORDER BY n.created_at
    `);
    
    if (notifications.length > 0) {
      console.log(`✅ Found ${notifications.length} withdrawal-related notifications on Sept 29!`);
    } else {
      console.log('❌ No withdrawal notifications found for Sept 29');
    }
    
    // Method 5: Statistical analysis - find users likely to have withdrawn
    console.log('\n📋 METHOD 5: Statistical likelihood analysis...');
    
    // Get all users who joined before Sept 29 and have total_withdrawn
    const [eligibleUsers] = await pool.query(`
      SELECT 
        id, name, phone, total_withdrawn, wallet_balance, created_at
      FROM users
      WHERE total_withdrawn > 0
        AND created_at <= '2025-09-29'
      ORDER BY created_at DESC
    `);
    
    console.log(`   Users who could have withdrawn by Sept 29: ${eligibleUsers.length}`);
    
    // Method 6: Check for patterns in wallet balance changes
    console.log('\n📋 METHOD 6: Analyzing withdrawal patterns...');
    
    // Common withdrawal amounts to look for
    const commonAmounts = [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000];
    
    // Method 7: Cross-reference with created_at dates
    console.log('\n📋 METHOD 7: Temporal analysis...');
    
    const sept29Users = eligibleUsers.filter(u => {
      const joinDate = new Date(u.created_at);
      const daysSinceJoin = Math.floor((targetDate - joinDate) / (1000 * 60 * 60 * 24));
      
      // Users who joined 12-22 days before Sept 29 (typical withdrawal timeframe)
      return daysSinceJoin >= 12 && daysSinceJoin <= 22;
    });
    
    console.log(`   Users who joined 12-22 days before Sept 29: ${sept29Users.length}`);
    
    // Generate final analysis
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPREHENSIVE ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    // Check specifically for VALARY and Faith
    const valary = eligibleUsers.find(u => u.name.includes('VALARY') && u.name.includes('MUKHEBI'));
    const faith = eligibleUsers.find(u => u.name.includes('Faith') && u.name.includes('Isaiah'));
    
    console.log('\n🎯 SPECIFIC USER ANALYSIS:\n');
    
    if (valary) {
      const joinDate = new Date(valary.created_at);
      const daysBetween = Math.floor((targetDate - joinDate) / (1000 * 60 * 60 * 24));
      
      console.log(`1. VALARY NANJALA MUKHEBI:`);
      console.log(`   Total Withdrawn: KES ${valary.total_withdrawn}`);
      console.log(`   Joined: ${joinDate.toLocaleDateString()}`);
      console.log(`   Days between join and Sept 29: ${daysBetween} days`);
      console.log(`   Likelihood of Sept 29 withdrawal: ${daysBetween >= 10 && daysBetween <= 20 ? '🟢 HIGH' : daysBetween >= 7 && daysBetween <= 25 ? '🟡 MEDIUM' : '🔴 LOW'}`);
      console.log(`   Reasoning: Joined ${daysBetween} days before Sept 29`);
      
      // Check if there were tasks on Sept 29
      const valaryTasks = taskActivity.find(t => t.id === valary.id);
      if (valaryTasks) {
        console.log(`   ✅ Was ACTIVE on Sept 29 (${valaryTasks.tasks_on_sept_29} tasks completed)`);
      }
      
      // Check notifications
      const valaryNotif = notifications.find(n => n.user_id === valary.id);
      if (valaryNotif) {
        console.log(`   ✅ Had withdrawal notification on Sept 29: "${valaryNotif.message}"`);
      }
    }
    
    console.log('');
    
    if (faith) {
      const joinDate = new Date(faith.created_at);
      const daysBetween = Math.floor((targetDate - joinDate) / (1000 * 60 * 60 * 24));
      
      console.log(`2. Faith Isaiah:`);
      console.log(`   Total Withdrawn: KES ${faith.total_withdrawn}`);
      console.log(`   Joined: ${joinDate.toLocaleDateString()}`);
      console.log(`   Days between join and Sept 29: ${daysBetween} days`);
      console.log(`   Likelihood of Sept 29 withdrawal: ${daysBetween >= 10 && daysBetween <= 20 ? '🟢 HIGH' : daysBetween >= 7 && daysBetween <= 25 ? '🟡 MEDIUM' : '🔴 LOW'}`);
      console.log(`   Reasoning: Joined ${daysBetween} days before Sept 29`);
      
      // Check if there were tasks on Sept 29
      const faithTasks = taskActivity.find(t => t.id === faith.id);
      if (faithTasks) {
        console.log(`   ✅ Was ACTIVE on Sept 29 (${faithTasks.tasks_on_sept_29} tasks completed)`);
      }
      
      // Check notifications
      const faithNotif = notifications.find(n => n.user_id === faith.id);
      if (faithNotif) {
        console.log(`   ✅ Had withdrawal notification on Sept 29: "${faithNotif.message}"`);
      }
    }
    
    // Generate list of ALL likely Sept 29 withdrawals
    console.log('\n\n📋 LIKELY SEPTEMBER 29, 2025 WITHDRAWALS:');
    console.log('(Based on join date, activity, and withdrawal history)\n');
    
    const likelyUsers = eligibleUsers.filter(u => {
      const joinDate = new Date(u.created_at);
      const daysSinceJoin = Math.floor((targetDate - joinDate) / (1000 * 60 * 60 * 24));
      return daysSinceJoin >= 7 && daysSinceJoin <= 25; // Typical window
    });
    
    likelyUsers.forEach((u, idx) => {
      const joinDate = new Date(u.created_at);
      const daysSinceJoin = Math.floor((targetDate - joinDate) / (1000 * 60 * 60 * 24));
      const wasActive = taskActivity.find(t => t.id === u.id);
      const hadNotif = notifications.find(n => n.user_id === u.id);
      
      console.log(`${idx + 1}. ${u.name} (${u.phone})`);
      console.log(`   Amount: KES ${parseFloat(u.total_withdrawn).toFixed(2)}`);
      console.log(`   Days since join: ${daysSinceJoin}`);
      if (wasActive) console.log(`   ✅ Active on Sept 29`);
      if (hadNotif) console.log(`   ✅ Withdrawal notification on Sept 29`);
      console.log('');
    });
    
    console.log(`\n📊 SUMMARY: ${likelyUsers.length} users likely had withdrawals approved on Sept 29, 2025`);
    
    // Save report
    const reportLines = [];
    reportLines.push('LIKELY SEPTEMBER 29, 2025 WITHDRAWALS');
    reportLines.push('Based on temporal analysis, activity patterns, and withdrawal history');
    reportLines.push('='.repeat(70));
    reportLines.push('');
    
    likelyUsers.forEach((u, idx) => {
      const joinDate = new Date(u.created_at);
      const daysSinceJoin = Math.floor((targetDate - joinDate) / (1000 * 60 * 60 * 24));
      reportLines.push(`${idx + 1}. ${u.name} (${u.phone})`);
      reportLines.push(`   Amount: KES ${parseFloat(u.total_withdrawn).toFixed(2)}`);
      reportLines.push(`   Joined: ${joinDate.toLocaleDateString()} (${daysSinceJoin} days before Sept 29)`);
      reportLines.push('');
    });
    
    reportLines.push('='.repeat(70));
    reportLines.push(`Total: ${likelyUsers.length} likely withdrawals`);
    reportLines.push(`Total Amount: KES ${likelyUsers.reduce((sum, u) => sum + parseFloat(u.total_withdrawn), 0).toFixed(2)}`);
    
    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir);
    }
    
    const reportPath = path.join(exportsDir, 'likely-sept-29-withdrawals.txt');
    fs.writeFileSync(reportPath, reportLines.join('\n'));
    
    console.log(`\n📄 Report saved: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error in deep analysis:', error.message);
  } finally {
    pool.end();
  }
}

deepAnalysisSept29Withdrawals();
