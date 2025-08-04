const pool = require('./db.js');

async function fixInvestmentsTable() {
  try {
    console.log('🔧 Fixing investments table structure...');
    
    // Add missing columns
    const columnsToAdd = [
      'ADD COLUMN roi_percentage DECIMAL(5,2) NOT NULL DEFAULT 2.3',
      'ADD COLUMN duration_days INT NOT NULL DEFAULT 10',
      'ADD COLUMN paid_out BOOLEAN DEFAULT FALSE',
      'ADD COLUMN paid_at DATETIME NULL',
      'ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];
    
    for (const column of columnsToAdd) {
      try {
        await pool.query(`ALTER TABLE investments ${column}`);
        console.log(`✅ Added column: ${column.split(' ')[2]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️ Column already exists: ${column.split(' ')[2]}`);
        } else {
          console.error(`❌ Error adding column ${column.split(' ')[2]}:`, error.message);
        }
      }
    }
    
    // Update existing investments with default values
    console.log('🔄 Updating existing investments with default values...');
    await pool.query(`
      UPDATE investments 
      SET roi_percentage = 2.3, duration_days = 10, paid_out = FALSE 
      WHERE roi_percentage IS NULL OR duration_days IS NULL
    `);
    
    console.log('✅ Investments table structure fixed!');
    
    // Show the updated structure
    const [tableInfo] = await pool.query(`DESCRIBE investments`);
    console.log('📋 Updated table structure:');
    tableInfo.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing investments table:', error);
  } finally {
    process.exit(0);
  }
}

fixInvestmentsTable(); 