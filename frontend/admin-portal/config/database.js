const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Caroline', // Updated password for MySQL Workbench
  database: process.env.DB_NAME || 'uai',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Admin Portal Database connected successfully');
    
    // Check if withdrawals table exists, create if not
    const [withdrawalTables] = await connection.query('SHOW TABLES LIKE "withdrawals"');
    if (withdrawalTables.length === 0) {
      console.log('❌ Withdrawals table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE withdrawals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP NULL,
          approved_by VARCHAR(100),
          rejected_by VARCHAR(100),
          admin_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Withdrawals table created');
    } else {
      console.log('✅ Withdrawals table exists');
    }
    
    // Check if appeals table exists, create if not
    const [appealTables] = await connection.query('SHOW TABLES LIKE "appeals"');
    if (appealTables.length === 0) {
      console.log('❌ Appeals table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE appeals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          appeal_reason TEXT NOT NULL,
          appeal_description TEXT NOT NULL,
          appeal_fee DECIMAL(10,2) DEFAULT 560.00,
          payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
          payment_proof TEXT NULL,
          status ENUM('pending', 'under_review', 'approved', 'rejected') DEFAULT 'pending',
          admin_response TEXT NULL,
          reviewed_by INT NULL,
          reviewed_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_status (status),
          INDEX idx_payment_status (payment_status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Appeals table created');
    } else {
      console.log('✅ Appeals table exists');
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Admin Portal Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection,
  dbConfig
};
