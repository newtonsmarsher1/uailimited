const pool = require('./db.js');

async function testPayoutSystem() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🧪 Testing payout system...\n');
    
    // First, let's create a test investment that has already matured
    console.log('📝 Creating test matured investment...');
    
    const testUserId = 7; // Use existing user
    const testAmount = 100;
    const testFund = 'UAI Starter Fund';
    const testROI = 2.3; // 2.3% daily
    const testDuration = 10; // 10 days
    
    // Set start date to 11 days ago (so it's matured)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 11);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + testDuration);
    
    // Insert test investment
    const [insertResult] = await connection.query(`
      INSERT INTO investments (
        user_id, 
        fund_name, 
        amount, 
        roi_percentage, 
        duration_days, 
        wallet_type, 
        start_date, 
        end_date, 
        status, 
        paid_out
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', FALSE)
    `, [testUserId, testFund, testAmount, testROI, testDuration, 'main', startDate, endDate]);
    
    const investmentId = insertResult.insertId;
    console.log(`✅ Created test investment ID: ${investmentId}`);
    console.log(`   User: ${testUserId}`);
    console.log(`   Amount: KES ${testAmount}`);
    console.log(`   Start Date: ${startDate.toLocaleString()}`);
    console.log(`   End Date: ${endDate.toLocaleString()}`);
    console.log(`   Status: matured (end date is in the past)`);
    
    // Get user's current balance
    const [userRows] = await connection.query('SELECT balance FROM users WHERE id = ?', [testUserId]);
    const currentBalance = userRows[0].balance;
    console.log(`💰 User's current balance: KES ${currentBalance}`);
    
    // Now test the payout processing
    console.log('\n🔄 Testing payout processing...');
    
    // Import and run the payout processor
    const { processInvestmentPayouts } = require('./process-investment-payouts.js');
    await processInvestmentPayouts();
    
    // Check if the investment was processed
    const [processedInvestment] = await connection.query(`
      SELECT id, status, paid_out, paid_at, amount, roi_percentage, duration_days
      FROM investments WHERE id = ?
    `, [investmentId]);
    
    if (processedInvestment.length > 0) {
      const inv = processedInvestment[0];
      console.log(`\n📊 Investment processing result:`);
      console.log(`   Status: ${inv.status}`);
      console.log(`   Paid Out: ${inv.paid_out ? 'Yes' : 'No'}`);
      console.log(`   Paid At: ${inv.paid_at ? new Date(inv.paid_at).toLocaleString() : 'Not paid'}`);
      
      if (inv.paid_out) {
        // Calculate expected payout
        const principal = parseFloat(inv.amount);
        const dailyROI = inv.roi_percentage / 100;
        const totalROI = dailyROI * inv.duration_days;
        const interest = principal * totalROI;
        const totalPayout = principal + interest;
        
        console.log(`   Principal: KES ${principal.toFixed(2)}`);
        console.log(`   Interest: KES ${interest.toFixed(2)}`);
        console.log(`   Total Payout: KES ${totalPayout.toFixed(2)}`);
        
        // Check user's new balance
        const [newUserRows] = await connection.query('SELECT balance FROM users WHERE id = ?', [testUserId]);
        const newBalance = newUserRows[0].balance;
        console.log(`💰 User's new balance: KES ${newBalance}`);
        
        const expectedNewBalance = currentBalance + totalPayout;
        console.log(`💰 Expected new balance: KES ${expectedNewBalance}`);
        
        if (Math.abs(newBalance - expectedNewBalance) < 0.01) {
          console.log('✅ Payout system is working correctly!');
        } else {
          console.log('❌ Payout system has an issue - balance not updated correctly');
        }
      } else {
        console.log('❌ Investment was not processed for payout');
      }
    }
    
    // Check for notifications
    const [notifications] = await connection.query(`
      SELECT message, created_at 
      FROM notifications 
      WHERE user_id = ? AND message LIKE '%Investment matured%'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [testUserId]);
    
    if (notifications.length > 0) {
      console.log(`\n📢 Notification sent: ${notifications[0].message}`);
    } else {
      console.log('\n⚠️ No payout notification found');
    }
    
  } catch (error) {
    console.error('❌ Error testing payout system:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the test
testPayoutSystem()
  .then(() => {
    console.log('\n✅ Payout system test completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }); 