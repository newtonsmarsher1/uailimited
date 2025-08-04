const fetch = require('node-fetch');

async function testCompleteInvestmentFlow() {
  try {
    console.log('🧪 Testing complete investment flow...');
    
    // Step 1: Login to get a valid token
    console.log('\n1️⃣ Logging in...');
    const loginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '+254708288313',
        password: 'Caroline'
      })
    });
    
    console.log(`📊 Login status: ${loginResponse.status}`);
    
    if (!loginResponse.ok) {
      const loginError = await loginResponse.json();
      console.log('❌ Login failed:', loginError);
      return;
    }
    
    const loginResult = await loginResponse.json();
    console.log('✅ Login successful');
    console.log('👤 User ID:', loginResult.user.id);
    console.log('💰 Balance:', loginResult.user.balance);
    
    const token = loginResult.token;
    
    // Step 2: Test investment creation
    console.log('\n2️⃣ Testing investment creation...');
    const investmentData = {
      amount: 100,
      fundName: 'UAI Starter Fund',
      walletType: 'main'
    };
    
    console.log('📋 Investment data:', investmentData);
    
    const investmentResponse = await fetch('http://localhost:3000/api/invest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(investmentData)
    });
    
    console.log(`📊 Investment status: ${investmentResponse.status}`);
    
    const investmentResult = await investmentResponse.json();
    console.log('📋 Investment response:', investmentResult);
    
    if (!investmentResponse.ok) {
      console.log('❌ Investment failed:', investmentResult.error);
    } else {
      console.log('✅ Investment successful!');
      console.log('💰 New balance:', investmentResult.newBalance);
      console.log('📊 Expected return:', investmentResult.investment.expectedReturn);
    }
    
  } catch (error) {
    console.error('❌ Error in test:', error.message);
  }
}

testCompleteInvestmentFlow(); 