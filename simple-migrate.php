<?php
echo "🗄️ UAI Agency - Simple Database Migration\n\n";

try {
    echo "🔌 Connecting to database...\n";
    
    // Connect directly to MySQL with no password
    $dsn = "mysql:host=localhost;port=3306;charset=utf8mb4";
    $pdo = new PDO($dsn, 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✅ Connected successfully!\n\n";
    
    // Create database
    echo "📊 Creating database...\n";
    $pdo->exec("CREATE DATABASE IF NOT EXISTS uai_agency");
    echo "✅ Database 'uai_agency' created/verified\n\n";
    
    // Connect to the specific database
    $pdo = new PDO("mysql:host=localhost;port=3306;dbname=uai_agency;charset=utf8mb4", 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create users table
    echo "📊 Creating users table...\n";
    $pdo->exec("
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
    ");
    echo "✅ Users table created\n";
    
    // Create tasks table
    echo "📋 Creating tasks table...\n";
    $pdo->exec("
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
    ");
    echo "✅ Tasks table created\n";
    
    // Create user_tasks table
    echo "📝 Creating user_tasks table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            task_id INT NOT NULL,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reward_earned DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    ");
    echo "✅ User tasks table created\n";
    
    // Create investments table
    echo "💰 Creating investments table...\n";
    $pdo->exec("
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
    ");
    echo "✅ Investments table created\n";
    
    // Create notifications table
    echo "🔔 Creating notifications table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'info',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");
    echo "✅ Notifications table created\n";
    
    // Create withdrawals table
    echo "💸 Creating withdrawals table...\n";
    $pdo->exec("
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
    ");
    echo "✅ Withdrawals table created\n";
    
    // Create kcb_transfers table
    echo "🏦 Creating kcb_transfers table...\n";
    $pdo->exec("
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
    ");
    echo "✅ KCB transfers table created\n";
    
    // Create levels table
    echo "📈 Creating levels table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS levels (
            id INT AUTO_INCREMENT PRIMARY KEY,
            level_number INT UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            min_tasks INT NOT NULL,
            min_earnings DECIMAL(10,2) NOT NULL,
            bonus_percentage DECIMAL(5,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Levels table created\n";
    
    // Create admin_users table
    echo "👑 Creating admin_users table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'admin',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Admin users table created\n";
    
    // Insert sample data
    echo "\n📊 Inserting sample data...\n";
    
    // Insert default admin user
    $hashedPassword = password_hash('admin123', PASSWORD_DEFAULT);
    $pdo->exec("
        INSERT IGNORE INTO admin_users (username, password, role) 
        VALUES ('admin', '$hashedPassword', 'super_admin')
    ");
    echo "✅ Default admin user created (username: admin, password: admin123)\n";
    
    // Insert sample tasks
    $sampleTasks = [
        ['Complete Daily Survey', 'Complete the daily survey to earn rewards', 5.00, 'daily'],
        ['Watch Video Tutorial', 'Watch the video tutorial about our platform', 3.00, 'daily'],
        ['Share on Social Media', 'Share our platform on your social media', 2.00, 'daily'],
        ['Refer a Friend', 'Invite a friend to join our platform', 10.00, 'one_time'],
        ['Complete Profile', 'Complete your profile information', 1.00, 'one_time']
    ];
    
    foreach ($sampleTasks as $task) {
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO tasks (title, description, reward, type) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute($task);
    }
    echo "✅ Sample tasks created\n";
    
    // Insert default levels
    $levels = [
        [1, 'Beginner', 0, 0.00, 0.00],
        [2, 'Bronze', 10, 50.00, 5.00],
        [3, 'Silver', 25, 150.00, 10.00],
        [4, 'Gold', 50, 300.00, 15.00],
        [5, 'Platinum', 100, 600.00, 20.00]
    ];
    
    foreach ($levels as $level) {
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO levels (level_number, name, min_tasks, min_earnings, bonus_percentage) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute($level);
    }
    echo "✅ Default levels created\n";
    
    echo "\n🎉 Database migration completed successfully!\n";
    echo "\n📊 Summary:\n";
    echo "- 8 tables created\n";
    echo "- Default admin user created\n";
    echo "- Sample tasks added\n";
    echo "- Default levels configured\n\n";
    
    echo "🚀 Next Steps:\n";
    echo "1. Start your web server\n";
    echo "2. Visit your application URL\n";
    echo "3. Register a new user account\n";
    echo "4. Test the features\n\n";
    
    echo "🎯 Your application URLs:\n";
    echo "- Main Application: http://localhost/uai-agency/\n";
    echo "- Admin Panel: http://localhost/uai-agency/admin/\n";
    echo "- API Endpoints: http://localhost/uai-agency/api/\n\n";
    
} catch (Exception $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    echo "Please check your database credentials and try again.\n";
}
?> 