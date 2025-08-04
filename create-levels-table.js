const mysql = require('mysql2/promise');

async function createLevelsTable() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('🗄️  Creating levels table with daily task limits...');

    // Create levels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level INT UNIQUE NOT NULL,
        name VARCHAR(50) DEFAULT 'Level',
        cost DECIMAL(10,2) DEFAULT 0.00,
        target DECIMAL(10,2) DEFAULT 0.00,
        daily_tasks INT DEFAULT 5,
        daily_commission DECIMAL(10,2) DEFAULT 0.00,
        reward_per_task DECIMAL(10,2) DEFAULT 17.00,
        invitation_rate_a DECIMAL(5,2) DEFAULT 12.00,
        invitation_rate_b DECIMAL(5,2) DEFAULT 3.00,
        invitation_rate_c DECIMAL(5,2) DEFAULT 1.00,
        task_commission_rate_a DECIMAL(5,2) DEFAULT 5.00,
        task_commission_rate_b DECIMAL(5,2) DEFAULT 2.00,
        task_commission_rate_c DECIMAL(5,2) DEFAULT 1.00,
        is_locked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created levels table');

    // Check if users table has name column, add if missing
    try {
      await pool.query('ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT "User"');
      console.log('✅ Added name column to users table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Name column already exists in users table');
      } else {
        console.log(`⚠️  Could not add name column: ${error.message}`);
      }
    }

    // Update existing users without names
    try {
      await pool.query('UPDATE users SET name = "User" WHERE name IS NULL OR name = ""');
      console.log('✅ Updated existing users with default names');
    } catch (error) {
      console.log(`⚠️  Could not update user names: ${error.message}`);
    }

    // Insert level data with daily task limits
    const levelsData = [
      {
        level: 0, // Temporary worker
        cost: 0.00,
        target: 0.00,
        daily_tasks: 5,
        daily_commission: 0.00,
        reward_per_task: 17.00,
        invitation_rate_a: 0.00,
        invitation_rate_b: 0.00,
        invitation_rate_c: 0.00,
        task_commission_rate_a: 0.00,
        task_commission_rate_b: 0.00,
        task_commission_rate_c: 0.00,
        is_locked: false
      },
      {
        level: 1,
        cost: 2000.00,
        target: 2400.00,
        daily_tasks: 5,
        daily_commission: 80.00,
        reward_per_task: 17.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 2,
        cost: 5000.00,
        target: 6000.00,
        daily_tasks: 10,
        daily_commission: 160.00,
        reward_per_task: 26.50,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 3,
        cost: 10000.00,
        target: 12000.00,
        daily_tasks: 17,
        daily_commission: 320.00,
        reward_per_task: 42.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 4,
        cost: 20000.00,
        target: 24000.00,
        daily_tasks: 30,
        daily_commission: 640.00,
        reward_per_task: 70.50,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 5,
        cost: 50000.00,
        target: 60000.00,
        daily_tasks: 53,
        daily_commission: 1280.00,
        reward_per_task: 118.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 6,
        cost: 100000.00,
        target: 120000.00,
        daily_tasks: 70,
        daily_commission: 2560.00,
        reward_per_task: 155.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 7,
        cost: 200000.00,
        target: 240000.00,
        daily_tasks: 85,
        daily_commission: 5120.00,
        reward_per_task: 220.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 8,
        cost: 500000.00,
        target: 600000.00,
        daily_tasks: 95,
        daily_commission: 10240.00,
        reward_per_task: 430.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      },
      {
        level: 9,
        cost: 1000000.00,
        target: 1200000.00,
        daily_tasks: 115,
        daily_commission: 20480.00,
        reward_per_task: 480.00,
        invitation_rate_a: 12.00,
        invitation_rate_b: 3.00,
        invitation_rate_c: 1.00,
        task_commission_rate_a: 5.00,
        task_commission_rate_b: 2.00,
        task_commission_rate_c: 1.00,
        is_locked: false
      }
    ];

    // Insert or update each level
    for (const levelData of levelsData) {
      try {
        await pool.query(`
          INSERT INTO levels (
            level, name, cost, target, daily_tasks, daily_commission, reward_per_task,
            invitation_rate_a, invitation_rate_b, invitation_rate_c,
            task_commission_rate_a, task_commission_rate_b, task_commission_rate_c, is_locked
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            cost = VALUES(cost),
            target = VALUES(target),
            daily_tasks = VALUES(daily_tasks),
            daily_commission = VALUES(daily_commission),
            reward_per_task = VALUES(reward_per_task),
            invitation_rate_a = VALUES(invitation_rate_a),
            invitation_rate_b = VALUES(invitation_rate_b),
            invitation_rate_c = VALUES(invitation_rate_c),
            task_commission_rate_a = VALUES(task_commission_rate_a),
            task_commission_rate_b = VALUES(task_commission_rate_b),
            task_commission_rate_c = VALUES(task_commission_rate_c),
            is_locked = VALUES(is_locked)
        `, [
          levelData.level, `Level ${levelData.level}`, levelData.cost, levelData.target, levelData.daily_tasks,
          levelData.daily_commission, levelData.reward_per_task,
          levelData.invitation_rate_a, levelData.invitation_rate_b, levelData.invitation_rate_c,
          levelData.task_commission_rate_a, levelData.task_commission_rate_b, levelData.task_commission_rate_c,
          levelData.is_locked
        ]);
        console.log(`✅ Level ${levelData.level}: ${levelData.daily_tasks} daily tasks, KES ${levelData.reward_per_task} per task`);
      } catch (error) {
        console.log(`⚠️  Error inserting level ${levelData.level}: ${error.message}`);
      }
    }

    console.log('\n🎯 Levels table created successfully!');
    console.log('\n📊 Daily task limits by level:');
    console.log('   Level 0 (Temp): 5 tasks/day');
    console.log('   Level 1: 5 tasks/day');
    console.log('   Level 2: 10 tasks/day');
    console.log('   Level 3: 17 tasks/day');
    console.log('   Level 4: 30 tasks/day');
    console.log('   Level 5: 53 tasks/day');
    console.log('   Level 6: 70 tasks/day');
    console.log('   Level 7: 85 tasks/day');
    console.log('   Level 8: 95 tasks/day');
    console.log('   Level 9: 115 tasks/day');

  } catch (error) {
    console.error('❌ Error creating levels table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the levels table creation
createLevelsTable().then(() => {
  console.log('\n✅ Levels table setup completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
}); 