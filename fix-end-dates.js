const pool = require('./db.js');

async function fixEndDates() {
  try {
    console.log('🔧 Fixing investment end dates...');
    
    // Get all investments that need end date fixes
    const [investments] = await pool.query(`
      SELECT id, start_date, duration_days, end_date 
      FROM investments 
      ORDER BY id
    `);
    
    console.log(`📊 Found ${investments.length} investments to check`);
    
    for (const investment of investments) {
      const startDate = new Date(investment.start_date);
      const calculatedEndDate = new Date(startDate.getTime() + (investment.duration_days * 24 * 60 * 60 * 1000));
      
      console.log(`📅 Investment ${investment.id}:`);
      console.log(`   Start: ${startDate.toLocaleDateString()}`);
      console.log(`   Duration: ${investment.duration_days} days`);
      console.log(`   Current End: ${investment.end_date ? new Date(investment.end_date).toLocaleDateString() : 'NULL'}`);
      console.log(`   Calculated End: ${calculatedEndDate.toLocaleDateString()}`);
      
      // Update the end date
      await pool.query(`
        UPDATE investments 
        SET end_date = ? 
        WHERE id = ?
      `, [calculatedEndDate, investment.id]);
      
      console.log(`   ✅ Updated end date`);
    }
    
    console.log('✅ All end dates fixed!');
    
    // Show some sample investments after fix
    const [sampleInvestments] = await pool.query(`
      SELECT id, fund_name, start_date, end_date, duration_days, status 
      FROM investments 
      ORDER BY id 
      LIMIT 5
    `);
    
    console.log('📋 Sample investments after fix:');
    sampleInvestments.forEach(inv => {
      const startDate = new Date(inv.start_date);
      const endDate = new Date(inv.end_date);
      const now = new Date();
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      console.log(`  ID: ${inv.id}, Fund: ${inv.fund_name}`);
      console.log(`    Start: ${startDate.toLocaleDateString()}, End: ${endDate.toLocaleDateString()}`);
      console.log(`    Status: ${inv.status}, Days Remaining: ${daysRemaining > 0 ? daysRemaining : 'Matured'}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing end dates:', error);
  } finally {
    process.exit(0);
  }
}

fixEndDates(); 