#!/usr/bin/env node

const fs = require('fs');

console.log('🚀 UAI Agency - Vercel Deployment Guide\n');

console.log('📋 Prerequisites Checklist:');
console.log('✅ Code pushed to GitHub');
console.log('✅ Vercel account created');
console.log('✅ PlanetScale database set up');
console.log('✅ Environment variables ready\n');

console.log('🔧 Step 1: Set up PlanetScale Database');
console.log('1. Go to https://planetscale.com');
console.log('2. Create a free account');
console.log('3. Create a new database called "uai-agency"');
console.log('4. Get your connection details from the dashboard\n');

console.log('🔧 Step 2: Run Database Migration');
console.log('1. Update the database credentials in migrate-to-planetscale.js');
console.log('2. Run: node migrate-to-planetscale.js\n');

console.log('🔧 Step 3: Deploy to Vercel');
console.log('Option A - Using Vercel Dashboard:');
console.log('1. Go to https://vercel.com');
console.log('2. Click "New Project"');
console.log('3. Import your GitHub repository (UAI-2025)');
console.log('4. Configure environment variables');
console.log('5. Deploy!\n');

console.log('Option B - Using Vercel CLI:');
console.log('1. Install Vercel CLI: npm i -g vercel');
console.log('2. Login: vercel login');
console.log('3. Deploy: vercel\n');

console.log('🔧 Step 4: Configure Environment Variables');
console.log('In your Vercel dashboard, add these environment variables:');
console.log('');
console.log('Database Configuration:');
console.log('DB_HOST=aws.connect.psdb.cloud');
console.log('DB_USER=your_planetscale_username');
console.log('DB_PASSWORD=your_planetscale_password');
console.log('DB_NAME=uai-agency');
console.log('DB_PORT=3306');
console.log('');
console.log('JWT Secret:');
console.log('JWT_SECRET=your_secure_jwt_secret_key');
console.log('');
console.log('M-PESA Configuration:');
console.log('DARAJA_CONSUMER_KEY=your_mpesa_consumer_key');
console.log('DARAJA_CONSUMER_SECRET=your_mpesa_consumer_secret');
console.log('DARAJA_SHORTCODE=your_shortcode');
console.log('DARAJA_PASSKEY=your_passkey');
console.log('DARAJA_CALLBACK_URL=https://your-app-name.vercel.app/api/mpesa-callback\n');

console.log('🔧 Step 5: Update M-PESA Callback URL');
console.log('After deployment, update your M-PESA callback URL to:');
console.log('https://your-vercel-app-name.vercel.app/api/mpesa-callback\n');

console.log('🎉 After Deployment:');
console.log('- Your app will be available at: https://your-app-name.vercel.app');
console.log('- Admin panel: https://your-app-name.vercel.app/admin-portal');
console.log('- Default admin credentials: admin / admin123\n');

console.log('📞 Support:');
console.log('- Vercel Docs: https://vercel.com/docs');
console.log('- PlanetScale Docs: https://planetscale.com/docs');
console.log('- M-PESA Docs: https://developer.safaricom.co.ke/docs'); 