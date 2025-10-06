const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function checkWithdrawalIssues() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔍 Checking withdrawal system issues...');
        
        // 1. Check pending payments
        const [pendingPayments] = await connection.query(`
            SELECT COUNT(*) as count FROM payments WHERE status = 'pending'
        `);
        
        console.log(`📊 Pending payments: ${pendingPayments[0].count}`);
        
        // 2. Check pending withdrawals
        const [pendingWithdrawals] = await connection.query(`
            SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'
        `);
        
        console.log(`📊 Pending withdrawals: ${pendingWithdrawals[0].count}`);
        
        // 3. Check recent withdrawals with status
        const [recentWithdrawals] = await connection.query(`
            SELECT 
                w.id,
                w.user_id,
                u.name,
                u.phone,
                w.amount,
                w.status,
                w.requested_at,
                w.processed_at
            FROM withdrawals w
            LEFT JOIN users u ON w.user_id = u.id
            ORDER BY w.requested_at DESC
            LIMIT 10
        `);
        
        console.log('\n📋 Recent withdrawals:');
        recentWithdrawals.forEach(w => {
            console.log(`   - ${w.name} (${w.phone}): KES ${w.amount} - ${w.status} - ${w.requested_at}`);
        });
        
        // 4. Check if there are any users with pending payments who can't withdraw
        const [usersWithPendingPayments] = await connection.query(`
            SELECT 
                u.id,
                u.name,
                u.phone,
                COUNT(p.id) as pending_payments
            FROM users u
            LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'pending'
            GROUP BY u.id, u.name, u.phone
            HAVING pending_payments > 0
            LIMIT 5
        `);
        
        console.log('\n⚠️  Users with pending payments:');
        usersWithPendingPayments.forEach(user => {
            console.log(`   - ${user.name} (${user.phone}): ${user.pending_payments} pending payments`);
        });
        
        // 5. Check withdrawal status API logic
        console.log('\n🔍 Checking withdrawal status API logic...');
        const [todayWithdrawals] = await connection.query(`
            SELECT 
                w.id,
                w.user_id,
                u.name,
                w.status,
                w.requested_at,
                DATE(w.requested_at) as request_date,
                CURDATE() as today
            FROM withdrawals w
            LEFT JOIN users u ON w.user_id = u.id
            WHERE DATE(w.requested_at) = CURDATE()
            ORDER BY w.requested_at DESC
            LIMIT 5
        `);
        
        console.log('📅 Today\'s withdrawals:');
        todayWithdrawals.forEach(w => {
            console.log(`   - ${w.name}: ${w.status} - ${w.requested_at} (Date: ${w.request_date}, Today: ${w.today})`);
        });
        
        // 6. Check if there are any issues with the status display logic
        console.log('\n🎨 Checking status display logic...');
        const [statusTest] = await connection.query(`
            SELECT 
                w.id,
                w.status,
                w.requested_at,
                TIMESTAMPDIFF(MINUTE, w.requested_at, NOW()) as minutes_elapsed
            FROM withdrawals w
            WHERE w.status = 'pending'
            ORDER BY w.requested_at DESC
            LIMIT 3
        `);
        
        console.log('⏰ Pending withdrawals timing:');
        statusTest.forEach(w => {
            const shouldShowProcessing = w.minutes_elapsed >= 15;
            console.log(`   - ID ${w.id}: ${w.minutes_elapsed} minutes elapsed - Should show ${shouldShowProcessing ? 'Disbursement in Progress' : 'Pending Review'}`);
        });
        
    } catch (error) {
        console.error('❌ Error checking withdrawal issues:', error);
    } finally {
        connection.release();
    }
}

// Run the check
checkWithdrawalIssues()
    .then(() => {
        console.log('\n🎯 Withdrawal issues check completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Withdrawal issues check failed:', error);
        process.exit(1);
    });





