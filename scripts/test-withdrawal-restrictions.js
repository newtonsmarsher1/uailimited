const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function testWithdrawalRestrictions() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔍 Testing withdrawal restrictions...');
        
        // Test with user 0111575831 (ANTONY MOMANYI)
        const [userRows] = await connection.query('SELECT id, name, phone FROM users WHERE phone = ?', ['0111575831']);
        
        if (userRows.length === 0) {
            console.log('❌ User not found');
            return;
        }
        
        const user = userRows[0];
        console.log(`👤 Testing with user: ${user.name} (ID: ${user.id})`);
        
        // 1. Check if user has pending payments
        const [pendingPayments] = await connection.query(`
            SELECT COUNT(*) as count FROM payments 
            WHERE user_id = ? AND status = 'pending'
        `, [user.id]);
        
        console.log(`📊 Pending payments: ${pendingPayments[0].count}`);
        
        // 2. Check if user has pending withdrawals
        const [pendingWithdrawals] = await connection.query(`
            SELECT COUNT(*) as count FROM withdrawals 
            WHERE user_id = ? AND status = 'pending'
        `, [user.id]);
        
        console.log(`📊 Pending withdrawals: ${pendingWithdrawals[0].count}`);
        
        // 3. Check if user has withdrawn today
        const today = new Date().toISOString().split('T')[0];
        const [todayWithdrawals] = await connection.query(`
            SELECT COUNT(*) as count FROM withdrawals 
            WHERE user_id = ? AND DATE(requested_at) = ?
        `, [user.id, today]);
        
        console.log(`📅 Withdrawals today: ${todayWithdrawals[0].count}`);
        
        // 4. Check user's wallet balance
        const [userData] = await connection.query(`
            SELECT wallet_balance, withdrawal_pin, full_name, bank_type, account_number
            FROM users WHERE id = ?
        `, [user.id]);
        
        console.log(`💰 Wallet balance: KES ${userData[0].wallet_balance}`);
        console.log(`🔐 Has withdrawal PIN: ${!!userData[0].withdrawal_pin}`);
        console.log(`📋 Has binding details: ${!!(userData[0].full_name && userData[0].bank_type && userData[0].account_number)}`);
        
        // 5. Check current time restrictions
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;
        const startTime = 8 * 60; // 8:00 AM
        const endTime = 16 * 60; // 4:00 PM
        
        console.log(`⏰ Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
        console.log(`⏰ Allowed time: 8:00 AM - 4:00 PM`);
        console.log(`✅ Time allowed: ${currentTime >= startTime && currentTime < endTime}`);
        
        // 6. Check day restrictions
        const dayOfWeek = now.getDay();
        const isSunday = dayOfWeek === 0;
        console.log(`📅 Day of week: ${dayOfWeek} (0=Sunday)`);
        console.log(`✅ Day allowed: ${!isSunday}`);
        
        // 7. Check if it's the second Tuesday
        const isSecondTuesday = (
            dayOfWeek === 2 && // Tuesday
            now.getDate() >= 8 && now.getDate() <= 14 // Second week
        );
        console.log(`📅 Is second Tuesday: ${isSecondTuesday}`);
        
        // 8. Summary of restrictions
        console.log('\n🚫 Withdrawal restrictions check:');
        console.log(`   - Has pending payments: ${pendingPayments[0].count > 0 ? '❌ BLOCKED' : '✅ OK'}`);
        console.log(`   - Has pending withdrawals: ${pendingWithdrawals[0].count > 0 ? '❌ BLOCKED' : '✅ OK'}`);
        console.log(`   - Withdrawn today: ${todayWithdrawals[0].count > 0 ? '❌ BLOCKED' : '✅ OK'}`);
        console.log(`   - Time allowed: ${currentTime >= startTime && currentTime < endTime ? '✅ OK' : '❌ BLOCKED'}`);
        console.log(`   - Day allowed: ${!isSunday ? '✅ OK' : '❌ BLOCKED'}`);
        console.log(`   - Not second Tuesday: ${!isSecondTuesday ? '✅ OK' : '❌ BLOCKED'}`);
        console.log(`   - Has withdrawal PIN: ${userData[0].withdrawal_pin ? '✅ OK' : '❌ BLOCKED'}`);
        console.log(`   - Has binding details: ${(userData[0].full_name && userData[0].bank_type && userData[0].account_number) ? '✅ OK' : '❌ BLOCKED'}`);
        
        // 9. Check if there's a specific pending payment restriction
        console.log('\n🔍 Checking for pending payment restriction logic...');
        
        // Look for any code that checks pending payments before allowing withdrawal
        const [recentPayments] = await connection.query(`
            SELECT id, amount, status, payment_method, created_at
            FROM payments 
            WHERE user_id = ? AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 5
        `, [user.id]);
        
        console.log('📋 Recent pending payments:');
        recentPayments.forEach(p => {
            console.log(`   - ID ${p.id}: KES ${p.amount} - ${p.payment_method} - ${p.created_at}`);
        });
        
        if (recentPayments.length > 0) {
            console.log('\n⚠️  ISSUE: User has pending payments that might block withdrawals');
            console.log('💡 This could be the reason withdrawals are blocked');
        }
        
    } catch (error) {
        console.error('❌ Error testing withdrawal restrictions:', error);
    } finally {
        connection.release();
    }
}

// Run the test
testWithdrawalRestrictions()
    .then(() => {
        console.log('\n🎯 Withdrawal restrictions test completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Withdrawal restrictions test failed:', error);
        process.exit(1);
    });





