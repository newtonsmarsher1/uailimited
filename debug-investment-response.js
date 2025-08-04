const pool = require('./db.js');

async function debugInvestmentResponse() {
  try {
    console.log('🔍 Debugging investment response...');
    
    // Check if there are any recent investments
    const [investments] = await pool.query(`
      SELECT id, fund_name, amount, status, created_at, user_id
      FROM investments 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log(`📊 Recent investments: ${investments.length}`);
    investments.forEach(inv => {
      console.log(`  ID: ${inv.id}, Fund: ${inv.fund_name}, Amount: ${inv.amount}, Status: ${inv.status}, User: ${inv.user_id}`);
    });
    
    // Check user balance
    const [users] = await pool.query(`
      SELECT id, phone, balance 
      FROM users 
      WHERE id = 7
    `);
    
    if (users.length > 0) {
      console.log(`💰 User 7 balance: KES ${users[0].balance}`);
    }
    
    // Test the investment API directly
    console.log('\n🧪 Testing investment API...');
    
    // Simulate the exact request that the frontend makes
    const testInvestment = {
      userId: 7,
      fundName: 'UAI Starter Fund',
      amount: 50,
      walletType: 'main'
    };
    
    // Get user balance first
    const [userRows] = await pool.query(
      'SELECT balance FROM users WHERE id = ?',
      [testInvestment.userId]
    );
    
    if (userRows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const currentBalance = parseFloat(userRows[0].balance || 0);
    console.log(`💰 Current balance: KES ${currentBalance}`);
    
    if (currentBalance < testInvestment.amount) {
      console.log(`❌ Insufficient balance. Available: KES ${currentBalance}, Required: KES ${testInvestment.amount}`);
      return;
    }
    
    // Define fund details
    const fundDetails = {
      'UAI Starter Fund': { roi: 2.3, duration: 10 }
    };
    
    const fundInfo = fundDetails[testInvestment.fundName];
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
      
      // Create investment record
      const [result] = await connection.query(
        'INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, wallet_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, "active")',
        [testInvestment.userId, testInvestment.fundName, testInvestment.amount, fundInfo.roi, fundInfo.duration, testInvestment.walletType, endDate]
      );
      
      console.log(`✅ Investment created with ID: ${result.insertId}`);
      
      await connection.commit();
      console.log('✅ Transaction committed successfully');
      
      // Create the response object exactly like the server does
      const response = {
        success: true,
        message: 'Investment processed successfully',
        newBalance: newBalance,
        investment: {
          fundName: testInvestment.fundName,
          amount: testInvestment.amount,
          roi: fundInfo.roi,
          duration: fundInfo.duration,
          expectedReturn: testInvestment.amount * (1 + (fundInfo.roi / 100) * fundInfo.duration)
        }
      };
      
      console.log('📤 Response object:');
      console.log(JSON.stringify(response, null, 2));
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Transaction failed:', error.message);
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    process.exit(0);
  }
}

debugInvestmentResponse(); 