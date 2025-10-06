const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function listTodaysReferralAwards() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`📊 Referral rewards awarded today (${today})\n`);

    // Fetch today's completed referral rewards (processed today or created today)
    const [rows] = await pool.query(`
      SELECT 
        rr.inviter_id,
        u.name AS inviter_name,
        u.phone AS inviter_phone,
        COUNT(*) AS rewards_count,
        SUM(rr.reward_amount) AS total_awarded,
        GROUP_CONCAT(CONCAT('user:', rr.user_id, ':', rr.reward_amount) ORDER BY rr.id SEPARATOR '|') AS details
      FROM referral_rewards rr
      LEFT JOIN users u ON u.id = rr.inviter_id
      WHERE rr.status = 'completed'
        AND DATE(COALESCE(rr.processed_at, rr.created_at)) = CURDATE()
      GROUP BY rr.inviter_id, u.name, u.phone
      ORDER BY total_awarded DESC, rewards_count DESC
    `);

    if (!rows.length) {
      console.log('❌ No referral rewards awarded today.');
      return;
    }

    const lines = [];
    lines.push('Inviter ID,Inviter Name,Phone,Count,Total Awarded');

    rows.forEach((r, idx) => {
      const line = `${r.inviter_id},${(r.inviter_name || '').replace(/,/g, ' ')},${r.inviter_phone || ''},${r.rewards_count},${Number(r.total_awarded).toFixed(2)}`;
      lines.push(line);

      console.log(`${idx + 1}. ${r.inviter_name || 'Unknown'} (${r.inviter_phone || 'N/A'}) - KES ${Number(r.total_awarded).toFixed(2)} (${r.rewards_count})`);
    });

    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir);
    }

    const csvPath = path.join(exportsDir, `today-referral-awards-${today}.csv`);
    const txtPath = path.join(exportsDir, `today-referral-awards-${today}.txt`);

    fs.writeFileSync(csvPath, lines.join('\n'));

    const txtLines = rows.map((r, idx) => {
      return `${idx + 1}. ${r.inviter_name || 'Unknown'} (${r.inviter_phone || 'N/A'}) - KES ${Number(r.total_awarded).toFixed(2)} (${r.rewards_count})`;
    });
    fs.writeFileSync(txtPath, txtLines.join('\n'));

    console.log(`\n📁 Saved CSV: ${csvPath}`);
    console.log(`📄 Saved TXT: ${txtPath}`);
  } catch (error) {
    console.error('❌ Error listing today\'s referral awards:', error.message);
  }
}

listTodaysReferralAwards();






