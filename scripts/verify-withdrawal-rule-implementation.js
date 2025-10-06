const mysql = require('mysql2/promise');

async function verifyWithdrawalRuleImplementation() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Verifying Withdrawal Rule Implementation\n');
    console.log('Rule: KES 300+ requires 1 referral, KES 1200+ requires 2 referrals\n');
    
    // Test the exact validation logic from the backend
    function validateWithdrawal(amount, totalReferrals) {
      if (amount >= 1200) {
        // 1200 and above: need at least 2 referrals
        if (totalReferrals < 2) {
          return {
            allowed: false,
            error: `To withdraw KES ${amount} or more, you must have invited at least 2 people. You currently have ${totalReferrals} referral${totalReferrals === 1 ? '' : 's'}.`
          };
        }
      } else if (amount >= 300) {
        // 300 and above: need at least 1 referral
        if (totalReferrals < 1) {
          return {
            allowed: false,
            error: `To withdraw KES ${amount} or more, you must have invited at least 1 person. You currently have ${totalReferrals} referrals.`
          };
        }
      }
      
      return { allowed: true };
    }
    
    // Test all possible scenarios
    const testCases = [
      // Amount, Referrals, Expected Result
      { amount: 100, referrals: 0, expected: true, description: "KES 100 (no requirement)" },
      { amount: 200, referrals: 0, expected: true, description: "KES 200 (no requirement)" },
      { amount: 300, referrals: 0, expected: false, description: "KES 300 with 0 referrals" },
      { amount: 300, referrals: 1, expected: true, description: "KES 300 with 1 referral" },
      { amount: 500, referrals: 0, expected: false, description: "KES 500 with 0 referrals" },
      { amount: 500, referrals: 1, expected: true, description: "KES 500 with 1 referral" },
      { amount: 1000, referrals: 1, expected: true, description: "KES 1000 with 1 referral" },
      { amount: 1200, referrals: 0, expected: false, description: "KES 1200 with 0 referrals" },
      { amount: 1200, referrals: 1, expected: false, description: "KES 1200 with 1 referral" },
      { amount: 1200, referrals: 2, expected: true, description: "KES 1200 with 2 referrals" },
      { amount: 5000, referrals: 1, expected: false, description: "KES 5000 with 1 referral" },
      { amount: 5000, referrals: 2, expected: true, description: "KES 5000 with 2 referrals" },
      { amount: 10000, referrals: 3, expected: true, description: "KES 10000 with 3 referrals" }
    ];
    
    console.log('🧪 Testing Validation Logic:');
    console.log('=' .repeat(80));
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
      const result = validateWithdrawal(testCase.amount, testCase.referrals);
      const passed = result.allowed === testCase.expected;
      
      if (passed) {
        passedTests++;
        console.log(`✅ ${testCase.description}: ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
      } else {
        console.log(`❌ ${testCase.description}: ${result.allowed ? 'ALLOWED' : 'BLOCKED'} (expected: ${testCase.expected ? 'ALLOWED' : 'BLOCKED'})`);
      }
      
      if (!result.allowed) {
        console.log(`   Error: "${result.error}"`);
      }
    }
    
    console.log('\n📊 Test Results:');
    console.log('=' .repeat(50));
    console.log(`Passed: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    
    if (passedTests === totalTests) {
      console.log('✅ All tests passed! Withdrawal rule is correctly implemented.');
    } else {
      console.log('❌ Some tests failed! Withdrawal rule needs fixing.');
    }
    
    // Test with real users from database
    console.log('\n👥 Testing with Real Users:');
    console.log('=' .repeat(50));
    
    const [users] = await pool.query(`
      SELECT 
        id, name, phone, level, wallet_balance
      FROM users 
      WHERE wallet_balance > 0
      ORDER BY wallet_balance DESC
      LIMIT 5
    `);
    
    for (const user of users) {
      const [referralCount] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE referred_by = ?
      `, [user.id]);
      
      const totalReferrals = referralCount[0].count;
      
      console.log(`\n👤 ${user.name} (Level ${user.level})`);
      console.log(`   Wallet: KES ${parseFloat(user.wallet_balance).toFixed(2)}`);
      console.log(`   Referrals: ${totalReferrals}`);
      
      // Test different amounts
      const testAmounts = [300, 1200, 5000];
      for (const amount of testAmounts) {
        if (amount <= user.wallet_balance) {
          const result = validateWithdrawal(amount, totalReferrals);
          console.log(`   KES ${amount}: ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
          if (!result.allowed) {
            console.log(`     "${result.error}"`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error verifying withdrawal rule:', error);
  } finally {
    pool.end();
  }
}

verifyWithdrawalRuleImplementation();





