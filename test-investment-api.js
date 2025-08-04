const fetch = require('node-fetch');

async function testInvestmentAPI() {
  try {
    console.log('🧪 Testing investment API endpoint...');
    
    // Test data
    const testData = {
      amount: 100,
      fundName: 'UAI Starter Fund',
      walletType: 'main'
    };
    
    console.log('📋 Test data:', testData);
    
    // Make API call to investment endpoint
    const response = await fetch('http://localhost:3000/api/invest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // This will fail authentication
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    const result = await response.json();
    console.log('📋 Response body:', result);
    
    if (!response.ok) {
      console.log('❌ API call failed');
      console.log('Error:', result.error);
    } else {
      console.log('✅ API call successful');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testInvestmentAPI(); 