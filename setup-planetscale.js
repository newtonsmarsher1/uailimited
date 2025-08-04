#!/usr/bin/env node

const mysql = require('mysql2/promise');

console.log('🌍 Setting up PlanetScale Database for UAI Agency\n');

console.log('📋 Step-by-step instructions:');
console.log('1. Go to https://planetscale.com and create a free account');
console.log('2. Create a new database called "uai-agency"');
console.log('3. Get your connection details from the dashboard');
console.log('4. Run the database migration script\n');

console.log('🔧 Required Environment Variables for Vercel:');
console.log('DB_HOST=aws.connect.psdb.cloud');
console.log('DB_USER=your_planetscale_username');
console.log('DB_PASSWORD=your_planetscale_password');
console.log('DB_NAME=uai-agency');
console.log('DB_PORT=3306');
console.log('JWT_SECRET=your_jwt_secret_key');
console.log('DARAJA_CONSUMER_KEY=your_mpesa_consumer_key');
console.log('DARAJA_CONSUMER_SECRET=your_mpesa_consumer_secret');
console.log('DARAJA_SHORTCODE=your_shortcode');
console.log('DARAJA_PASSKEY=your_passkey');
console.log('DARAJA_CALLBACK_URL=https://your-vercel-app.vercel.app/api/mpesa-callback\n');

console.log('📊 Database Tables to Create:');
console.log('- users');
console.log('- tasks');
console.log('- investments');
console.log('- notifications');
console.log('- withdrawals');
console.log('- kcb_transfers');
console.log('- levels');
console.log('- admin_users\n');

console.log('🚀 Next Steps:');
console.log('1. Set up PlanetScale database');
console.log('2. Run database migration');
console.log('3. Configure Vercel environment variables');
console.log('4. Deploy to Vercel\n');

console.log('💡 Tips:');
console.log('- PlanetScale offers a free tier with 1 database');
console.log('- Use their CLI tool for easier database management');
console.log('- They provide automatic backups and scaling');
console.log('- Perfect for Vercel serverless functions'); 