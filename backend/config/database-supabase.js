import postgres from 'postgres';

// Supabase connection string
const connectionString = process.env.DATABASE_URL || 
  `postgresql://postgres:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`;

// Create postgres connection
const sql = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  max: 20, // Maximum number of connections
  idle_timeout: 20,
  connect_timeout: 10,
});

// Test database connection and verify tables
async function verifyDatabase() {
  try {
    console.log('🔍 Verifying Supabase PostgreSQL database connection and tables...');
    
    // Test connection
    const result = await sql`SELECT version()`;
    console.log('✅ Database connected successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'postgres'} on ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}`);
    
    // Check if payments table exists
    const paymentsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
      );
    `;
    
    if (!paymentsTable[0].exists) {
      console.log('❌ Payments table does not exist. Creating it...');
      await sql`
        CREATE TABLE payments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
          payment_method VARCHAR(50),
          hr_manager_id INTEGER,
          transaction_number VARCHAR(100) UNIQUE,
          user_phone VARCHAR(20),
          verification_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP NULL,
          description TEXT
        )
      `;
      console.log('✅ Payments table created');
    } else {
      console.log('✅ Payments table exists');
    }
    
    // Check if admin_users table exists
    const adminTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      );
    `;
    
    if (!adminTable[0].exists) {
      console.log('❌ Admin_users table does not exist. Creating it...');
      await sql`
        CREATE TABLE admin_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          mobile VARCHAR(20),
          role VARCHAR(20) DEFAULT 'HR Manager' CHECK (role IN ('CEO', 'HR Manager', 'Financial Manager', 'super_admin')),
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
      `;
      console.log('✅ Admin_users table created');
    } else {
      console.log('✅ Admin_users table exists');
    }
    
    // Check if users table exists
    const usersTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;
    
    if (!usersTable[0].exists) {
      console.log('❌ Users table does not exist. Creating it...');
      await sql`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          phone VARCHAR(20) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100),
          level INTEGER DEFAULT 0,
          wallet_balance DECIMAL(10,2) DEFAULT 0.00,
          bond_balance DECIMAL(10,2) DEFAULT 0.00,
          total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
          is_active BOOLEAN DEFAULT TRUE,
          is_admin BOOLEAN DEFAULT FALSE,
          invitation_code VARCHAR(20),
          referral_code VARCHAR(20),
          referred_by VARCHAR(20),
          withdrawal_pin VARCHAR(255),
          pin_attempts INTEGER DEFAULT 0,
          pin_locked_until TIMESTAMP NULL,
          full_name VARCHAR(100),
          bank_type VARCHAR(50),
          account_number VARCHAR(50),
          temp_worker_start_date TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Users table created');
    } else {
      console.log('✅ Users table exists');
    }
    
    // Check if notifications table exists
    const notificationsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `;
    
    if (!notificationsTable[0].exists) {
      console.log('❌ Notifications table does not exist. Creating it...');
      await sql`
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(20) DEFAULT 'info',
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Notifications table created');
    } else {
      console.log('✅ Notifications table exists');
    }
    
    // Check if withdrawals table exists
    const withdrawalsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'withdrawals'
      );
    `;
    
    if (!withdrawalsTable[0].exists) {
      console.log('❌ Withdrawals table does not exist. Creating it...');
      await sql`
        CREATE TABLE withdrawals (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP NULL,
          approved_by VARCHAR(100),
          rejected_by VARCHAR(100),
          admin_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Withdrawals table created');
    } else {
      console.log('✅ Withdrawals table exists');
    }
    
    // Check if appeals table exists
    const appealsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'appeals'
      );
    `;
    
    if (!appealsTable[0].exists) {
      console.log('❌ Appeals table does not exist. Creating it...');
      await sql`
        CREATE TABLE appeals (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          appeal_reason TEXT NOT NULL,
          appeal_description TEXT NOT NULL,
          appeal_fee DECIMAL(10,2) DEFAULT 560.00,
          payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
          payment_proof TEXT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
          admin_response TEXT NULL,
          reviewed_by INTEGER NULL,
          reviewed_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✅ Appeals table created');
    } else {
      console.log('✅ Appeals table exists');
    }
    
    // Check for sample data in admin_users
    const adminCount = await sql`SELECT COUNT(*) as count FROM admin_users`;
    console.log(`📊 Admin users count: ${adminCount[0].count}`);
    
    if (adminCount[0].count === 0) {
      console.log('⚠️ No admin users found. You may need to add some via the admin portal.');
    }
    
    console.log('🎉 Database verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    console.error('🔧 Please check your database configuration');
  }
}

// Run verification
verifyDatabase();

export default sql;
