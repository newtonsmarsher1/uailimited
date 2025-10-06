const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function simulateCompletedTasks() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🎭 Simulating completed tasks for testing...');
        
        await connection.beginTransaction();
        
        // 1. Get some users and tasks to work with
        const [users] = await connection.query(`
            SELECT id, name FROM users 
            WHERE is_active = 1 OR is_active IS NULL 
            LIMIT 5
        `);
        
        const [appTasks] = await connection.query(`
            SELECT id FROM app_tasks WHERE is_active = 1 LIMIT 10
        `);
        
        const [regularTasks] = await connection.query(`
            SELECT id FROM tasks LIMIT 5
        `);
        
        console.log(`📊 Found ${users.length} users, ${appTasks.length} app tasks, ${regularTasks.length} regular tasks`);
        
        // 2. Create some completed tasks for today
        let completedCount = 0;
        
        for (const user of users) {
            // Complete some app tasks
            for (let i = 0; i < Math.min(3, appTasks.length); i++) {
                const task = appTasks[i];
                await connection.query(`
                    INSERT INTO user_tasks (user_id, app_task_id, task_type, is_complete, completed_at, reward_earned) 
                    VALUES (?, ?, 'app', 1, NOW(), 11.00)
                    ON DUPLICATE KEY UPDATE 
                    is_complete = 1, completed_at = NOW(), reward_earned = 11.00
                `, [user.id, task.id]);
                completedCount++;
            }
            
            // Complete some regular tasks
            for (let i = 0; i < Math.min(2, regularTasks.length); i++) {
                const task = regularTasks[i];
                await connection.query(`
                    INSERT INTO user_tasks (user_id, task_id, is_complete, completed_at, reward_earned) 
                    VALUES (?, ?, 1, NOW(), 15.00)
                    ON DUPLICATE KEY UPDATE 
                    is_complete = 1, completed_at = NOW(), reward_earned = 15.00
                `, [user.id, task.id]);
                completedCount++;
            }
        }
        
        // 3. Update user task stats
        for (const user of users) {
            await connection.query(`
                INSERT INTO user_task_stats (user_id, date, tasks_completed_today, todays_earnings) 
                VALUES (?, CURDATE(), 5, 55.00)
                ON DUPLICATE KEY UPDATE 
                tasks_completed_today = 5, todays_earnings = 55.00
            `, [user.id]);
        }
        
        await connection.commit();
        
        console.log(`✅ Created ${completedCount} completed tasks for ${users.length} users`);
        console.log('🎯 Now you can test the daily reset functionality');
        
        // 4. Show current state
        const [completedTasks] = await connection.query(`
            SELECT COUNT(*) as count FROM user_tasks 
            WHERE is_complete = 1 AND DATE(completed_at) = CURDATE()
        `);
        
        const [ongoingTasks] = await connection.query(`
            SELECT COUNT(*) as count FROM user_tasks 
            WHERE is_complete = 0 OR completed_at IS NULL
        `);
        
        console.log(`📊 Current state:`);
        console.log(`   - Completed tasks today: ${completedTasks[0].count}`);
        console.log(`   - Ongoing tasks: ${ongoingTasks[0].count}`);
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error simulating completed tasks:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Run the simulation
simulateCompletedTasks()
    .then(() => {
        console.log('\n🎉 Task simulation completed!');
        console.log('💡 You can now run: node scripts/test-daily-reset.js');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Task simulation failed:', error);
        process.exit(1);
    });





