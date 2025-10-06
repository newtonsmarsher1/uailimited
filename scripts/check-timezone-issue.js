const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function checkTimezoneIssue() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔍 Checking timezone issue...');
        
        // 1. Check current timezone
        const [timezoneInfo] = await connection.query(`
            SELECT 
                @@global.time_zone as global_tz,
                NOW() as db_time
        `);
        
        console.log('📅 Current settings:');
        console.log('   Global timezone:', timezoneInfo[0].global_tz);
        console.log('   Database time:', timezoneInfo[0].db_time);
        console.log('   Local time:', new Date());
        
        // 2. Check the specific withdrawal
        const [withdrawal] = await connection.query(`
            SELECT 
                id,
                amount,
                status,
                requested_at,
                TIMESTAMPDIFF(MINUTE, requested_at, NOW()) as minutes_ago
            FROM withdrawals 
            WHERE id = 161
        `);
        
        if (withdrawal.length > 0) {
            const w = withdrawal[0];
            console.log('\n📋 Withdrawal ID 161:');
            console.log('   Amount:', w.amount);
            console.log('   Status:', w.status);
            console.log('   Requested at:', w.requested_at);
            console.log('   Minutes ago:', w.minutes_ago);
            
            // 3. Check what the frontend should show
            const requestedAt = new Date(w.requested_at);
            const now = new Date();
            const timeDiff = now - requestedAt;
            const minutesElapsed = Math.floor(timeDiff / (1000 * 60));
            
            console.log('\n🎨 Frontend calculation:');
            console.log('   Requested at (Date object):', requestedAt);
            console.log('   Current time:', now);
            console.log('   Time difference (ms):', timeDiff);
            console.log('   Minutes elapsed:', minutesElapsed);
            console.log('   Should show:', minutesElapsed < 15 ? 'Pending Review' : 'Disbursement in Progress');
            
            // 4. Check if the timestamp is correct
            console.log('\n🔍 Timestamp analysis:');
            console.log('   Is timestamp in future?', timeDiff < 0);
            console.log('   Is timestamp reasonable?', minutesElapsed >= 0 && minutesElapsed < 1440);
            
            if (timeDiff < 0) {
                console.log('   ❌ ISSUE: Timestamp is in the future!');
            } else if (minutesElapsed < 0) {
                console.log('   ❌ ISSUE: Negative minutes elapsed!');
            } else {
                console.log('   ✅ Timestamp looks correct');
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking timezone issue:', error);
    } finally {
        connection.release();
    }
}

// Run the check
checkTimezoneIssue()
    .then(() => {
        console.log('\n🎯 Timezone issue check completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Timezone issue check failed:', error);
        process.exit(1);
    });





