const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Caroline',
  database: process.env.DB_NAME || 'uai',
  port: process.env.DB_PORT || 3306
};

async function setupTestUserWithdrawalDetails() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔍 Setting up test user withdrawal details...');
    
    // First, fix the bank_type column size
    try {
      await connection.query('ALTER TABLE users MODIFY COLUMN bank_type VARCHAR(100)');
      console.log('✅ Fixed bank_type column size');
    } catch (error) {
      console.log('ℹ️ Bank_type column already correct size');
    }
    
    // Find the test user
    const [users] = await connection.query(
      'SELECT id, name, wallet_balance FROM users WHERE phone = "+254708288313"'
    );
    
    if (users.length === 0) {
      console.log('❌ Test user not found');
      return;
    }
    
    const user = users[0];
    console.log('📊 Found test user:', user);
    
    // Set up withdrawal details
    const hashedPin = await bcrypt.hash('1234', 10);
    
    await connection.query(`
      UPDATE users SET 
        full_name = 'Test User',
        bank_type = 'M-Pesa',
        account_number = '0712345678',
        withdrawal_pin = ?,
        wallet_balance = 1000.00,
        pin_attempts = 0,
        pin_locked_until = NULL
      WHERE id = ?
    `, [hashedPin, user.id]);
    
    console.log('✅ Withdrawal details set up successfully');
    console.log('📱 Full Name: Test User');
    console.log('🏦 Bank Type: M-Pesa');
    console.log('💳 Account Number: 0712345678');
    console.log('🔑 PIN: 1234');
    console.log('💰 Wallet Balance: KES 1000.00');
    
  } catch (error) {
    console.error('❌ Error setting up withdrawal details:', error.message);
  } finally {
    await connection.end();
  }
}

setupTestUserWithdrawalDetails();
