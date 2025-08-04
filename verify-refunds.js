const pool = require('./db.js');

async function verifyRefunds() {
  try {
    console.log('🔍 Verifying refunds and user balances...');
    
    // Check all users and their balances
    const [users] = await pool.query(`
      SELECT 
        id, 
        phone, 
        balance,
        name
      FROM users 
      ORDER BY id
    `);
    
    console.log(`📊 Found ${users.length} users:`);
    
    let totalSystemBalance = 0;
    users.forEach(user => {
      const balance = parseFloat(user.balance || 0);
      totalSystemBalance += balance;
      console.log(`   User ${user.id} (${user.phone}): KES ${balance.toFixed(2)}`);
    });
    
    console.log(`\n💰 Total System Balance: KES ${totalSystemBalance.toFixed(2)}`);
    
    // Check if any investments remain
    const [investments] = await pool.query('SELECT COUNT(*) as count FROM investments');
    console.log(`📊 Remaining investment records: ${investments[0].count}`);
    
    if (investments[0].count === 0) {
      console.log('✅ All investment records have been cleared');
    } else {
      console.log('⚠️  Some investment records still exist');
    }
    
    // Check if any active investments exist
    const [activeInvestments] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM investments 
      WHERE paid_out = FALSE
    `);
    
    console.log(`📊 Active investments: ${activeInvestments[0].count}`);
    
    if (activeInvestments[0].count === 0) {
      console.log('✅ No active investments remain - all money has been refunded');
    } else {
      console.log('⚠️  Some active investments still exist');
    }
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying refunds:', error);
  } finally {
    process.exit(0);
  }
}

verifyRefunds(); 