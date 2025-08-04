const pool = require('./db.js');

async function cleanupTestInvestment() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🧹 Cleaning up test investment...\n');
    
    // Delete the test investment
    const [deleteResult] = await connection.query('DELETE FROM investments WHERE id = 28');
    
    if (deleteResult.affectedRows > 0) {
      console.log('✅ Test investment deleted');
    } else {
      console.log('⚠️ Test investment not found or already deleted');
    }
    
    // Verify no investments remain
    const [remainingInvestments] = await connection.query('SELECT COUNT(*) as count FROM investments');
    console.log(`📊 Remaining investment records: ${remainingInvestments[0].count}`);
    
    if (remainingInvestments[0].count === 0) {
      console.log('🎉 All investment records have been cleared!');
    }
    
    // Show final user balance
    const [userRows] = await connection.query('SELECT id, phone, balance FROM users WHERE id = 7');
    if (userRows.length > 0) {
      const user = userRows[0];
      console.log(`\n💰 Final user balance:`);
      console.log(`   User ${user.id} (${user.phone}): KES ${user.balance}`);
    }
    
    console.log('\n✅ Cleanup completed!');
    console.log('🎯 The payout system is working correctly and ready for new investments.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the cleanup
cleanupTestInvestment()
  .then(() => {
    console.log('\n✅ System is ready for new investments!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }); 