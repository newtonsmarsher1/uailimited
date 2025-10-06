-- UAI Agency Production Database Setup Script
-- Run this script in MySQL Workbench or MySQL command line

-- Create production database
CREATE DATABASE IF NOT EXISTS uai_production 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create production user (replace with your credentials)
CREATE USER IF NOT EXISTS 'uai_prod_user'@'localhost' IDENTIFIED BY 'your_secure_production_password';
GRANT ALL PRIVILEGES ON uai_production.* TO 'uai_prod_user'@'localhost';
FLUSH PRIVILEGES;

-- Use the production database
USE uai_production;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_referral_code (referral_code),
    INDEX idx_referred_by (referred_by),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
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
    description TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_transaction_number (transaction_number),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create appeals table
CREATE TABLE IF NOT EXISTS appeals (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create tasks table (if needed)
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reward_amount DECIMAL(10,2) DEFAULT 0.00,
    task_type ENUM('daily', 'weekly', 'monthly', 'special') DEFAULT 'daily',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_type (task_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user_tasks table (if needed)
CREATE TABLE IF NOT EXISTS user_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    task_id INT NOT NULL,
    status ENUM('pending', 'completed', 'expired') DEFAULT 'pending',
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_task (user_id, task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_task_id (task_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (change credentials!)
INSERT IGNORE INTO admin_users (name, mobile, role, is_active) 
VALUES ('System Administrator', '1234567890', 'super_admin', TRUE);

-- Show completion message
SELECT 'Database setup completed successfully!' as message;
SELECT 'Please update your .env file with the production database credentials' as next_step;

