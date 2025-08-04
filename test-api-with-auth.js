const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testInvestmentWithAuth() {
  try {
    console.log('🔐 Testing with authentication...');
    
    // Step 1: Login
    console.log('📝 Logging in...');
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
    
    console.log('📊 Login response status:', loginResponse.status);
    
    const loginResult = await loginResponse.json();
    console.log('📋 Login result:', loginResult);
    
    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }
    
    // Step 2: Test investment with token
    console.log('💰 Testing investment with token...');
    const investResponse = await fetch('http://localhost:3000/api/invest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginResult.token}`
      },
      body: JSON.stringify({
        amount: 50,
        fundName: 'UAI Starter Fund',
        walletType: 'main'
      })
    });
    
    console.log('📊 Investment response status:', investResponse.status);
    
    const investResult = await investResponse.text();
    console.log('📋 Investment response body:', investResult);
    
    if (investResponse.ok) {
      console.log('✅ Investment API is working!');
    } else {
      console.log('❌ Investment API failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInvestmentWithAuth(); 