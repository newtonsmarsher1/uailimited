const mysql = require('mysql2/promise');

async function searchPhoneNumbers() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Searching for phone numbers and referral relationships\n');
    
    // Search for inviter
    console.log('📱 SEARCHING FOR INVITER 0106736692:');
    const [inviter] = await pool.query(`
      SELECT id, name, phone, level, invitation_code, referred_by, wallet_balance, created_at
      FROM users WHERE phone LIKE '%0106736692%' OR phone LIKE '%106736692%'
    `);
    
    if (inviter.length > 0) {
      const inviterData = inviter[0];
      console.log(`✅ Found: ${inviterData.name} (ID: ${inviterData.id})`);
      console.log(`   Phone: ${inviterData.phone}`);
      console.log(`   Level: ${inviterData.level}`);
      console.log(`   Invitation Code: ${inviterData.invitation_code}`);
      console.log(`   Wallet Balance: KES ${parseFloat(inviterData.wallet_balance).toFixed(2)}`);
      console.log(`   Joined: ${new Date(inviterData.created_at).toLocaleDateString()}`);
      
      // Find users referred by this inviter
      console.log('\n👥 USERS REFERRED BY THIS INVITER:');
      const [referredUsers] = await pool.query(`
        SELECT id, name, phone, level, created_at, wallet_balance
        FROM users 
        WHERE referred_by = ? OR referred_by = ?
        ORDER BY created_at DESC
      `, [inviterData.id, inviterData.invitation_code]);
      
      if (referredUsers.length > 0) {
        console.log(`Found ${referredUsers.length} referred user(s):`);
        referredUsers.forEach((user, idx) => {
          console.log(`  ${idx + 1}. ${user.name} (ID: ${user.id})`);
          console.log(`     Phone: ${user.phone}`);
          console.log(`     Level: ${user.level}`);
          console.log(`     Joined: ${new Date(user.created_at).toLocaleDateString()}`);
          console.log(`     Wallet: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
          console.log('');
        });
      } else {
        console.log('❌ No users found referred by this inviter');
      }
      
      // Check referral rewards for this inviter
      console.log('💰 REFERRAL REWARDS FOR THIS INVITER:');
      const [rewards] = await pool.query(`
        SELECT 
          rr.id, rr.user_id, rr.level, rr.reward_amount, rr.status, rr.created_at, rr.processed_at,
          u.name as user_name, u.phone as user_phone
        FROM referral_rewards rr
        LEFT JOIN users u ON u.id = rr.user_id
        WHERE rr.inviter_id = ?
        ORDER BY rr.created_at DESC
      `, [inviterData.id]);
      
      if (rewards.length > 0) {
        console.log(`Found ${rewards.length} referral reward(s):`);
        rewards.forEach((reward, idx) => {
          console.log(`  ${idx + 1}. User: ${reward.user_name} (${reward.user_phone})`);
          console.log(`     Amount: KES ${parseFloat(reward.reward_amount).toFixed(2)}`);
          console.log(`     Status: ${reward.status}`);
          console.log(`     Created: ${new Date(reward.created_at).toLocaleString()}`);
          if (reward.processed_at) {
            console.log(`     Processed: ${new Date(reward.processed_at).toLocaleString()}`);
          }
          console.log('');
        });
      } else {
        console.log('❌ No referral rewards found for this inviter');
      }
      
    } else {
      console.log('❌ Inviter 0106736692 not found in database');
    }
    
    // Search for invitee with variations
    console.log('\n📱 SEARCHING FOR INVITEE 0710646811 (with variations):');
    const [invitee] = await pool.query(`
      SELECT id, name, phone, level, invitation_code, referred_by, wallet_balance, created_at
      FROM users WHERE phone LIKE '%0710646811%' OR phone LIKE '%710646811%' OR phone LIKE '%+254710646811%'
    `);
    
    if (invitee.length > 0) {
      const inviteeData = invitee[0];
      console.log(`✅ Found: ${inviteeData.name} (ID: ${inviteeData.id})`);
      console.log(`   Phone: ${inviteeData.phone}`);
      console.log(`   Level: ${inviteeData.level}`);
      console.log(`   Referred By: ${inviteeData.referred_by}`);
      console.log(`   Wallet Balance: KES ${parseFloat(inviteeData.wallet_balance).toFixed(2)}`);
      console.log(`   Joined: ${new Date(inviteeData.created_at).toLocaleDateString()}`);
    } else {
      console.log('❌ Invitee 0710646811 not found with any phone format');
      
      // Search for similar phone numbers
      console.log('\n🔍 SEARCHING FOR SIMILAR PHONE NUMBERS:');
      const [similar] = await pool.query(`
        SELECT id, name, phone, level, referred_by, created_at
        FROM users 
        WHERE phone LIKE '%710646%' OR phone LIKE '%106468%'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      if (similar.length > 0) {
        console.log(`Found ${similar.length} similar phone number(s):`);
        similar.forEach((user, idx) => {
          console.log(`  ${idx + 1}. ${user.name} (ID: ${user.id})`);
          console.log(`     Phone: ${user.phone}`);
          console.log(`     Level: ${user.level}`);
          console.log(`     Referred By: ${user.referred_by}`);
          console.log(`     Joined: ${new Date(user.created_at).toLocaleDateString()}`);
          console.log('');
        });
      } else {
        console.log('❌ No similar phone numbers found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error searching phone numbers:', error.message);
  } finally {
    pool.end();
  }
}

searchPhoneNumbers();




