const mysql = require('mysql2/promise');

async function checkBackupTables() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 CHECKING BACKUP TABLES FOR REAL BALANCES');
    console.log('===========================================\n');

    // Check users_backup_reset table
    console.log('🔍 Checking users_backup_reset table...\n');
    
    const [backupUsers] = await pool.query(`
      SELECT 
        id,
        name,
        phone,
        wallet_balance,
        level,
        created_at
      FROM users_backup_reset 
      WHERE phone IN ('0707582934', '+254703730012', '+254705878793', '+254112174452')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (backupUsers.length > 0) {
      console.log('📊 Found backup user data:');
      backupUsers.forEach(user => {
        console.log(`👤 ${user.name} (${user.phone})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Wallet Balance: KES ${user.wallet_balance}`);
        console.log(`   Level: ${user.level}`);
        console.log(`   Backup Date: ${user.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No backup user data found\n');
    }

    // Check daily_reset_log table
    console.log('🔍 Checking daily_reset_log table...\n');
    
    const [dailyLogs] = await pool.query(`
      SELECT *
      FROM daily_reset_log 
      WHERE DATE(created_at) = CURDATE()
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (dailyLogs.length > 0) {
      console.log('📊 Found daily reset logs:');
      dailyLogs.forEach(log => {
        console.log(`📅 ${log.created_at}: ${JSON.stringify(log)}`);
      });
      console.log('');
    } else {
      console.log('❌ No daily reset logs found for today\n');
    }

    // Check monthly_reset_log table
    console.log('🔍 Checking monthly_reset_log table...\n');
    
    const [monthlyLogs] = await pool.query(`
      SELECT *
      FROM monthly_reset_log 
      WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (monthlyLogs.length > 0) {
      console.log('📊 Found monthly reset logs:');
      monthlyLogs.forEach(log => {
        console.log(`📅 ${log.created_at}: ${JSON.stringify(log)}`);
      });
      console.log('');
    } else {
      console.log('❌ No recent monthly reset logs found\n');
    }

    // Check if there are any recent backup entries
    console.log('🔍 Checking for recent backups...\n');
    
    const [recentBackups] = await pool.query(`
      SELECT 
        'users_backup_reset' as table_name,
        COUNT(*) as count,
        MAX(created_at) as latest_backup
      FROM users_backup_reset
      WHERE DATE(created_at) = CURDATE()
      
      UNION ALL
      
      SELECT 
        'payments_backup_reset' as table_name,
        COUNT(*) as count,
        MAX(created_at) as latest_backup
      FROM payments_backup_reset
      WHERE DATE(created_at) = CURDATE()
      
      UNION ALL
      
      SELECT 
        'referral_rewards_backup_reset' as table_name,
        COUNT(*) as count,
        MAX(created_at) as latest_backup
      FROM referral_rewards_backup_reset
      WHERE DATE(created_at) = CURDATE()
    `);

    console.log('📊 Today\'s backup summary:');
    recentBackups.forEach(backup => {
      console.log(`   • ${backup.table_name}: ${backup.count} records (latest: ${backup.latest_backup})`);
    });
    console.log('');

    // If we found backup data, show the most recent balances
    if (backupUsers.length > 0) {
      console.log('✅ FOUND REAL BALANCES FROM BACKUP!\n');
      console.log('🔧 These are the REAL balances from backup:');
      console.log('');
      
      // Get the most recent backup for each user
      const [latestBackups] = await pool.query(`
        SELECT 
          phone,
          name,
          wallet_balance,
          level,
          created_at
        FROM users_backup_reset 
        WHERE phone IN ('0707582934', '+254703730012', '+254705878793', '+254112174452')
          AND created_at = (
            SELECT MAX(created_at) 
            FROM users_backup_reset u2 
            WHERE u2.phone = users_backup_reset.phone
          )
        ORDER BY phone
      `);

      console.log('👤 REAL BALANCES FROM BACKUP:');
      latestBackups.forEach(user => {
        console.log(`   • ${user.name} (${user.phone}): KES ${user.wallet_balance} (Level ${user.level})`);
      });
      
      console.log('\n💡 These are the ACTUAL balances that should be restored!');
    } else {
      console.log('❌ NO BACKUP DATA FOUND');
      console.log('');
      console.log('🔧 MANUAL SOLUTION REQUIRED:');
      console.log('');
      console.log('Since I cannot find the real balances from 11:59 AM today,');
      console.log('please provide the EXACT balances these users had:');
      console.log('');
      console.log('👤 Users needing real balance restoration:');
      console.log('   • Eliezer Magati (0707582934)');
      console.log('   • CORNELIUS RUTO LONIKA (+254703730012)');
      console.log('   • DENIS PKIACH (+254705878793)');
      console.log('   • COSMAS SHIMWENYI MUSUNGU (+254112174452)');
      console.log('');
      console.log('💡 Please tell me the REAL balances they had at 11:59 AM today');
    }

  } catch (error) {
    console.error('❌ Error checking backup tables:', error.message);
  } finally {
    pool.end();
  }
}

checkBackupTables();


