const pool = require('./db.js');

async function deleteAllInvestments() {
  try {
    console.log('🗑️ Deleting all investment records...');
    
    // First, show current investment count
    const [currentCount] = await pool.query('SELECT COUNT(*) as count FROM investments');
    console.log(`📊 Current investment records: ${currentCount[0].count}`);
    
    if (currentCount[0].count === 0) {
      console.log('✅ No investment records to delete');
      return;
    }
    
    // Show investment summary before deletion
    const [investments] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(amount) as total_amount,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM investments
    `);
    
    const summary = investments[0];
    console.log('\n📋 Investment Summary:');
    console.log(`   Total Investments: ${summary.total}`);
    console.log(`   Total Amount: KES ${parseFloat(summary.total_amount || 0).toFixed(2)}`);
    console.log(`   Active: ${summary.active}`);
    console.log(`   Completed: ${summary.completed}`);
    console.log(`   Cancelled: ${summary.cancelled}`);
    
    // Confirm deletion
    console.log('\n⚠️  WARNING: This will permanently delete ALL investment records!');
    console.log('   This action cannot be undone.');
    
    // Delete all investment records
    const [result] = await pool.query('DELETE FROM investments');
    
    console.log(`\n✅ Successfully deleted ${result.affectedRows} investment records`);
    
    // Verify deletion
    const [finalCount] = await pool.query('SELECT COUNT(*) as count FROM investments');
    console.log(`📊 Remaining investment records: ${finalCount[0].count}`);
    
    if (finalCount[0].count === 0) {
      console.log('✅ All investment records have been completely removed');
    } else {
      console.log('⚠️  Some investment records still remain');
    }
    
  } catch (error) {
    console.error('❌ Error deleting investments:', error);
  } finally {
    process.exit(0);
  }
}

deleteAllInvestments(); 