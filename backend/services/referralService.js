const pool = require('../config/database.js');

// Generate unique referral code
async function generateUniqueReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [code]);
    if (existing.length === 0) {
      isUnique = true;
    }
  }
  
  return code;
}

module.exports = {
  generateUniqueReferralCode
};
