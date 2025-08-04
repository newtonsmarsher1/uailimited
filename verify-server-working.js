const pool = require('./db.js');

async function verifyServerWorking() {
  try {
    console.log('🔍 Verifying server is working...');
    
    // Test database connection
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Database connected. Users: ${users[0].count}`);
    
    // Test investment creation
    const [investments] = await pool.query('SELECT COUNT(*) as count FROM investments');
    console.log(`✅ Investments table accessible. Records: ${investments[0].count}`);
    
    // Check latest investment
    const [latestInvestment] = await pool.query(`
      SELECT id, fund_name, amount, status, created_at 
      FROM investments 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (latestInvestment.length > 0) {
      const inv = latestInvestment[0];
      console.log(`✅ Latest investment: ID ${inv.id}, ${inv.fund_name}, KES ${inv.amount}, Status: ${inv.status}`);
    }
    
    console.log('✅ Server is working properly!');
    console.log('🌐 You can now test investments at: http://localhost:3000/financial-management-fund.html');
    console.log('🧪 Or use the test page: http://localhost:3000/test-login-investment.html');
    
  } catch (error) {
    console.error('❌ Server verification failed:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyServerWorking(); 