const pool = require('./db.js');

async function testInvestmentCreation() {
  try {
    console.log('🧪 Testing investment creation...');
    
    // Test data
    const testInvestment = {
      userId: 7, // Use existing user
      fundName: 'UAI Starter Fund',
      amount: 100.00,
      walletType: 'main'
    };
    
    console.log('📋 Test investment details:');
    console.log(`  User ID: ${testInvestment.userId}`);
    console.log(`  Fund: ${testInvestment.fundName}`);
    console.log(`  Amount: KES ${testInvestment.amount}`);
    console.log(`  Wallet: ${testInvestment.walletType}`);
    
    // Check user balance first
    const [userRows] = await pool.query(
      'SELECT balance FROM users WHERE id = ?',
      [testInvestment.userId]
    );
    
    if (userRows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const currentBalance = parseFloat(userRows[0].balance || 0);
    
    console.log(`💰 User balance: KES ${currentBalance}`);
    
    // Check if user has sufficient balance
    if (currentBalance < testInvestment.amount) {
      console.log(`❌ Insufficient balance. Available: KES ${currentBalance}, Required: KES ${testInvestment.amount}`);
      return;
    }
    
    // Define fund details
    const fundDetails = {
      'UAI Starter Fund': { roi: 2.3, duration: 10 },
      'UAI Micro Fund': { roi: 2.5, duration: 15 },
      'Agriculture Fund': { roi: 2.7, duration: 20 },
      'Tech Growth Fund': { roi: 2.8, duration: 25 },
      'Crypto Mining Fund': { roi: 3.5, duration: 45 },
      'Real Estate Fund': { roi: 3.2, duration: 60 },
      'Wells Fargo': { roi: 2.9, duration: 30 },
      'Citibank': { roi: 3.0, duration: 40 },
      'Gold Investment Fund': { roi: 3.8, duration: 90 },
      'Diamond Elite Fund': { roi: 4.5, duration: 120 }
    };
    
    const fundInfo = fundDetails[testInvestment.fundName];
    if (!fundInfo) {
      console.log('❌ Invalid fund name');
      return;
    }
    
    console.log(`📊 Fund details - ROI: ${fundInfo.roi}%, Duration: ${fundInfo.duration} days`);
    
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Deduct amount from wallet
      const newBalance = currentBalance - testInvestment.amount;
      await connection.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, testInvestment.userId]);
      console.log(`✅ Balance updated to KES ${newBalance}`);
      
      // Calculate end_date
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + fundInfo.duration);
      
      console.log(`📅 Start date: ${startDate.toLocaleString()}`);
      console.log(`📅 End date: ${endDate.toLocaleString()}`);
      
      // Create investment record
      const [result] = await connection.query(
        'INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, wallet_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, "active")',
        [testInvestment.userId, testInvestment.fundName, testInvestment.amount, fundInfo.roi, fundInfo.duration, testInvestment.walletType, endDate]
      );
      
      console.log(`✅ Investment created with ID: ${result.insertId}`);
      
      await connection.commit();
      console.log('✅ Transaction committed successfully');
      
      // Show the created investment
      const [investments] = await pool.query(`
        SELECT * FROM investments WHERE id = ?
      `, [result.insertId]);
      
      if (investments.length > 0) {
        const inv = investments[0];
        console.log('\n📋 Created investment details:');
        console.log(`  ID: ${inv.id}`);
        console.log(`  Fund: ${inv.fund_name}`);
        console.log(`  Amount: KES ${inv.amount}`);
        console.log(`  ROI: ${inv.roi_percentage}% daily`);
        console.log(`  Duration: ${inv.duration_days} days`);
        console.log(`  Start: ${new Date(inv.start_date).toLocaleString()}`);
        console.log(`  End: ${new Date(inv.end_date).toLocaleString()}`);
        console.log(`  Status: ${inv.status}`);
        console.log(`  Wallet Type: ${inv.wallet_type}`);
      }
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Transaction failed:', error);
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error testing investment creation:', error);
  } finally {
    process.exit(0);
  }
}

testInvestmentCreation(); 