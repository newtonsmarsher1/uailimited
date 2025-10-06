const mysql = require('mysql2/promise');

async function setReferralAndAward() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  const inviterPhones = ['+254703490643', '0703490643', '703490643'];
  const inviteePhones = ['+254741373441', '0741373441', '741373441'];

  try {
    console.log('🔗 Linking referral: Emmanuel John → Otara John');

    // Load inviter and invitee
    const [inviterRows] = await pool.query(
      `SELECT id, name, phone, level, wallet_balance FROM users
       WHERE phone IN (?, ?, ?) LIMIT 1`,
      [inviterPhones[0], inviterPhones[1], inviterPhones[2]]
    );
    const [inviteeRows] = await pool.query(
      `SELECT id, name, phone, level, wallet_balance, referred_by FROM users
       WHERE phone IN (?, ?, ?) LIMIT 1`,
      [inviteePhones[0], inviteePhones[1], inviteePhones[2]]
    );

    if (!inviterRows.length || !inviteeRows.length) {
      if (!inviterRows.length) console.log('❌ Inviter not found');
      if (!inviteeRows.length) console.log('❌ Invitee not found');
      return;
    }

    const inviter = inviterRows[0];
    const invitee = inviteeRows[0];
    console.log(`✅ Inviter: ${inviter.name} (ID: ${inviter.id})`);
    console.log(`✅ Invitee: ${invitee.name} (ID: ${invitee.id})`);

    // Link referral if missing or incorrect
    if (invitee.referred_by !== inviter.id) {
      await pool.query('UPDATE users SET referred_by = ? WHERE id = ?', [inviter.id, invitee.id]);
      console.log('✅ Referral link set: referred_by updated');
    } else {
      console.log('ℹ️ Referral link already set correctly');
    }

    // Check if reward already exists
    const [existing] = await pool.query(
      `SELECT id FROM referral_rewards WHERE inviter_id = ? AND user_id = ? AND status = 'completed' LIMIT 1`,
      [inviter.id, invitee.id]
    );
    if (existing.length) {
      console.log('ℹ️ Reward already exists. No further action.');
      return;
    }

    // Determine reward based on invitee level
    const levelRewards = { 0: 0, 1: 288, 2: 600, 3: 1200, 4: 1800, 5: 2400 };
    const reward = levelRewards[invitee.level] || 0;
    console.log(`💡 Invitee level: ${invitee.level} → Reward: KES ${reward}`);

    if (reward <= 0) {
      console.log('ℹ️ Invitee is level 0. No reward to award.');
      return;
    }

    // Award reward
    const newBalance = parseFloat(inviter.wallet_balance) + reward;
    await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, inviter.id]);
    await pool.query(
      'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [inviter.id, invitee.id, invitee.level, reward, 'completed', new Date()]
    );
    console.log(`✅ Awarded KES ${reward} to ${inviter.name}. New balance: KES ${newBalance.toFixed(2)}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    pool.end();
  }
}

setReferralAndAward();






