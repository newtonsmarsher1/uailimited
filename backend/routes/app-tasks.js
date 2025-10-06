const express = require('express');
const pool = require('../config/database.js');
const { simpleAuth } = require('../middleware/auth-simple.js');

const router = express.Router();

// Get app tasks for user
router.get('/', simpleAuth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT level FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const userLevel = user.level || 1;
  
    // Get app tasks from database
    const [dbAppTasks] = await pool.query('SELECT * FROM app_tasks WHERE is_active=1 ORDER BY id');
    
    // Create all 50 tasks (database + frontend-only)
    const frontendTasks = {
      1: { app_name: "TikTok", app_icon: "../assets/tiktok.png" },
      2: { app_name: "Instagram", app_icon: "../assets/social.png" },
      3: { app_name: "WhatsApp", app_icon: "../assets/whatsapp.png" },
      4: { app_name: "Spotify", app_icon: "../assets/spotify.png" },
      5: { app_name: "Netflix", app_icon: "../assets/video.png" },
      6: { app_name: "YouTube", app_icon: "../assets/play.png" },
      7: { app_name: "Facebook", app_icon: "../assets/facebook-messenger-logo.png" },
      8: { app_name: "Twitter", app_icon: "../assets/social (1).png" },
      9: { app_name: "Snapchat", app_icon: "../assets/social (2).png" },
      10: { app_name: "LinkedIn", app_icon: "../assets/social (3).png" },
      11: { app_name: "Telegram", app_icon: "../assets/messaging.png" },
      12: { app_name: "Discord", app_icon: "../assets/chat.png" },
      13: { app_name: "Amazon", app_icon: "../assets/app-store.png" },
      14: { app_name: "Pinterest", app_icon: "../assets/pinterest.png" },
      15: { app_name: "Reddit", app_icon: "../assets/social (4).png" },
      16: { app_name: "Twitch", app_icon: "../assets/video.png" },
      17: { app_name: "Zoom", app_icon: "../assets/camera.png" },
      18: { app_name: "Skype", app_icon: "../assets/chat (1).png" },
      19: { app_name: "Microsoft Teams", app_icon: "../assets/social (5).png" },
      20: { app_name: "Slack", app_icon: "../assets/message.png" },
      21: { app_name: "Google Drive", app_icon: "../assets/app.png" },
      22: { app_name: "Dropbox", app_icon: "../assets/app (1).png" },
      23: { app_name: "OneDrive", app_icon: "../assets/app (2).png" },
      24: { app_name: "iCloud", app_icon: "../assets/app (3).png" },
      25: { app_name: "Adobe Creative Cloud", app_icon: "../assets/app (4).png" },
      26: { app_name: "Canva", app_icon: "../assets/app (5).png" },
      27: { app_name: "Figma", app_icon: "../assets/app (6).png" },
      28: { app_name: "Sketch", app_icon: "../assets/app (7).png" },
      29: { app_name: "Notion", app_icon: "../assets/note.png" },
      30: { app_name: "Evernote", app_icon: "../assets/note.png" },
      31: { app_name: "Trello", app_icon: "../assets/applications.png" },
      32: { app_name: "Asana", app_icon: "../assets/applications.png" },
      33: { app_name: "Monday.com", app_icon: "../assets/applications.png" },
      34: { app_name: "Jira", app_icon: "../assets/applications.png" },
      35: { app_name: "Confluence", app_icon: "../assets/applications.png" },
      36: { app_name: "GitHub", app_icon: "../assets/applications.png" },
      37: { app_name: "GitLab", app_icon: "../assets/applications.png" },
      38: { app_name: "Bitbucket", app_icon: "../assets/applications.png" },
      39: { app_name: "Docker", app_icon: "../assets/applications.png" },
      40: { app_name: "Kubernetes", app_icon: "../assets/applications.png" },
      41: { app_name: "AWS", app_icon: "../assets/applications.png" },
      42: { app_name: "Google Cloud", app_icon: "../assets/applications.png" },
      43: { app_name: "Azure", app_icon: "../assets/applications.png" },
      44: { app_name: "Heroku", app_icon: "../assets/applications.png" },
      45: { app_name: "Vercel", app_icon: "../assets/applications.png" },
      46: { app_name: "Netlify", app_icon: "../assets/applications.png" },
      47: { app_name: "Firebase", app_icon: "../assets/applications.png" },
      48: { app_name: "Supabase", app_icon: "../assets/applications.png" },
      49: { app_name: "MongoDB", app_icon: "../assets/applications.png" },
      50: { app_name: "PostgreSQL", app_icon: "../assets/applications.png" }
    };
    
    // Create complete app tasks list (database tasks + frontend-only tasks)
    const appTasks = [];
    for (let i = 1; i <= 50; i++) {
      const dbTask = dbAppTasks.find(t => t.id === i);
      if (dbTask) {
        appTasks.push(dbTask);
      } else {
        const frontendTask = frontendTasks[i];
        if (frontendTask) {
          appTasks.push({
            id: i,
            app_name: frontendTask.app_name,
            app_icon: frontendTask.app_icon,
            is_active: 1
          });
        }
      }
    }
    
    // Get completed app tasks for today
    const [completedToday] = await pool.query(`
      SELECT app_task_id FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE() AND task_type='app'
    `, [req.user.id]);
    
    // Get all completed app tasks
    const [allCompleted] = await pool.query(`
      SELECT app_task_id FROM user_tasks WHERE user_id=? AND is_complete=1 AND task_type='app'
    `, [req.user.id]);
    
    const completedIds = new Set(allCompleted.map(r => r.app_task_id));
    const completedTodayIds = new Set(completedToday.map(r => r.app_task_id));
    
    // Get max tasks per day from database
    const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel]);
    const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
    
    // Get level-based rewards
    const levelRewards = {
      0: 11,      // Level 0 (Temporary Worker): 11 shillings per task
      1: 17,      // Level 1: 17 shillings per task
      2: 23.4,    // Level 2: 23.4 shillings per task
      3: 48,      // Level 3: 48 shillings per task
      4: 65,      // Level 4: 65 shillings per task
      5: 118,     // Level 5: 118 shillings per task
      6: 155,     // Level 6: 155 shillings per task
      7: 220,     // Level 7: 220 shillings per task
      8: 430,     // Level 8: 430 shillings per task
      9: 480      // Level 9: 480 shillings per task
    };
    
    // Get current user level (ensures immediate access to new level rewards)
    const currentUserLevel = userLevel;
    const userLevelReward = levelRewards[currentUserLevel] || levelRewards[0];
    
    // Map app tasks with completion status and rewards
    // IMPORTANT: A task is 'completed' only if it was completed TODAY
    // After midnight, tasks should appear as 'ongoing' again
    const tasksWithStatus = appTasks.map(task => ({
      id: task.id,
      name: task.app_name,
      icon: task.app_icon,
      earning: userLevelReward,
      status: completedTodayIds.has(task.id) ? "completed" : "ongoing",
      completedToday: completedTodayIds.has(task.id)
    }));
  
    res.json({
      tasks: tasksWithStatus,
      maxTasksPerDay: maxTasksPerDay,
      completedToday: completedToday.length,
      userLevel: userLevel,
      ongoingCount: appTasks.length - completedTodayIds.size,
      completedCount: completedToday.length
    });
  } catch (error) {
    console.error('Error in app tasks:', error);
    res.status(500).json({ error: 'Failed to fetch app tasks' });
  }
});

// Complete app task
router.post('/complete', simpleAuth, async (req, res) => {
  const taskId = req.body.task_id || req.body.taskId;
  
  try {
    // Get user info
    const [[user]] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get app task info - handle both database tasks and frontend-only tasks
    let appTask;
    const [[dbAppTask]] = await pool.query('SELECT * FROM app_tasks WHERE id=? AND is_active=1', [taskId]);
    
    if (dbAppTask) {
      // Task exists in database
      appTask = dbAppTask;
    } else if (taskId >= 1 && taskId <= 50) {
      // Frontend-only task (not in database) - create virtual task object
      const frontendTasks = {
        1: { app_name: "TikTok", app_icon: "../assets/tiktok.png" },
        2: { app_name: "Instagram", app_icon: "../assets/social.png" },
        3: { app_name: "WhatsApp", app_icon: "../assets/whatsapp.png" },
        4: { app_name: "Spotify", app_icon: "../assets/spotify.png" },
        5: { app_name: "Netflix", app_icon: "../assets/video.png" },
        6: { app_name: "YouTube", app_icon: "../assets/play.png" },
        7: { app_name: "Facebook", app_icon: "../assets/facebook-messenger-logo.png" },
        8: { app_name: "Twitter", app_icon: "../assets/social (1).png" },
        9: { app_name: "Snapchat", app_icon: "../assets/social (2).png" },
        10: { app_name: "LinkedIn", app_icon: "../assets/social (3).png" },
        11: { app_name: "Telegram", app_icon: "../assets/messaging.png" },
        12: { app_name: "Discord", app_icon: "../assets/chat.png" },
        13: { app_name: "Amazon", app_icon: "../assets/app-store.png" },
        14: { app_name: "Pinterest", app_icon: "../assets/pinterest.png" },
        15: { app_name: "Reddit", app_icon: "../assets/social (4).png" },
        16: { app_name: "Twitch", app_icon: "../assets/video.png" },
        17: { app_name: "Zoom", app_icon: "../assets/camera.png" },
        18: { app_name: "Skype", app_icon: "../assets/chat (1).png" },
        19: { app_name: "Microsoft Teams", app_icon: "../assets/social (5).png" },
        20: { app_name: "Slack", app_icon: "../assets/message.png" },
        21: { app_name: "Google Drive", app_icon: "../assets/app.png" },
        22: { app_name: "Dropbox", app_icon: "../assets/app (1).png" },
        23: { app_name: "OneDrive", app_icon: "../assets/app (2).png" },
        24: { app_name: "iCloud", app_icon: "../assets/app (3).png" },
        25: { app_name: "Adobe Creative Cloud", app_icon: "../assets/app (4).png" },
        26: { app_name: "Canva", app_icon: "../assets/app (5).png" },
        27: { app_name: "Figma", app_icon: "../assets/app (6).png" },
        28: { app_name: "Sketch", app_icon: "../assets/app (7).png" },
        29: { app_name: "Notion", app_icon: "../assets/note.png" },
        30: { app_name: "Evernote", app_icon: "../assets/note.png" },
        31: { app_name: "Trello", app_icon: "../assets/applications.png" },
        32: { app_name: "Asana", app_icon: "../assets/applications.png" },
        33: { app_name: "Monday.com", app_icon: "../assets/applications.png" },
        34: { app_name: "Jira", app_icon: "../assets/applications.png" },
        35: { app_name: "Confluence", app_icon: "../assets/applications.png" },
        36: { app_name: "GitHub", app_icon: "../assets/applications.png" },
        37: { app_name: "GitLab", app_icon: "../assets/applications.png" },
        38: { app_name: "Bitbucket", app_icon: "../assets/applications.png" },
        39: { app_name: "Docker", app_icon: "../assets/applications.png" },
        40: { app_name: "Kubernetes", app_icon: "../assets/applications.png" },
        41: { app_name: "AWS", app_icon: "../assets/applications.png" },
        42: { app_name: "Google Cloud", app_icon: "../assets/applications.png" },
        43: { app_name: "Azure", app_icon: "../assets/applications.png" },
        44: { app_name: "Heroku", app_icon: "../assets/applications.png" },
        45: { app_name: "Vercel", app_icon: "../assets/applications.png" },
        46: { app_name: "Netlify", app_icon: "../assets/applications.png" },
        47: { app_name: "Firebase", app_icon: "../assets/applications.png" },
        48: { app_name: "Supabase", app_icon: "../assets/applications.png" },
        49: { app_name: "MongoDB", app_icon: "../assets/applications.png" },
        50: { app_name: "PostgreSQL", app_icon: "../assets/applications.png" }
      };
      
      const frontendTask = frontendTasks[taskId];
      if (frontendTask) {
        appTask = {
          id: taskId,
          app_name: frontendTask.app_name,
          app_icon: frontendTask.app_icon
        };
        console.log(`📱 Using frontend-only task: ${appTask.app_name} (ID: ${taskId})`);
      } else {
        return res.status(404).json({ error: 'App task not found' });
      }
    } else {
      return res.status(404).json({ error: 'App task not found' });
    }

    // Get level-based reward
    const levelRewards = {
      0: 11,      // Level 0 (Temporary Worker): 11 shillings per task
      1: 17,      // Level 1: 17 shillings per task
      2: 23.4,    // Level 2: 23.4 shillings per task
      3: 48,      // Level 3: 48 shillings per task
      4: 65,      // Level 4: 65 shillings per task
      5: 118,     // Level 5: 118 shillings per task
      6: 155,     // Level 6: 155 shillings per task
      7: 220,     // Level 7: 220 shillings per task
      8: 430,     // Level 8: 430 shillings per task
      9: 480      // Level 9: 480 shillings per task
    };
    
    // Get current user level (ensures immediate access to new level rewards)
    const currentUserLevel = user.level;
    const userLevelReward = levelRewards[currentUserLevel] || levelRewards[0];

    // Check if today is Sunday (day 0 in JavaScript Date)
    const today = new Date();
    const isSunday = today.getDay() === 0;
    
    // Check if today is a public holiday (Kenya public holidays 2024-2025)
    const publicHolidays = [
      // 2024 Holidays
      '2024-01-01', // New Year's Day
      '2024-03-29', // Good Friday
      '2024-04-01', // Easter Monday
      '2024-05-01', // Labour Day
      '2024-06-01', // Madaraka Day
      '2024-06-16', // Eid al-Fitr (approximate)
      '2024-10-10', // Moi Day
      '2024-10-20', // Mashujaa Day
      '2024-12-12', // Jamhuri Day
      '2024-12-25', // Christmas Day
      '2024-12-26', // Boxing Day
      
      // 2025 Holidays
      '2025-01-01', // New Year's Day
      '2025-03-21', // Good Friday
      '2025-03-24', // Easter Monday
      '2025-05-01', // Labour Day
      '2025-06-01', // Madaraka Day
      '2025-06-06', // Eid al-Fitr (approximate)
      '2025-10-10', // Moi Day
      '2025-10-20', // Mashujaa Day
      '2025-12-12', // Jamhuri Day
      '2025-12-25', // Christmas Day
      '2025-12-26'  // Boxing Day
    ];
    
    const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const isPublicHoliday = publicHolidays.includes(todayString);
    
    // Block task completion on Sundays and public holidays
    if (isSunday) {
      return res.status(403).json({ 
        error: 'Task completion is not allowed on Sundays. Please try again tomorrow.',
        restriction: 'sunday'
      });
    }
    
    if (isPublicHoliday) {
      return res.status(403).json({ 
        error: 'Task completion is not allowed on public holidays. Please try again tomorrow.',
        restriction: 'public_holiday'
      });
    }

    // Check if this specific app task is already completed today
    const [alreadyCompleted] = await pool.query(`
      SELECT id FROM user_tasks 
      WHERE user_id=? AND app_task_id=? AND task_type='app' AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id, taskId]);
    
    if (alreadyCompleted.length > 0) {
      // Return success for already completed tasks instead of error
      return res.json({ 
        success: true,
        alreadyCompleted: true,
        taskId: taskId,
        message: 'Task already completed today!',
        appName: appTask.app_name,
        reward: userLevelReward
      });
    }

    // Check daily app task limit only for app tasks
    const [todayTasks] = await pool.query(`
      SELECT COUNT(*) as completed_today
      FROM user_tasks 
      WHERE user_id=? AND task_type='app' AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    const completedToday = todayTasks[0].completed_today || 0;
    
    // Get user's daily task limit
    const userLevel = user.level === 0 ? 0 : user.level;
    const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel]);
    const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
    
    if (completedToday >= maxTasksPerDay) {
      return res.status(403).json({ 
        error: `Daily task limit reached! You have completed ${completedToday} tasks today. Daily limit for your level is ${maxTasksPerDay} tasks.`,
        dailyLimitReached: true,
        completedToday: completedToday,
        maxTasksPerDay: maxTasksPerDay
      });
    }

    // For temporary workers, check if they can still work
    if (user.level === 0) {
      // Use temp_worker_start_date if available, otherwise use created_at
      const trialStartDate = user.temp_worker_start_date ? new Date(user.temp_worker_start_date) : new Date(user.created_at);
      const today = new Date();
      const daysSinceStart = Math.floor((today - trialStartDate) / (1000 * 60 * 60 * 24));
      
      // Check if they've exceeded 5 days (time-based trial period only)
      if (daysSinceStart >= 5) {
        return res.status(403).json({ 
          error: 'Trial period expired after 5 days. Please upgrade to continue.',
          shouldUpgrade: true,
          daysSinceStart: daysSinceStart,
          trialStartDate: trialStartDate.toISOString()
        });
      }
      
      // Optional: Check if they've completed too many tasks (e.g., 20+ tasks in trial period)
      const [totalTasks] = await pool.query(`
        SELECT COUNT(*) as total_completed
        FROM user_tasks 
        WHERE user_id=? AND is_complete=1
      `, [req.user.id]);
      
      const totalCompleted = totalTasks[0].total_completed || 0;
      
      // Only block if they've completed an excessive number of tasks (20+)
      if (totalCompleted >= 20) {
        return res.status(403).json({ 
          error: 'Trial period completed! You have completed many tasks. Please upgrade to Level 1 to continue.',
          shouldUpgrade: true,
          tasksCompleted: totalCompleted
        });
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Record task completion in user_tasks table (using app_task_id for app tasks)
      await connection.query(`
        INSERT INTO user_tasks (user_id, app_task_id, task_type, is_complete, completed_at, reward_earned) 
        VALUES (?, ?, 'app', 1, NOW(), ?)
      `, [req.user.id, taskId, userLevelReward]);

      // 2. Record detailed completion (only for database tasks)
      if (dbAppTask) {
        await connection.query(`
          INSERT INTO task_completions (user_id, task_id, task_name, reward_amount, user_level_at_completion)
          VALUES (?, ?, ?, ?, ?)
        `, [req.user.id, taskId, appTask.app_name, userLevelReward, user.level]);
      } else {
        // For frontend-only tasks, we'll skip task_completions table
        // since the task_id doesn't exist in the tasks table
        console.log(`📱 Skipping task_completions for frontend-only task: ${appTask.app_name} (ID: ${taskId})`);
      }

      // 3. Update daily stats
      await connection.query(`
        INSERT INTO user_task_stats (user_id, date, tasks_completed_today, todays_earnings)
        VALUES (?, CURDATE(), 1, ?)
        ON DUPLICATE KEY UPDATE 
        tasks_completed_today = tasks_completed_today + 1,
        todays_earnings = todays_earnings + ?
      `, [req.user.id, userLevelReward, userLevelReward]);

      // 4. Update earnings summary
      await connection.query(`
        INSERT INTO user_earnings_summary (user_id, total_tasks_completed, total_earnings, this_month_earnings)
        VALUES (?, 1, ?, ?)
        ON DUPLICATE KEY UPDATE 
        total_tasks_completed = total_tasks_completed + 1,
        total_earnings = total_earnings + ?,
        this_month_earnings = this_month_earnings + ?
      `, [req.user.id, userLevelReward, userLevelReward, userLevelReward, userLevelReward]);

      // 5. Update user balance (remove old this_month_earnings reference)
      const newBalance = parseFloat(user.wallet_balance || 0) + parseFloat(userLevelReward);
      await connection.query(`
        UPDATE users SET 
        wallet_balance = ?
        WHERE id = ?
      `, [newBalance, req.user.id]);

      await connection.commit();

      // Get updated stats
      const [stats] = await pool.query(`
        SELECT 
          ues.total_tasks_completed,
          ues.total_earnings,
          ues.this_month_earnings,
          uts.todays_earnings,
          uts.tasks_completed_today
        FROM user_earnings_summary ues
        LEFT JOIN user_task_stats uts ON ues.user_id = uts.user_id AND uts.date = CURDATE()
        WHERE ues.user_id = ?
      `, [req.user.id]);

      const userStats = stats[0] || {};

      res.json({ 
        success: true, 
        reward: userLevelReward, 
        newBalance: newBalance,
        appName: appTask.app_name,
        stats: {
          totalTasksCompleted: userStats.total_tasks_completed || 0,
          totalEarnings: userStats.total_earnings || 0,
          thisMonthEarnings: userStats.this_month_earnings || 0,
          todaysEarnings: userStats.todays_earnings || 0,
          tasksCompletedToday: userStats.tasks_completed_today || 0
        },
        message: user.level === 0 ? 
          `App downloaded! Earned KES ${userLevelReward}. Trial task completed!` :
          `App downloaded! Earned KES ${userLevelReward}`
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error completing app task:', error);
    res.status(500).json({ error: 'Failed to complete app task' });
  }
});

// Get user's daily stats
router.get('/daily-stats', simpleAuth, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        uts.tasks_completed_today,
        uts.todays_earnings,
        ues.total_tasks_completed,
        ues.total_earnings,
        ues.this_month_earnings
      FROM user_task_stats uts
      LEFT JOIN user_earnings_summary ues ON uts.user_id = ues.user_id
      WHERE uts.user_id = ? AND uts.date = CURDATE()
    `, [req.user.id]);

    const [userLevel] = await pool.query('SELECT level FROM users WHERE id = ?', [req.user.id]);
    const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel[0]?.level || 1]);
    
    const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
    const userStats = stats[0] || {};

    res.json({
      tasksCompletedToday: userStats.tasks_completed_today || 0,
      todaysEarnings: userStats.todays_earnings || 0,
      totalTasksCompleted: userStats.total_tasks_completed || 0,
      totalEarnings: userStats.total_earnings || 0,
      thisMonthEarnings: userStats.this_month_earnings || 0,
      maxTasksPerDay: maxTasksPerDay,
      userLevel: userLevel[0]?.level || 1
    });

  } catch (error) {
    console.error('Error getting daily stats:', error);
    res.status(500).json({ error: 'Failed to get daily stats' });
  }
});

module.exports = router;
