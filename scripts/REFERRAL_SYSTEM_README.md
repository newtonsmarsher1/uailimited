# Daily Referral Check System

## 🚀 Automatic Referral Reward System

The referral reward system is now fully automated! Here's how to use it:

### 📋 Manual Execution

1. **Full System Check** (recommended weekly):
   ```
   node scripts/automatic-referral-reward-system.js
   ```

2. **Daily Quick Check** (for new users only):
   ```
   node scripts/daily-referral-check.js
   ```

3. **Windows Batch File** (double-click to run):
   ```
   scripts/daily-referral-check.bat
   ```

### ⏰ Scheduled Execution (Optional)

To run automatically every day, you can set up a Windows Task Scheduler:

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 6:00 AM
4. Set action: Start a program
5. Program: `node`
6. Arguments: `scripts/daily-referral-check.js`
7. Start in: `C:\Users\PC\Desktop\UAI AGENCY MAIN`

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

**Last Updated**: 2025-10-04T10:00:28.130Z
**System Version**: 1.0
