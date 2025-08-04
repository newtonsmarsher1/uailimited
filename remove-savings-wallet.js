const fs = require('fs');
const path = require('path');

function removeSavingsWallet() {
  try {
    console.log('🗑️ Removing savings wallet options...');
    
    const filePath = path.join(__dirname, 'public', 'financial-management-fund.html');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove all savings wallet options
    const originalLines = content.split('\n');
    const newLines = [];
    
    for (let line of originalLines) {
      // Skip lines that contain savings wallet options
      if (line.includes('value="savings"') || line.includes('Savings Wallet')) {
        console.log('❌ Removing line:', line.trim());
        continue;
      }
      newLines.push(line);
    }
    
    const newContent = newLines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log('✅ Successfully removed all savings wallet options');
    
  } catch (error) {
    console.error('❌ Error removing savings wallet options:', error);
  }
}

removeSavingsWallet(); 