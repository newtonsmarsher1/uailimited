@echo off
echo 🔧 MySQL Port Conflict Fix
echo.

echo 📋 Current situation:
echo - Port 3306 is being used by Windows MySQL service
echo - XAMPP MySQL cannot start because of this conflict
echo.

echo 🎯 Solution Options:
echo.
echo Option 1: Stop Windows MySQL Service (Recommended)
echo - Right-click this file and "Run as administrator"
echo - This will stop the Windows MySQL service
echo - Then start XAMPP MySQL
echo.

echo Option 2: Change XAMPP MySQL Port
echo - Open XAMPP Control Panel
echo - Click "Config" next to MySQL
echo - Select "my.ini"
echo - Change port=3306 to port=3307
echo - Save and restart XAMPP MySQL
echo.

echo Option 3: Use Windows MySQL Instead
echo - Keep Windows MySQL running
echo - Update your .env file to use existing MySQL
echo - No need to start XAMPP MySQL
echo.

echo 🔍 Checking current MySQL status...
netstat -ano | findstr :3306

echo.
echo 💡 Recommended Action:
echo 1. Right-click this file and "Run as administrator"
echo 2. Choose Option 1 to stop Windows MySQL
echo 3. Start XAMPP MySQL from Control Panel
echo.

pause 