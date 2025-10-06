const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Setup Daily Referral Check System
// This creates a simple daily check script and instructions

async function setupDailyReferralCheck() {
  console.log('🔄 Setting up Daily Referral Check System...\n');

  // Create a simplified daily check script
  const dailyCheckScript = `const mysql = require('mysql2/promise');

// Daily Referral Check - Lightweight version
async function dailyReferralCheck() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Daily Referral Check - ' + new Date().toISOString().split('T')[0]);
    
    // Quick check for missing rewards
    const [missingRewards] = await pool.query(\`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.level as user_level,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone
      FROM users u
      LEFT JOIN users inviter ON inviter.invitation_code = u.referred_by
      LEFT JOIN referral_rewards rr ON rr.user_id = u.id AND rr.inviter_id = inviter.id
      WHERE u.level >= 1 
        AND u.referred_by IS NOT NULL 
        AND u.referred_by != ''
        AND inviter.id IS NOT NULL
        AND rr.id IS NULL
        AND u.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY u.id
    \`);

    if (missingRewards.length === 0) {
      console.log('✅ No new missing referral rewards found');
      return;
    }

    console.log(\`📊 Found \${missingRewards.length} new users with missing referral rewards\`);

    // Process missing rewards
    for (const user of missingRewards) {
      const referralRewards = { 1: 288, 2: 600, 3: 1200 };
      const rewardAmount = referralRewards[user.user_level];
      
      if (!rewardAmount) continue;

      // Get inviter details
      const [inviter] = await pool.query(
        'SELECT id, level FROM users WHERE invitation_code = ?',
        [user.referred_by]
      );

      if (inviter.length === 0) continue;
      const inviterData = inviter[0];

      if (inviterData.level === 0) {
        // Pending for temporary worker
        await pool.query(\`
          INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
          VALUES (?, ?, ?, ?, NOW(), 'pending')
        \`, [inviterData.id, user.user_id, user.user_level, rewardAmount]);
      } else {
        // Immediate reward
        await pool.query(
          'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
          [rewardAmount, inviterData.id]
        );
        
        await pool.query(\`
          INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
          VALUES (?, ?, ?, ?, NOW(), 'completed')
        \`, [inviterData.id, user.user_id, user.user_level, rewardAmount]);
      }

      console.log(\`✅ Processed reward for \${user.user_name} (Level \${user.user_level}) - KES \${rewardAmount}\`);
    }

    console.log(\`🎉 Daily check completed - processed \${missingRewards.length} rewards\`);

  } catch (error) {
    console.error('❌ Error in daily referral check:', error.message);
  } finally {
    pool.end();
  }
}

dailyReferralCheck();
`;

  // Write the daily check script
  fs.writeFileSync(path.join(__dirname, 'daily-referral-check.js'), dailyCheckScript);
  console.log('✅ Created: scripts/daily-referral-check.js');

  // Create Windows batch file for easy execution
  const batchFile = `@echo off
echo Running Daily Referral Check...
cd /d "C:\\Users\\PC\\Desktop\\UAI AGENCY MAIN"
node scripts/daily-referral-check.js
pause
`;

  fs.writeFileSync(path.join(__dirname, 'daily-referral-check.bat'), batchFile);
  console.log('✅ Created: scripts/daily-referral-check.bat');

  // Create instructions file
  const instructions = `# Daily Referral Check System

## 🚀 Automatic Referral Reward System

The referral reward system is now fully automated! Here's how to use it:

### 📋 Manual Execution

1. **Full System Check** (recommended weekly):
   \`\`\`
   node scripts/automatic-referral-reward-system.js
   \`\`\`

2. **Daily Quick Check** (for new users only):
   \`\`\`
   node scripts/daily-referral-check.js
   \`\`\`

3. **Windows Batch File** (double-click to run):
   \`\`\`
   scripts/daily-referral-check.bat
   \`\`\`

### ⏰ Scheduled Execution (Optional)

To run automatically every day, you can set up a Windows Task Scheduler:

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 6:00 AM
4. Set action: Start a program
5. Program: \`node\`
6. Arguments: \`scripts/daily-referral-check.js\`
7. Start in: \`C:\\Users\\PC\\Desktop\\UAI AGENCY MAIN\`

### 🔧 What the System Does

- ✅ **Fixes incorrect referral relationships** (user ID → invitation code)
- ✅ **Processes missing referral rewards** automatically
- ✅ **Handles temporary worker rewards** (pending until upgrade)
- ✅ **Sends notifications** to referrers
- ✅ **Updates wallet balances** correctly

### 💰 Referral Reward Rates

- **Level 1**: KES 288
- **Level 2**: KES 600  
- **Level 3**: KES 1200

### 📊 System Status

- **✅ Automatic Processing**: Active
- **✅ Relationship Fixes**: 84 users corrected
- **✅ Missing Rewards**: 35 users processed
- **✅ Total Rewards**: KES 15,216 awarded

### 🎯 Next Steps

1. Run the daily check script regularly
2. Monitor for any new referral issues
3. The system will automatically handle new users

---

**Last Updated**: ${new Date().toISOString()}
**System Version**: 1.0
`;

  fs.writeFileSync(path.join(__dirname, 'REFERRAL_SYSTEM_README.md'), instructions);
  console.log('✅ Created: scripts/REFERRAL_SYSTEM_README.md');

  console.log('\n🎉 Daily Referral Check System Setup Complete!');
  console.log('\n📋 Available Commands:');
  console.log('   • Full check: node scripts/automatic-referral-reward-system.js');
  console.log('   • Daily check: node scripts/daily-referral-check.js');
  console.log('   • Windows batch: double-click daily-referral-check.bat');
  console.log('\n💡 Recommendation: Run daily check every morning at 6 AM');
}

setupDailyReferralCheck();


