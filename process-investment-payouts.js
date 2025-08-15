const pool = require('./db-vercel.js');

// Process investment payouts
async function processInvestmentPayouts() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // Get matured investments
    const [maturedInvestments] = await connection.query(`
      SELECT 
        i.id,
        i.user_id,
        i.fund_name,
        i.amount,
        i.roi_percentage,
        i.duration_days,
        i.start_date,
        i.end_date,
        i.wallet_type,
        u.balance as user_balance
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.status = 'active' 
      AND i.end_date <= NOW()
      AND i.total_earned = 0
    `);
    
    console.log(`📊 Found ${maturedInvestments.length} matured investments to process`);
    
    for (const investment of maturedInvestments) {
      try {
        await connection.beginTransaction();
        
        // Calculate earnings
        const totalEarnings = (investment.amount * investment.roi_percentage) / 100;
        
        // Update investment
        await connection.query(`
          UPDATE investments 
          SET status = 'completed', total_earned = ?, updated_at = NOW()
          WHERE id = ?
        `, [totalEarnings, investment.id]);
        
        // Update user balance
        if (investment.wallet_type === 'wallet') {
          await connection.query(`
            UPDATE users 
            SET balance = balance + ?, updated_at = NOW()
            WHERE id = ?
          `, [totalEarnings, investment.user_id]);
        } else {
          await connection.query(`
            UPDATE users 
            SET balance = balance + ?, updated_at = NOW()
            WHERE id = ?
          `, [totalEarnings, investment.user_id]);
        }
        
        await connection.commit();
        
        console.log(`✅ Processed investment ${investment.id}: User ${investment.user_id} earned KES ${totalEarnings}`);
        
      } catch (error) {
        await connection.rollback();
        console.error(`❌ Error processing investment ${investment.id}:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in processInvestmentPayouts:', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Get investment statistics
async function getInvestmentStats(userId) {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_investments,
        SUM(amount) as total_invested,
        SUM(total_earned) as total_earned,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_investments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_investments
      FROM investments 
      WHERE user_id = ?
    `, [userId]);
    
    return stats[0] || {
      total_investments: 0,
      total_invested: 0,
      total_earned: 0,
      active_investments: 0,
      completed_investments: 0
    };
  } catch (error) {
    console.error('❌ Error getting investment stats:', error);
    return {
      total_investments: 0,
      total_invested: 0,
      total_earned: 0,
      active_investments: 0,
      completed_investments: 0
    };
  }
}

module.exports = {
  processInvestmentPayouts,
  getInvestmentStats
};
