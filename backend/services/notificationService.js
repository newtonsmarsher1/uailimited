const pool = require('../config/database.js');

// Push notification to user
async function pushNotification(userId, message, type = "info") {
  try {
    // Check if user exists before sending notification
    const [userExists] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userExists.length === 0) {
      console.log(`Skipping notification for user ${userId} - user not found in users table`);
      return;
    }
    
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
      [userId, message, type]
    );
  } catch (error) {
    console.error('Error pushing notification:', error);
  }
}

// Notify all CEO and HR Manager users
async function notifyAdminsOfNewUser(message) {
  try {
    // Get admin users from admin_users table
    const [admins] = await pool.query('SELECT id FROM admin_users WHERE role IN ("CEO", "HR Manager", "super_admin") AND is_active = 1');
    
    if (admins.length === 0) {
      console.log('No active admin users found for notifications');
      return;
    }
    
    let notificationsSent = 0;
    for (const admin of admins) {
      // Check if this admin user exists in the users table before sending notification
      const [userExists] = await pool.query('SELECT id FROM users WHERE id = ?', [admin.id]);
      if (userExists.length > 0) {
        await pushNotification(admin.id, message, "info");
        notificationsSent++;
      } else {
        console.log(`Skipping notification for admin ${admin.id} - user not found in users table`);
      }
    }
    
    console.log(`Sent ${notificationsSent} admin notifications for new user`);
  } catch (err) {
    console.error('Error notifying admins:', err);
  }
}

module.exports = {
  pushNotification,
  notifyAdminsOfNewUser
};
