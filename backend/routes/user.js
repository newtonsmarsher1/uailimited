const express = require('express');
const pool = require('../config/database.js');
const { pushNotification } = require('../services/notificationService.js');
const { simpleAuth } = require('../middleware/auth-simple.js');
const bcrypt = require('bcrypt');

const router = express.Router();

// Function to immediately grant all privileges for a new level
async function grantLevelPrivileges(userId, newLevel) {
  try {
    console.log(`🎯 Granting Level ${newLevel} privileges to user ${userId}`);
    
    // Get level configuration
    const [levelConfig] = await pool.query('SELECT * FROM levels WHERE level = ?', [newLevel]);
    
    if (levelConfig.length === 0) {
      console.log(`⚠️ No configuration found for level ${newLevel}`);
      return;
    }
    
    const levelData = levelConfig[0];
    
    // Update user with immediate access to new level privileges
    await pool.query(`
      UPDATE users SET 
        level = ?,
        daily_task_limit = ?,
        can_access_premium_tasks = ?,
        can_access_investment_tasks = ?,
        can_access_referral_bonuses = ?,
        level_upgraded_at = NOW()
      WHERE id = ?
    `, [
      newLevel,
      levelData.daily_tasks || 5,
      newLevel >= 3 ? 1 : 0, // Premium tasks from level 3+
      newLevel >= 5 ? 1 : 0, // Investment tasks from level 5+
      newLevel >= 2 ? 1 : 0, // Referral bonuses from level 2+
      userId
    ]);
    
    // Send notification about new privileges
    await pool.query(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, 'level_upgrade', NOW())
    `, [userId, `🎉 Congratulations! You've been upgraded to Level ${newLevel}. You now have access to ${levelData.daily_tasks} daily tasks and enhanced privileges!`]);
    
    console.log(`✅ Level ${newLevel} privileges granted to user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error granting level privileges:', error);
  }
}

// Function to process pending referral rewards when temporary worker upgrades
async function processPendingReferralRewards(userId, newLevel) {
  try {
    console.log(`🎁 Processing pending referral rewards for user ${userId} upgrading to level ${newLevel}`);
    
    // Get all pending referral rewards for this user
    const [pendingRewards] = await pool.query(`
      SELECT id, reward_amount, level, created_at
      FROM referral_rewards 
      WHERE inviter_id = ? AND status = 'pending'
      ORDER BY created_at ASC
    `, [userId]);
    
    if (pendingRewards.length === 0) {
      console.log(`No pending referral rewards found for user ${userId}`);
      return;
    }
    
    let totalRewardAmount = 0;
    
    // Process each pending reward
    for (const reward of pendingRewards) {
      totalRewardAmount += reward.reward_amount;
      
      // Update the reward status to completed
      await pool.query(`
        UPDATE referral_rewards 
        SET status = 'completed', processed_at = NOW()
        WHERE id = ?
      `, [reward.id]);
      
      console.log(`✅ Processed pending reward: KES ${reward.reward_amount} for level ${reward.level}`);
    }
    
    // Add total reward amount to user's wallet
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
      [totalRewardAmount, userId]
    );
    
    // Send notification about processed rewards
    await pool.query(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, 'referral_reward', NOW())
    `, [userId, `🎉 Congratulations! You've upgraded to Level ${newLevel} and received KES ${totalRewardAmount} in pending referral rewards!`]);
    
    console.log(`✅ Total pending referral rewards of KES ${totalRewardAmount} processed for user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error processing pending referral rewards:', error);
  }
}

// Function to handle referral rewards when user upgrades from temporary worker
async function processReferralRewards(userId, newLevel) {
  try {
    console.log(`🎁 Processing referral rewards for user ${userId} upgrading to level ${newLevel}`);
    
    // First, process any pending referral rewards for this user
    await processPendingReferralRewards(userId, newLevel);
    
    // Get user's referral information
    const [userRows] = await pool.query(
      'SELECT referred_by FROM users WHERE id = ?',
      [userId]
    );
    
    if (!userRows.length || !userRows[0].referred_by) {
      console.log('No referral found for user');
      return;
    }
    
    const referredBy = userRows[0].referred_by;
    
    // Get the inviter's information
    // First try to find by invitation_code, if not found, try by ID
    let [inviterRows] = await pool.query(
      'SELECT id, name, invitation_code, level FROM users WHERE invitation_code = ?',
      [referredBy]
    );
    
    // If not found by invitation_code, try by ID
    if (inviterRows.length === 0) {
      [inviterRows] = await pool.query(
        'SELECT id, name, invitation_code, level FROM users WHERE id = ?',
        [referredBy]
      );
    }
    
    if (!inviterRows.length) {
      console.log('Inviter not found');
      return;
    }
    
    const inviter = inviterRows[0];
    
    // Check if this user has already received ANY referral rewards (regardless of level)
    // The referrer should only get rewarded ONCE per invitee, when they first upgrade to Level 1
    const [existingRewards] = await pool.query(
      'SELECT COUNT(*) as count FROM referral_rewards WHERE user_id = ?',
      [userId]
    );
    
    if (existingRewards[0].count > 0) {
      console.log(`User has already received referral rewards - no additional rewards given`);
      return;
    }
    
    // Only give rewards when upgrading to Level 1 (the first upgrade)
    if (newLevel !== 1) {
      console.log(`Only Level 1 upgrades trigger referral rewards - no reward for level ${newLevel}`);
      return;
    }
    
    // The referrer gets KES 288 only once when their invitee upgrades to Level 1
    const rewardAmount = 288; // KES 288 - only reward given
    
    console.log(`Giving referral reward of KES ${rewardAmount} to referrer for Level 1 upgrade`);
    
    // Check if inviter is a temporary worker (level 0)
    if (inviter.level === 0) {
      // Temporary workers don't receive rewards immediately - hold them until upgrade
      await pool.query(`
        INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
        VALUES (?, ?, ?, ?, NOW(), 'pending')
      `, [inviter.id, userId, 1, rewardAmount]);
      
      // Send notification to temporary worker about pending reward
      await pool.query(`
        INSERT INTO notifications (user_id, message, type, created_at)
        VALUES (?, ?, 'referral_reward', NOW())
      `, [inviter.id, `🎁 Your invitee upgraded to Level 1! You'll receive KES ${rewardAmount} when you upgrade to Level 1 or above.`]);
      
      console.log(`⏳ Referral reward of KES ${rewardAmount} held for temporary worker ${inviter.name} (ID: ${inviter.id}) until upgrade`);
    } else {
      // Non-temporary workers receive rewards immediately
      await pool.query(
        'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
        [rewardAmount, inviter.id]
      );
      
      // Record the referral reward as completed
      await pool.query(`
        INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, created_at, status)
        VALUES (?, ?, ?, ?, NOW(), 'completed')
      `, [inviter.id, userId, 1, rewardAmount]);
      
      // Send notification to inviter
      await pool.query(`
        INSERT INTO notifications (user_id, message, type, created_at)
        VALUES (?, ?, 'referral_reward', NOW())
      `, [inviter.id, `🎉 Congratulations! Your invitee upgraded to Level 1 and you earned KES ${rewardAmount} referral reward!`]);
      
      console.log(`✅ Referral reward of KES ${rewardAmount} given to inviter ${inviter.name} (ID: ${inviter.id})`);
    }
    
  } catch (error) {
    console.error('❌ Error processing referral rewards:', error);
  }
}

// Get user stats
router.get('/stats', simpleAuth, async (req, res) => {
  try {
    // Fetch all relevant user info with monthly earnings from user_earnings_summary
    const [userRows] = await pool.query(`
      SELECT u.phone, u.name, u.level, u.wallet_balance, u.referral_code, u.invitation_code, 
             u.referred_by, u.level as bond, u.is_admin, u.temp_worker_start_date, u.created_at,
             ues.total_earnings, ues.this_month_earnings,
             referrer.name as referrer_name
      FROM users u
      LEFT JOIN user_earnings_summary ues ON u.id = ues.user_id
      LEFT JOIN users referrer ON u.referred_by = referrer.invitation_code
      WHERE u.id=?
    `, [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Get completed task IDs for today (including both regular and app tasks)
    const [completedTasks] = await pool.query(`
      SELECT COALESCE(task_id, app_task_id) as task_id FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    const completed_task_ids = completedTasks.map(task => parseInt(task.task_id));
    const tasks_completed_today = completedTasks.length;
    
    // Get total withdrawal
    const [withdrawRows] = await pool.query(`
      SELECT SUM(amount) as total_withdrawal FROM withdrawals WHERE user_id=? AND status='approved'
    `, [req.user.id]);
    
    // Calculate today's earnings based on user level
    const levelRewards = {
      0: 11,      // Temporary Worker: 11 shillings per task
      1: 17,      // Level 1: 17 shillings per task
      2: 23.4,    // Level 2: 23.4 shillings per task
      3: 48,      // Level 3: 48 shillings per task
      4: 65,      // Level 4: 65 shillings per task
      5: 267,     // Level 5: 267 shillings per task
      6: 230,     // Level 6: 230 shillings per task
      7: 298,     // Level 7: 298 shillings per task
      8: 428,     // Level 8: 428 shillings per task
      9: 555      // Level 9: 555 shillings per task
    };
    
    const userLevelReward = levelRewards[user.level] || levelRewards[1];
    const today_earning = tasks_completed_today * userLevelReward;
    
    // Use stored earnings values from users table (more reliable and accurate)
    const totalEarningsAmount = parseFloat(user.total_earnings || 0);
    const monthEarningsAmount = parseFloat(user.this_month_earnings || 0);
    
    // Get referral rewards for additional info (but don't double-count)
    const [referralEarnings] = await pool.query(`
      SELECT COALESCE(SUM(reward_amount), 0) as referral_earned FROM referral_rewards 
      WHERE inviter_id=? AND status='completed' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND created_at < DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')
    `, [req.user.id]);
    
    const [totalReferralEarnings] = await pool.query(`
      SELECT COALESCE(SUM(reward_amount), 0) as total_referral_earned FROM referral_rewards 
      WHERE inviter_id=? AND status='completed'
    `, [req.user.id]);
    
    // Calculate task earnings (total - referral) for display purposes
    const referralEarningsAmount = parseFloat(totalReferralEarnings[0].total_referral_earned || 0);
    const taskEarnings = Math.max(0, totalEarningsAmount - referralEarningsAmount);
    
    const monthReferralEarnings = parseFloat(referralEarnings[0].referral_earned || 0);
    const monthTaskEarnings = Math.max(0, monthEarningsAmount - monthReferralEarnings);
    
    // Debug logging for monthly earnings
    console.log(`📊 Monthly earnings for user ${req.user.id}:`);
    console.log(`   - Stored total earnings: KES ${totalEarningsAmount}`);
    console.log(`   - Stored month earnings: KES ${monthEarningsAmount}`);
    console.log(`   - Task earnings: KES ${taskEarnings}`);
    console.log(`   - Referral earnings: KES ${monthReferralEarnings}`);
    
    res.json({
      phone: user.phone,
      name: user.name,
      level: user.level,
      avatar: "👤",
      today_earning: today_earning,
      month_earning: monthEarningsAmount, // Stored value from users table
      total_revenue: totalEarningsAmount, // Stored value from users table
      task_earnings: taskEarnings,
      referral_earnings: referralEarningsAmount,
      referral_earnings_total: referralEarningsAmount, // Add this for frontend compatibility
      month_task_earnings: monthTaskEarnings,
      month_referral_earnings: monthReferralEarnings,
      referral_earnings_month: monthReferralEarnings, // Add this for frontend compatibility
      total_withdrawal: withdrawRows[0].total_withdrawal || 0,
      wallet_balance: user.wallet_balance || 0,
      bond: user.bond || 0,
      tasks_done: completed_task_ids.length,
      tasks_completed_today: tasks_completed_today,
      completed_task_ids: completed_task_ids,
      referral_code: user.referral_code,
      invitation_code: user.invitation_code,
      referred_by: user.referred_by,
      referrer_name: user.referrer_name,
      is_temporary_worker: user.level === 0,
      temp_worker_start_date: user.temp_worker_start_date || null,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Error in user-stats:', error);
    
    // Send a proper JSON response even on error
    try {
      res.status(500).json({ 
        error: 'Failed to fetch user stats',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } catch (jsonError) {
      // If JSON response fails, send plain text
      res.status(500).set('Content-Type', 'text/plain');
      res.send('Failed to fetch user stats');
    }
  }
});

// Get user home info
router.get('/home', simpleAuth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT phone, level, wallet_balance, referral_code FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Get recent payments for this user
    const [recentPayments] = await pool.query(`
      SELECT amount, mpesa_code, status, created_at 
      FROM payments 
      WHERE user_id = ? AND status = 'confirmed'
      ORDER BY created_at DESC 
      LIMIT 5
    `, [req.user.id]);
    
    res.json({
      ...user,
      recentPayments: recentPayments,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
});

// Get payment history
router.get('/payment-history', simpleAuth, async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT amount, mpesa_code, status, created_at 
      FROM payments 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [req.user.id]);
    
    res.json({
      payments: payments,
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0)
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Get team stats
router.get('/team-stats', simpleAuth, async (req, res) => {
  try {
    const [user] = await pool.query('SELECT invitation_code FROM users WHERE id=?', [req.user.id]);
    
    if (!user || !user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    
    // Get direct referrals (A level)
    const [directReferrals] = await pool.query(`
              SELECT id, phone, level, wallet_balance as balance, created_at 
      FROM users WHERE referred_by=?
    `, [userData.invitation_code]);
    
    // Get indirect referrals (B level)
    const [indirectReferrals] = await pool.query(`
              SELECT u.id, u.phone, u.level, u.wallet_balance as balance, u.created_at
      FROM users u
      JOIN users direct ON u.referred_by = direct.invitation_code
      WHERE direct.referred_by = ?
    `, [userData.invitation_code]);
    
    // Calculate earnings from team (using task completions for more accurate data)
    const [teamEarnings] = await pool.query(`
      SELECT COALESCE(SUM(tc.reward_amount), 0) as total_earnings
      FROM task_completions tc
      JOIN users u ON tc.user_id = u.id
      WHERE (u.referred_by = ? OR u.referred_by IN (
        SELECT invitation_code FROM users WHERE referred_by = ?
      ))
    `, [userData.invitation_code, userData.invitation_code]);
    
    res.json({
      directReferrals: directReferrals.length,
      indirectReferrals: indirectReferrals.length,
      totalTeamMembers: directReferrals.length + indirectReferrals.length,
      teamEarnings: teamEarnings[0].total_earnings || 0,
      directReferralsList: directReferrals,
      indirectReferralsList: indirectReferrals
    });
  } catch (error) {
    console.error('Error in team-stats:', error);
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

      // Get temporary worker status
      router.get('/temp-worker-status', simpleAuth, async (req, res) => {
        try {
          const [user] = await pool.query(
            'SELECT level, created_at, temp_worker_start_date FROM users WHERE id = ?',
            [req.user.id]
          );
      
          if (!user.length) {
            return res.status(404).json({ error: 'User not found' });
          }
      
          const userData = user[0];
          const isTempWorker = userData.level === 0;
          
          if (isTempWorker) {
            // Calculate remaining time for temporary worker (5 days trial period)
            const startDate = new Date(userData.temp_worker_start_date || userData.created_at);
            const now = new Date();
            const timeDiff = now - startDate;
            const daysRemaining = Math.max(0, 5 - Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
            const hoursRemaining = Math.max(0, 24 - Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
            const minutesRemaining = Math.max(0, 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)));
            
            res.json({ 
              isTempWorker: true,
              daysRemaining,
              hoursRemaining,
              minutesRemaining,
              startDate: userData.temp_worker_start_date || userData.created_at
            });
          } else {
            res.json({ isTempWorker: false });
          }
        } catch (error) {
          console.error('Error getting temp worker status:', error);
          res.status(500).json({ error: 'Failed to get status' });
        }
      });
      
      // Upgrade temporary worker
      router.post('/upgrade-temp-worker', simpleAuth, async (req, res) => {
        try {
          const [user] = await pool.query(
            'SELECT level, wallet_balance FROM users WHERE id = ?',
            [req.user.id]
          );
          
          if (!user.length) {
            return res.status(404).json({ error: 'User not found' });
          }
          
          const userData = user[0];
          
          if (userData.level !== 0) {
            return res.status(400).json({ error: 'Only temporary workers can upgrade' });
          }
          
          // Cost to upgrade from temporary worker to level 1
          const upgradeCost = 2600;
          
          if (userData.wallet_balance < upgradeCost) {
            return res.status(400).json({ 
              error: `Insufficient funds! You need KES ${upgradeCost.toLocaleString()} to upgrade from temporary worker to Level 1` 
            });
          }
          
          // Update user to level 1 and deduct cost
          await pool.query(
            'UPDATE users SET level = 1, wallet_balance = wallet_balance - ?, temp_worker_start_date = NULL WHERE id = ?',
            [upgradeCost, req.user.id]
          );
          
          // Immediately grant Level 1 privileges
          await grantLevelPrivileges(req.user.id, 1);
          
          // Process referral rewards for the inviter
          await processReferralRewards(req.user.id, 1);
          
          pushNotification(req.user.id, "Successfully upgraded from temporary worker to Level 1!", "success");
          res.json({ 
            success: true,
            message: "Successfully upgraded to Level 1",
            newLevel: 1,
            cost: upgradeCost,
            newBalance: userData.wallet_balance - upgradeCost
          });
          
        } catch (error) {
          console.error('Error upgrading temp worker:', error);
          res.status(500).json({ error: 'Failed to upgrade' });
        }
      });

// Get binding status
router.get('/binding-status', simpleAuth, async (req, res) => {
  try {
    const [user] = await pool.query(
      'SELECT full_name, id_number, bank_type, account_number, withdrawal_pin FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    const isBound = userData.full_name && userData.bank_type && userData.account_number && userData.withdrawal_pin;
    
    res.json({
      isBound: isBound,
      fullName: userData.full_name,
      idNumber: userData.id_number,
      bankType: userData.bank_type,
      accountNumber: userData.account_number,
      hasPin: !!userData.withdrawal_pin
    });
  } catch (error) {
    console.error('Error checking binding status:', error);
    res.status(500).json({ error: 'Failed to check binding status' });
  }
});

// Bind withdrawal details
router.post('/bind-details', simpleAuth, async (req, res) => {
  const { fullName, bankType, accountNumber, withdrawalPin } = req.body;
  
  if (!fullName || !bankType || !accountNumber || !withdrawalPin) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (withdrawalPin.length !== 4 || !/^\d+$/.test(withdrawalPin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  
  try {
    // Hash the withdrawal PIN for security
    const hashedPin = await bcrypt.hash(withdrawalPin, 10);
    
    // Store withdrawal details securely (without ID number - that comes during first withdrawal)
    await pool.query(
      'UPDATE users SET full_name=?, bank_type=?, account_number=?, withdrawal_pin=?, pin_attempts=0, pin_locked_until=NULL WHERE id=?', 
      [fullName, bankType, accountNumber, hashedPin, req.user.id]
    );
    
    pushNotification(req.user.id, "Withdrawal details bound successfully.", "success");
    res.json({ message: "Withdrawal details saved successfully." });
  } catch (error) {
    console.error('Error binding details:', error);
    res.status(500).json({ error: 'Failed to save details' });
  }
});

// Set ID number (one-time during first withdrawal)
router.post('/set-id-number', simpleAuth, async (req, res) => {
  const { idNumber } = req.body;
  
  if (!idNumber) {
    return res.status(400).json({ error: 'ID number is required' });
  }
  
  // Validate ID number format
  if (idNumber.length < 6 || idNumber.length > 20) {
    return res.status(400).json({ error: 'Invalid ID number format' });
  }
  
  try {
    // Check if user already has an ID number
    const [user] = await pool.query(
      'SELECT id_number FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (user[0].id_number) {
      return res.status(400).json({ error: 'ID number already set and cannot be changed' });
    }
    
    // Check if ID number is already used by another user
    const [existingId] = await pool.query(
      'SELECT id FROM users WHERE id_number = ?',
      [idNumber]
    );
    
    if (existingId.length > 0) {
      return res.status(400).json({ error: 'This ID number is already registered by another user' });
    }
    
    // Save the ID number
    await pool.query(
      'UPDATE users SET id_number = ? WHERE id = ?',
      [idNumber, req.user.id]
    );
    
    pushNotification(req.user.id, "ID number saved successfully.", "success");
    res.json({ message: "ID number saved successfully." });
  } catch (error) {
    console.error('Error setting ID number:', error);
    
    // Check if it's a duplicate key error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This ID number is already registered by another user' });
    }
    
    res.status(500).json({ error: 'Failed to save ID number' });
  }
});

// Reset withdrawal PIN
router.post('/reset-withdrawal-pin', simpleAuth, async (req, res) => {
  const { password, newPin } = req.body;
  
  if (!password || !newPin) {
    return res.status(400).json({ error: 'Password and new PIN are required' });
  }
  
  if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  
  try {
    // Verify account password
    const [user] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if password matches (handle both hashed and plain text passwords)
    let isPasswordValid = false;
    
    if (user[0].password === password) {
      // Plain text password match
      isPasswordValid = true;
    } else {
      // Try bcrypt comparison for hashed passwords
      try {
        isPasswordValid = await bcrypt.compare(password, user[0].password);
      } catch (error) {
        isPasswordValid = false;
      }
    }
    
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid account password' });
    }
    
    // Hash the new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);
    
    // Update PIN and reset attempts
    await pool.query(
      'UPDATE users SET withdrawal_pin=?, pin_attempts=0, pin_locked_until=NULL WHERE id=?',
      [hashedPin, req.user.id]
    );
    
    pushNotification(req.user.id, "Withdrawal PIN reset successfully.", "success");
    res.json({ message: "Withdrawal PIN reset successfully." });
  } catch (error) {
    console.error('Error resetting PIN:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});

// Get levels data
router.get('/levels', simpleAuth, async (req, res) => {
  try {
    // Get user's current level
    const [userRows] = await pool.query('SELECT level FROM users WHERE id = ?', [req.user.id]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const currentLevel = user.level;
    
    // Get completed tasks today
    const [completedToday] = await pool.query(`
      SELECT COUNT(*) as completed FROM user_tasks 
      WHERE user_id = ? AND DATE(completed_at) = CURDATE()
    `, [req.user.id]);
    
         // Define level data with costs and requirements (0-9 system including temporary worker)
     const levelData = [
       {
         level: 0,
         target: 5,
         dailyTasks: 5,
         dailyCommission: 55, // Updated to 55
         rewardPerTask: 11, // Added reward per task
         invitation_rate_a: 0, // Changed to 0 for N/A display
         invitation_rate_b: 0, // Changed to 0 for N/A display
         invitation_rate_c: 0, // Changed to 0 for N/A display
         task_commission_rate_a: 0, // Changed to 0 for N/A display
         task_commission_rate_b: 0, // Changed to 0 for N/A display
         task_commission_rate_c: 0, // Changed to 0 for N/A display
         isTemporaryWorker: true
       },
       {
         level: 1,
         target: 5,
         dailyTasks: 5,
         dailyCommission: 85, // 17 × 5 tasks
         rewardPerTask: 17, // Added reward per task
         invitation_rate_a: 12,
         invitation_rate_b: 3,
         invitation_rate_c: 1,
         task_commission_rate_a: 5,
         task_commission_rate_b: 2,
         task_commission_rate_c: 1
       },
      {
        level: 2,
        target: 10,
        dailyTasks: 10,
        dailyCommission: 234, // 23.4 × 10 tasks
        rewardPerTask: 23.4, // Added reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 3,
        target: 15,
        dailyTasks: 15,
        dailyCommission: 720, // 48 × 15 tasks
        rewardPerTask: 48, // Updated reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 4,
        target: 20,
        dailyTasks: 20,
        dailyCommission: 1300, // 65 × 20 tasks
        rewardPerTask: 65, // Updated reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 5,
        target: 25,
        dailyTasks: 25,
        dailyCommission: 6675, // 267 × 25 tasks
        rewardPerTask: 267, // Added reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 6,
        target: 30,
        dailyTasks: 30,
        dailyCommission: 6900, // 230 × 30 tasks
        rewardPerTask: 230, // Added reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 7,
        target: 35,
        dailyTasks: 35,
        dailyCommission: 10430, // 298 × 35 tasks
        rewardPerTask: 298, // Added reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 8,
        target: 40,
        dailyTasks: 40,
        dailyCommission: 17120, // 428 × 40 tasks
        rewardPerTask: 428, // Added reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      },
      {
        level: 9,
        target: 45,
        dailyTasks: 45,
        dailyCommission: 24975, // 555 × 45 tasks
        rewardPerTask: 555, // Added reward per task
        invitation_rate_a: 12,
        invitation_rate_b: 3,
        invitation_rate_c: 1,
        task_commission_rate_a: 5,
        task_commission_rate_b: 2,
        task_commission_rate_c: 1
      }
    ];
    
    res.json({
      currentLevel: currentLevel,
      completedToday: completedToday[0].completed,
      levelData: levelData
    });
  } catch (error) {
    console.error('Error fetching levels data:', error);
    res.status(500).json({ error: 'Failed to fetch levels data' });
  }
});

// Choose level endpoint
router.post('/choose-level', simpleAuth, async (req, res) => {
  try {
    const { level } = req.body;
    
    if (level === undefined || level === null) {
      return res.status(400).json({ error: 'Level is required' });
    }

         // Check if level is locked (8, 9) or if trying to select temporary worker level
     if (level >= 8) {
       return res.status(400).json({ error: 'This level is currently locked and unavailable for selection.' });
     }
     
     if (level === 0) {
       return res.status(400).json({ error: 'Temporary worker level cannot be selected manually.' });
     }

    // Get user's current level and wallet balance
    const [userRows] = await pool.query(
      'SELECT level, wallet_balance FROM users WHERE id = ?', 
      [req.user.id]
    );
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const currentLevel = user.level;
    const walletBalance = parseFloat(user.wallet_balance || 0);

         // Define level costs (0-9 system including temporary worker)
     const levelCosts = {
       0: 0,        // Temporary Worker (free)
       1: 2600,     // Level 1
       2: 7500,     // Level 2
       3: 23500,    // Level 3
       4: 20000,    // Level 4
       5: 177000,   // Level 5
       6: 482000,   // Level 6
       7: 1084000,  // Level 7
       8: 2257000,  // Level 8
       9: 4270000   // Level 9
     };

    const cost = levelCosts[level] || 0;
    
    // Check if user has sufficient balance
    if (walletBalance < cost) {
      return res.status(400).json({ 
        error: `Insufficient funds! You need KES ${cost.toLocaleString()} but your balance is KES ${walletBalance.toLocaleString()}` 
      });
    }

    // Calculate refund and net cost
    let refundAmount = 0;
    let netCost = cost;
    
    if (currentLevel > 0) {
      // User has a previous level, calculate refund from previous level cost
      const currentLevelCost = levelCosts[currentLevel] || 0;
      refundAmount = currentLevelCost; // Full refund of previous level cost
      
      if (level > currentLevel) {
        // Upgrading: refund previous level + pay difference
        netCost = cost - refundAmount;
      } else if (level < currentLevel) {
        // Downgrading: refund previous level + get refund for downgrade
        netCost = -(refundAmount - cost); // This will be negative (refund)
      } else {
        // Same level: just refund previous level
        netCost = -refundAmount; // This will be negative (refund)
      }
    } else {
      // User is upgrading from temporary worker (level 0), no refund
      netCost = cost;
    }

    // Update user's level and wallet balance
    const newBalance = walletBalance - netCost;
    
    await pool.query(
      'UPDATE users SET level = ?, wallet_balance = ? WHERE id = ?',
      [level, newBalance, req.user.id]
    );

    // Immediately grant all privileges for the new level
    await grantLevelPrivileges(req.user.id, level);
    
    // Process referral rewards if upgrading to levels 1, 2, or 3
    if (level === 1 || level === 2 || level === 3) {
      await processReferralRewards(req.user.id, level);
    }

    res.json({
      success: true,
      message: `Successfully joined Level ${level}`,
      newLevel: level,
      cost: cost,
      refundAmount: refundAmount,
      netCost: netCost,
      newBalance: newBalance,
      previousLevel: currentLevel,
      previousLevelCost: currentLevel > 0 ? levelCosts[currentLevel] : 0
    });

  } catch (error) {
    console.error('Error choosing level:', error);
    res.status(500).json({ error: 'Failed to choose level' });
  }
});

// Get users who joined using your invitation code
router.get('/invitation-users', simpleAuth, async (req, res) => {
  try {
    // Get the current user's invitation code
    const [userRows] = await pool.query(
      'SELECT invitation_code FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userInvitationCode = userRows[0].invitation_code;
    
    if (!userInvitationCode) {
      return res.json({
        invitationCode: null,
        invitedUsers: [],
        totalInvited: 0
      });
    }
    
    // Find users who were referred by this user (using user ID, not invitation code)
    const [invitedUsers] = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.phone, 
        u.level, 
        u.wallet_balance as balance,
        u.created_at,
        u.temp_worker_start_date,
        COALESCE(rr.reward_amount, 0) as referral_reward_earned,
        rr.created_at as reward_date,
        rr.status as reward_status
      FROM users u
      LEFT JOIN referral_rewards rr ON u.id = rr.user_id AND rr.inviter_id = ?
      WHERE u.referred_by = ? 
      ORDER BY u.created_at DESC
    `, [req.user.id, req.user.id]);
    
    // Calculate total referral rewards earned from invited users
    let totalReferralEarnings = 0;
    let totalPendingRewards = 0;
    
    try {
      // Get completed referral rewards earned from invited users
      const [referralRewardsEarnings] = await pool.query(`
        SELECT COALESCE(SUM(reward_amount), 0) as total_referral_earned 
        FROM referral_rewards 
        WHERE inviter_id = ? AND user_id IN (
          SELECT id FROM users WHERE referred_by = ?
        ) AND status = 'completed'
      `, [req.user.id, req.user.id]);
      
      // Get pending referral rewards
      const [pendingRewardsEarnings] = await pool.query(`
        SELECT COALESCE(SUM(reward_amount), 0) as total_pending_earned 
        FROM referral_rewards 
        WHERE inviter_id = ? AND status = 'pending'
      `, [req.user.id]);
      
      totalReferralEarnings = parseFloat(referralRewardsEarnings[0].total_referral_earned || 0);
      totalPendingRewards = parseFloat(pendingRewardsEarnings[0].total_pending_earned || 0);
      
      console.log(`📊 Total referral earnings for user ${req.user.id}: KES ${totalReferralEarnings}`);
    } catch (error) {
      console.error('Error calculating referral earnings:', error);
      totalReferralEarnings = 0;
    }
    
    res.json({
      invitationCode: userInvitationCode,
      invitedUsers: invitedUsers,
      totalInvited: invitedUsers.length,
      totalEarnings: totalReferralEarnings,
      totalPendingRewards: totalPendingRewards
    });
    
  } catch (error) {
    console.error('Error fetching invitation users:', error);
    res.status(500).json({ error: 'Failed to fetch invitation users' });
  }
});

// Check for pending recharge status
router.get('/pending-recharge', simpleAuth, async (req, res) => {
  try {
    // Get the most recent pending recharge for this user
    const [rechargeRows] = await pool.query(`
      SELECT p.*, u.name as user_name, u.phone as user_phone
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.status = 'pending' AND p.payment_method LIKE '%hr_manager%'
      ORDER BY p.created_at DESC
      LIMIT 1
    `, [req.user.id]);
    
    if (rechargeRows.length > 0) {
      const pendingRecharge = rechargeRows[0];
      res.json({
        success: true,
        pendingRecharge: {
          id: pendingRecharge.id,
          amount: pendingRecharge.amount,
          phone: pendingRecharge.phone,
          message: pendingRecharge.verification_message,
          transaction_number: pendingRecharge.transaction_number,
          created_at: pendingRecharge.created_at,
          status: pendingRecharge.status
        }
      });
    } else {
      res.json({
        success: true,
        pendingRecharge: null
      });
    }
  } catch (error) {
    console.error('Error checking pending recharge:', error);
    res.status(500).json({ error: 'Failed to check pending recharge status' });
  }
});

// Get withdrawal records (shows 90% of all withdrawal records)
router.get('/withdrawal-records', simpleAuth, async (req, res) => {
  try {
    // Get all withdrawal records for the user, ordered by most recent first
    const [withdrawalRows] = await pool.query(`
      SELECT 
        id,
        amount,
        status,
        requested_at,
        processed_at,
        approved_by,
        rejected_by,
        admin_notes
      FROM withdrawals 
      WHERE user_id = ? 
      ORDER BY requested_at DESC
    `, [req.user.id]);
    
    // Calculate display amounts and processing fees for each record
    const recordsWithFees = withdrawalRows.map(record => {
      const processingFee = Math.round(record.amount * 0.1 * 100) / 100; // 10% tax
      const displayAmount = Math.round(record.amount * 0.9 * 100) / 100; // 90% of original
      
      return {
        ...record,
        original_amount: record.amount, // What user requested
        display_amount: displayAmount,   // What user sees (90%)
        processing_fee: processingFee    // Tax amount (10%)
      };
    });
    
    res.json({
      success: true,
      records: recordsWithFees,
      totalRecords: withdrawalRows.length
    });
    
  } catch (error) {
    console.error('Error fetching withdrawal records:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawal records' });
  }
});

module.exports = router;
