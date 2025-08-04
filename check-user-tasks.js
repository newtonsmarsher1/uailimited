const mysql = require('mysql2/promise');

async function checkUserTasks() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Caroline',
    database: 'uai'
  });

  try {
    console.log('🔍 Checking user_tasks table...');
    
    // Check all user_tasks for today
    const [allTasks] = await pool.query(`
      SELECT user_id, task_id, is_complete, completed_at 
      FROM user_tasks 
      WHERE DATE(completed_at) = CURDATE()
      ORDER BY user_id, completed_at
    `);
    
    console.log('📋 All user_tasks for today:', allTasks);
    
    // Check specific user (user 7)
    const [user7Tasks] = await pool.query(`
      SELECT user_id, task_id, is_complete, completed_at 
      FROM user_tasks 
      WHERE user_id = 7 AND DATE(completed_at) = CURDATE()
      ORDER BY completed_at
    `);
    
    console.log('📋 User 7 tasks for today:', user7Tasks);
    
    // Check user_task_stats for user 7
    const [user7Stats] = await pool.query(`
      SELECT * FROM user_task_stats 
      WHERE user_id = 7 AND date = CURDATE()
    `);
    
    console.log('📊 User 7 stats for today:', user7Stats);
    
    // Check user_earnings_summary for user 7
    const [user7Earnings] = await pool.query(`
      SELECT * FROM user_earnings_summary 
      WHERE user_id = 7
    `);
    
    console.log('💰 User 7 earnings summary:', user7Earnings);
    
  } catch (error) {
    console.error('❌ Error checking user tasks:', error);
  } finally {
    await pool.end();
  }
}

checkUserTasks(); 