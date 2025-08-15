# UAI Agency - XAMPP Setup Guide

## 🎯 Quick Setup with XAMPP

### Step 1: Start XAMPP Services

1. **Open XAMPP Control Panel**
2. **Start Apache and MySQL**:
   - Click "Start" next to Apache
   - Click "Start" next to MySQL
   - Both should show green status

### Step 2: Copy Files to XAMPP

1. **Navigate to XAMPP directory**:
   - Windows: `C:\xampp\htdocs\`
   - Mac: `/Applications/XAMPP/htdocs/`
   - Linux: `/opt/lampp/htdocs/`

2. **Create project folder**:
   ```
   C:\xampp\htdocs\uai-agency\
   ```

3. **Copy all PHP files** to this folder:
   - `index.php`
   - `config/` folder
   - `includes/` folder
   - `api/` folder
   - `public/` folder
   - `.htaccess`
   - `migrate-to-mysql.php`
   - `setup-local.php`

### Step 3: Create Database

1. **Open phpMyAdmin**:
   - Go to: `http://localhost/phpmyadmin`
   - Username: `root`
   - Password: (leave blank by default)

2. **Create database**:
   ```sql
   CREATE DATABASE uai_agency;
   ```

### Step 4: Configure Environment

1. **Create `.env` file** in your project folder:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=uai_agency
   APP_ENV=development
   JWT_SECRET=your-secret-key-here
   APP_URL=http://localhost/uai-agency
   ```

### Step 5: Run Database Migration

1. **Open browser** and go to:
   ```
   http://localhost/uai-agency/migrate-to-mysql.php
   ```

2. **You should see**:
   ```
   🗄️ UAI Agency - Database Migration
   
   🔌 Connecting to database...
   ✅ Connected successfully!
   
   📊 Creating users table...
   ✅ Users table created
   ...
   🎉 Database migration completed successfully!
   ```

### Step 6: Test Your Application

1. **Visit your application**:
   ```
   http://localhost/uai-agency/
   ```

2. **Register a new account**:
   - Phone: `254700000000`
   - Password: `password123`
   - Name: `Test User`

3. **Login and test features**:
   - Complete tasks
   - Check wallet balance
   - Try investment features

### Step 7: Access Admin Panel

1. **Go to admin panel**:
   ```
   http://localhost/uai-agency/admin/
   ```

2. **Login with**:
   - Username: `admin`
   - Password: `admin123`

## 🔧 Troubleshooting

### If Apache won't start:
- Check if port 80 is in use
- Try changing Apache port in XAMPP config
- Restart XAMPP as administrator

### If MySQL won't start:
- Check if port 3306 is in use
- Try changing MySQL port
- Check error logs in XAMPP

### If database connection fails:
- Verify MySQL is running
- Check database credentials in `.env`
- Ensure database `uai_agency` exists

### If files not found:
- Check file permissions
- Verify file paths
- Ensure all files are in correct folder

## 📁 File Structure in XAMPP

```
C:\xampp\htdocs\uai-agency\
├── index.php
├── .env
├── .htaccess
├── migrate-to-mysql.php
├── setup-local.php
├── config/
│   ├── database.php
│   └── config.php
├── includes/
│   └── functions.php
├── api/
│   └── router.php
└── public/
    ├── index.html
    ├── css/
    ├── js/
    └── assets/
```

## 🎯 Next Steps

1. **Test all features**:
   - User registration/login
   - Task completion
   - Investment creation
   - Withdrawal requests

2. **Customize the application**:
   - Modify task rewards
   - Add new investment funds
   - Change payment methods

3. **Deploy to live hosting**:
   - Choose hosting provider
   - Upload files
   - Configure production database

## 🚀 Success!

Your UAI Agency application is now running locally with XAMPP!

- **Main URL**: `http://localhost/uai-agency/`
- **Admin Panel**: `http://localhost/uai-agency/admin/`
- **API Endpoints**: `http://localhost/uai-agency/api/`

Start testing and customizing your application! 