const mysql = require('mysql2/promise');

async function checkWithdrawalsTable() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 CHECKING WITHDRAWALS TABLE STRUCTURE');
    console.log('======================================\n');

    // Check table structure
    const [columns] = await pool.query('DESCRIBE withdrawals');
    
    console.log('📋 Withdrawals table structure:');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''}`);
    });
    console.log('');

    // Get recent withdrawals
    const [recentWithdrawals] = await pool.query(`
      SELECT *
      FROM withdrawals 
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log('📊 Recent withdrawals:');
    recentWithdrawals.forEach(withdrawal => {
      console.log(`💰 ID: ${withdrawal.id}, User: ${withdrawal.user_id}, Amount: ${withdrawal.amount}, Status: ${withdrawal.status}`);
    });
    console.log('');

    // Get withdrawals from today (using whatever date column exists)
    const [todaysWithdrawals] = await pool.query(`
      SELECT *
      FROM withdrawals 
      WHERE DATE(request_date) = CURDATE() OR DATE(created_at) = CURDATE() OR DATE(updated_at) = CURDATE()
      ORDER BY id DESC
    `);

    console.log(`📊 Today's withdrawals: ${todaysWithdrawals.length}`);
    todaysWithdrawals.forEach(withdrawal => {
      console.log(`💰 ${withdrawal.user_id}: KES ${withdrawal.amount} (${withdrawal.status})`);
    });

  } catch (error) {
    console.error('❌ Error checking withdrawals table:', error.message);
  } finally {
    pool.end();
  }
}

checkWithdrawalsTable();


