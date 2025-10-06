const mysql = require('mysql2/promise');

async function findRealBalances() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 FINDING REAL BALANCES FROM 11:59 AM TODAY');
    console.log('============================================\n');

    // Check if there are any backup tables or logs
    console.log('🔍 Checking for backup tables or logs...\n');

    // Check all tables in the database
    const [tables] = await pool.query('SHOW TABLES');
    console.log('📋 Available tables:');
    tables.forEach(table => {
      console.log(`   • ${Object.values(table)[0]}`);
    });
    console.log('');

    // Check if there are any audit logs or backup tables
    const backupTables = tables.filter(table => {
      const tableName = Object.values(table)[0];
      return tableName.includes('backup') || 
             tableName.includes('log') || 
             tableName.includes('audit') || 
             tableName.includes('history');
    });

    if (backupTables.length > 0) {
      console.log('📋 Found potential backup tables:');
      backupTables.forEach(table => {
        console.log(`   • ${Object.values(table)[0]}`);
      });
      console.log('');
    }

    // Check user_earnings_summary table for any historical data
    console.log('🔍 Checking user_earnings_summary table...\n');
    
    const [earningsSummary] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        ues.total_earnings,
        ues.this_month_earnings,
        u.wallet_balance
      FROM users u
      LEFT JOIN user_earnings_summary ues ON ues.user_id = u.id
      WHERE u.phone IN ('0707582934', '+254703730012', '+254705878793', '+254112174452')
      ORDER BY u.id
    `);

    console.log('📊 Earnings Summary Data:');
    earningsSummary.forEach(user => {
      console.log(`👤 ${user.name} (${user.phone})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Current Wallet: KES ${user.wallet_balance}`);
      console.log(`   Total Earnings: KES ${user.total_earnings || 0}`);
      console.log(`   This Month: KES ${user.this_month_earnings || 0}`);
      console.log('');
    });

    // Check task completions for earnings
    console.log('🔍 Checking task completions for earnings...\n');
    
    const [taskEarnings] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        SUM(tc.reward_amount) as total_task_earnings
      FROM users u
      LEFT JOIN task_completions tc ON tc.user_id = u.id
      WHERE u.phone IN ('0707582934', '+254703730012', '+254705878793', '+254112174452')
      GROUP BY u.id, u.name, u.phone
      ORDER BY u.id
    `);

    console.log('📊 Task Earnings Data:');
    taskEarnings.forEach(user => {
      console.log(`👤 ${user.name} (${user.phone})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Task Earnings: KES ${user.total_task_earnings || 0}`);
      console.log('');
    });

    // Check if there's any system that tracks balance changes
    console.log('🔍 Looking for balance change logs...\n');
    
    // Check notifications table for any balance-related notifications
    const [balanceNotifications] = await pool.query(`
      SELECT 
        user_id,
        message,
        created_at
      FROM notifications 
      WHERE message LIKE '%balance%' OR message LIKE '%KES%'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    if (balanceNotifications.length > 0) {
      console.log('📧 Balance-related notifications:');
      balanceNotifications.forEach(notif => {
        console.log(`   ${notif.created_at}: User ${notif.user_id} - ${notif.message}`);
      });
      console.log('');
    } else {
      console.log('❌ No balance-related notifications found');
    }

    // Ask user for the real balances
    console.log('❌ UNABLE TO FIND REAL BALANCES FROM DATABASE');
    console.log('');
    console.log('🔧 SOLUTION: Please provide the REAL balances that were at 11:59 AM today:');
    console.log('');
    console.log('👤 Key users that need real balances:');
    console.log('   • Eliezer Magati (0707582934)');
    console.log('   • CORNELIUS RUTO LONIKA (+254703730012)');
    console.log('   • DENIS PKIACH (+254705878793)');
    console.log('   • COSMAS SHIMWENYI MUSUNGU (+254112174452)');
    console.log('');
    console.log('💡 Please tell me the EXACT balances these users had at 11:59 AM today');

  } catch (error) {
    console.error('❌ Error finding real balances:', error.message);
  } finally {
    pool.end();
  }
}

findRealBalances();


