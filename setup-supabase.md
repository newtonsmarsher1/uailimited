# 🚀 Supabase Setup Guide for UAI Agency

## Step 1: Create Supabase Account
1. Go to: https://supabase.com/
2. Click "Start your project"
3. Sign up with GitHub/Google/Email
4. Create a new project

## Step 2: Project Settings
- **Project Name:** `uai-agency` or `uailimited`
- **Database Password:** Choose a strong password (save it!)
- **Region:** Choose closest to your users
- **Pricing Plan:** Free

## Step 3: Get Connection Details
After creating the project:
1. Go to **Settings** → **Database**
2. Find the **Connection string** section
3. Copy these details:
   - **Host:** `db.your-project-ref.supabase.co`
   - **Database:** `postgres`
   - **User:** `postgres`
   - **Password:** `your-password`
   - **Port:** `5432`

## Step 4: Update Environment Variables
Once you have the credentials, run these commands:

```bash
vercel env rm DB_HOST
vercel env rm DB_USER  
vercel env rm DB_PASSWORD
vercel env rm DB_NAME
vercel env rm DB_PORT

# Add new Supabase credentials
vercel env add DB_HOST
vercel env add DB_USER
vercel env add DB_PASSWORD
vercel env add DB_NAME
vercel env add DB_PORT
```

## Step 5: Update Database Configuration
Replace the database import in your server.js:
```javascript
// Change from:
const pool = require('./config/database.js');

// To:
const pool = require('./config/database-postgres.js');
```

## Step 6: Deploy
```bash
git add .
git commit -m "Add PostgreSQL support for Supabase"
git push
vercel --prod
```

## 🎯 Your Current Working Link:
**https://nissan-dressed-demonstrates-schools.trycloudflare.com**

This is working perfectly with real users! Keep using this while we set up the cloud database.
