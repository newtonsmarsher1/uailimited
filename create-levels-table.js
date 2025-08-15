const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Caroline',
  database: 'uai'
};

async function createLevelsTable() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Create levels table
    console.log('📊 Creating levels table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level INT NOT NULL UNIQUE,
        daily_tasks INT NOT NULL DEFAULT 5,
        daily_commission DECIMAL(10,2) DEFAULT 0.00,
        target_amount DECIMAL(10,2) DEFAULT 0.00,
        is_locked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Levels table created');

    // Insert level data
    console.log('📋 Inserting level data...');
    const levels = [
      { level: 0, daily_tasks: 5, daily_commission: 0.00, target_amount: 0.00, is_locked: false }, // Temporary workers
      { level: 1, daily_tasks: 5, daily_commission: 80.00, target_amount: 2400.00, is_locked: false },
      { level: 2, daily_tasks: 8, daily_commission: 120.00, target_amount: 3600.00, is_locked: false },
      { level: 3, daily_tasks: 12, daily_commission: 200.00, target_amount: 6000.00, is_locked: false },
      { level: 4, daily_tasks: 15, daily_commission: 300.00, target_amount: 9000.00, is_locked: false },
      { level: 5, daily_tasks: 20, daily_commission: 500.00, target_amount: 15000.00, is_locked: false },
      { level: 6, daily_tasks: 25, daily_commission: 800.00, target_amount: 24000.00, is_locked: false },
      { level: 7, daily_tasks: 30, daily_commission: 1200.00, target_amount: 36000.00, is_locked: false },
      { level: 8, daily_tasks: 35, daily_commission: 2000.00, target_amount: 60000.00, is_locked: false },
      { level: 9, daily_tasks: 40, daily_commission: 3000.00, target_amount: 90000.00, is_locked: false }
    ];

    for (const levelData of levels) {
      await connection.execute(`
        INSERT INTO levels (level, daily_tasks, daily_commission, target_amount, is_locked)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        daily_tasks = VALUES(daily_tasks),
        daily_commission = VALUES(daily_commission),
        target_amount = VALUES(target_amount),
        is_locked = VALUES(is_locked)
      `, [levelData.level, levelData.daily_tasks, levelData.daily_commission, levelData.target_amount, levelData.is_locked]);
    }
    console.log('✅ Level data inserted');

    // Verify levels
    console.log('🔍 Verifying levels...');
    const [levelsData] = await connection.execute('SELECT * FROM levels ORDER BY level');
    console.log('Levels data:', levelsData);

    console.log('\n🎉 Levels table setup completed successfully!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

createLevelsTable();
