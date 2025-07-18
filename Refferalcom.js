const pool = require('./db.js');

async function processReferralCommissions() {
  const [referrers] = await pool.query('SELECT id, referral_code FROM users WHERE referral_code IS NOT NULL');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const for_date = yesterday.toISOString().slice(0,10);

  for (const ref of referrers) {
    // Find direct referrals
    const [referrals] = await pool.query('SELECT id FROM users WHERE referred_by=?', [ref.referral_code]);
    let totalCommission = 0;

    for (const referral of referrals) {
      // Earnings from tasks completed yesterday
      const [earningsRows] = await pool.query(`
        SELECT SUM(t.reward) as earned
        FROM user_tasks ut
        JOIN tasks t ON ut.task_id=t.id
        WHERE ut.user_id=? AND DATE(ut.completed_at)=?
      `, [referral.id, for_date]);
      const earned = earningsRows[0]?.earned || 0;
      if (earned > 0) {
        const commission = Math.round(earned * 0.015 * 100) / 100; // round to 2 decimals
        if (commission > 0) {
          await pool.query(
            'INSERT INTO referral_commissions (referrer_id, referred_user_id, amount, for_date) VALUES (?, ?, ?, ?)',
            [ref.id, referral.id, commission, for_date]
          );
          await pool.query('UPDATE users SET balance=balance+? WHERE id=?', [commission, ref.id]);
          totalCommission += commission;
        }
      }
    }
    if (totalCommission > 0) {
      console.log(`Credited KES ${totalCommission} to referrer ${ref.id} for date ${for_date}`);
    }
  }
  process.exit(0);
}

processReferralCommissions().catch(e => { console.error(e); process.exit(1); });