#!/usr/bin/env node

/**
 * M-PESA + Ngrok Setup Script
 * This script helps configure ngrok and update the callback URL
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 M-PESA + Ngrok Setup Script');
console.log('================================\n');

// Check if ngrok is installed
function checkNgrok() {
  try {
    require('child_process').execSync('ngrok --version', { stdio: 'ignore' });
    console.log('✅ Ngrok is installed');
    return true;
  } catch (error) {
    console.log('❌ Ngrok is not installed');
    console.log('📥 Please install ngrok: https://ngrok.com/download');
    return false;
  }
}

// Update callback URL in server.js
function updateCallbackUrl(ngrokUrl) {
  try {
    const serverPath = path.join(__dirname, 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Update the callback URL
    const newCallbackUrl = `${ngrokUrl}/api/mpesa-callback`;
    serverContent = serverContent.replace(
      /callbackUrl: process\.env\.DARAJA_CALLBACK_URL \|\| '[^']*'/,
      `callbackUrl: process.env.DARAJA_CALLBACK_URL || '${newCallbackUrl}'`
    );
    
    fs.writeFileSync(serverPath, serverContent);
    console.log(`✅ Updated callback URL to: ${newCallbackUrl}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to update callback URL:', error.message);
    return false;
  }
}

// Create .env file
function createEnvFile(ngrokUrl) {
  const envContent = `# M-PESA Daraja API Configuration
DARAJA_CONSUMER_KEY=KrfGaEKOmQiAkDZtHe0yt8Hu8BIGgBLijxAHcGwBr2w1CAqx
DARAJA_CONSUMER_SECRET=9vALTqheARYBGkTsNIqbMA9zNAnf2HGm8rbtUqfTLp1sQB1bUU0Vv5ZvG6sq2XYb
DARAJA_SHORTCODE=522522
DARAJA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
DARAJA_CALLBACK_URL=${ngrokUrl}/api/mpesa-callback

# Environment
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=uai_agency

# Server Configuration
PORT=3000
`;

  try {
    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file with M-PESA credentials');
    return true;
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
    return false;
  }
}

// Main setup function
async function setupMpesaNgrok() {
  console.log('🔧 Setting up M-PESA with Ngrok...\n');
  
  // Check ngrok installation
  if (!checkNgrok()) {
    console.log('\n📋 Next Steps:');
    console.log('1. Install ngrok from https://ngrok.com/download');
    console.log('2. Run: ngrok config add-authtoken YOUR_TOKEN');
    console.log('3. Run: ngrok http 3000');
    console.log('4. Copy the HTTPS URL and run this script again');
    return;
  }
  
  // Get ngrok URL from user
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('🌐 Enter your ngrok HTTPS URL (e.g., https://abc123.ngrok.io): ', (ngrokUrl) => {
    rl.close();
    
    if (!ngrokUrl.startsWith('https://')) {
      console.log('❌ Please enter a valid HTTPS URL');
      return;
    }
    
    console.log('\n🔧 Updating configuration...');
    
    // Update callback URL
    if (updateCallbackUrl(ngrokUrl)) {
      // Create .env file
      createEnvFile(ngrokUrl);
      
      console.log('\n✅ Setup completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Start your server: node server.js');
      console.log('2. Test M-PESA integration');
      console.log('3. Update callback URL in Safaricom Daraja portal');
      console.log(`   Callback URL: ${ngrokUrl}/api/mpesa-callback`);
    }
  });
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupMpesaNgrok().catch(console.error);
}

module.exports = { setupMpesaNgrok, updateCallbackUrl, createEnvFile }; 