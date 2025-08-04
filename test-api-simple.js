const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testInvestmentAPI() {
  try {
    console.log('🧪 Testing investment API directly...');
    
    // Test without authentication first
    const response = await fetch('http://localhost:3000/api/invest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 50,
        fundName: 'UAI Starter Fund',
        walletType: 'main'
      })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', response.headers.raw());
    
    const result = await response.text();
    console.log('📋 Response body:', result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInvestmentAPI(); 