const mysql = require('mysql2/promise');

async function addIdNumberColumn() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Adding id_number column to users table...\n');
    
    // Check if column already exists
    const [columns] = await pool.query(`
      SHOW COLUMNS FROM users LIKE 'id_number'
    `);
    
    if (columns.length > 0) {
      console.log('✅ id_number column already exists');
      return;
    }
    
    // Add the id_number column with unique constraint
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN id_number VARCHAR(20) NULL UNIQUE,
      ADD INDEX idx_id_number (id_number)
    `);
    
    console.log('✅ Successfully added id_number column to users table');
    console.log('   - Type: VARCHAR(20)');
    console.log('   - Constraint: UNIQUE (one ID per user)');
    console.log('   - Nullable: YES (existing users can have NULL)');
    console.log('   - Indexed: YES (for fast lookups)');
    
  } catch (error) {
    console.error('❌ Error adding id_number column:', error.message);
  } finally {
    pool.end();
  }
}

addIdNumberColumn();




