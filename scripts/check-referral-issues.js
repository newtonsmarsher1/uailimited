const mysql = require('mysql2/promise');

async function checkReferralIssues() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Investigating Referral Reward Issues\n');
    
    // 1. Check the specific users mentioned
    console.log('📱 Checking specific users mentioned:');
    console.log('=' .repeat(80));
    
    const [specificUsers] = await pool.query(`
      SELECT id, name, phone, level, referred_by, invitation_code, wallet_balance
      FROM users 
      WHERE phone IN ('+254758432064', '+254740020784', '+254798921142') 
         OR name LIKE '%William%Momanyi%'
         OR name LIKE '%William%momanyi%'
      ORDER BY id
    `);
    
    console.log('User ID | Name                | Phone           | Level | Referred By | Invitation Code | Wallet');
    console.log('-' .repeat(80));
    
    specificUsers.forEach(user => {
      const id = user.id.toString().padEnd(7);
      const name = (user.name || 'N/A').substring(0, 18).padEnd(18);
      const phone = (user.phone || 'N/A').substring(0, 14).padEnd(14);
      const level = user.level.toString().padEnd(5);
      const referredBy = (user.referred_by || 'N/A').substring(0, 10).padEnd(10);
      const invitationCode = (user.invitation_code || 'N/A').substring(0, 12).padEnd(12);
      const wallet = `KES ${parseFloat(user.wallet_balance || 0).toFixed(2)}`;
      
      console.log(`${id} | ${name} | ${phone} | ${level} | ${referredBy} | ${invitationCode} | ${wallet}`);
    });
    
    // 2. Check referral relationships for these users
    console.log('\n🔗 Checking referral relationships:');
    console.log('=' .repeat(80));
    
    for (const user of specificUsers) {
      if (user.referred_by) {
        // Check if referred_by is an ID or invitation code
        const [referrer] = await pool.query(`
          SELECT id, name, phone, level, invitation_code, wallet_balance
          FROM users 
          WHERE id = ? OR invitation_code = ?
        `, [user.referred_by, user.referred_by]);
        
        if (referrer.length > 0) {
          const ref = referrer[0];
          console.log(`\n👤 User ${user.name} (${user.phone}) was referred by:`);
          console.log(`   Referrer ID: ${ref.id}`);
          console.log(`   Referrer Name: ${ref.name}`);
          console.log(`   Referrer Phone: ${ref.phone}`);
          console.log(`   Referrer Level: ${ref.level}`);
          console.log(`   Referrer Invitation Code: ${ref.invitation_code}`);
          console.log(`   Referrer Wallet: KES ${parseFloat(ref.wallet_balance || 0).toFixed(2)}`);
        } else {
          console.log(`\n❌ User ${user.name} (${user.phone}) has invalid referrer: ${user.referred_by}`);
        }
      }
    }
    
    // 3. Check referral_rewards table structure
    console.log('\n📊 Checking referral_rewards table structure:');
    console.log('=' .repeat(80));
    
    const [tableInfo] = await pool.query('DESCRIBE referral_rewards');
    console.log('Column Name     | Type         | Null | Key | Default | Extra');
    console.log('-' .repeat(80));
    tableInfo.forEach(col => {
      const name = col.Field.padEnd(15);
      const type = col.Type.padEnd(12);
      const null_ = col.Null.padEnd(4);
      const key = col.Key.padEnd(3);
      const default_ = (col.Default || 'NULL').padEnd(7);
      const extra = col.Extra || '';
      console.log(`${name} | ${type} | ${null_} | ${key} | ${default_} | ${extra}`);
    });
    
    // 4. Check all referral rewards for today
    console.log('\n🎁 Referral rewards awarded today:');
    console.log('=' .repeat(80));
    
    const [todayRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.inviter_id,
        rr.user_id,
        rr.reward_amount,
        rr.status,
        rr.created_at,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        user.name as user_name,
        user.phone as user_phone,
        user.level as user_level
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      LEFT JOIN users user ON user.id = rr.user_id
      WHERE DATE(rr.created_at) = CURDATE()
      ORDER BY rr.created_at DESC
    `);
    
    if (todayRewards.length === 0) {
      console.log('   No referral rewards awarded today');
    } else {
      console.log('Reward ID | Inviter Name        | Inviter Phone    | User Name         | User Phone    | Amount  | Status    | Time');
      console.log('-' .repeat(80));
      
      todayRewards.forEach(reward => {
        const id = reward.id.toString().padEnd(9);
        const inviterName = (reward.inviter_name || 'N/A').substring(0, 18).padEnd(18);
        const inviterPhone = (reward.inviter_phone || 'N/A').substring(0, 14).padEnd(14);
        const userName = (reward.user_name || 'N/A').substring(0, 16).padEnd(16);
        const userPhone = (reward.user_phone || 'N/A').substring(0, 12).padEnd(12);
        const amount = `KES ${reward.reward_amount}`.padEnd(7);
        const status = reward.status.padEnd(9);
        const time = new Date(reward.created_at).toLocaleTimeString();
        
        console.log(`${id} | ${inviterName} | ${inviterPhone} | ${userName} | ${userPhone} | ${amount} | ${status} | ${time}`);
      });
    }
    
    // 5. Check for pending referral rewards
    console.log('\n⏳ Pending referral rewards:');
    console.log('=' .repeat(80));
    
    const [pendingRewards] = await pool.query(`
      SELECT 
        rr.id,
        rr.inviter_id,
        rr.user_id,
        rr.reward_amount,
        rr.created_at,
        inviter.name as inviter_name,
        inviter.phone as inviter_phone,
        user.name as user_name,
        user.phone as user_phone,
        user.level as user_level
      FROM referral_rewards rr
      LEFT JOIN users inviter ON inviter.id = rr.inviter_id
      LEFT JOIN users user ON user.id = rr.user_id
      WHERE rr.status = 'pending'
      ORDER BY rr.created_at DESC
    `);
    
    if (pendingRewards.length === 0) {
      console.log('   No pending referral rewards');
    } else {
      console.log('Reward ID | Inviter Name        | Inviter Phone    | User Name         | User Phone    | Amount  | Created');
      console.log('-' .repeat(80));
      
      pendingRewards.forEach(reward => {
        const id = reward.id.toString().padEnd(9);
        const inviterName = (reward.inviter_name || 'N/A').substring(0, 18).padEnd(18);
        const inviterPhone = (reward.inviter_phone || 'N/A').substring(0, 14).padEnd(14);
        const userName = (reward.user_name || 'N/A').substring(0, 16).padEnd(16);
        const userPhone = (reward.user_phone || 'N/A').substring(0, 12).padEnd(12);
        const amount = `KES ${reward.reward_amount}`.padEnd(7);
        const created = new Date(reward.created_at).toLocaleDateString();
        
        console.log(`${id} | ${inviterName} | ${inviterPhone} | ${userName} | ${userPhone} | ${amount} | ${created}`);
      });
    }
    
    // 6. Check for users who should have received rewards but didn't
    console.log('\n🔍 Checking for missing referral rewards:');
    console.log('=' .repeat(80));
    
    const [missingRewards] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.level,
        u.referred_by,
        ref.name as referrer_name,
        ref.phone as referrer_phone,
        ref.level as referrer_level,
        ref.wallet_balance as referrer_wallet
      FROM users u
      LEFT JOIN users ref ON (ref.id = u.referred_by OR ref.invitation_code = u.referred_by)
      LEFT JOIN referral_rewards rr ON rr.user_id = u.id AND rr.inviter_id = ref.id
      WHERE u.referred_by IS NOT NULL 
        AND ref.id IS NOT NULL
        AND u.level > 0
        AND rr.id IS NULL
      ORDER BY u.created_at DESC
    `);
    
    if (missingRewards.length === 0) {
      console.log('   No missing referral rewards found');
    } else {
      console.log('User ID | User Name         | User Phone    | Level | Referrer Name      | Referrer Phone    | Referrer Level | Referrer Wallet');
      console.log('-' .repeat(80));
      
      missingRewards.forEach(user => {
        const id = user.id.toString().padEnd(7);
        const userName = (user.name || 'N/A').substring(0, 16).padEnd(16);
        const userPhone = (user.phone || 'N/A').substring(0, 12).padEnd(12);
        const level = user.level.toString().padEnd(5);
        const referrerName = (user.referrer_name || 'N/A').substring(0, 18).padEnd(18);
        const referrerPhone = (user.referrer_phone || 'N/A').substring(0, 16).padEnd(16);
        const referrerLevel = user.referrer_level.toString().padEnd(13);
        const referrerWallet = `KES ${parseFloat(user.referrer_wallet || 0).toFixed(2)}`;
        
        console.log(`${id} | ${userName} | ${userPhone} | ${level} | ${referrerName} | ${referrerPhone} | ${referrerLevel} | ${referrerWallet}`);
      });
    }
    
    // 7. Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(80));
    console.log(`Total users checked: ${specificUsers.length}`);
    console.log(`Referral rewards awarded today: ${todayRewards.length}`);
    console.log(`Pending referral rewards: ${pendingRewards.length}`);
    console.log(`Missing referral rewards: ${missingRewards.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

checkReferralIssues();





