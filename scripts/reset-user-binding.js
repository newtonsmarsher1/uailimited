const mysql = require('mysql2/promise');

async function resetUserBinding() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Resetting Binding Details for User 0706848124\n');
    
    // Get user details first
    const [user] = await pool.query(`
      SELECT id, name, phone, full_name, id_number, bank_type, account_number, wallet_balance
      FROM users 
      WHERE phone = '0706848124' OR phone = '+254706848124' OR phone LIKE '%706848124%'
    `);
    
    if (user.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const userData = user[0];
    
    console.log('📋 USER DETAILS BEFORE RESET:');
    console.log(`   Name: ${userData.name} (ID: ${userData.id})`);
    console.log(`   Phone: ${userData.phone}`);
    console.log(`   Full Name: ${userData.full_name || 'Not set'}`);
    console.log(`   ID Number: ${userData.id_number || 'Not set'}`);
    console.log(`   Bank Type: ${userData.bank_type || 'Not set'}`);
    console.log(`   Account Number: ${userData.account_number || 'Not set'}`);
    console.log(`   Wallet Balance: KES ${parseFloat(userData.wallet_balance).toFixed(2)}`);
    
    // Reset binding details (keep wallet balance and other info intact)
    await pool.query(`
      UPDATE users 
      SET 
        full_name = NULL,
        id_number = NULL,
        bank_type = NULL,
        account_number = NULL,
        withdrawal_pin = NULL,
        pin_attempts = 0,
        pin_locked_until = NULL
      WHERE id = ?
    `, [userData.id]);
    
    console.log('\n✅ BINDING DETAILS RESET SUCCESSFULLY!');
    console.log('   - Full Name: Cleared');
    console.log('   - ID Number: Cleared');
    console.log('   - Bank Type: Cleared');
    console.log('   - Account Number: Cleared');
    console.log('   - Withdrawal PIN: Cleared');
    console.log('   - PIN Attempts: Reset to 0');
    console.log('   - PIN Lock: Cleared');
    
    console.log('\n📌 User can now bind their withdrawal details again.');
    console.log('   Wallet balance and other account data remain intact.');
    
    // Verify the reset
    const [verifyUser] = await pool.query(`
      SELECT full_name, id_number, bank_type, account_number, withdrawal_pin
      FROM users WHERE id = ?
    `, [userData.id]);
    
    console.log('\n🔍 VERIFICATION:');
    console.log(`   Full Name: ${verifyUser[0].full_name || '✅ NULL'}`);
    console.log(`   ID Number: ${verifyUser[0].id_number || '✅ NULL'}`);
    console.log(`   Bank Type: ${verifyUser[0].bank_type || '✅ NULL'}`);
    console.log(`   Account Number: ${verifyUser[0].account_number || '✅ NULL'}`);
    console.log(`   Withdrawal PIN: ${verifyUser[0].withdrawal_pin || '✅ NULL'}`);
    
  } catch (error) {
    console.error('❌ Error resetting binding:', error.message);
  } finally {
    pool.end();
  }
}

resetUserBinding();




