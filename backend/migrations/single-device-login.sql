-- Single Device Login Security System
-- Database migration to add session tracking and security features

-- Create user_sessions table to track active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_fingerprint VARCHAR(64) NOT NULL,
    device_info JSON NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_user_id (user_id),
    INDEX idx_fingerprint (device_fingerprint),
    INDEX idx_active (is_active),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create security_events table to log security-related events
CREATE TABLE IF NOT EXISTS security_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    details JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add device_fingerprint column to users table for current active device
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_device_fingerprint VARCHAR(64) NULL,
ADD COLUMN IF NOT EXISTS last_login_device_info JSON NULL,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_current_device ON users(current_device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Insert sample security event types
INSERT IGNORE INTO security_events (user_id, event_type, details, created_at) 
SELECT 1, 'SYSTEM_INIT', '{"message": "Single device login system initialized"}', NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

-- Clean up any existing sessions older than 7 days
DELETE FROM user_sessions WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Update existing users to have null device fingerprint (will be set on next login)
UPDATE users SET current_device_fingerprint = NULL WHERE current_device_fingerprint IS NOT NULL;


