const pool = require('./db.js');

async function clearAllInvestmentsAndRefund() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting investment cleanup and refund process...');
    
    // Get all active investments
    const [investments] = await connection.query(`
      SELECT i.id, i.user_id, i.amount, i.fund_name, u.phone, u.balance
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.status = 'active'
      ORDER BY i.user_id
    `);
    
    console.log(`📊 Found ${investments.length} active investments to refund`);
    
    if (investments.length === 0) {
      console.log('✅ No active investments found. Nothing to refund.');
      return;
    }
    
    // Group investments by user
    const userInvestments = {};
    investments.forEach(inv => {
      if (!userInvestments[inv.user_id]) {
        userInvestments[inv.user_id] = {
          user_id: inv.user_id,
          phone: inv.phone,
          current_balance: inv.balance,
          investments: [],
          total_refund: 0
        };
      }
      userInvestments[inv.user_id].investments.push(inv);
      userInvestments[inv.user_id].total_refund += parseFloat(inv.amount);
    });
    
    console.log(`👥 Affected users: ${Object.keys(userInvestments).length}`);
    
    // Start transaction
    await connection.beginTransaction();
    
    let refundedUsers = 0;
    let totalRefunded = 0;
    
    for (const userId in userInvestments) {
      const userData = userInvestments[userId];
      
      try {
        console.log(`\n💰 Processing user ${userId} (${userData.phone})`);
        console.log(`   Current balance: KES ${userData.current_balance}`);
        console.log(`   Investments to refund: ${userData.investments.length}`);
        console.log(`   Total refund amount: KES ${userData.total_refund}`);
        
        // Calculate new balance
        const newBalance = parseFloat(userData.current_balance) + userData.total_refund;
        
        // Update user balance
        await connection.query(
          'UPDATE users SET balance = ? WHERE id = ?',
          [newBalance, userId]
        );
        
        console.log(`   ✅ Balance updated to: KES ${newBalance}`);
        
        // Mark investments as cancelled
        const investmentIds = userData.investments.map(inv => inv.id);
        await connection.query(
          'UPDATE investments SET status = "cancelled", paid_out = 1, paid_at = NOW() WHERE id IN (?)',
          [investmentIds]
        );
        
        console.log(`   ✅ ${investmentIds.length} investments marked as cancelled`);
        
        // Send notification to user
        const notificationMessage = `Dear valued customer, we sincerely apologize for the inconvenience. Your investment(s) in our wealth fund have been cancelled and the full amount of KES ${userData.total_refund.toFixed(2)} has been refunded to your wallet. The company is very sorry for this situation. Your new wallet balance is KES ${newBalance.toFixed(2)}. Thank you for your understanding.`;
        
        await connection.query(
          'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
          [userId, notificationMessage, 'info']
        );
        
        console.log(`   ✅ Notification sent to user`);
        
        refundedUsers++;
        totalRefunded += userData.total_refund;
        
      } catch (error) {
        console.error(`   ❌ Error processing user ${userId}:`, error.message);
        throw error;
      }
    }
    
    // Commit transaction
    await connection.commit();
    
    console.log('\n🎉 REFUND PROCESS COMPLETED SUCCESSFULLY!');
    console.log(`📊 Summary:`);
    console.log(`   - Users refunded: ${refundedUsers}`);
    console.log(`   - Total amount refunded: KES ${totalRefunded.toFixed(2)}`);
    console.log(`   - Investments cancelled: ${investments.length}`);
    
    // Verify the results
    console.log('\n🔍 Verifying results...');
    
    const [remainingActive] = await connection.query(
      'SELECT COUNT(*) as count FROM investments WHERE status = "active"'
    );
    
    console.log(`   - Remaining active investments: ${remainingActive[0].count}`);
    
    if (remainingActive[0].count === 0) {
      console.log('   ✅ All active investments have been successfully cancelled');
    } else {
      console.log('   ⚠️ Some active investments remain');
    }
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error during refund process:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script
clearAllInvestmentsAndRefund()
  .then(() => {
    console.log('\n✅ Investment cleanup and refund process completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Process failed:', error.message);
    process.exit(1);
  }); 