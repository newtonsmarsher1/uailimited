const mysql = require('mysql2/promise');

async function investigateAndAward() {
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
    console.log('🔍 Investigating specific referral claim');
    console.log('   Inviter: +254703490643');
    console.log('   Invitee: +254741373441\n');

    // Find inviter
    const [inviterRows] = await pool.query(
      `SELECT id, name, phone, level, wallet_balance, created_at
       FROM users
       WHERE phone IN (?, ?, ?) OR phone LIKE ? OR phone LIKE ? OR phone LIKE ?
       ORDER BY id ASC
       LIMIT 1`,
      [
        inviterPhones[0], inviterPhones[1], inviterPhones[2],
        `%${inviterPhones[0].replace('+254', '')}%`,
        `%${inviterPhones[1].slice(1)}%`,
        `%${inviterPhones[2]}%`
      ]
    );

    // Find invitee
    const [inviteeRows] = await pool.query(
      `SELECT id, name, phone, level, wallet_balance, created_at, referred_by
       FROM users
       WHERE phone IN (?, ?, ?) OR phone LIKE ? OR phone LIKE ? OR phone LIKE ?
       ORDER BY id ASC
       LIMIT 1`,
      [
        inviteePhones[0], inviteePhones[1], inviteePhones[2],
        `%${inviteePhones[0].replace('+254', '')}%`,
        `%${inviteePhones[1].slice(1)}%`,
        `%${inviteePhones[2]}%`
      ]
    );

    if (!inviterRows.length || !inviteeRows.length) {
      if (!inviterRows.length) console.log('❌ Inviter not found');
      if (!inviteeRows.length) console.log('❌ Invitee not found');
      return;
    }

    const inviter = inviterRows[0];
    const invitee = inviteeRows[0];

    console.log(`✅ Inviter: ${inviter.name} (ID: ${inviter.id}, ${inviter.phone})`);
    console.log(`✅ Invitee: ${invitee.name} (ID: ${invitee.id}, ${invitee.phone})`);
    console.log(`   Invitee.referred_by = ${invitee.referred_by}`);

    if (invitee.referred_by !== inviter.id) {
      console.log('❌ Referral relationship not found (referred_by does not match inviter)');
      return;
    }

    // Check existing reward
    const [existing] = await pool.query(
      `SELECT id, reward_amount, status, created_at
       FROM referral_rewards
       WHERE inviter_id = ? AND user_id = ? AND status = 'completed'
       ORDER BY id DESC
       LIMIT 1`,
      [inviter.id, invitee.id]
    );

    if (existing.length) {
      console.log(`ℹ️ Reward already exists: KES ${parseFloat(existing[0].reward_amount).toFixed(2)} (no action taken)`);
      return;
    }

    // Determine expected reward based on invitee level
    const levelRewards = { 0: 0, 1: 288, 2: 600, 3: 1200, 4: 1800, 5: 2400 };
    const expectedReward = levelRewards[invitee.level] || 0;
    console.log(`💡 Invitee level: ${invitee.level} → Expected reward: KES ${expectedReward}`);

    if (expectedReward <= 0) {
      console.log('ℹ️ Invitee level is 0, no reward applicable.');
      return;
    }

    // Award
    const newBalance = parseFloat(inviter.wallet_balance) + expectedReward;
    await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, inviter.id]);
    await pool.query(
      'INSERT INTO referral_rewards (inviter_id, user_id, level, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [inviter.id, invitee.id, invitee.level, expectedReward, 'completed', new Date()]
    );

    console.log(`✅ Awarded KES ${expectedReward} to ${inviter.name}. New balance: KES ${newBalance.toFixed(2)}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    // Close pool
    // eslint-disable-next-line no-undef
    pool.end();
  }
}

investigateAndAward();






