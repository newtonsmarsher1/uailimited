const mysql = require('mysql2/promise');

async function checkReferralRewardsTable() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Checking referral_rewards table structure...\n');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'referral_rewards'"
    );

    if (tables.length === 0) {
      console.log('❌ referral_rewards table does not exist');
      return;
    }

    console.log('✅ referral_rewards table exists');

    // Get table structure
    const [columns] = await pool.query(
      'DESCRIBE referral_rewards'
    );

    console.log('\n📋 Table structure:');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''}`);
    });

    // Check existing data
    const [existingData] = await pool.query(
      'SELECT COUNT(*) as count FROM referral_rewards'
    );

    console.log(`\n📊 Existing records: ${existingData[0].count}`);

    if (existingData[0].count > 0) {
      const [sampleData] = await pool.query(
        'SELECT * FROM referral_rewards LIMIT 3'
      );
      
      console.log('\n📄 Sample data:');
      sampleData.forEach((row, index) => {
        console.log(`   Record ${index + 1}:`, row);
      });
    }

  } catch (error) {
    console.error('❌ Error checking table:', error.message);
  } finally {
    pool.end();
  }
}

checkReferralRewardsTable();


