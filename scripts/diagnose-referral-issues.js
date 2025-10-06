const mysql = require('mysql2/promise');

async function normalizePhones(raw) {
  const unique = new Set();
  for (const p of raw) {
    if (!p) continue;
    const s = String(p).trim();
    if (!s) continue;
    if (s.startsWith('+')) unique.add(s);
    else if (s.startsWith('0')) {
      unique.add(s);
      unique.add('+254' + s.slice(1));
      if (s.startsWith('01') || s.startsWith('07')) unique.add(s.slice(1));
    } else {
      unique.add(s);
      if (s.length === 9) unique.add('+254' + s);
      if (s.length === 9) unique.add('0' + s);
    }
  }
  return Array.from(unique);
}

async function findUserByPhones(pool, label, phones) {
  const variants = await normalizePhones(phones);
  const placeholders = variants.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, name, phone, level, invitation_code, referred_by, created_at
     FROM users
     WHERE phone IN (${placeholders})
     ORDER BY id DESC`,
    variants
  );
  if (!rows.length) {
    console.log(`❌ ${label}: No user found for phones: ${variants.join(', ')}`);
    return null;
  }
  if (rows.length > 1) {
    console.log(`⚠️ ${label}: Multiple matches; using the latest by id`);
  }
  const user = rows[0];
  console.log(`✅ ${label}: ${user.name || 'N/A'} (ID: ${user.id}) Phone: ${user.phone} Level: ${user.level} InvCode: ${user.invitation_code}`);
  return user;
}

async function checkReferral(pool, inviter, invitee) {
  console.log('\n🔗 Checking referral linkage...');
  const byCode = invitee.referred_by === inviter.invitation_code;
  const byId = invitee.referred_by === String(inviter.id);
  console.log(`   invitee.referred_by = ${invitee.referred_by || 'NULL'}`);
  console.log(`   Matches inviter.invitation_code? ${byCode ? 'YES' : 'NO'}`);
  console.log(`   Matches inviter.id? ${byId ? 'YES' : 'NO'}`);
  return byCode || byId;
}

async function checkRewards(pool, inviterId, inviteeId) {
  const [rows] = await pool.query(
    `SELECT id, inviter_id, user_id, level, reward_amount, status, created_at, processed_at
     FROM referral_rewards WHERE inviter_id = ? AND user_id = ? ORDER BY created_at DESC`,
    [inviterId, inviteeId]
  );
  if (!rows.length) {
    console.log('💤 No referral_rewards record found for this pair');
    return null;
  }
  console.log('📜 referral_rewards records:');
  for (const r of rows) {
    console.log(`   #${r.id} level=${r.level} amount=KES ${r.reward_amount} status=${r.status} created=${r.created_at} processed=${r.processed_at || 'N/A'}`);
  }
  return rows[0];
}

async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🧪 Diagnosing referral issues for provided pairs...');

    const pairs = [
      { inviterPhones: ['0740285715'], inviteePhones: ['+254715817417'], labels: ['Inviter A (0740285715)', 'Invitee A (Sopian Nyongesa +254715817417)'] },
      { inviterPhones: ['0706609894'], inviteePhones: ['0707128529'], labels: ['Inviter B (0706609894)', 'Invitee B (0707128529)'] },
    ];

    for (const pair of pairs) {
      console.log('\n==============================');
      console.log(`Pair: ${pair.labels[0]} -> ${pair.labels[1]}`);

      const inviter = await findUserByPhones(pool, pair.labels[0], pair.inviterPhones);
      const invitee = await findUserByPhones(pool, pair.labels[1], pair.inviteePhones);
      if (!inviter || !invitee) continue;

      const linked = await checkReferral(pool, inviter, invitee);
      if (!linked) {
        console.log('❗ Problem: Invitee is not linked to inviter via referred_by.');
        console.log('   Fix suggestion: Set invitee.referred_by to inviter.invitation_code.');
      }

      await checkRewards(pool, inviter.id, invitee.id);

      // Policy checks
      console.log('\n📏 Policy evaluation:');
      console.log('   - Rewards are given to direct inviter only.');
      console.log('   - Reward triggers when invitee reaches level >= 1.');
      if (invitee.level === 0) {
        console.log('   ➜ Invitee is Level 0: no reward yet. Will trigger upon upgrade.');
      } else {
        console.log(`   ➜ Invitee is Level ${invitee.level}: reward should exist if linkage is correct.`);
      }

      // Pending rewards for temporary inviter scenario
      const [pendingForInviter] = await pool.query(
        `SELECT COUNT(*) as cnt FROM referral_rewards WHERE inviter_id = ? AND status = 'pending'`,
        [inviter.id]
      );
      if (pendingForInviter[0].cnt > 0) {
        console.log(`   ℹ️ Inviter has ${pendingForInviter[0].cnt} pending reward(s). These complete when inviter upgrades from level 0.`);
      }
    }

  } catch (err) {
    console.error('❌ Diagnostic error:', err.message);
  } finally {
    // @ts-ignore
    if (typeof pool !== 'undefined') pool.end();
  }
}

run();




