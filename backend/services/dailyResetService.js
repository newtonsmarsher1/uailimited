const mysql = require('mysql2/promise');
const cron = require('node-cron');

// Daily reset service for task limits
class DailyResetService {
    constructor() {
        this.pool = mysql.createPool({
            host: '127.0.0.1',
            user: 'root',
            password: 'Caroline',
            database: 'uai',
            connectionLimit: 10
        });
    }

    async resetDailyTasks() {
        const connection = await this.pool.getConnection();
        try {
            console.log('🔄 Starting daily task reset at midnight...');
            
            await connection.beginTransaction();
            
            // 1. Reset all completed tasks back to ongoing for all users
            console.log('🔄 Resetting completed tasks back to ongoing...');
            const [resetTasksResult] = await connection.execute(`
                UPDATE user_tasks 
                SET is_complete = 0, completed_at = NULL 
                WHERE is_complete = 1 AND DATE(completed_at) = CURDATE()
            `);
            
            console.log(`✅ Reset ${resetTasksResult.affectedRows} completed tasks back to ongoing`);
            
            // 2. Reset daily task counters for all users
            console.log('🔄 Resetting daily task counters...');
            const [resetCountersResult] = await connection.execute(`
                UPDATE user_task_stats 
                SET tasks_completed_today = 0, todays_earnings = 0 
                WHERE date = CURDATE()
            `);
            
            console.log(`✅ Reset ${resetCountersResult.affectedRows} user task counters`);

            // 3. Update trial countdown for temporary workers
            console.log('🔄 Updating trial countdowns...');
            const [trialResult] = await connection.execute(`
                UPDATE users 
                SET trial_days_remaining = GREATEST(0, DATEDIFF(trial_end_date, CURDATE())),
                    is_trial_active = CASE 
                        WHEN DATEDIFF(trial_end_date, CURDATE()) > 0 THEN TRUE 
                        ELSE FALSE 
                    END,
                    trial_expired = CASE 
                        WHEN DATEDIFF(trial_end_date, CURDATE()) <= 0 THEN TRUE 
                        ELSE FALSE 
                    END
                WHERE level = 0
            `);
            
            console.log(`✅ Updated ${trialResult.affectedRows} trial worker countdowns`);
            
            await connection.commit();

            console.log('✅ Daily task reset completed successfully!');
            console.log('📊 All users can now complete their daily task limits');
            console.log('🔄 All completed tasks have been reset to ongoing');
            console.log('⏰ Trial countdowns updated for temporary workers');

        } catch (error) {
            await connection.rollback();
            console.error('❌ Error during daily reset:', error);
        } finally {
            connection.release();
        }
    }

    startScheduler() {
        // Schedule daily reset at midnight (00:00)
        cron.schedule('0 0 * * *', () => {
            this.resetDailyTasks();
        }, {
            scheduled: true,
            timezone: "Africa/Nairobi"
        });

        console.log('⏰ Daily reset service started - will reset at 00:00 daily');
    }
}

module.exports = DailyResetService;