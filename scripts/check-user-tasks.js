const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function checkUserTasks() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔍 Checking user tasks for 0111575831...');
        
        // 1. Get user info
        const [userRows] = await connection.query('SELECT id, name, level FROM users WHERE phone = ?', ['0111575831']);
        
        if (userRows.length === 0) {
            console.log('❌ User not found');
            return;
        }
        
        const user = userRows[0];
        console.log(`👤 User: ${user.name} (ID: ${user.id}, Level: ${user.level})`);
        
        // 2. Get total app tasks available
        const [appTasksCount] = await connection.query('SELECT COUNT(*) as count FROM app_tasks WHERE is_active = 1');
        console.log(`📱 Total app tasks available: ${appTasksCount[0].count}`);
        
        // 3. Get completed app tasks for today
        const [completedToday] = await connection.query(`
            SELECT app_task_id FROM user_tasks 
            WHERE user_id=? AND is_complete=1 AND DATE(completed_at)=CURDATE() AND task_type='app'
        `, [user.id]);
        
        console.log(`✅ Completed app tasks today: ${completedToday.length}`);
        
        // 4. Get all completed app tasks
        const [allCompleted] = await connection.query(`
            SELECT app_task_id FROM user_tasks 
            WHERE user_id=? AND is_complete=1 AND task_type='app'
        `, [user.id]);
        
        console.log(`📊 Total completed app tasks: ${allCompleted.length}`);
        
        // 5. Calculate ongoing tasks
        const ongoingCount = appTasksCount[0].count - completedToday.length;
        console.log(`🔄 Should show ongoing: ${ongoingCount}`);
        
        // 6. Get level config
        const [levelConfig] = await connection.query('SELECT daily_tasks FROM levels WHERE level = ?', [user.level]);
        const maxTasksPerDay = levelConfig.length > 0 ? levelConfig[0].daily_tasks : 5;
        
        console.log(`📅 Daily task limit for level ${user.level}: ${maxTasksPerDay}`);
        
        // 7. Check if user has reached daily limit
        const hasReachedLimit = completedToday.length >= maxTasksPerDay;
        console.log(`🚫 Daily limit reached: ${hasReachedLimit}`);
        
        // 8. Show what the API should return
        console.log('\n📡 API Response should be:');
        console.log(`   - Total tasks: ${appTasksCount[0].count}`);
        console.log(`   - Ongoing tasks: ${ongoingCount}`);
        console.log(`   - Completed today: ${completedToday.length}`);
        console.log(`   - Max tasks per day: ${maxTasksPerDay}`);
        
        // 9. Check if there are any issues
        if (ongoingCount < appTasksCount[0].count) {
            console.log('\n⚠️  ISSUE: User should see all tasks as ongoing, but some are marked as completed');
            console.log('🔧 This suggests the daily reset is not working properly');
        } else {
            console.log('\n✅ All tasks should appear as ongoing');
        }
        
    } catch (error) {
        console.error('❌ Error checking user tasks:', error);
    } finally {
        connection.release();
    }
}

// Run the check
checkUserTasks()
    .then(() => {
        console.log('\n🎯 User task check completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 User task check failed:', error);
        process.exit(1);
    });





