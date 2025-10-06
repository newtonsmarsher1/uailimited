const mysql = require('mysql2/promise');

async function checkSpecificUsersWithdrawals() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Checking Withdrawal History for Specific Users\n');
    
    // Get VALARY MUKHEBI details
    const [valary] = await pool.query(`
      SELECT 
        id, name, phone, total_withdrawn, wallet_balance, created_at
      FROM users
      WHERE name LIKE '%VALARY%MUKHEBI%' OR phone LIKE '%714376419%'
    `);
    
    // Get Faith Isaiah details
    const [faith] = await pool.query(`
      SELECT 
        id, name, phone, total_withdrawn, wallet_balance, created_at
      FROM users
      WHERE name LIKE '%Faith%Isaiah%' OR phone LIKE '%793263932%'
    `);
    
    const usersToCheck = [];
    
    if (valary.length > 0) {
      usersToCheck.push(valary[0]);
    }
    if (faith.length > 0) {
      usersToCheck.push(faith[0]);
    }
    
    if (usersToCheck.length === 0) {
      console.log('❌ Users not found');
      return;
    }
    
    for (const user of usersToCheck) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`👤 ${user.name} (ID: ${user.id})`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Total Withdrawn (lifetime): KES ${parseFloat(user.total_withdrawn).toFixed(2)}`);
      console.log(`   Current Balance: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
      console.log(`   Account Created: ${new Date(user.created_at).toLocaleDateString()}`);
      
      // Get all withdrawal records for this user
      const [withdrawals] = await pool.query(`
        SELECT 
          id, amount, status, requested_at, processed_at, approved_by, admin_notes
        FROM withdrawals
        WHERE user_id = ?
        ORDER BY requested_at DESC
      `, [user.id]);
      
      console.log(`\n📋 Withdrawal Records: ${withdrawals.length}`);
      
      if (withdrawals.length > 0) {
        withdrawals.forEach((w, idx) => {
          console.log(`\n   ${idx + 1}. Withdrawal ID: ${w.id}`);
          console.log(`      Amount: KES ${parseFloat(w.amount).toFixed(2)}`);
          console.log(`      Status: ${w.status}`);
          console.log(`      Requested: ${w.requested_at ? new Date(w.requested_at).toLocaleString() : 'N/A'}`);
          console.log(`      Processed: ${w.processed_at ? new Date(w.processed_at).toLocaleString() : 'N/A'}`);
          console.log(`      Approved By: ${w.approved_by || 'N/A'}`);
          
          // Check if this could be from Sept 29
          if (w.requested_at) {
            const reqDate = new Date(w.requested_at);
            if (reqDate.getMonth() === 8 && reqDate.getDate() === 29) {
              console.log(`      ⚠️  REQUESTED ON SEPT 29, 2025`);
            }
          }
          if (w.processed_at) {
            const procDate = new Date(w.processed_at);
            if (procDate.getMonth() === 8 && procDate.getDate() === 29) {
              console.log(`      ⚠️  PROCESSED ON SEPT 29, 2025`);
            }
          }
          
          if (w.admin_notes && w.admin_notes.includes('restored')) {
            console.log(`      Note: This is a restored record (original date lost)`);
          }
        });
      } else {
        console.log('   No withdrawal records found in database');
      }
      
      // Analysis based on total_withdrawn
      if (user.total_withdrawn > 0) {
        console.log(`\n💡 ANALYSIS:`);
        console.log(`   This user has withdrawn KES ${parseFloat(user.total_withdrawn).toFixed(2)} in total`);
        
        if (withdrawals.length === 0) {
          console.log(`   ⚠️  No withdrawal records found - may have been deleted`);
        } else {
          const totalInRecords = withdrawals
            .filter(w => w.status === 'approved')
            .reduce((sum, w) => sum + parseFloat(w.amount), 0);
          
          if (totalInRecords === parseFloat(user.total_withdrawn)) {
            console.log(`   ✅ Records match total_withdrawn field`);
          } else {
            console.log(`   ⚠️  Mismatch: Records show KES ${totalInRecords.toFixed(2)} but total_withdrawn is KES ${parseFloat(user.total_withdrawn).toFixed(2)}`);
          }
        }
        
        console.log(`\n   Based on total_withdrawn being KES ${parseFloat(user.total_withdrawn).toFixed(2)}:`);
        console.log(`   - This user HAS made withdrawals in the past`);
        console.log(`   - The current record(s) may be restored/reconstructed`);
        console.log(`   - Original approval dates were likely lost in deletion`);
      }
    }
    
    console.log(`\n${'='.repeat(70)}\n`);
    console.log('📌 CONCLUSION:');
    console.log('   If these users show total_withdrawn > 0, they have made withdrawals.');
    console.log('   However, the exact dates (including Sept 29) were lost when records were deleted.');
    console.log('   The restored records show today\'s date, not the original approval dates.');
    
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
  } finally {
    pool.end();
  }
}

checkSpecificUsersWithdrawals();




