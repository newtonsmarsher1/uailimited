const mysql = require('mysql2/promise');

async function fixMissingInvitationCodes() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Missing Invitation Codes\n');
    
    // Check users without invitation codes
    const [usersWithoutCodes] = await pool.query(`
      SELECT id, name, phone, referral_code, invitation_code
      FROM users 
      WHERE invitation_code IS NULL OR invitation_code = ''
      ORDER BY id ASC
    `);
    
    console.log(`📊 Found ${usersWithoutCodes.length} users without invitation codes\n`);
    
    if (usersWithoutCodes.length === 0) {
      console.log('✅ All users have invitation codes!');
      return;
    }
    
    // Generate unique invitation codes for missing users
    let generatedCount = 0;
    let failedCount = 0;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    for (const user of usersWithoutCodes) {
      try {
        console.log(`🔧 Generating invitation code for: ${user.name} (ID: ${user.id})`);
        
        let invitationCode_new;
        let isUnique = false;
        let attempts = 0;
        
        // Generate unique code
        while (!isUnique && attempts < 100) {
          invitationCode_new = '';
          for (let i = 0; i < 8; i++) {
            invitationCode_new += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          
          const [existingCodes] = await pool.query('SELECT id FROM users WHERE invitation_code = ?', [invitationCode_new]);
          if (existingCodes.length === 0) {
            isUnique = true;
          }
          attempts++;
        }
        
        if (isUnique) {
          // Update user with new invitation code
          await pool.query('UPDATE users SET invitation_code = ? WHERE id = ?', [invitationCode_new, user.id]);
          
          console.log(`✅ Generated: ${invitationCode_new}`);
          generatedCount++;
        } else {
          console.log(`❌ Failed to generate unique code after 100 attempts`);
          failedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error generating code for ${user.name}:`, error.message);
        failedCount++;
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Successfully generated codes: ${generatedCount}`);
    if (failedCount > 0) {
      console.log(`❌ Failed to generate codes: ${failedCount}`);
    }
    
    // Verify all users now have invitation codes
    console.log(`\n🔍 VERIFICATION:`);
    const [finalCheck] = await pool.query(`
      SELECT COUNT(*) as total_users,
             COUNT(invitation_code) as users_with_codes,
             COUNT(*) - COUNT(invitation_code) as users_without_codes
      FROM users
    `);
    
    const stats = finalCheck[0];
    console.log(`📊 Total users: ${stats.total_users}`);
    console.log(`📊 Users with invitation codes: ${stats.users_with_codes}`);
    console.log(`📊 Users without invitation codes: ${stats.users_without_codes}`);
    
    if (stats.users_without_codes === 0) {
      console.log('✅ All users now have unique invitation codes!');
    }
    
    // Show sample of users with invitation codes
    console.log(`\n📋 SAMPLE INVITATION CODES:`);
    const [sampleUsers] = await pool.query(`
      SELECT name, phone, invitation_code 
      FROM users 
      WHERE invitation_code IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    sampleUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.phone}) - ${user.invitation_code}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing missing invitation codes:', error.message);
  } finally {
    pool.end();
  }
}

fixMissingInvitationCodes();