const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function cleanupTestData() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🧹 Cleaning up test data...');
        
        await connection.beginTransaction();
        
        // Remove test completed tasks (only those created today for testing)
        const [deleteResult] = await connection.query(`
            DELETE FROM user_tasks 
            WHERE is_complete = 1 
            AND DATE(completed_at) = CURDATE() 
            AND reward_earned IN (11.00, 15.00)
        `);
        
        console.log(`✅ Removed ${deleteResult.affectedRows} test completed tasks`);
        
        // Reset test user task stats
        const [resetResult] = await connection.query(`
            UPDATE user_task_stats 
            SET tasks_completed_today = 0, todays_earnings = 0 
            WHERE date = CURDATE() 
            AND todays_earnings = 55.00
        `);
        
        console.log(`✅ Reset ${resetResult.affectedRows} test user task stats`);
        
        await connection.commit();
        
        console.log('✅ Test data cleanup completed!');
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Run the cleanup
cleanupTestData()
    .then(() => {
        console.log('🎯 Cleanup completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Cleanup failed:', error);
        process.exit(1);
    });





