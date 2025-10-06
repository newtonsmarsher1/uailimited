const mysql = require('mysql2/promise');

async function revertCyprianWallets() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Finding and Reverting Cyprian\'s Wallets\n');
    
    // Get all Cyprian accounts
    const [cyprianAccounts] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by, invitation_code
      FROM users 
      WHERE name LIKE '%Cyprian%' OR phone = '0740020784'
      ORDER BY id
    `);
    
    if (cyprianAccounts.length === 0) {
      console.log('❌ No Cyprian accounts found');
      return;
    }
    
    console.log(`📋 Found ${cyprianAccounts.length} Cyprian account(s):`);
    console.log('=' .repeat(80));
    console.log('User ID | Name                | Phone           | Level | Wallet Balance | Referred By');
    console.log('-' .repeat(80));
    
    cyprianAccounts.forEach(cyprian => {
      const id = cyprian.id.toString().padEnd(7);
      const name = cyprian.name.substring(0, 18).padEnd(18);
      const phone = cyprian.phone.substring(0, 14).padEnd(14);
      const level = cyprian.level.toString().padEnd(5);
      const balance = `KES ${parseFloat(cyprian.wallet_balance).toFixed(2)}`.padEnd(13);
      const referredBy = (cyprian.referred_by || 'N/A').substring(0, 10).padEnd(10);
      
      console.log(`${id} | ${name} | ${phone} | ${level} | ${balance} | ${referredBy}`);
    });
    
    // Check which Cyprian was mentioned in the original issue
    console.log('\n🔍 Checking which Cyprian was mentioned in the original issue...');
    console.log('   Original issue: "0740020784 has invited 0798921142 but has not been awarded"');
    
    const mentionedCyprian = cyprianAccounts.find(c => c.phone === '0740020784');
    
    if (mentionedCyprian) {
      console.log(`\n✅ Found the mentioned Cyprian: ${mentionedCyprian.name} (ID: ${mentionedCyprian.id})`);
      console.log(`   Phone: ${mentionedCyprian.phone}`);
      console.log(`   Level: ${mentionedCyprian.level}`);
      console.log(`   Current wallet: KES ${parseFloat(mentionedCyprian.wallet_balance).toFixed(2)}`);
      
      // Check if this Cyprian was affected by our corrections
      console.log('\n🔍 Checking if this Cyprian was affected by our corrections...');
      
      // Calculate task earnings
      const [taskEarnings] = await pool.query(`
        SELECT COALESCE(SUM(reward_earned), 0) as total_earnings
        FROM user_tasks 
        WHERE user_id = ? AND is_complete = 1
      `, [mentionedCyprian.id]);
      
      const taskEarningsAmount = parseFloat(taskEarnings[0].total_earnings);
      const currentBalance = parseFloat(mentionedCyprian.wallet_balance);
      const difference = currentBalance - taskEarningsAmount;
      
      console.log(`   Task earnings: KES ${taskEarningsAmount.toFixed(2)}`);
      console.log(`   Current wallet: KES ${currentBalance.toFixed(2)}`);
      console.log(`   Difference: KES ${difference.toFixed(2)}`);
      
      if (Math.abs(difference) > 0.01) {
        console.log(`\n⚠️  This Cyprian was affected by our corrections!`);
        console.log(`   His wallet was changed from an unknown amount to KES ${currentBalance.toFixed(2)}`);
        console.log(`   (based on task earnings only)`);
        
        // Since we don't know the original balance, we need to estimate
        // Based on the pattern, it was likely higher before our corrections
        console.log('\n❓ We need to determine the original balance before our corrections');
        console.log('   Options:');
        console.log('   1. Set to KES 0.00 (if no tasks completed)');
        console.log('   2. Set to a reasonable amount based on level and activity');
        console.log('   3. Keep current balance (task earnings only)');
        
        // For now, let's check if there are any clues about the original balance
        console.log('\n🔍 Looking for clues about original balance...');
        
        // Check if there are any withdrawal records
        const [withdrawals] = await pool.query(`
          SELECT id, amount, status, requested_at
          FROM withdrawals 
          WHERE user_id = ?
          ORDER BY requested_at DESC
        `, [mentionedCyprian.id]);
        
        if (withdrawals.length > 0) {
          console.log(`   Found ${withdrawals.length} withdrawal(s):`);
          withdrawals.forEach(w => {
            console.log(`     - KES ${w.amount} (${w.status}) on ${new Date(w.requested_at).toLocaleDateString()}`);
          });
        } else {
          console.log('   No withdrawals found');
        }
        
        // Check if there are any payment records
        const [payments] = await pool.query(`
          SELECT id, amount, status, created_at
          FROM payments 
          WHERE user_id = ?
          ORDER BY created_at DESC
        `, [mentionedCyprian.id]);
        
        if (payments.length > 0) {
          console.log(`   Found ${payments.length} payment(s):`);
          payments.forEach(p => {
            console.log(`     - KES ${p.amount} (${p.status}) on ${new Date(p.created_at).toLocaleDateString()}`);
          });
        } else {
          console.log('   No payments found');
        }
        
        // Based on the original issue, Cyprian should have received referral rewards
        // but didn't. This suggests his original balance was likely higher
        console.log('\n💡 Based on the original issue:');
        console.log('   - Cyprian invited Brian Memba kebaso (0798921142)');
        console.log('   - Cyprian should have received a referral reward');
        console.log('   - But he was not awarded');
        console.log('   - This suggests his original balance was likely higher');
        
        // Estimate original balance (task earnings + potential referral rewards)
        const estimatedOriginalBalance = taskEarningsAmount + 600; // Assuming Level 2 reward
        console.log(`\n📊 Estimated original balance: KES ${estimatedOriginalBalance.toFixed(2)}`);
        console.log(`   (Task earnings: KES ${taskEarningsAmount.toFixed(2)} + Estimated referral reward: KES 600.00)`);
        
        // Ask if we should revert to estimated balance
        console.log('\n🔄 Should we revert Cyprian\'s wallet to the estimated original balance?');
        console.log(`   Current: KES ${currentBalance.toFixed(2)}`);
        console.log(`   Estimated original: KES ${estimatedOriginalBalance.toFixed(2)}`);
        console.log(`   Difference: KES ${(estimatedOriginalBalance - currentBalance).toFixed(2)}`);
        
      } else {
        console.log('\n✅ This Cyprian was not affected by our corrections');
        console.log('   His wallet balance matches his task earnings');
      }
      
    } else {
      console.log('\n❌ Could not find the Cyprian mentioned in the original issue (0740020784)');
      console.log('   Available Cyprian accounts:');
      cyprianAccounts.forEach(c => {
        console.log(`     - ${c.name} (ID: ${c.id}, Phone: ${c.phone})`);
      });
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(60));
    console.log(`Cyprian accounts found: ${cyprianAccounts.length}`);
    console.log(`Mentioned Cyprian found: ${mentionedCyprian ? 'Yes' : 'No'}`);
    console.log(`Affected by corrections: ${mentionedCyprian && Math.abs(difference) > 0.01 ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

revertCyprianWallets();





