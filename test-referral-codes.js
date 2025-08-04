const pool = require('./db.js');

async function testReferralCodes() {
  try {
    console.log('=== Testing Referral Codes ===\n');
    
    // Get all users with their referral codes
    const [users] = await pool.query(`
      SELECT id, phone, referral_code, referred_by 
      FROM users 
      ORDER BY id
    `);
    
    console.log(`Total users in database: ${users.length}\n`);
    
    let validCodes = 0;
    let invalidCodes = 0;
    
    for (const user of users) {
      const isValid = user.referral_code && 
                     user.referral_code.length >= 6 && 
                     user.referral_code.length <= 8 && 
                     /^[A-Z0-9]+$/.test(user.referral_code);
      
      if (isValid) {
        validCodes++;
        console.log(`✅ User ${user.id} (${user.phone}): ${user.referral_code} (${user.referral_code.length} chars)`);
      } else {
        invalidCodes++;
        console.log(`❌ User ${user.id} (${user.phone}): ${user.referral_code || 'NULL'} (INVALID)`);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Valid codes: ${validCodes}`);
    console.log(`Invalid codes: ${invalidCodes}`);
    console.log(`Total: ${users.length}`);
    
    // Test referral link generation
    console.log(`\n=== Testing Referral Links ===`);
    const testUser = users.find(u => u.referral_code);
    if (testUser) {
      const referralLink = `https://uai-agency.com/ref/${testUser.referral_code}`;
      console.log(`Sample referral link: ${referralLink}`);
    }
    
  } catch (error) {
    console.error('Error testing referral codes:', error);
  } finally {
    await pool.end();
  }
}

testReferralCodes(); 