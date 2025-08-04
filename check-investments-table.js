const pool = require('./db.js');

async function checkInvestmentsTable() {
  try {
    console.log('🔍 Checking investments table structure...');
    
    // Check if table exists and get its structure
    const [tableInfo] = await pool.query(`
      DESCRIBE investments
    `);
    
    console.log('📋 Investments table structure:');
    tableInfo.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
    });
    
    // Check if there are any investments
    const [investments] = await pool.query(`
      SELECT COUNT(*) as count FROM investments
    `);
    
    console.log(`📊 Total investments: ${investments[0].count}`);
    
    if (investments[0].count > 0) {
      const [sampleInvestments] = await pool.query(`
        SELECT * FROM investments LIMIT 3
      `);
      
      console.log('📋 Sample investments:');
      sampleInvestments.forEach(inv => {
        console.log(`  ID: ${inv.id}, Fund: ${inv.fund_name}, Amount: ${inv.amount}, Start: ${inv.start_date}, End: ${inv.end_date}, Status: ${inv.status}, Paid: ${inv.paid_out}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking investments table:', error);
  } finally {
    process.exit(0);
  }
}

checkInvestmentsTable(); 