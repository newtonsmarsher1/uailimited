#!/usr/bin/env node

const mysql = require('mysql2/promise');

// Database configuration - update these with your PlanetScale credentials
const dbConfig = {
  host: process.env.DB_HOST || 'aws.connect.psdb.cloud',
  user: process.env.DB_USER || 'your_planetscale_username',
  password: process.env.DB_PASSWORD || 'your_planetscale_password',
  database: process.env.DB_NAME || 'uai-agency',
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: true
  }
};

async function createTables() {
  let connection;
  
  try {
    console.log('🔌 Connecting to PlanetScale database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Create users table
    console.log('📊 Creating users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        email VARCHAR(100),
        wallet_balance DECIMAL(10,2) DEFAULT 0.00,
        bond_balance DECIMAL(10,2) DEFAULT 0.00,
        total_earned DECIMAL(10,2) DEFAULT 0.00,
        total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
        referral_code VARCHAR(20) UNIQUE,
        referred_by VARCHAR(20),
        level INT DEFAULT 1,
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        language VARCHAR(5) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create tasks table
    console.log('📋 Creating tasks table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        reward DECIMAL(10,2) NOT NULL,
        type VARCHAR(50) DEFAULT 'daily',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tasks table created');

    // Create user_tasks table (for tracking completed tasks)
    console.log('📝 Creating user_tasks table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        task_id INT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reward_earned DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        UNIQUE KEY unique_user_task (user_id, task_id, DATE(completed_at))
      )
    `);
    console.log('✅ User tasks table created');

    // Create investments table
    console.log('💰 Creating investments table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS investments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fund_name VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        roi_percentage DECIMAL(5,2) NOT NULL,
        duration_days INT NOT NULL,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NOT NULL,
        wallet_type ENUM('wallet', 'bond') DEFAULT 'wallet',
        status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
        total_earned DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Investments table created');

    // Create notifications table
    console.log('🔔 Creating notifications table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Notifications table created');

    // Create withdrawals table
    console.log('💸 Creating withdrawals table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(50) NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
        account_details TEXT,
        admin_notes TEXT,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Withdrawals table created');

    // Create kcb_transfers table
    console.log('🏦 Creating kcb_transfers table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kcb_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        mpesa_receipt_number VARCHAR(50) UNIQUE,
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ KCB transfers table created');

    // Create levels table
    console.log('📈 Creating levels table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level_number INT UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        min_tasks INT NOT NULL,
        min_earnings DECIMAL(10,2) NOT NULL,
        bonus_percentage DECIMAL(5,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Levels table created');

    // Create admin_users table
    console.log('👑 Creating admin_users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Admin users table created');

    // Insert default admin user
    console.log('👤 Creating default admin user...');
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT IGNORE INTO admin_users (username, password, role) 
      VALUES ('admin', ?, 'super_admin')
    `, [hashedPassword]);
    console.log('✅ Default admin user created (username: admin, password: admin123)');

    // Insert sample tasks
    console.log('📋 Creating sample tasks...');
    const sampleTasks = [
      ['Complete Daily Survey', 'Complete the daily survey to earn rewards', 5.00, 'daily'],
      ['Watch Video Tutorial', 'Watch the video tutorial about our platform', 3.00, 'daily'],
      ['Share on Social Media', 'Share our platform on your social media', 2.00, 'daily'],
      ['Refer a Friend', 'Invite a friend to join our platform', 10.00, 'one_time'],
      ['Complete Profile', 'Complete your profile information', 1.00, 'one_time']
    ];

    for (const task of sampleTasks) {
      await connection.execute(`
        INSERT IGNORE INTO tasks (title, description, reward, type) 
        VALUES (?, ?, ?, ?)
      `, task);
    }
    console.log('✅ Sample tasks created');

    // Insert default levels
    console.log('📈 Creating default levels...');
    const levels = [
      [1, 'Beginner', 0, 0.00, 0.00],
      [2, 'Bronze', 10, 50.00, 5.00],
      [3, 'Silver', 25, 150.00, 10.00],
      [4, 'Gold', 50, 300.00, 15.00],
      [5, 'Platinum', 100, 600.00, 20.00]
    ];

    for (const level of levels) {
      await connection.execute(`
        INSERT IGNORE INTO levels (level_number, name, min_tasks, min_earnings, bonus_percentage) 
        VALUES (?, ?, ?, ?, ?)
      `, level);
    }
    console.log('✅ Default levels created');

    console.log('\n🎉 Database migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 8 tables created');
    console.log('- Default admin user created');
    console.log('- Sample tasks added');
    console.log('- Default levels configured');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Please check your database credentials and try again.');
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  createTables();
}

module.exports = { createTables }; 