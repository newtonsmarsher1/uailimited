const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Caroline',
  database: 'uai'
};

async function testTaskCompletion() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Test 1: Check if all required tables exist
    console.log('📋 Test 1: Checking required tables...');
    const requiredTables = ['users', 'user_tasks', 'task_completions', 'user_task_stats', 'user_earnings_summary'];
    
    for (const table of requiredTables) {
      const [tableExists] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'uai' AND table_name = ?
      `, [table]);
      
      if (tableExists[0].count > 0) {
        console.log(`✅ Table ${table} exists`);
      } else {
        console.log(`❌ Table ${table} does not exist`);
      }
    }

    // Test 2: Check if there are any users
    console.log('\n👥 Test 2: Checking users...');
    const [users] = await connection.execute('SELECT id, phone, bond_level FROM users LIMIT 5');
    console.log(`Found ${users.length} users:`, users);

    // Test 3: Check task_completions table structure
    console.log('\n📊 Test 3: Checking task_completions structure...');
    const [columns] = await connection.execute(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'uai' AND table_name = 'task_completions'
      ORDER BY ordinal_position
    `);
    console.log('task_completions columns:', columns.map(c => c.column_name));

    // Test 4: Check if there are any completed tasks
    console.log('\n📋 Test 4: Checking completed tasks...');
    const [completedTasks] = await connection.execute(`
      SELECT COUNT(*) as count FROM task_completions
    `);
    console.log(`Total completed tasks: ${completedTasks[0].count}`);

    // Test 5: Check user_task_stats
    console.log('\n📈 Test 5: Checking user task stats...');
    const [userStats] = await connection.execute(`
      SELECT user_id, date, tasks_completed_today, todays_earnings 
      FROM user_task_stats 
      WHERE date = CURDATE()
    `);
    console.log(`Today's stats:`, userStats);

    // Test 6: Check user_earnings_summary
    console.log('\n💰 Test 6: Checking user earnings summary...');
    const [earningsSummary] = await connection.execute(`
      SELECT user_id, total_tasks_completed, total_earnings, this_month_earnings 
      FROM user_earnings_summary
    `);
    console.log(`Earnings summary:`, earningsSummary);

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

testTaskCompletion();
