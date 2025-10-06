const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function fixWithdrawalTimestamps() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔧 Fixing withdrawal timestamps...');
        
        // 1. Check current timezone settings
        const [timezoneInfo] = await connection.query(`
            SELECT 
                @@global.time_zone as global_tz,
                @@session.time_zone as session_tz,
                NOW() as db_time
        `);
        
        console.log('📅 Current timezone settings:');
        console.log('   Global timezone:', timezoneInfo[0].global_tz);
        console.log('   Session timezone:', timezoneInfo[0].session_tz);
        console.log('   Database time:', timezoneInfo[0].db_time);
        console.log('   Local time:', new Date());
        
        // 2. Check recent withdrawals with timestamp issues
        const [recentWithdrawals] = await connection.query(`
            SELECT 
                id,
                user_id,
                amount,
                status,
                requested_at,
                TIMESTAMPDIFF(MINUTE, requested_at, NOW()) as minutes_ago
            FROM withdrawals 
            WHERE status = 'pending'
            ORDER BY requested_at DESC
            LIMIT 5
        `);
        
        console.log('\n📋 Recent pending withdrawals:');
        recentWithdrawals.forEach(w => {
            console.log(`   ID ${w.id}: KES ${w.amount} - ${w.minutes_ago} minutes ago - ${w.requested_at}`);
        });
        
        // 3. Check if timestamps are in the future (indicating timezone issue)
        const [futureWithdrawals] = await connection.query(`
            SELECT 
                id,
                user_id,
                amount,
                requested_at,
                TIMESTAMPDIFF(MINUTE, NOW(), requested_at) as minutes_in_future
            FROM withdrawals 
            WHERE requested_at > NOW()
            ORDER BY requested_at DESC
            LIMIT 5
        `);
        
        if (futureWithdrawals.length > 0) {
            console.log('\n⚠️  Found withdrawals with future timestamps:');
            futureWithdrawals.forEach(w => {
                console.log(`   ID ${w.id}: ${w.minutes_in_future} minutes in future - ${w.requested_at}`);
            });
        }
        
        // 4. Check if we should set timezone to Africa/Nairobi
        console.log('\n🌍 Checking if timezone should be set to Africa/Nairobi...');
        
        // Test setting timezone for this session
        await connection.query("SET time_zone = '+03:00'");
        
        const [kenyaTime] = await connection.query('SELECT NOW() as kenya_time');
        console.log('   Kenya time (UTC+3):', kenyaTime[0].kenya_time);
        
        // 5. Update recent withdrawals to use correct timezone
        console.log('\n🔧 Updating recent withdrawals to use correct timestamps...');
        
        const [updateResult] = await connection.query(`
            UPDATE withdrawals 
            SET requested_at = CONVERT_TZ(requested_at, '+00:00', '+03:00')
            WHERE status = 'pending' 
            AND requested_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
        `);
        
        console.log(`✅ Updated ${updateResult.affectedRows} recent withdrawals`);
        
        // 6. Verify the fix
        const [fixedWithdrawals] = await connection.query(`
            SELECT 
                id,
                amount,
                requested_at,
                TIMESTAMPDIFF(MINUTE, requested_at, NOW()) as minutes_ago
            FROM withdrawals 
            WHERE status = 'pending'
            ORDER BY requested_at DESC
            LIMIT 3
        `);
        
        console.log('\n✅ Fixed withdrawals:');
        fixedWithdrawals.forEach(w => {
            console.log(`   ID ${w.id}: KES ${w.amount} - ${w.minutes_ago} minutes ago - ${w.requested_at}`);
        });
        
        // 7. Set timezone for future connections
        console.log('\n⚙️  Setting timezone for future connections...');
        await connection.query("SET GLOBAL time_zone = '+03:00'");
        console.log('✅ Global timezone set to UTC+3 (Africa/Nairobi)');
        
    } catch (error) {
        console.error('❌ Error fixing withdrawal timestamps:', error);
    } finally {
        connection.release();
    }
}

// Run the fix
fixWithdrawalTimestamps()
    .then(() => {
        console.log('\n🎯 Withdrawal timestamp fix completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Withdrawal timestamp fix failed:', error);
        process.exit(1);
    });
