const pool = require('../config/database.js');
const { pushNotification } = require('./notificationService.js');

// Process investment payouts
async function processInvestmentPayouts() {
  try {
    console.log('🔄 Processing investment payouts...');
    
    // Get all completed investments that haven't been paid out
    const [completedInvestments] = await pool.query(`
      SELECT 
        i.*,
        u.balance as user_balance,
        u.name as user_name
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.status = 'active' 
      AND i.end_date <= NOW()
      AND i.payout_processed = FALSE
    `);
    
    console.log(`📊 Found ${completedInvestments.length} completed investments to process`);
    
    for (const investment of completedInvestments) {
      try {
        // Calculate payout amount
        const payoutAmount = investment.amount + (investment.amount * (investment.roi_percentage / 100) * investment.duration_days);
        
        // Update user balance
        const newBalance = parseFloat(investment.user_balance || 0) + payoutAmount;
        await pool.query(
          'UPDATE users SET balance = ? WHERE id = ?',
          [newBalance, investment.user_id]
        );
        
        // Mark investment as completed and paid out
        await pool.query(
          'UPDATE investments SET status = "completed", payout_processed = TRUE, payout_amount = ?, payout_date = NOW() WHERE id = ?',
          [payoutAmount, investment.id]
        );
        
        // Send notification to user
        await pushNotification(
          investment.user_id,
          `Investment in ${investment.fund_name} completed! You received KES ${payoutAmount.toFixed(2)}.`,
          'success'
        );
        
        console.log(`✅ Processed payout for user ${investment.user_id}: KES ${payoutAmount.toFixed(2)}`);
        
      } catch (error) {
        console.error(`❌ Error processing payout for investment ${investment.id}:`, error);
      }
    }
    
    console.log('✅ Investment payout processing completed');
    
  } catch (error) {
    console.error('❌ Error in processInvestmentPayouts:', error);
    throw error;
  }
}

// Get investment statistics for user
async function getInvestmentStats(userId) {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_investments,
        SUM(amount) as total_invested,
        SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as active_investments,
        SUM(CASE WHEN status = 'completed' THEN payout_amount ELSE 0 END) as total_earned,
        AVG(roi_percentage) as avg_roi
      FROM investments 
      WHERE user_id = ?
    `, [userId]);
    
    return stats[0] || {
      total_investments: 0,
      total_invested: 0,
      active_investments: 0,
      total_earned: 0,
      avg_roi: 0
    };
    
  } catch (error) {
    console.error('Error getting investment stats:', error);
    throw error;
  }
}

module.exports = {
  processInvestmentPayouts,
  getInvestmentStats
};
