@echo off
echo 🚀 UAI Agency - XAMPP Setup Script
echo.

echo 📋 Checking XAMPP installation...
if not exist "C:\xampp\htdocs" (
    echo ❌ XAMPP not found in C:\xampp\htdocs
    echo Please install XAMPP first: https://www.apachefriends.org/
    pause
    exit /b 1
)

echo ✅ XAMPP found!

echo.
echo 📁 Creating project folder...
if not exist "C:\xampp\htdocs\uai-agency" (
    mkdir "C:\xampp\htdocs\uai-agency"
    echo ✅ Created C:\xampp\htdocs\uai-agency
) else (
    echo ✅ Project folder already exists
)

echo.
echo 📋 Creating .env file...
(
echo DB_HOST=localhost
echo DB_USER=root
echo DB_PASSWORD=
echo DB_NAME=uai_agency
echo APP_ENV=development
echo JWT_SECRET=your-secret-key-change-this-in-production
echo APP_URL=http://localhost/uai-agency
) > "C:\xampp\htdocs\uai-agency\.env"

echo ✅ Created .env file

echo.
echo 📊 Next Steps:
echo 1. Start XAMPP Control Panel
echo 2. Start Apache and MySQL services
echo 3. Open http://localhost/phpmyadmin
echo 4. Create database: uai_agency
echo 5. Copy all PHP files to C:\xampp\htdocs\uai-agency\
echo 6. Visit http://localhost/uai-agency/migrate-to-mysql.php
echo 7. Test your application at http://localhost/uai-agency/
echo.
echo 🎯 Your application will be available at:
echo    http://localhost/uai-agency/
echo.
pause 