const mysql = require('mysql2/promise');

async function checkTableStructure() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Checking Table Structures\n');
    
    // Check user_tasks table
    console.log('📊 user_tasks table structure:');
    console.log('=' .repeat(50));
    const [userTasksColumns] = await pool.query('DESCRIBE user_tasks');
    userTasksColumns.forEach(col => {
      console.log(`${col.Field.padEnd(20)} | ${col.Type.padEnd(15)} | ${col.Null.padEnd(4)} | ${col.Key.padEnd(3)} | ${col.Default || 'NULL'}`);
    });
    
    // Check tasks table
    console.log('\n📊 tasks table structure:');
    console.log('=' .repeat(50));
    const [tasksColumns] = await pool.query('DESCRIBE tasks');
    tasksColumns.forEach(col => {
      console.log(`${col.Field.padEnd(20)} | ${col.Type.padEnd(15)} | ${col.Null.padEnd(4)} | ${col.Key.padEnd(3)} | ${col.Default || 'NULL'}`);
    });
    
    // Check app_tasks table
    console.log('\n📊 app_tasks table structure:');
    console.log('=' .repeat(50));
    const [appTasksColumns] = await pool.query('DESCRIBE app_tasks');
    appTasksColumns.forEach(col => {
      console.log(`${col.Field.padEnd(20)} | ${col.Type.padEnd(15)} | ${col.Null.padEnd(4)} | ${col.Key.padEnd(3)} | ${col.Default || 'NULL'}`);
    });
    
    // Check levels table
    console.log('\n📊 levels table structure:');
    console.log('=' .repeat(50));
    const [levelsColumns] = await pool.query('DESCRIBE levels');
    levelsColumns.forEach(col => {
      console.log(`${col.Field.padEnd(20)} | ${col.Type.padEnd(15)} | ${col.Null.padEnd(4)} | ${col.Key.padEnd(3)} | ${col.Default || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

checkTableStructure();





