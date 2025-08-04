# Vercel Deployment Guide for UAI Agency

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Cloud Database**: You'll need a cloud MySQL database (PlanetScale, Railway, or similar)

## Step 1: Set Up Cloud Database

### Option A: PlanetScale (Recommended)
1. Go to [planetscale.com](https://planetscale.com) and create an account
2. Create a new database
3. Get your connection details (host, username, password, database name)

### Option B: Railway
1. Go to [railway.app](https://railway.app) and create an account
2. Create a new MySQL database
3. Get your connection details

### Option C: AWS RDS
1. Set up an RDS MySQL instance on AWS
2. Configure security groups and get connection details

## Step 2: Prepare Your Code

### 1. Update Database Configuration
Replace the database import in `server.js`:
```javascript
// Change this line:
const pool = require('./db.js');

// To this:
const pool = require('./db-vercel.js');
```

### 2. Update M-PESA Configuration
Update the DARAJA configuration in `server.js` to use environment variables:
```javascript
const DARAJA = {
  consumerKey: process.env.DARAJA_CONSUMER_KEY || 'your_key',
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET || 'your_secret',
  shortCode: process.env.DARAJA_SHORTCODE || '522522',
  passkey: process.env.DARAJA_PASSKEY || 'your_passkey',
  callbackUrl: process.env.DARAJA_CALLBACK_URL || 'your_callback_url',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
};
```

## Step 3: Deploy to Vercel

### Method 1: Using Vercel CLI
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

### Method 2: Using GitHub Integration
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure the project settings

## Step 4: Configure Environment Variables

In your Vercel dashboard, go to your project settings and add these environment variables:

### Database Configuration
```
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306
```

### M-PESA Configuration
```
DARAJA_CONSUMER_KEY=your_mpesa_consumer_key
DARAJA_CONSUMER_SECRET=your_mpesa_consumer_secret
DARAJA_SHORTCODE=your_shortcode
DARAJA_PASSKEY=your_passkey
DARAJA_CALLBACK_URL=https://your-vercel-app.vercel.app/api/mpesa-callback
```

### JWT Secret
```
JWT_SECRET=your_jwt_secret_key
```

## Step 5: Database Migration

After deployment, you'll need to run your database migrations. You can do this by:

1. Creating a migration script
2. Running it manually on your cloud database
3. Or setting up a database migration service

## Step 6: Update M-PESA Callback URL

Update your M-PESA callback URL to point to your Vercel deployment:
```
https://your-app-name.vercel.app/api/mpesa-callback
```

## Important Notes

### Limitations
- Vercel functions have a 10-second timeout limit
- No persistent file storage (use cloud storage for files)
- Serverless functions (stateless)

### Recommendations
1. Use connection pooling for database connections
2. Implement proper error handling for timeouts
3. Consider using Vercel's Edge Functions for better performance
4. Set up proper CORS configuration for your domain

### Monitoring
- Use Vercel's built-in analytics and monitoring
- Set up error tracking (Sentry, LogRocket, etc.)
- Monitor database performance

## Troubleshooting

### Common Issues
1. **Database Connection Timeout**: Increase timeout values in database config
2. **M-PESA Callback Issues**: Ensure callback URL is publicly accessible
3. **Environment Variables**: Double-check all environment variables are set correctly
4. **CORS Issues**: Update CORS configuration for your domain

### Support
- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Vercel Community: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions) 