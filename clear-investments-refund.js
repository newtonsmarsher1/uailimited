const pool = require('./db.js');

async function clearInvestmentsAndRefund() {
  try {
    console.log('🧹 Clearing all investment data and refunding money...');
    
    // First, get all active investments that haven't been paid out
    const [activeInvestments] = await pool.query(`
      SELECT 
        i.id,
        i.user_id,
        i.amount,
        i.fund_name,
        i.status,
        i.paid_out,
        u.phone,
        u.balance as current_balance
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.paid_out = FALSE
      ORDER BY i.user_id, i.id
    `);
    
    console.log(`📊 Found ${activeInvestments.length} active investments to refund`);
    
    if (activeInvestments.length === 0) {
      console.log('✅ No active investments to refund');
    } else {
      // Group investments by user
      const userRefunds = {};
      activeInvestments.forEach(inv => {
        if (!userRefunds[inv.user_id]) {
          userRefunds[inv.user_id] = {
            user_id: inv.user_id,
            phone: inv.phone,
            current_balance: parseFloat(inv.current_balance || 0),
            investments: [],
            total_refund: 0
          };
        }
        userRefunds[inv.user_id].investments.push(inv);
        userRefunds[inv.user_id].total_refund += parseFloat(inv.amount);
      });
      
      console.log(`👥 Refunding ${Object.keys(userRefunds).length} users:`);
      
      // Start transaction for all refunds
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        for (const userId in userRefunds) {
          const user = userRefunds[userId];
          const newBalance = user.current_balance + user.total_refund;
          
          console.log(`\n💰 User ${user.phone}:`);
          console.log(`   Current Balance: KES ${user.current_balance.toFixed(2)}`);
          console.log(`   Refund Amount: KES ${user.total_refund.toFixed(2)}`);
          console.log(`   New Balance: KES ${newBalance.toFixed(2)}`);
          console.log(`   Investments to refund: ${user.investments.length}`);
          
          // Update user balance
          await connection.query(
            'UPDATE users SET balance = ? WHERE id = ?',
            [newBalance, userId]
          );
          
          // Mark investments as paid out
          for (const inv of user.investments) {
            await connection.query(
              'UPDATE investments SET paid_out = TRUE, paid_at = NOW(), status = "cancelled" WHERE id = ?',
              [inv.id]
            );
            console.log(`   ✅ Refunded investment ${inv.id}: KES ${inv.amount} (${inv.fund_name})`);
          }
        }
        
        // Delete all investment records (optional - uncomment if you want to completely remove them)
        // await connection.query('DELETE FROM investments');
        // console.log('🗑️ All investment records deleted');
        
        await connection.commit();
        console.log('\n✅ All refunds processed successfully!');
        
      } catch (error) {
        await connection.rollback();
        console.error('❌ Error processing refunds:', error);
        throw error;
      } finally {
        connection.release();
      }
    }
    
    // Show final status
    const [finalInvestments] = await pool.query(`
      SELECT 
        COUNT(*) as total_investments,
        SUM(CASE WHEN paid_out = FALSE THEN 1 ELSE 0 END) as active_investments,
        SUM(CASE WHEN paid_out = TRUE THEN 1 ELSE 0 END) as paid_investments
      FROM investments
    `);
    
    const [finalUsers] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(balance) as total_balance
      FROM users
    `);
    
    console.log('\n📊 Final Status:');
    console.log(`   Total Investments: ${finalInvestments[0].total_investments}`);
    console.log(`   Active Investments: ${finalInvestments[0].active_investments}`);
    console.log(`   Paid/Cancelled Investments: ${finalInvestments[0].paid_investments}`);
    console.log(`   Total Users: ${finalUsers[0].total_users}`);
    console.log(`   Total System Balance: KES ${parseFloat(finalUsers[0].total_balance || 0).toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error clearing investments:', error);
  } finally {
    process.exit(0);
  }
}

clearInvestmentsAndRefund(); 