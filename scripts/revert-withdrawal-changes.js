const mysql = require('mysql2/promise');

async function revertWithdrawalChanges() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔄 REVERTING WITHDRAWAL CHANGES');
    console.log('==============================\n');

    // Get all withdrawals made today
    const [todaysWithdrawals] = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.status,
        w.requested_at,
        u.name,
        u.phone,
        u.wallet_balance
      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      WHERE DATE(w.requested_at) = CURDATE()
        AND w.status = 'approved'
      ORDER BY w.requested_at DESC
    `);

    console.log(`🔍 Found ${todaysWithdrawals.length} withdrawals to revert\n`);

    let reverted = 0;

    for (const withdrawal of todaysWithdrawals) {
      try {
        console.log(`👤 ${withdrawal.name} (${withdrawal.phone})`);
        console.log(`   Current Balance: KES ${withdrawal.wallet_balance}`);
        console.log(`   Withdrawal Amount: KES ${withdrawal.amount}`);
        
        // Remove the withdrawal amount from current balance (revert the change)
        const correctBalance = parseFloat(withdrawal.wallet_balance) - parseFloat(withdrawal.amount);
        
        console.log(`   Correct Balance: KES ${correctBalance}`);

        // Update the balance
        await pool.query(
          'UPDATE users SET wallet_balance = ? WHERE id = ?',
          [correctBalance, withdrawal.user_id]
        );

        console.log(`   ✅ Balance reverted to KES ${correctBalance}\n`);
        reverted++;

      } catch (error) {
        console.error(`   ❌ Error reverting ${withdrawal.name}:`, error.message);
        console.log('');
      }
    }

    // Summary
    console.log('📊 REVERSION SUMMARY');
    console.log('====================');
    console.log(`✅ Users reverted: ${reverted}`);
    console.log(`📋 Total withdrawals processed: ${todaysWithdrawals.length}`);

    console.log('\n🎉 Withdrawal changes reverted!');
    console.log('   • Users now have their balances as they were after their actual withdrawals');
    console.log('   • No fake amounts added');

  } catch (error) {
    console.error('❌ Error reverting withdrawal changes:', error.message);
  } finally {
    pool.end();
  }
}

revertWithdrawalChanges();


