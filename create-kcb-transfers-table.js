const mysql = require('mysql2/promise');
const db = require('./db');

async function createKcbTransfersTable() {
  try {
    const connection = await mysql.createConnection(db);
    
    // Create KCB transfers table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS kcb_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        original_amount DECIMAL(10,2) NOT NULL,
        transfer_amount DECIMAL(10,2) NOT NULL,
        mpesa_receipt VARCHAR(50) NOT NULL,
        kcb_account_name VARCHAR(100) NOT NULL,
        kcb_account_number VARCHAR(50) NOT NULL,
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ KCB transfers table created successfully');
    
    await connection.end();
  } catch (error) {
    console.error('❌ Error creating KCB transfers table:', error);
  }
}

createKcbTransfersTable(); 