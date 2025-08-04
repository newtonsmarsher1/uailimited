const pool = require('./db.js');

async function checkNotifications() {
  try {
    console.log('=== Checking Notifications ===\n');
    
    // Check if notifications table exists and has data
    const [notifications] = await pool.query(`
      SELECT n.*, u.phone, u.referral_code 
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
    `);
    
    console.log(`Total notifications in database: ${notifications.length}\n`);
    
    if (notifications.length === 0) {
      console.log('No notifications found. Checking if notifications table exists...');
      
      const [tables] = await pool.query(`
        SHOW TABLES LIKE 'notifications'
      `);
      
      if (tables.length === 0) {
        console.log('Notifications table does not exist. Creating it...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            message TEXT NOT NULL,
            type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        console.log('Notifications table created successfully.');
      }
    } else {
      console.log('Recent notifications:');
      notifications.slice(0, 10).forEach(notification => {
        const date = new Date(notification.created_at).toLocaleString();
        console.log(`📧 ${date} - User ${notification.user_id} (${notification.phone}): ${notification.message}`);
      });
    }
    
    // Check users and their referral codes
    console.log('\n=== Current Users and Referral Codes ===');
    const [users] = await pool.query(`
      SELECT id, phone, referral_code, referred_by 
      FROM users 
      ORDER BY id
    `);
    
    users.forEach(user => {
      console.log(`👤 User ${user.id} (${user.phone}): ${user.referral_code || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('Error checking notifications:', error);
  } finally {
    await pool.end();
  }
}

checkNotifications(); 