const mysql = require('mysql2/promise');

async function listWithdrawalsSept29() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('📊 Approved Withdrawals on September 29, 2025\n');
    
    // Query for approved withdrawals on 2025-09-29
    const [withdrawals] = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        u.name,
        u.phone,
        w.amount,
        w.status,
        w.requested_at,
        w.processed_at,
        w.approved_by,
        w.admin_notes
      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      WHERE w.status = 'approved'
        AND (
          DATE(w.processed_at) = '2025-09-29' 
          OR DATE(w.requested_at) = '2025-09-29'
        )
      ORDER BY w.processed_at DESC, w.requested_at DESC
    `);
    
    if (withdrawals.length === 0) {
      console.log('❌ No approved withdrawals found for September 29, 2025');
      
      // Check what dates we have
      const [dates] = await pool.query(`
        SELECT DISTINCT DATE(processed_at) as date, COUNT(*) as count
        FROM withdrawals 
        WHERE status = 'approved' AND processed_at IS NOT NULL
        GROUP BY DATE(processed_at)
        ORDER BY date DESC
        LIMIT 10
      `);
      
      if (dates.length > 0) {
        console.log('\n📅 Recent approved withdrawal dates:');
        dates.forEach(d => {
          console.log(`   ${d.date ? new Date(d.date).toLocaleDateString() : 'N/A'}: ${d.count} withdrawals`);
        });
      }
      
      return;
    }
    
    console.log(`✅ Found ${withdrawals.length} approved withdrawal(s) on September 29, 2025\n`);
    
    let totalAmount = 0;
    
    withdrawals.forEach((w, idx) => {
      console.log(`${idx + 1}. ${w.name} (ID: ${w.user_id})`);
      console.log(`   Phone: ${w.phone}`);
      console.log(`   Amount: KES ${parseFloat(w.amount).toFixed(2)}`);
      console.log(`   Withdrawal ID: ${w.id}`);
      console.log(`   Requested: ${w.requested_at ? new Date(w.requested_at).toLocaleString() : 'N/A'}`);
      console.log(`   Processed: ${w.processed_at ? new Date(w.processed_at).toLocaleString() : 'N/A'}`);
      console.log(`   Approved By: ${w.approved_by || 'N/A'}`);
      if (w.admin_notes) {
        console.log(`   Notes: ${w.admin_notes}`);
      }
      console.log('');
      
      totalAmount += parseFloat(w.amount);
    });
    
    console.log(`📊 SUMMARY:`);
    console.log(`   Total withdrawals: ${withdrawals.length}`);
    console.log(`   Total amount: KES ${totalAmount.toFixed(2)}`);
    
    // Save to file
    const fs = require('fs');
    const path = require('path');
    
    const lines = [];
    lines.push('Approved Withdrawals - September 29, 2025');
    lines.push('='.repeat(60));
    lines.push('');
    
    withdrawals.forEach((w, idx) => {
      lines.push(`${idx + 1}. ${w.name} (${w.phone})`);
      lines.push(`   Amount: KES ${parseFloat(w.amount).toFixed(2)}`);
      lines.push(`   User ID: ${w.user_id}`);
      lines.push(`   Withdrawal ID: ${w.id}`);
      lines.push(`   Requested: ${w.requested_at ? new Date(w.requested_at).toLocaleString() : 'N/A'}`);
      lines.push(`   Processed: ${w.processed_at ? new Date(w.processed_at).toLocaleString() : 'N/A'}`);
      lines.push('');
    });
    
    lines.push('='.repeat(60));
    lines.push(`Total: ${withdrawals.length} withdrawals, KES ${totalAmount.toFixed(2)}`);
    
    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir);
    }
    
    const txtPath = path.join(exportsDir, 'withdrawals-sept-29-2025.txt');
    fs.writeFileSync(txtPath, lines.join('\n'));
    
    console.log(`\n📄 Report saved to: ${txtPath}`);
    
  } catch (error) {
    console.error('❌ Error listing withdrawals:', error.message);
  } finally {
    pool.end();
  }
}

listWithdrawalsSept29();




