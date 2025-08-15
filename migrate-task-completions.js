const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Caroline',
  database: 'uai'
};

async function migrateTaskCompletions() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Check if task_completions table exists and get its structure
    console.log('📋 Checking task_completions table structure...');
    const [tableExists] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'uai' AND table_name = 'task_completions'
    `);
    
    if (tableExists[0].count === 0) {
      // Create task_completions table with enhanced structure
      console.log('📋 Creating task_completions table...');
      await connection.execute(`
        CREATE TABLE task_completions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          task_id INT NOT NULL,
          task_name VARCHAR(255) NOT NULL,
          reward_amount DECIMAL(10,2) NOT NULL,
          user_level_at_completion INT NOT NULL,
          completion_date DATE NOT NULL,
          task_type VARCHAR(50) DEFAULT 'app_download',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_completion_date (completion_date),
          INDEX idx_user_date (user_id, completion_date),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Task completions table created');
    } else {
      // Check if completion_date column exists
      const [columnExists] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.columns 
        WHERE table_schema = 'uai' AND table_name = 'task_completions' AND column_name = 'completion_date'
      `);
      
      if (columnExists[0].count === 0) {
        console.log('📋 Adding completion_date column to task_completions...');
        await connection.execute(`
          ALTER TABLE task_completions 
          ADD COLUMN completion_date DATE NOT NULL DEFAULT (CURDATE()) AFTER user_level_at_completion
        `);
        console.log('✅ completion_date column added');
      } else {
        console.log('ℹ️ task_completions table already has completion_date column');
      }
    }

    // Create or update user_task_stats table for daily tracking
    console.log('📊 Creating/updating user_task_stats table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_task_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        tasks_completed_today INT DEFAULT 0,
        todays_earnings DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, date),
        INDEX idx_user_id (user_id),
        INDEX idx_date (date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ User task stats table created/updated');

    // Create or update user_earnings_summary table for overall tracking
    console.log('💰 Creating/updating user_earnings_summary table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_earnings_summary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_tasks_completed INT DEFAULT 0,
        total_earnings DECIMAL(10,2) DEFAULT 0.00,
        this_month_earnings DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_id (user_id),
        INDEX idx_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ User earnings summary table created/updated');

    // Migrate existing user_tasks data to task_completions if needed
    console.log('🔄 Checking for existing user_tasks data to migrate...');
    const [existingTasks] = await connection.execute(`
      SELECT COUNT(*) as count FROM user_tasks WHERE is_complete = 1
    `);
    
    if (existingTasks[0].count > 0) {
      console.log(`📋 Found ${existingTasks[0].count} completed tasks to migrate...`);
      
      // Check if task_completions is empty
      const [existingCompletions] = await connection.execute(`
        SELECT COUNT(*) as count FROM task_completions
      `);
      
      if (existingCompletions[0].count === 0) {
        console.log('🔄 Migrating existing completed tasks to task_completions...');
        await connection.execute(`
          INSERT INTO task_completions (user_id, task_id, task_name, reward_amount, user_level_at_completion, completion_date, task_type)
          SELECT 
            ut.user_id,
            ut.task_id,
            COALESCE(t.title, CONCAT('Task ', ut.task_id)) as task_name,
            COALESCE(t.reward, 17.00) as reward_amount,
            COALESCE(u.bond_level, 1) as user_level_at_completion,
            DATE(ut.completed_at) as completion_date,
            COALESCE(t.type, 'app_download') as task_type
          FROM user_tasks ut
          LEFT JOIN tasks t ON ut.task_id = t.id
          LEFT JOIN users u ON ut.user_id = u.id
          WHERE ut.is_complete = 1
        `);
        console.log('✅ Existing tasks migrated to task_completions');
      } else {
        console.log('ℹ️ Task completions table already has data, skipping migration');
      }
    } else {
      console.log('ℹ️ No existing completed tasks found');
    }

    // Initialize user_earnings_summary for existing users
    console.log('💰 Initializing user earnings summary for existing users...');
    await connection.execute(`
      INSERT IGNORE INTO user_earnings_summary (user_id, total_tasks_completed, total_earnings, this_month_earnings)
      SELECT 
        u.id,
        COALESCE(COUNT(tc.id), 0) as total_tasks_completed,
        COALESCE(SUM(tc.reward_amount), 0.00) as total_earnings,
        COALESCE(SUM(CASE 
          WHEN MONTH(tc.completion_date) = MONTH(CURDATE()) 
          AND YEAR(tc.completion_date) = YEAR(CURDATE()) 
          THEN tc.reward_amount 
          ELSE 0 
        END), 0.00) as this_month_earnings
      FROM users u
      LEFT JOIN task_completions tc ON u.id = tc.user_id
      GROUP BY u.id
    `);
    console.log('✅ User earnings summary initialized');

    // Initialize user_task_stats for today
    console.log('📊 Initializing user task stats for today...');
    await connection.execute(`
      INSERT IGNORE INTO user_task_stats (user_id, date, tasks_completed_today, todays_earnings)
      SELECT 
        u.id,
        CURDATE() as date,
        COALESCE(COUNT(tc.id), 0) as tasks_completed_today,
        COALESCE(SUM(tc.reward_amount), 0.00) as todays_earnings
      FROM users u
      LEFT JOIN task_completions tc ON u.id = tc.user_id 
        AND tc.completion_date = CURDATE()
      GROUP BY u.id
    `);
    console.log('✅ User task stats initialized for today');

    console.log('\n🎉 Task completions migration completed successfully!');
    console.log('\n📊 Summary of tables:');
    console.log('- task_completions: Enhanced task completion tracking');
    console.log('- user_task_stats: Daily task and earnings statistics');
    console.log('- user_earnings_summary: Overall user earnings summary');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

migrateTaskCompletions();
