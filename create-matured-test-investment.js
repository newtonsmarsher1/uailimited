const pool = require('./db.js');

async function createMaturedTestInvestment() {
  try {
    console.log('🧪 Creating matured test investment...');
    
         // Create a test investment that has already matured (started 2 days ago, duration 1 day)
     const testInvestment = {
       user_id: 7, // Use existing user ID
      fund_name: 'UAI Starter Fund',
      amount: 100.00,
      roi_percentage: 2.3,
      duration_days: 1, // 1 day duration
      wallet_type: 'main',
      status: 'active'
    };
    
    // Calculate start date as 2 days ago (so it matured yesterday)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2);
    
    // Calculate end date as 1 day after start
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // Insert the matured test investment
    const [result] = await pool.query(`
      INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, wallet_type, status, start_date, end_date, paid_out)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
    `, [
      testInvestment.user_id,
      testInvestment.fund_name,
      testInvestment.amount,
      testInvestment.roi_percentage,
      testInvestment.duration_days,
      testInvestment.wallet_type,
      testInvestment.status,
      startDate,
      endDate
    ]);
    
    console.log(`✅ Matured test investment created with ID: ${result.insertId}`);
    
    // Show the created investment
    const [investments] = await pool.query(`
      SELECT * FROM investments WHERE id = ?
    `, [result.insertId]);
    
    if (investments.length > 0) {
      const inv = investments[0];
      console.log('📋 Matured test investment details:');
      console.log(`  ID: ${inv.id}`);
      console.log(`  Fund: ${inv.fund_name}`);
      console.log(`  Amount: KES ${inv.amount}`);
      console.log(`  ROI: ${inv.roi_percentage}% daily`);
      console.log(`  Duration: ${inv.duration_days} days`);
      console.log(`  Start: ${new Date(inv.start_date).toLocaleString()}`);
      console.log(`  End: ${new Date(inv.end_date).toLocaleString()}`);
      console.log(`  Status: ${inv.status}`);
      console.log(`  Paid Out: ${inv.paid_out}`);
      
      // Calculate expected payout
      const interestAmount = inv.amount * (inv.roi_percentage / 100) * inv.duration_days;
      const totalPayout = inv.amount + interestAmount;
      console.log(`  Expected Payout: KES ${totalPayout.toFixed(2)} (Principal: ${inv.amount} + Interest: ${interestAmount.toFixed(2)})`);
    }
    
    console.log('💡 This investment has already matured and should be processed for payout.');
    
  } catch (error) {
    console.error('❌ Error creating matured test investment:', error);
  } finally {
    process.exit(0);
  }
}

createMaturedTestInvestment(); 