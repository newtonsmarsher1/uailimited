const mysql = require('mysql2/promise');

async function recoverApprovedWithdrawals() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Checking Withdrawal Backup Table\n');
    
    // Check the backup table
    const [backupRecords] = await pool.query(`
      SELECT * FROM withdrawals_backup_reset
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log('📊 BACKUP TABLE STRUCTURE:');
    if (backupRecords.length > 0) {
      console.log('Columns:', Object.keys(backupRecords[0]).join(', '));
      console.log(`\nFound ${backupRecords.length} recent records in backup\n`);
    } else {
      console.log('❌ Backup table is empty');
    }
    
    // Count approved withdrawals in backup
    const [backupApproved] = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM withdrawals_backup_reset 
      WHERE status = 'approved'
    `);
    
    console.log('📋 APPROVED WITHDRAWALS IN BACKUP:');
    console.log(`   Count: ${backupApproved[0].count}`);
    console.log(`   Total Amount: KES ${parseFloat(backupApproved[0].total || 0).toFixed(2)}`);
    
    // Get all approved withdrawals from backup
    const [approvedWithdrawals] = await pool.query(`
      SELECT * 
      FROM withdrawals_backup_reset 
      WHERE status = 'approved'
      ORDER BY id ASC
    `);
    
    if (approvedWithdrawals.length === 0) {
      console.log('\n❌ No approved withdrawals found in backup table');
      return;
    }
    
    console.log(`\n📋 APPROVED WITHDRAWALS TO RESTORE (${approvedWithdrawals.length} records):`);
    approvedWithdrawals.slice(0, 10).forEach((w, idx) => {
      console.log(`   ${idx + 1}. ID: ${w.id}, Amount: KES ${w.amount}, Status: ${w.status}`);
      console.log(`      Requested: ${w.requested_at}, Processed: ${w.processed_at || 'N/A'}`);
    });
    
    if (approvedWithdrawals.length > 10) {
      console.log(`   ... and ${approvedWithdrawals.length - 10} more`);
    }
    
    // Check current withdrawals table
    const [currentApproved] = await pool.query(`
      SELECT COUNT(*) as count
      FROM withdrawals 
      WHERE status = 'approved'
    `);
    
    console.log(`\n📊 CURRENT APPROVED WITHDRAWALS IN MAIN TABLE: ${currentApproved[0].count}`);
    
    if (currentApproved[0].count === 0 && approvedWithdrawals.length > 0) {
      console.log('\n⚠️  RESTORATION READY:');
      console.log(`   Found ${approvedWithdrawals.length} approved withdrawals in backup`);
      console.log(`   Main table has 0 approved withdrawals`);
      console.log(`   Total to restore: KES ${parseFloat(backupApproved[0].total).toFixed(2)}`);
      console.log('\n   Ready to restore? This will:');
      console.log('   1. Copy all approved withdrawals from backup to main table');
      console.log('   2. Preserve all original data (IDs, dates, amounts, etc.)');
    } else if (currentApproved[0].count > 0) {
      console.log('\n✅ Main table already has approved withdrawals');
      console.log('   No restoration needed or data already restored');
    }
    
  } catch (error) {
    console.error('❌ Error checking backup:', error.message);
  } finally {
    pool.end();
  }
}

recoverApprovedWithdrawals();




