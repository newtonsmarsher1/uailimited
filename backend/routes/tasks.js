const express = require('express');
const pool = require('../config/database.js');
const { pushNotification } = require('../services/notificationService.js');
const { simpleAuth } = require('../middleware/auth-simple.js');

const router = express.Router();

// Get tasks for user
router.get('/', simpleAuth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT level, bond_balance FROM users WHERE id=?', [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    const userLevel = user.level || 1;
    const userBondBalance = user.bond_balance || 0;
  
    // Get tasks for user's level - allow Level 0 users to access Level 1 tasks
    const effectiveLevel = userLevel === 0 ? 1 : userLevel;
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE bond_level_required<=? ORDER BY id', [effectiveLevel]);
    
    // Get completed tasks for today
    const [completedToday] = await pool.query(`
      SELECT task_id FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    // Get all completed tasks
    const [allCompleted] = await pool.query(`
      SELECT task_id FROM user_tasks WHERE user_id=? AND is_complete=1
    `, [req.user.id]);
    
    const completedIds = new Set(allCompleted.map(r => r.task_id));
    const completedTodayIds = new Set(completedToday.map(r => r.task_id));
    
    // Get max tasks per day from database
    const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel]);
    const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
    
    // Add video URLs and metadata for company ads
    const tasksWithVideos = tasks.map(t => {
      let videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984"; // Default Design Studio
      let thumbnailUrl = "https://img.youtube.com/vi/3V1FjfGJ1bE/maxresdefault.jpg";
      
      // Map specific tasks to YouTube video URLs
      if (t.title.includes("Design Studio")) {
        videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984";
        thumbnailUrl = "https://img.youtube.com/vi/3V1FjfGJ1bE/maxresdefault.jpg";
      } else if (t.title.includes("Samsung Galaxy")) {
        videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984";
        thumbnailUrl = "https://img.youtube.com/vi/4Qp0NE1xXps/maxresdefault.jpg";
      } else if (t.title.includes("Tecno Camera")) {
        videoUrl = "https://www.facebook.com/ads/library/?id=1371755010718984";
        thumbnailUrl = "https://img.youtube.com/vi/Z8vZxiMZK5U/maxresdefault.jpg";
      }
      
      // Get level-based reward for the user
      const levelRewards = {
        0: 11,      // Level 0 (Temporary Worker): 11 shillings
        1: 17,      // Level 1: 17 shillings
        2: 23.5,    // Level 2: 23.5 shillings
        3: 48,      // Level 3: 48 shillings
        4: 65,      // Level 4: 65 shillings
        5: 118,     // Level 5: 118 shillings
        6: 155,     // Level 6: 155 shillings
        7: 220,     // Level 7: 220 shillings
        8: 430,     // Level 8: 430 shillings
        9: 480      // Level 9: 480 shillings
      };
      
      const userLevelReward = levelRewards[userLevel] || levelRewards[1];
      
      // Update task with level-based reward
      const updatedTask = {
        ...t,
        reward: userLevelReward, // Apply level-based reward
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        completed: completedIds.has(t.id),
        completedToday: completedTodayIds.has(t.id)
      };
      
      return updatedTask;
    });
  
    res.json({
      tasks: tasksWithVideos,
      maxTasksPerDay: maxTasksPerDay,
      completedToday: completedToday.length,
      userLevel: userLevel
    });
  } catch (error) {
    console.error('Error in tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Complete task
router.post('/complete', simpleAuth, async (req, res) => {
  const taskId = req.body.task_id || req.body.taskId;
  
  try {
    // Get user info
    const [[user]] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get task info - handle both database tasks and hardcoded frontend tasks
    let task;
    if (taskId <= 150) {
      // This is a hardcoded frontend task, create a virtual task object
      task = {
        id: taskId,
        title: `App Download Task ${taskId}`,
        description: `Download app task ${taskId}`,
        reward: 17 // Base reward, will be overridden by level-based calculation
      };
    } else {
      // This is a database task
      const [[dbTask]] = await pool.query('SELECT * FROM tasks WHERE id=?', [taskId]);
      if (!dbTask) return res.status(404).json({ error: 'Task not found' });
      task = dbTask;
    }

    // Get level-based reward for the user (immediate access to new level rewards)
    const levelRewards = {
      0: 11,      // Level 0 (Temporary Worker): 11 shillings
      1: 17,      // Level 1: 17 shillings
      2: 23.4,    // Level 2: 23.4 shillings
      3: 48,      // Level 3: 48 shillings
      4: 65,      // Level 4: 65 shillings
      5: 118,     // Level 5: 118 shillings
      6: 155,     // Level 6: 155 shillings
      7: 220,     // Level 7: 220 shillings
      8: 430,     // Level 8: 430 shillings
      9: 480      // Level 9: 480 shillings
    };
    
    // Get current user level (ensures immediate access to new level rewards)
    const currentUserLevel = user.level;
    const userLevelReward = levelRewards[currentUserLevel] || levelRewards[0];
    const actualReward = userLevelReward; // Use level-based reward instead of task.reward

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

    // Check daily task limit for all users
    const [todayTasks] = await pool.query(`
      SELECT COUNT(*) as completed_today
      FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    const completedToday = todayTasks[0].completed_today || 0;
    
    // Get user's daily task limit from levels table
    const userLevel = user.level === 0 ? 0 : user.level;
    const [levelConfig] = await pool.query('SELECT daily_tasks FROM levels WHERE level = ?', [userLevel]);
    const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
    
    // Check if user has exceeded daily limit
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

    // Start transaction for data consistency
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Record task completion in user_tasks
      await connection.query(`
        INSERT INTO user_tasks (user_id, task_id, is_complete, completed_at, reward_earned) 
        VALUES (?, ?, 1, NOW(), ?)
      `, [req.user.id, taskId, actualReward]);

      // 2. Record detailed task completion
      await connection.query(`
        INSERT INTO task_completions (user_id, task_id, task_name, reward_amount, user_level_at_completion)
        VALUES (?, ?, ?, ?, ?)
      `, [req.user.id, taskId, task.title, actualReward, user.level]);

      // 3. Update or create daily stats
      await connection.query(`
        INSERT INTO user_task_stats (user_id, date, tasks_completed_today, todays_earnings)
        VALUES (?, CURDATE(), 1, ?)
        ON DUPLICATE KEY UPDATE 
        tasks_completed_today = tasks_completed_today + 1,
        todays_earnings = todays_earnings + ?
      `, [req.user.id, actualReward, actualReward]);

      // 4. Update user earnings summary
      await connection.query(`
        INSERT INTO user_earnings_summary (user_id, total_tasks_completed, total_earnings, this_month_earnings)
        VALUES (?, 1, ?, ?)
        ON DUPLICATE KEY UPDATE 
        total_tasks_completed = total_tasks_completed + 1,
        total_earnings = total_earnings + ?,
        this_month_earnings = this_month_earnings + ?
      `, [req.user.id, actualReward, actualReward, actualReward, actualReward]);

      // 5. Update user balance (remove old this_month_earnings reference)
      const newBalance = parseFloat(user.wallet_balance || 0) + parseFloat(actualReward);
      await connection.query(`
        UPDATE users SET 
        wallet_balance = ?
        WHERE id = ?
      `, [newBalance, req.user.id]);

      // 6. Update temporary worker earnings if applicable
      if (user.level === 0) {
        // No need to update temporary_worker table since we're using the main users table
      }

      // Commit transaction
      await connection.commit();

      // Get updated stats for response
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

      const response = { 
        success: true, 
        reward: actualReward, 
        newBalance: newBalance,
        stats: {
          totalTasksCompleted: userStats.total_tasks_completed || 0,
          totalEarnings: userStats.total_earnings || 0,
          thisMonthEarnings: userStats.this_month_earnings || 0,
          todaysEarnings: userStats.todays_earnings || 0,
          tasksCompletedToday: userStats.tasks_completed_today || 0
        },
        message: user.level === 0 ? 
          `Task completed! Earned KES ${actualReward}. Trial task ${totalCompleted + 1}/5` :
          `Task completed! Earned KES ${actualReward}`
      };
      
      res.json(response);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Get user's completed tasks
router.get('/user-tasks', simpleAuth, async (req, res) => {
  try {
    // Get completed tasks for today
    const [completedTasks] = await pool.query(`
      SELECT task_id FROM user_tasks 
      WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE()
    `, [req.user.id]);
    
    const completedTaskIds = completedTasks.map(task => parseInt(task.task_id));
    
    res.json({
      completedTasks: completedTaskIds
    });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

// Get task history with pagination
router.get('/task-history', simpleAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Try to get task history from database
    let taskHistory = [];
    let summary = [{ totalTasksCompleted: 0, totalEarnings: 0, averageReward: 0 }];
    let totalCount = [{ total: 0 }];
    let activeDaysData = [];
    
    try {
      // First try to get data from task_completions table
      const [totalCountResult] = await pool.query(`
        SELECT COUNT(*) as total FROM task_completions 
        WHERE user_id = ?
      `, [req.user.id]);
      
      if (totalCountResult[0].total > 0) {
        // Use task_completions data
        totalCount = totalCountResult;

        const [taskHistoryResult] = await pool.query(`
          SELECT 
            task_id,
            reward_amount,
            completed_at,
            user_level_at_completion,
            task_name
          FROM task_completions 
          WHERE user_id = ?
          ORDER BY completed_at DESC
          LIMIT ? OFFSET ?
        `, [req.user.id, limit, offset]);
        taskHistory = taskHistoryResult;

        const [summaryResult] = await pool.query(`
          SELECT 
            COUNT(*) as totalTasksCompleted,
            COALESCE(SUM(reward_amount), 0) as totalEarnings,
            COALESCE(AVG(reward_amount), 0) as averageReward
          FROM task_completions 
          WHERE user_id = ?
        `, [req.user.id]);
        summary = summaryResult;

        const [activeDaysResult] = await pool.query(`
          SELECT 
            DATE(completed_at) as completion_date,
            COUNT(*) as tasks_completed
          FROM task_completions 
          WHERE user_id = ?
          GROUP BY DATE(completed_at)
          ORDER BY completion_date DESC
        `, [req.user.id]);
        activeDaysData = activeDaysResult;
      } else {
        // Fallback to user_tasks table with estimated rewards
        const [totalCountResult2] = await pool.query(`
          SELECT COUNT(*) as total FROM user_tasks 
          WHERE user_id = ? AND is_complete = 1
        `, [req.user.id]);
        totalCount = totalCountResult2;

        const [taskHistoryResult] = await pool.query(`
          SELECT 
            ut.task_id,
            CASE 
              WHEN ut.user_level_at_completion = 0 THEN 11
              WHEN ut.user_level_at_completion = 1 THEN 17
              WHEN ut.user_level_at_completion = 2 THEN 24.3
              WHEN ut.user_level_at_completion = 3 THEN 48
              WHEN ut.user_level_at_completion = 4 THEN 68
              WHEN ut.user_level_at_completion = 5 THEN 267
              WHEN ut.user_level_at_completion = 6 THEN 230
              WHEN ut.user_level_at_completion = 7 THEN 298
              WHEN ut.user_level_at_completion = 8 THEN 428
              WHEN ut.user_level_at_completion = 9 THEN 555
              ELSE 17
            END as reward_amount,
            ut.completed_at,
            COALESCE(ut.user_level_at_completion, 0) as user_level_at_completion,
            COALESCE(t.title, CONCAT('Task ', ut.task_id)) as task_name
          FROM user_tasks ut
          LEFT JOIN tasks t ON ut.task_id = t.id
          WHERE ut.user_id = ? AND ut.is_complete = 1
          ORDER BY ut.completed_at DESC
          LIMIT ? OFFSET ?
        `, [req.user.id, req.user.id, limit, offset]);
        taskHistory = taskHistoryResult;

        const [summaryResult] = await pool.query(`
          SELECT 
            COUNT(*) as totalTasksCompleted,
            SUM(CASE 
              WHEN user_level_at_completion = 0 THEN 11
              WHEN user_level_at_completion = 1 THEN 17
              WHEN user_level_at_completion = 2 THEN 24.3
              WHEN user_level_at_completion = 3 THEN 48
              WHEN user_level_at_completion = 4 THEN 68
              WHEN user_level_at_completion = 5 THEN 267
              WHEN user_level_at_completion = 6 THEN 230
              WHEN user_level_at_completion = 7 THEN 298
              WHEN user_level_at_completion = 8 THEN 428
              WHEN user_level_at_completion = 9 THEN 555
              ELSE 17
            END) as totalEarnings,
            AVG(CASE 
              WHEN user_level_at_completion = 0 THEN 11
              WHEN user_level_at_completion = 1 THEN 17
              WHEN user_level_at_completion = 2 THEN 24.3
              WHEN user_level_at_completion = 3 THEN 48
              WHEN user_level_at_completion = 4 THEN 68
              WHEN user_level_at_completion = 5 THEN 267
              WHEN user_level_at_completion = 6 THEN 230
              WHEN user_level_at_completion = 7 THEN 298
              WHEN user_level_at_completion = 8 THEN 428
              WHEN user_level_at_completion = 9 THEN 555
              ELSE 17
            END) as averageReward
          FROM user_tasks 
          WHERE user_id = ? AND is_complete = 1
        `, [req.user.id]);
        summary = summaryResult;

        const [activeDaysResult] = await pool.query(`
          SELECT 
            DATE(completed_at) as completion_date,
            COUNT(*) as tasks_completed
          FROM user_tasks 
          WHERE user_id = ? AND is_complete = 1
          GROUP BY DATE(completed_at)
          ORDER BY completion_date DESC
        `, [req.user.id]);
        activeDaysData = activeDaysResult;
      }
      
    } catch (error) {
      console.log('Database query for task history failed:', error.message);
      // Return empty task history if database fails
      taskHistory = [];
      summary = [{ totalTasksCompleted: 0, totalEarnings: 0, averageReward: 0 }];
      totalCount = [{ total: 0 }];
      activeDaysData = [];
    }

    const activeDays = activeDaysData.length;
    let longestStreak = 0;
    let currentStreak = 0;

    if (activeDaysData.length > 0) {
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < activeDaysData.length; i++) {
        const taskDate = new Date(activeDaysData[i].completion_date);
        taskDate.setHours(0, 0, 0, 0);

        const dayDiff = Math.floor((currentDate - taskDate) / (1000 * 60 * 60 * 24));

        if (dayDiff === i) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          break;
        }
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount[0].total / limit));

    res.json({
      taskHistory: taskHistory || [],
      summary: {
        totalTasksCompleted: summary[0]?.totalTasksCompleted || 0,
        totalEarnings: parseFloat(summary[0]?.totalEarnings || 0).toFixed(2),
        averageReward: parseFloat(summary[0]?.averageReward || 0).toFixed(2),
        activeDays: activeDays,
        longestStreak: longestStreak
      },
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalCount[0].total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching task history:', error);
    // Return empty task history instead of error
    res.json({
      taskHistory: [],
      summary: {
        totalTasksCompleted: 0,
        totalEarnings: "0.00",
        averageReward: "0.00",
        activeDays: 0,
        longestStreak: 0
      },
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  }
});

module.exports = router;
