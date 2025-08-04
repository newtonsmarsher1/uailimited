const pool = require('./db.js');

async function createTestInvestment() {
  try {
    console.log('🧪 Creating test investment...');
    
    // Create a test investment that will mature in 1 minute
    const testInvestment = {
      user_id: 1, // Assuming user ID 1 exists
      fund_name: 'UAI Starter Fund',
      amount: 100.00,
      roi_percentage: 2.3,
      duration_days: 1, // 1 day for testing
      wallet_type: 'main',
      status: 'active'
    };
    
    // Insert the test investment
    const [result] = await pool.query(`
      INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, wallet_type, status, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
    `, [
      testInvestment.user_id,
      testInvestment.fund_name,
      testInvestment.amount,
      testInvestment.roi_percentage,
      testInvestment.duration_days,
      testInvestment.wallet_type,
      testInvestment.status,
      testInvestment.duration_days
    ]);
    
    console.log(`✅ Test investment created with ID: ${result.insertId}`);
    
    // Show the created investment
    const [investments] = await pool.query(`
      SELECT * FROM investments WHERE id = ?
    `, [result.insertId]);
    
    if (investments.length > 0) {
      const inv = investments[0];
      console.log('📋 Test investment details:');
      console.log(`  ID: ${inv.id}`);
      console.log(`  Fund: ${inv.fund_name}`);
      console.log(`  Amount: KES ${inv.amount}`);
      console.log(`  ROI: ${inv.roi_percentage}% daily`);
      console.log(`  Duration: ${inv.duration_days} days`);
      console.log(`  Start: ${new Date(inv.start_date).toLocaleString()}`);
      console.log(`  End: ${new Date(inv.end_date).toLocaleString()}`);
      console.log(`  Status: ${inv.status}`);
    }
    
    console.log('💡 This investment will mature in 1 day. You can test the payout processing then.');
    
  } catch (error) {
    console.error('❌ Error creating test investment:', error);
  } finally {
    process.exit(0);
  }
}

createTestInvestment(); 