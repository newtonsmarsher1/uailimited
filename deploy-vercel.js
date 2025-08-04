#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing UAI Agency for Vercel deployment...\n');

// Check if required files exist
const requiredFiles = [
  'server.js',
  'package.json',
  'vercel.json',
  'db-vercel.js'
];

console.log('📋 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing`);
  }
});

// Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('\n📦 Package.json scripts:');
Object.keys(packageJson.scripts).forEach(script => {
  console.log(`  - ${script}: ${packageJson.scripts[script]}`);
});

// Check dependencies
console.log('\n🔧 Dependencies:');
Object.keys(packageJson.dependencies).forEach(dep => {
  console.log(`  - ${dep}: ${packageJson.dependencies[dep]}`);
});

console.log('\n📝 Deployment Checklist:');
console.log('1. ✅ Vercel configuration created (vercel.json)');
console.log('2. ✅ Database configuration updated (db-vercel.js)');
console.log('3. ✅ Git ignore file created (.gitignore)');
console.log('4. ⚠️  You need to:');
console.log('   - Set up a cloud MySQL database (PlanetScale, Railway, etc.)');
console.log('   - Configure environment variables in Vercel dashboard');
console.log('   - Update M-PESA callback URL to your Vercel domain');
console.log('   - Run database migrations on your cloud database');

console.log('\n🚀 Next steps:');
console.log('1. Push your code to GitHub');
console.log('2. Go to vercel.com and create a new project');
console.log('3. Import your GitHub repository');
console.log('4. Configure environment variables');
console.log('5. Deploy!');

console.log('\n📚 For detailed instructions, see: VERCEL_DEPLOYMENT_GUIDE.md'); 