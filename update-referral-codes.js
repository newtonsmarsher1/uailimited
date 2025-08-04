const pool = require('./db.js');

// Function to generate random alphanumeric code (6-8 characters)
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = Math.floor(Math.random() * 3) + 6; // 6-8 characters
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to check if referral code already exists
async function isReferralCodeUnique(code) {
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [code]);
    return rows.length === 0;
  } catch (error) {
    console.error('Error checking referral code uniqueness:', error);
    return false;
  }
}

// Function to generate unique referral code
async function generateUniqueReferralCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    code = generateReferralCode();
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique referral code after 100 attempts');
    }
  } while (!(await isReferralCodeUnique(code)));
  
  return code;
}

// Function to send notification to user
async function sendNotification(userId, message, type = 'info') {
  try {
    // Check if notifications table exists, if not create it
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
    
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
      [userId, message, type]
    );
    console.log(`Notification sent to user ${userId}: ${message}`);
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}

// Main function to update all referral codes
async function updateAllReferralCodes() {
  try {
    console.log('Starting referral code update process...');
    
    // Get all users who need referral codes updated
    const [users] = await pool.query(`
      SELECT id, phone, referral_code 
      FROM users 
      WHERE referral_code IS NULL 
         OR LENGTH(referral_code) < 6 
         OR LENGTH(referral_code) > 8
         OR referral_code NOT REGEXP '^[A-Z0-9]+$'
    `);
    
    console.log(`Found ${users.length} users to update`);
    
    if (users.length === 0) {
      console.log('No users need referral code updates');
      return;
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Generate unique referral code
        const newReferralCode = await generateUniqueReferralCode();
        
        // Update user's referral code
        await pool.query(
          'UPDATE users SET referral_code = ? WHERE id = ?',
          [newReferralCode, user.id]
        );
        
        // Send notification to user
        const notificationMessage = `Your referral code has been updated to: ${newReferralCode}. Share this code with friends to earn rewards!`;
        await sendNotification(user.id, notificationMessage, 'success');
        
        console.log(`Updated user ${user.id} (${user.phone}): ${user.referral_code || 'NULL'} → ${newReferralCode}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`Error updating user ${user.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n=== Update Summary ===`);
    console.log(`Total users processed: ${users.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Also update users who have referral codes but they're not in the right format
    const [formatUsers] = await pool.query(`
      SELECT id, phone, referral_code 
      FROM users 
      WHERE referral_code IS NOT NULL 
        AND (LENGTH(referral_code) < 6 OR LENGTH(referral_code) > 8 OR referral_code NOT REGEXP '^[A-Z0-9]+$')
    `);
    
    if (formatUsers.length > 0) {
      console.log(`\nUpdating ${formatUsers.length} users with invalid format codes...`);
      
      for (const user of formatUsers) {
        try {
          const newReferralCode = await generateUniqueReferralCode();
          
          await pool.query(
            'UPDATE users SET referral_code = ? WHERE id = ?',
            [newReferralCode, user.id]
          );
          
          const notificationMessage = `Your referral code has been updated to: ${newReferralCode}. Share this code with friends to earn rewards!`;
          await sendNotification(user.id, notificationMessage, 'success');
          
          console.log(`Updated format for user ${user.id} (${user.phone}): ${user.referral_code} → ${newReferralCode}`);
          
        } catch (error) {
          console.error(`Error updating format for user ${user.id}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error in updateAllReferralCodes:', error);
  }
}

// Function to ensure all new users get proper referral codes
async function ensureNewUsersGetReferralCodes() {
  try {
    console.log('Ensuring all new users have proper referral codes...');
    
    // Get users without referral codes
    const [users] = await pool.query(`
      SELECT id, phone 
      FROM users 
      WHERE referral_code IS NULL
    `);
    
    console.log(`Found ${users.length} users without referral codes`);
    
    for (const user of users) {
      try {
        const newReferralCode = await generateUniqueReferralCode();
        
        await pool.query(
          'UPDATE users SET referral_code = ? WHERE id = ?',
          [newReferralCode, user.id]
        );
        
        const notificationMessage = `Welcome! Your referral code is: ${newReferralCode}. Share this code with friends to earn rewards!`;
        await sendNotification(user.id, notificationMessage, 'info');
        
        console.log(`Assigned referral code to user ${user.id} (${user.phone}): ${newReferralCode}`);
        
      } catch (error) {
        console.error(`Error assigning referral code to user ${user.id}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Error in ensureNewUsersGetReferralCodes:', error);
  }
}

// Function to validate all referral codes
async function validateReferralCodes() {
  try {
    console.log('Validating all referral codes...');
    
    const [users] = await pool.query(`
      SELECT id, phone, referral_code 
      FROM users 
      WHERE referral_code IS NOT NULL
    `);
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const user of users) {
      const isValid = user.referral_code && 
                     user.referral_code.length >= 6 && 
                     user.referral_code.length <= 8 && 
                     /^[A-Z0-9]+$/.test(user.referral_code);
      
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
        console.log(`Invalid referral code for user ${user.id} (${user.phone}): ${user.referral_code}`);
      }
    }
    
    console.log(`\n=== Validation Summary ===`);
    console.log(`Total users with referral codes: ${users.length}`);
    console.log(`Valid codes: ${validCount}`);
    console.log(`Invalid codes: ${invalidCount}`);
    
  } catch (error) {
    console.error('Error in validateReferralCodes:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('=== UAI Referral Code Update Script ===\n');
    
    // Step 1: Update existing referral codes
    await updateAllReferralCodes();
    
    // Step 2: Ensure new users have referral codes
    await ensureNewUsersGetReferralCodes();
    
    // Step 3: Validate all referral codes
    await validateReferralCodes();
    
    console.log('\n=== Script completed successfully ===');
    
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateReferralCode,
  generateUniqueReferralCode,
  sendNotification,
  updateAllReferralCodes,
  ensureNewUsersGetReferralCodes,
  validateReferralCodes
}; 