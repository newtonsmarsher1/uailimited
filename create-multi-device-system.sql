-- Create user_devices table to track multiple device sessions
-- This enables users to login from up to 3 devices simultaneously

CREATE TABLE IF NOT EXISTS user_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_fingerprint VARCHAR(64) NOT NULL,
    device_name VARCHAR(100) DEFAULT 'Unknown Device',
    device_info JSON,
    login_token VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_device_per_user (user_id, device_fingerprint),
    INDEX idx_user_id (user_id),
    INDEX idx_device_fingerprint (device_fingerprint),
    INDEX idx_login_token (login_token),
    INDEX idx_last_activity (last_activity)
);

-- Add device management columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS max_devices INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS device_count INT DEFAULT 0;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_max_devices ON users(max_devices);
CREATE INDEX IF NOT EXISTS idx_users_device_count ON users(device_count);

-- Show completion message
SELECT 'Multi-device login system created successfully!' as message;
SELECT 'Users can now login from up to 3 devices simultaneously' as feature;
SELECT 'Device tracking and management enabled' as status;
