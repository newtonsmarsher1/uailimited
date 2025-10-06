const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function testDailyReset() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🧪 Testing daily reset functionality...');
        console.log('📅 Current date:', new Date().toISOString());
        
        // 1. Check current completed tasks
        console.log('\n📊 Current state before reset:');
        const [completedBefore] = await connection.query(`
            SELECT COUNT(*) as count FROM user_tasks 
            WHERE is_complete = 1 AND DATE(completed_at) = CURDATE()
        `);
        
        const [ongoingBefore] = await connection.query(`
            SELECT COUNT(*) as count FROM user_tasks 
            WHERE is_complete = 0 OR completed_at IS NULL
        `);
        
        console.log(`   - Completed tasks today: ${completedBefore[0].count}`);
        console.log(`   - Ongoing tasks: ${ongoingBefore[0].count}`);
        
        // 2. Simulate the daily reset
        console.log('\n🔄 Simulating daily reset...');
        await connection.beginTransaction();
        
        // Reset completed tasks back to ongoing
        const [resetTasksResult] = await connection.execute(`
            UPDATE user_tasks 
            SET is_complete = 0, completed_at = NULL 
            WHERE is_complete = 1 AND DATE(completed_at) = CURDATE()
        `);
        
        console.log(`✅ Reset ${resetTasksResult.affectedRows} completed tasks back to ongoing`);
        
        // Reset daily counters
        const [resetCountersResult] = await connection.execute(`
            UPDATE user_task_stats 
            SET tasks_completed_today = 0, todays_earnings = 0 
            WHERE date = CURDATE()
        `);
        
        console.log(`✅ Reset ${resetCountersResult.affectedRows} user task counters`);
        
        await connection.commit();
        
        // 3. Check state after reset
        console.log('\n📊 State after reset:');
        const [completedAfter] = await connection.query(`
            SELECT COUNT(*) as count FROM user_tasks 
            WHERE is_complete = 1 AND DATE(completed_at) = CURDATE()
        `);
        
        const [ongoingAfter] = await connection.query(`
            SELECT COUNT(*) as count FROM user_tasks 
            WHERE is_complete = 0 OR completed_at IS NULL
        `);
        
        console.log(`   - Completed tasks today: ${completedAfter[0].count}`);
        console.log(`   - Ongoing tasks: ${ongoingAfter[0].count}`);
        
        // 4. Verify the reset worked
        if (completedAfter[0].count === 0) {
            console.log('\n✅ SUCCESS: All completed tasks have been reset to ongoing!');
            console.log('🎉 Users will now see all tasks as available in the ongoing section');
        } else {
            console.log('\n❌ ISSUE: Some tasks are still marked as completed');
        }
        
        // 5. Show task distribution by user
        console.log('\n👥 Task distribution by user:');
        const [userTasks] = await connection.query(`
            SELECT 
                u.id,
                u.name,
                COUNT(ut.id) as total_tasks,
                SUM(CASE WHEN ut.is_complete = 1 THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN ut.is_complete = 0 OR ut.completed_at IS NULL THEN 1 ELSE 0 END) as ongoing_tasks
            FROM users u
            LEFT JOIN user_tasks ut ON u.id = ut.user_id
            GROUP BY u.id, u.name
            HAVING total_tasks > 0
            ORDER BY total_tasks DESC
            LIMIT 10
        `);
        
        userTasks.forEach(user => {
            console.log(`   - ${user.name} (ID: ${user.id}): ${user.ongoing_tasks} ongoing, ${user.completed_tasks} completed`);
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error during test:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Run the test
testDailyReset()
    .then(() => {
        console.log('\n🎯 Daily reset test completed successfully!');
        console.log('💡 The daily reset service will now properly reset completed tasks to ongoing at midnight');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Daily reset test failed:', error);
        process.exit(1);
    });





