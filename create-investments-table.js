const pool = require('./db.js');

async function createInvestmentsTable() {
  try {
    // Create investments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS investments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fund_name VARCHAR(64) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        roi_percentage DECIMAL(5,2) NOT NULL,
        duration_days INT NOT NULL,
        start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_date DATETIME GENERATED ALWAYS AS (DATE_ADD(start_date, INTERVAL duration_days DAY)) STORED,
        paid_out BOOLEAN DEFAULT FALSE,
        paid_at DATETIME NULL,
        wallet_type ENUM('main', 'savings') DEFAULT 'main',
        status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Investments table created successfully');
    
    // Create indexes (without IF NOT EXISTS for compatibility)
    try {
      await pool.query(`CREATE INDEX idx_investments_user_id ON investments(user_id)`);
      console.log('✅ User ID index created');
    } catch (error) {
      console.log('ℹ️ User ID index already exists');
    }
    
    try {
      await pool.query(`CREATE INDEX idx_investments_end_date ON investments(end_date)`);
      console.log('✅ End date index created');
    } catch (error) {
      console.log('ℹ️ End date index already exists');
    }
    
    try {
      await pool.query(`CREATE INDEX idx_investments_paid_out ON investments(paid_out)`);
      console.log('✅ Paid out index created');
    } catch (error) {
      console.log('ℹ️ Paid out index already exists');
    }

    console.log('✅ Investment table setup completed');
    
  } catch (error) {
    console.error('❌ Error creating investments table:', error);
  } finally {
    process.exit(0);
  }
}

createInvestmentsTable(); 