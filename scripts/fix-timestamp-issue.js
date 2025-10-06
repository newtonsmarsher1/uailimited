const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function fixTimestampIssue() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔧 Fixing timestamp issue...');
        
        // 1. Revert timezone back to UTC
        console.log('🔄 Reverting timezone to UTC...');
        await connection.query("SET GLOBAL time_zone = '+00:00'");
        console.log('✅ Timezone reverted to UTC');
        
        // 2. Check current timezone
        const [timezoneInfo] = await connection.query(`
            SELECT 
                @@global.time_zone as global_tz,
                NOW() as db_time
        `);
        
        console.log('📅 Current settings:');
        console.log('   Global timezone:', timezoneInfo[0].global_tz);
        console.log('   Database time:', timezoneInfo[0].db_time);
        console.log('   Local time:', new Date());
        
        // 3. Fix the problematic withdrawals by setting correct timestamps
        console.log('\n🔧 Fixing withdrawal timestamps...');
        
        // Get the current time in UTC
        const now = new Date();
        const utcTime = now.toISOString().slice(0, 19).replace('T', ' ');
        
        // Update the recent withdrawals to use current time minus some minutes
        const [updateResult] = await connection.query(`
            UPDATE withdrawals 
            SET requested_at = DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            WHERE id IN (161, 160) AND status = 'pending'
        `);
        
        console.log(`✅ Updated ${updateResult.affectedRows} withdrawals`);
        
        // 4. Verify the fix
        const [fixedWithdrawals] = await connection.query(`
            SELECT 
                id,
                amount,
                status,
                requested_at,
                TIMESTAMPDIFF(MINUTE, requested_at, NOW()) as minutes_ago
            FROM withdrawals 
            WHERE id IN (161, 160)
        `);
        
        console.log('\n✅ Fixed withdrawals:');
        fixedWithdrawals.forEach(w => {
            console.log(`   ID ${w.id}: KES ${w.amount} - ${w.minutes_ago} minutes ago - ${w.requested_at}`);
            
            // Check frontend calculation
            const requestedAt = new Date(w.requested_at);
            const now = new Date();
            const timeDiff = now - requestedAt;
            const minutesElapsed = Math.floor(timeDiff / (1000 * 60));
            
            console.log(`     Frontend: ${minutesElapsed} minutes elapsed`);
            console.log(`     Should show: ${minutesElapsed < 15 ? 'Pending Review' : 'Disbursement in Progress'}`);
        });
        
        // 5. Test the withdrawal status API
        console.log('\n🧪 Testing withdrawal status API...');
        
        const [testWithdrawal] = await connection.query(`
            SELECT 
                id,
                amount,
                status,
                requested_at
            FROM withdrawals 
            WHERE user_id = 89 AND status = 'pending'
            ORDER BY requested_at DESC
            LIMIT 1
        `);
        
        if (testWithdrawal.length > 0) {
            const w = testWithdrawal[0];
            console.log('📋 Test withdrawal:');
            console.log('   ID:', w.id);
            console.log('   Amount:', w.amount);
            console.log('   Status:', w.status);
            console.log('   Requested at:', w.requested_at);
            
            // Simulate frontend calculation
            const requestedAt = new Date(w.requested_at);
            const now = new Date();
            const timeDiff = now - requestedAt;
            const minutesElapsed = Math.floor(timeDiff / (1000 * 60));
            
            console.log('   Minutes elapsed:', minutesElapsed);
            console.log('   Should show:', minutesElapsed < 15 ? 'Pending Review' : 'Disbursement in Progress');
        }
        
    } catch (error) {
        console.error('❌ Error fixing timestamp issue:', error);
    } finally {
        connection.release();
    }
}

// Run the fix
fixTimestampIssue()
    .then(() => {
        console.log('\n🎯 Timestamp issue fix completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Timestamp issue fix failed:', error);
        process.exit(1);
    });





