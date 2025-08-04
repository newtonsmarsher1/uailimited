const pool = require('./db.js');

async function completeInvestmentCleanup() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🧹 Starting complete investment cleanup...\n');
    
    // First, let's see what we have
    const [allInvestments] = await connection.query(`
      SELECT id, user_id, fund_name, amount, status, created_at
      FROM investments
      ORDER BY id
    `);
    
    console.log(`📊 Current investment records: ${allInvestments.length}`);
    
    if (allInvestments.length > 0) {
      console.log('📋 Investment Summary:');
      allInvestments.forEach(inv => {
        console.log(`   ID: ${inv.id}, User: ${inv.user_id}, Fund: ${inv.fund_name}, Amount: ${inv.amount}, Status: ${inv.status}`);
      });
    }
    
    // Check if there are any active investments that need refunding
    const [activeInvestments] = await connection.query(`
      SELECT i.id, i.user_id, i.amount, u.balance, u.phone
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.status = 'active'
    `);
    
    if (activeInvestments.length > 0) {
      console.log(`\n💰 Found ${activeInvestments.length} active investments to refund first...`);
      
      // Group by user
      const userRefunds = {};
      activeInvestments.forEach(inv => {
        if (!userRefunds[inv.user_id]) {
          userRefunds[inv.user_id] = {
            user_id: inv.user_id,
            phone: inv.phone,
            current_balance: inv.balance,
            total_refund: 0
          };
        }
        userRefunds[inv.user_id].total_refund += parseFloat(inv.amount);
      });
      
      // Start transaction for refunds
      await connection.beginTransaction();
      
      for (const userId in userRefunds) {
        const userData = userRefunds[userId];
        const newBalance = parseFloat(userData.current_balance) + userData.total_refund;
        
        console.log(`   Refunding user ${userId} (${userData.phone}): KES ${userData.total_refund}`);
        
        // Update user balance
        await connection.query(
          'UPDATE users SET balance = ? WHERE id = ?',
          [newBalance, userId]
        );
        
        // Send notification
        const notificationMessage = `Dear valued customer, we sincerely apologize for the inconvenience. Your investment(s) in our wealth fund have been cancelled and the full amount of KES ${userData.total_refund.toFixed(2)} has been refunded to your wallet. The company is very sorry for this situation. Your new wallet balance is KES ${newBalance.toFixed(2)}. Thank you for your understanding.`;
        
        await connection.query(
          'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
          [userId, notificationMessage, 'info']
        );
      }
      
      await connection.commit();
      console.log('   ✅ Refunds completed');
    }
    
    // Now completely delete ALL investment records
    console.log('\n🗑️ Deleting ALL investment records...');
    
    await connection.beginTransaction();
    
    const [deleteResult] = await connection.query('DELETE FROM investments');
    
    await connection.commit();
    
    console.log(`✅ Deleted ${deleteResult.affectedRows} investment records`);
    
    // Verify deletion
    const [remainingInvestments] = await connection.query('SELECT COUNT(*) as count FROM investments');
    console.log(`📊 Remaining investment records: ${remainingInvestments[0].count}`);
    
    if (remainingInvestments[0].count === 0) {
      console.log('🎉 All investment records have been completely removed!');
    } else {
      console.log('⚠️ Some investment records still remain');
    }
    
    // Show final user balances
    console.log('\n💰 Final user balances:');
    const [users] = await connection.query(`
      SELECT id, phone, balance 
      FROM users 
      ORDER BY id
    `);
    
    users.forEach(user => {
      console.log(`   User ${user.id} (${user.phone}): KES ${user.balance}`);
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script
completeInvestmentCleanup()
  .then(() => {
    console.log('\n✅ Complete investment cleanup finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }); 