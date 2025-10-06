const mysql = require('mysql2/promise');

// Database configuration with performance optimizations
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Caroline',
  database: process.env.DB_NAME || 'uai',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 50, // Increased from 10 to 50
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4',
  timezone: 'Z',
  // Performance optimizations
  multipleStatements: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: false,
  debug: false,
  trace: false,
  // Connection pool optimizations
  idleTimeout: 300000, // 5 minutes
  maxReconnects: 3,
  reconnectDelay: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection and verify tables
async function verifyDatabase() {
  try {
    console.log('🔍 Verifying database connection and tables...');
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
    
    // Check if payments table exists
    const [tables] = await connection.query('SHOW TABLES LIKE "payments"');
    if (tables.length === 0) {
      console.log('❌ Payments table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
          payment_method VARCHAR(50),
          hr_manager_id INT,
          transaction_number VARCHAR(100) UNIQUE,
          user_phone VARCHAR(20),
          verification_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP NULL,
          description TEXT
        )
      `);
      console.log('✅ Payments table created');
    } else {
      console.log('✅ Payments table exists');
    }
    
    // Check if admin_users table exists
    const [adminTables] = await connection.query('SHOW TABLES LIKE "admin_users"');
    if (adminTables.length === 0) {
      console.log('❌ Admin_users table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE admin_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          mobile VARCHAR(20),
          role ENUM('CEO', 'HR Manager', 'Financial Manager', 'super_admin') DEFAULT 'HR Manager',
          payment_method VARCHAR(50),
          bank_name VARCHAR(100),
          account_number VARCHAR(50),
          branch VARCHAR(100),
          swift_code VARCHAR(20),
          reference_code VARCHAR(50),
          verified BOOLEAN DEFAULT FALSE,
          rejected BOOLEAN DEFAULT FALSE,
          is_ceo_added BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Admin_users table created');
    } else {
      console.log('✅ Admin_users table exists');
    }
    
    // Check if users table exists
    const [userTables] = await connection.query('SHOW TABLES LIKE "users"');
    if (userTables.length === 0) {
      console.log('❌ Users table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          phone VARCHAR(20) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100),
          level INT DEFAULT 0,
          wallet_balance DECIMAL(10,2) DEFAULT 0.00,
          bond_balance DECIMAL(10,2) DEFAULT 0.00,
          total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
          is_active BOOLEAN DEFAULT TRUE,
          is_admin BOOLEAN DEFAULT FALSE,
          invitation_code VARCHAR(20),
          referral_code VARCHAR(20),
          referred_by VARCHAR(20),
          withdrawal_pin VARCHAR(255),
          pin_attempts INT DEFAULT 0,
          pin_locked_until TIMESTAMP NULL,
          full_name VARCHAR(100),
          bank_type VARCHAR(50),
          account_number VARCHAR(50),
          temp_worker_start_date TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Users table created');
    } else {
      console.log('✅ Users table exists');
    }
    
    // Check if notifications table exists
    const [notificationTables] = await connection.query('SHOW TABLES LIKE "notifications"');
    if (notificationTables.length === 0) {
      console.log('❌ Notifications table does not exist. Creating it...');
      await connection.query(`
        CREATE TABLE notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(20) DEFAULT 'info',
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Notifications table created');
    } else {
      console.log('✅ Notifications table exists');
    }
    
    // Check if withdrawals table exists
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
    
    // Check if appeals table exists
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
    
    // Check for sample data in admin_users
    const [adminCount] = await connection.query('SELECT COUNT(*) as count FROM admin_users');
    console.log(`📊 Admin users count: ${adminCount[0].count}`);
    
    if (adminCount[0].count === 0) {
      console.log('⚠️ No admin users found. You may need to add some via the admin portal.');
    }
    
    connection.release();
    console.log('🎉 Database verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    console.error('🔧 Please check your database configuration');
  }
}

// Run verification
verifyDatabase();

module.exports = pool;
