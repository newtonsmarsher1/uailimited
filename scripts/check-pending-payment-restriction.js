const mysql = require('mysql2/promise');

// Database configuration
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
});

async function checkPendingPaymentRestriction() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔍 Checking for pending payment restriction...');
        
        // Test with user 0111575831 (ANTONY MOMANYI)
        const [userRows] = await connection.query('SELECT id, name, phone FROM users WHERE phone = ?', ['0111575831']);
        
        if (userRows.length === 0) {
            console.log('❌ User not found');
            return;
        }
        
        const user = userRows[0];
        console.log(`👤 Testing with user: ${user.name} (ID: ${user.id})`);
        
        // 1. Check all pending payments for this user
        const [pendingPayments] = await connection.query(`
            SELECT id, amount, status, payment_method, created_at, description
            FROM payments 
            WHERE user_id = ? AND status = 'pending'
            ORDER BY created_at DESC
        `, [user.id]);
        
        console.log(`📊 Pending payments: ${pendingPayments.length}`);
        pendingPayments.forEach(p => {
            console.log(`   - ID ${p.id}: KES ${p.amount} - ${p.payment_method} - ${p.created_at}`);
            console.log(`     Description: ${p.description}`);
        });
        
        // 2. Check if there are any withdrawal-related pending payments
        const withdrawalPayments = pendingPayments.filter(p => p.payment_method === 'withdrawal');
        console.log(`\n💰 Withdrawal-related pending payments: ${withdrawalPayments.length}`);
        
        // 3. Check if there are any recharge-related pending payments
        const rechargePayments = pendingPayments.filter(p => p.payment_method !== 'withdrawal');
        console.log(`💳 Recharge-related pending payments: ${rechargePayments.length}`);
        
        // 4. Check if there's a specific restriction logic
        console.log('\n🔍 Checking for restriction logic...');
        
        // Look for any code that might block withdrawals based on pending payments
        if (rechargePayments.length > 0) {
            console.log('⚠️  User has pending recharge payments that might block withdrawals');
            console.log('💡 This could be the reason withdrawals are blocked');
            
            // Check if these are old pending payments that should be cleaned up
            const oldPayments = rechargePayments.filter(p => {
                const paymentDate = new Date(p.created_at);
                const now = new Date();
                const daysDiff = (now - paymentDate) / (1000 * 60 * 60 * 24);
                return daysDiff > 1; // Older than 1 day
            });
            
            if (oldPayments.length > 0) {
                console.log(`\n🧹 Found ${oldPayments.length} old pending payments (older than 1 day):`);
                oldPayments.forEach(p => {
                    const daysOld = Math.floor((new Date() - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
                    console.log(`   - ID ${p.id}: ${daysOld} days old - ${p.description}`);
                });
                console.log('💡 These old pending payments should be cleaned up');
            }
        }
        
        // 5. Check if there's a specific restriction in the code
        console.log('\n🔍 Checking for specific restriction logic...');
        
        // Look for any code that checks pending payments before allowing withdrawal
        const [recentWithdrawals] = await connection.query(`
            SELECT id, amount, status, requested_at
            FROM withdrawals 
            WHERE user_id = ? 
            ORDER BY requested_at DESC
            LIMIT 3
        `, [user.id]);
        
        console.log('📋 Recent withdrawals:');
        recentWithdrawals.forEach(w => {
            console.log(`   - ID ${w.id}: KES ${w.amount} - ${w.status} - ${w.requested_at}`);
        });
        
        // 6. Check if the issue is with the "already withdrawn today" logic
        const today = new Date().toISOString().split('T')[0];
        const [todayWithdrawals] = await connection.query(`
            SELECT COUNT(*) as count FROM withdrawals 
            WHERE user_id = ? AND DATE(requested_at) = ?
        `, [user.id, today]);
        
        console.log(`\n📅 Withdrawals today: ${todayWithdrawals[0].count}`);
        
        if (todayWithdrawals[0].count > 0) {
            console.log('❌ ISSUE: User has already withdrawn today - this blocks new withdrawals');
            console.log('💡 This is the main reason withdrawals are blocked');
        }
        
        // 7. Summary
        console.log('\n📊 Summary:');
        console.log(`   - Pending payments: ${pendingPayments.length}`);
        console.log(`   - Withdrawal payments: ${withdrawalPayments.length}`);
        console.log(`   - Recharge payments: ${rechargePayments.length}`);
        console.log(`   - Withdrawals today: ${todayWithdrawals[0].count}`);
        console.log(`   - Main blocker: ${todayWithdrawals[0].count > 0 ? 'Already withdrawn today' : 'No obvious blocker'}`);
        
    } catch (error) {
        console.error('❌ Error checking pending payment restriction:', error);
    } finally {
        connection.release();
    }
}

// Run the check
checkPendingPaymentRestriction()
    .then(() => {
        console.log('\n🎯 Pending payment restriction check completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Pending payment restriction check failed:', error);
        process.exit(1);
    });





