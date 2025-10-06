-- Fix database schema issues for UAI Agency
-- This script addresses the missing tables and columns that cause blank task areas

-- 1. Create levels table if it doesn't exist
CREATE TABLE IF NOT EXISTS levels (
    level INT PRIMARY KEY,
    daily_tasks INT DEFAULT 5,
    bond_requirement DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default level configurations
INSERT IGNORE INTO levels (level, daily_tasks, bond_requirement) VALUES
(0, 5, 0.00),   -- Temporary Worker
(1, 5, 0.00),   -- Level 1
(2, 10, 0.00),  -- Level 2
(3, 15, 0.00),  -- Level 3
(4, 20, 0.00),  -- Level 4
(5, 25, 0.00),  -- Level 5
(6, 30, 0.00),  -- Level 6
(7, 35, 0.00),  -- Level 7
(8, 40, 0.00),  -- Level 8
(9, 50, 0.00);  -- Level 9

-- 2. Add missing columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS bond_level_required INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS reward DECIMAL(10,2) DEFAULT 17.00,
ADD COLUMN IF NOT EXISTS videoUrl TEXT,
ADD COLUMN IF NOT EXISTS thumbnailUrl TEXT;

-- 3. Add missing columns to user_tasks table
ALTER TABLE user_tasks 
ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS app_task_id INT NULL,
ADD COLUMN IF NOT EXISTS task_type ENUM('regular', 'app') DEFAULT 'regular';

-- 4. Create app_tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    app_icon VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some default app tasks
INSERT IGNORE INTO app_tasks (id, app_name, app_icon, is_active) VALUES
(1, 'TikTok', '../assets/tiktok.png', TRUE),
(2, 'Instagram', '../assets/social.png', TRUE),
(3, 'WhatsApp', '../assets/whatsapp.png', TRUE),
(4, 'Spotify', '../assets/spotify.png', TRUE),
(5, 'Netflix', '../assets/video.png', TRUE);

-- 5. Insert some default regular tasks if none exist
INSERT IGNORE INTO tasks (id, title, description, reward, bond_level_required, is_active) VALUES
(1, 'Design Studio Ad', 'Watch Design Studio advertisement', 17.00, 1, TRUE),
(2, 'Samsung Galaxy Ad', 'Watch Samsung Galaxy advertisement', 17.00, 1, TRUE),
(3, 'Tecno Camera Ad', 'Watch Tecno Camera advertisement', 17.00, 1, TRUE),
(4, 'Facebook Marketing', 'Complete Facebook marketing task', 17.00, 1, TRUE),
(5, 'Instagram Promotion', 'Complete Instagram promotion task', 17.00, 1, TRUE);

-- 6. Create user_earnings_summary table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_earnings_summary (
    user_id INT PRIMARY KEY,
    total_tasks_completed INT DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    this_month_earnings DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Create user_task_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_task_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    tasks_completed_today INT DEFAULT 0,
    todays_earnings DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Update existing user_tasks records to have is_complete = TRUE where status = 'completed'
UPDATE user_tasks SET is_complete = TRUE WHERE status = 'completed';

-- Show completion message
SELECT 'Database schema fixes completed successfully!' as message;
SELECT 'Please restart your backend server to apply changes' as next_step;
