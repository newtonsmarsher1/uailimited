const mysql = require('mysql2/promise');

class DailyEarningsService {
  constructor() {
    this.pool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: 'Caroline',
      database: 'uai',
      port: 3306
    });
    this.isRunning = false;
  }

  // Update monthly earnings for a specific user
  async updateUserMonthlyEarnings(userId) {
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Calculate this month's earnings from user_tasks
      const [monthEarnings] = await this.pool.execute(`
        SELECT COALESCE(SUM(reward_earned), 0) as total 
        FROM user_tasks 
        WHERE user_id = ? 
        AND MONTH(completed_at) = ? 
        AND YEAR(completed_at) = ?
        AND completed_at IS NOT NULL
      `, [userId, currentMonth, currentYear]);
      
      const earnings = parseFloat(monthEarnings[0].total);
      
      // Update the user_earnings_summary table
      await this.pool.execute(`
        UPDATE user_earnings_summary 
        SET this_month_earnings = ?
        WHERE user_id = ?
      `, [earnings, userId]);
      
      return earnings;
    } catch (error) {
      console.error(`❌ Error updating monthly earnings for user ${userId}:`, error);
      return 0;
    }
  }

  // Update monthly earnings for all users
  async updateAllUsersMonthlyEarnings() {
    try {
      console.log('🔄 Updating monthly earnings for all users...');
      
      const [allUsers] = await this.pool.execute('SELECT id, name FROM users');
      let updatedCount = 0;
      let totalEarnings = 0;
      
      for (const user of allUsers) {
        const earnings = await this.updateUserMonthlyEarnings(user.id);
        if (earnings > 0) {
          updatedCount++;
          totalEarnings += earnings;
        }
      }
      
      console.log(`✅ Updated ${updatedCount} users with earnings`);
      console.log(`💰 Total monthly earnings: KES ${totalEarnings.toFixed(2)}`);
      
      return { updatedCount, totalEarnings };
    } catch (error) {
      console.error('❌ Error updating all users monthly earnings:', error);
      return { updatedCount: 0, totalEarnings: 0 };
    }
  }

  // Start the daily earnings service
  startService() {
    if (this.isRunning) {
      console.log('⚠️ Daily earnings service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🕐 Starting Daily Earnings Update Service...');
    
    // Update every hour to ensure real-time accuracy
    setInterval(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        
        // Only update during active hours (6 AM to 11 PM)
        if (hour >= 6 && hour <= 23) {
          console.log(`🔄 Hourly earnings update at ${now.toLocaleTimeString()}`);
          
          // Get users who completed tasks today
          const [activeUsers] = await this.pool.execute(`
            SELECT DISTINCT user_id 
            FROM user_tasks 
            WHERE DATE(completed_at) = CURDATE() 
            AND completed_at IS NOT NULL
          `);
          
          console.log(`📊 Found ${activeUsers.length} users with tasks today`);
          
          // Update only active users to optimize performance
          for (const activeUser of activeUsers) {
            await this.updateUserMonthlyEarnings(activeUser.user_id);
          }
          
          console.log(`✅ Updated ${activeUsers.length} active users`);
        }
      } catch (error) {
        console.error('❌ Error in hourly earnings update:', error);
      }
    }, 3600000); // Every hour
    
    // Also update immediately on startup
    setTimeout(async () => {
      console.log('🚀 Initial earnings update on startup...');
      await this.updateAllUsersMonthlyEarnings();
    }, 5000);
  }

  // Stop the service
  stopService() {
    this.isRunning = false;
    console.log('🛑 Daily earnings service stopped');
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      serviceName: 'Daily Earnings Update Service',
      description: 'Updates monthly earnings in real-time for active users'
    };
  }
}

module.exports = DailyEarningsService;
