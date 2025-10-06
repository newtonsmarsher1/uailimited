const pool = require('../config/database.js');

class MonthlyResetService {
  constructor() {
    this.isRunning = false;
    this.lastResetMonth = null;
  }

  // Check if it's time for a monthly reset
  isTimeForReset() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthYear = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    
    // Check if it's the first day of the month (between 00:00 and 01:00)
    const day = now.getDate();
    const hours = now.getHours();
    
    if (day === 1 && hours >= 0 && hours <= 1) {
      // Check if reset was already done this month
      return this.checkIfResetNeeded(monthYear);
    }
    
    return false;
  }

  // Check if reset is needed for the current month
  async checkIfResetNeeded(monthYear) {
    try {
      const [resetLog] = await pool.query(
        'SELECT id FROM monthly_reset_log WHERE reset_month = ?',
        [monthYear]
      );
      return resetLog.length === 0; // Reset needed if no log exists
    } catch (error) {
      console.error('Error checking reset status:', error);
      return false;
    }
  }

  // Perform monthly reset
  async performMonthlyReset() {
    if (this.isRunning) {
      console.log('🔄 Monthly reset already in progress...');
      return;
    }

    this.isRunning = true;
    const connection = await pool.getConnection();
    
    try {
      console.log('🔄 Starting monthly reset process...');
      
      await connection.beginTransaction();

      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
      const currentYear = now.getFullYear();
      const monthYear = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
      
      // Check if reset was already done this month
      const [resetLog] = await connection.query(
        'SELECT id FROM monthly_reset_log WHERE reset_month = ?',
        [monthYear]
      );

      if (resetLog.length > 0) {
        console.log('✅ Monthly reset already completed for this month');
        return;
      }

      // Get all active users (using is_active column instead of status)
      const [users] = await connection.query(
        'SELECT id FROM users WHERE is_active = 1 OR is_active IS NULL'
      );

      let earningsReset = 0;
      let usersAffected = 0;

      for (const user of users) {
        // Reset monthly earnings for each user in both tables
        const [result1] = await connection.query(`
          UPDATE user_earnings_summary 
          SET this_month_earnings = 0.00
          WHERE user_id = ?
        `, [user.id]);

        const [result2] = await connection.query(`
          UPDATE users 
          SET this_month_earnings = 0.00
          WHERE id = ?
        `, [user.id]);

        if (result1.affectedRows > 0 || result2.affectedRows > 0) {
          usersAffected++;
          earningsReset += (result1.affectedRows + result2.affectedRows);
        }
      }

      // Log the reset
      await connection.query(`
        INSERT INTO monthly_reset_log (reset_month, users_reset, earnings_reset, users_affected, reset_time, status, notes)
        VALUES (?, ?, ?, ?, NOW(), 'success', 'Monthly reset completed automatically')
      `, [monthYear, usersAffected, earningsReset, usersAffected]);

      await connection.commit();

      this.lastResetMonth = `${currentMonth}_${currentYear}`;
      
      console.log(`✅ Monthly reset completed successfully!`);
      console.log(`📊 Users affected: ${usersAffected}`);
      console.log(`🔄 Earnings reset: ${earningsReset}`);
      console.log(`📅 Reset month: ${monthYear}`);

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error during monthly reset:', error);
    } finally {
      connection.release();
      this.isRunning = false;
    }
  }

  // Start the monthly reset scheduler
  startScheduler() {
    console.log('🕐 Starting monthly reset scheduler...');
    
    // Check every 15 minutes if it's time for reset
    setInterval(async () => {
      if (await this.isTimeForReset()) {
        this.performMonthlyReset();
      }
    }, 900000); // Check every 15 minutes

    // Also check immediately on startup
    setTimeout(async () => {
      if (await this.isTimeForReset()) {
        this.performMonthlyReset();
      }
    }, 5000); // Check after 5 seconds
  }

  // Manual reset (for testing)
  async manualReset() {
    console.log('🔧 Performing manual monthly reset...');
    await this.performMonthlyReset();
  }

  // Get reset status
  async getResetStatus() {
    try {
      const [lastReset] = await pool.query(
        'SELECT * FROM monthly_reset_log ORDER BY reset_time DESC LIMIT 1'
      );

      const [thisMonthStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          SUM(this_month_earnings) as total_monthly_earnings
        FROM user_earnings_summary
      `);

      return {
        lastReset: lastReset[0] || null,
        thisMonthStats: thisMonthStats[0] || {
          total_users: 0,
          total_monthly_earnings: 0
        },
        schedulerRunning: true,
        lastResetMonth: this.lastResetMonth
      };
    } catch (error) {
      console.error('Error getting monthly reset status:', error);
      return { error: 'Failed to get monthly reset status' };
    }
  }
}

module.exports = new MonthlyResetService();

