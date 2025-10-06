const mysql = require('mysql2/promise');

async function restoreWilliamBalance() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 RESTORING WILLIAM\'S BALANCE AFTER WITHDRAWAL');
    console.log('==============================================\n');

    // Get William's current balance and withdrawal amount
    const [williamInfo] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.wallet_balance,
        w.amount as withdrawal_amount
      FROM users u
      LEFT JOIN withdrawals w ON w.user_id = u.id 
        AND DATE(w.requested_at) = CURDATE() 
        AND w.status = 'approved'
      WHERE u.phone = '0720868337'
    `);

    if (williamInfo.length === 0) {
      console.log('❌ William not found');
      return;
    }

    const william = williamInfo[0];
    console.log('👤 WILLIAM\'S CURRENT INFO:');
    console.log(`   Name: ${william.name}`);
    console.log(`   Phone: ${william.phone}`);
    console.log(`   Current Balance: KES ${william.wallet_balance}`);
    console.log(`   Today's Withdrawal: KES ${william.withdrawal_amount || 0}`);
    console.log('');

    if (!william.withdrawal_amount) {
      console.log('❌ No withdrawal found for William today');
      return;
    }

    // Calculate the balance after withdrawal
    const balanceAfterWithdrawal = parseFloat(william.wallet_balance) - parseFloat(william.withdrawal_amount);
    
    console.log('🔧 CALCULATING BALANCE AFTER WITHDRAWAL:');
    console.log(`   Current Balance: KES ${william.wallet_balance}`);
    console.log(`   Withdrawal Amount: KES ${william.withdrawal_amount}`);
    console.log(`   Balance After Withdrawal: KES ${balanceAfterWithdrawal}`);
    console.log('');

    // Update William's balance
    await pool.query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [balanceAfterWithdrawal, william.id]
    );

    console.log('✅ WILLIAM\'S BALANCE RESTORED:');
    console.log(`   New Balance: KES ${balanceAfterWithdrawal}`);
    console.log('');
    console.log('🎉 William now has his balance as it was after his withdrawal today!');

  } catch (error) {
    console.error('❌ Error restoring William\'s balance:', error.message);
  } finally {
    pool.end();
  }
}

restoreWilliamBalance();


