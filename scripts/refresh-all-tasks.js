const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function refreshAllTasks() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔄 Starting task refresh process...');
        console.log('📅 Current date:', new Date().toISOString());
        
        await connection.beginTransaction();
        
        // 1. Reset all user_tasks completion status for today
        console.log('🔄 Resetting all user_tasks completion status...');
        const [resetResult] = await connection.query(`
            UPDATE user_tasks 
            SET is_complete = 0, completed_at = NULL 
            WHERE DATE(completed_at) = CURDATE()
        `);
        
        console.log(`✅ Reset ${resetResult.affectedRows} user_tasks entries`);
        
        // 2. Reset daily task counters for all users
        console.log('🔄 Resetting daily task counters...');
        const [counterResult] = await connection.query(`
            UPDATE user_task_stats 
            SET tasks_completed_today = 0, todays_earnings = 0 
            WHERE date = CURDATE()
        `);
        
        console.log(`✅ Reset ${counterResult.affectedRows} user_task_stats entries`);
        
        // 3. Ensure all app_tasks are active
        console.log('🔄 Ensuring all app_tasks are active...');
        const [appTasksResult] = await connection.query(`
            UPDATE app_tasks 
            SET is_active = 1 
            WHERE is_active = 0
        `);
        
        console.log(`✅ Activated ${appTasksResult.affectedRows} app_tasks`);
        
        // 4. Regular tasks don't have is_active column, they're always available
        console.log('🔄 Regular tasks are always available (no is_active column)');
        
        // 5. Get summary of available tasks
        const [appTasksCount] = await connection.query(`
            SELECT COUNT(*) as count FROM app_tasks WHERE is_active = 1
        `);
        
        const [regularTasksCount] = await connection.query(`
            SELECT COUNT(*) as count FROM tasks
        `);
        
        const [userCount] = await connection.query(`
            SELECT COUNT(*) as count FROM users WHERE is_active = 1 OR is_active IS NULL
        `);
        
        await connection.commit();
        
        console.log('✅ Task refresh completed successfully!');
        console.log('📊 Summary:');
        console.log(`   - Active App Tasks: ${appTasksCount[0].count}`);
        console.log(`   - Active Regular Tasks: ${regularTasksCount[0].count}`);
        console.log(`   - Active Users: ${userCount[0].count}`);
        console.log(`   - Total Tasks Available: ${appTasksCount[0].count + regularTasksCount[0].count}`);
        console.log('🎉 All users can now see all tasks as ongoing!');
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error during task refresh:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Run the refresh
refreshAllTasks()
    .then(() => {
        console.log('🎯 Task refresh process completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Task refresh failed:', error);
        process.exit(1);
    });
