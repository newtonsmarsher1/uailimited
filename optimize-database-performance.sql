-- Database optimization script for faster task loading
-- This script adds indexes and optimizes queries for better performance

-- Add indexes for faster task queries
ALTER TABLE tasks ADD INDEX idx_bond_level_required (bond_level_required);
ALTER TABLE tasks ADD INDEX idx_is_active (is_active);
ALTER TABLE tasks ADD INDEX idx_type (type);

-- Add indexes for user_tasks queries
ALTER TABLE user_tasks ADD INDEX idx_user_id_complete (user_id, is_complete);
ALTER TABLE user_tasks ADD INDEX idx_user_id_date (user_id, completed_at);
ALTER TABLE user_tasks ADD INDEX idx_user_id_task_type (user_id, task_type);
ALTER TABLE user_tasks ADD INDEX idx_completed_at_date (completed_at);

-- Add indexes for app_tasks queries
ALTER TABLE app_tasks ADD INDEX idx_is_active_id (is_active, id);
ALTER TABLE app_tasks ADD INDEX idx_type (type);

-- Add indexes for levels table
ALTER TABLE levels ADD INDEX idx_level (level);

-- Add indexes for users table
ALTER TABLE users ADD INDEX idx_level (level);
ALTER TABLE users ADD INDEX idx_is_active (is_active);

-- Optimize user_tasks table structure
-- Add composite indexes for common query patterns
ALTER TABLE user_tasks ADD INDEX idx_user_complete_today (user_id, is_complete, DATE(completed_at));
ALTER TABLE user_tasks ADD INDEX idx_user_task_type_complete (user_id, task_type, is_complete);

-- Show completion message
SELECT 'Database optimization completed successfully!' as message;
SELECT 'Task loading should now be significantly faster' as result;
SELECT 'Indexes added for: tasks, user_tasks, app_tasks, levels, users' as indexes_added;
