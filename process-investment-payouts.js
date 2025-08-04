const pool = require('./db.js');

async function processInvestmentPayouts() {
  try {
    console.log('🔄 Processing investment payouts...');
    
    // Get all matured investments that haven't been paid out yet
    const [maturedInvestments] = await pool.query(`
      SELECT 
        i.id,
        i.user_id,
        i.fund_name,
        i.amount,
        i.roi_percentage as roi_percent,
        i.duration_days,
        i.start_date,
        i.end_date,
        u.phone,
        u.balance as current_balance
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.paid_out = FALSE 
      AND i.end_date <= NOW()
      AND i.status = 'active'
      ORDER BY i.end_date ASC
    `);

    if (maturedInvestments.length === 0) {
      console.log('✅ No matured investments to process');
      return;
    }

    console.log(`📊 Found ${maturedInvestments.length} matured investments to process`);

    for (const investment of maturedInvestments) {
             try {
         // Convert amount to number and calculate total payout (principal + interest)
         const principalAmount = parseFloat(investment.amount);
         const dailyROI = investment.roi_percent / 100;
         const totalROI = dailyROI * investment.duration_days;
         const interestAmount = principalAmount * totalROI;
         const totalPayout = principalAmount + interestAmount;

         console.log(`💰 Processing payout for investment ${investment.id}:`);
         console.log(`   User: ${investment.phone}`);
         console.log(`   Fund: ${investment.fund_name}`);
         console.log(`   Principal: KES ${principalAmount.toFixed(2)}`);
         console.log(`   Interest: KES ${interestAmount.toFixed(2)}`);
         console.log(`   Total Payout: KES ${totalPayout.toFixed(2)}`);

        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
          // Update user balance
          await connection.query(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [totalPayout, investment.user_id]
          );

          // Mark investment as paid out
          await connection.query(
            'UPDATE investments SET paid_out = TRUE, paid_at = NOW(), status = "completed" WHERE id = ?',
            [investment.id]
          );

                     // Add notification for user
           await connection.query(
             'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
             [
               investment.user_id,
               `🎉 Investment matured! Your ${investment.fund_name} investment of KES ${principalAmount.toFixed(2)} has earned KES ${interestAmount.toFixed(2)} interest. Total payout: KES ${totalPayout.toFixed(2)}`,
               'success'
             ]
           );

          // Also send a system notification
          console.log(`📢 Notification sent to user ${investment.user_id}: Investment payout processed`);

          await connection.commit();
          console.log(`✅ Successfully processed payout for investment ${investment.id}`);

        } catch (error) {
          await connection.rollback();
          console.error(`❌ Error processing investment ${investment.id}:`, error);
        } finally {
          connection.release();
        }

      } catch (error) {
        console.error(`❌ Error processing investment ${investment.id}:`, error);
      }
    }

    console.log('✅ Investment payout processing completed');

  } catch (error) {
    console.error('❌ Error in processInvestmentPayouts:', error);
  }
}

// Function to get investment statistics
async function getInvestmentStats(userId = null) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_investments,
        SUM(amount) as total_invested,
        SUM(CASE WHEN paid_out = TRUE THEN amount + (amount * (roi_percentage / 100) * duration_days) ELSE 0 END) as total_paid_out,
        SUM(CASE WHEN paid_out = FALSE AND end_date <= NOW() THEN amount + (amount * (roi_percentage / 100) * duration_days) ELSE 0 END) as pending_payouts,
        SUM(CASE WHEN paid_out = FALSE AND end_date > NOW() THEN amount ELSE 0 END) as active_investments
      FROM investments
    `;
    
    const params = [];
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const [stats] = await pool.query(query, params);
    return stats[0];
  } catch (error) {
    console.error('Error getting investment stats:', error);
    return null;
  }
}

// Export functions for use in other files
module.exports = {
  processInvestmentPayouts,
  getInvestmentStats
};

// If run directly, process payouts
if (require.main === module) {
  processInvestmentPayouts().then(() => {
    console.log('🏁 Payout processing script completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} 