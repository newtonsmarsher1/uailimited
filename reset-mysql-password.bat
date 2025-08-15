@echo off
echo 🔧 MySQL Password Reset Helper
echo.

echo 📋 Current Issue:
echo - MySQL 8.0 requires password authentication
echo - phpMyAdmin cannot connect without correct password
echo.

echo 🎯 Solution Steps:
echo.
echo Step 1: Stop MySQL Service
echo - Open Services (services.msc)
echo - Find "MySQL80" service
echo - Right-click and select "Stop"
echo.

echo Step 2: Start MySQL in Safe Mode
echo - Open Command Prompt as Administrator
echo - Navigate to MySQL bin folder (usually):
echo   C:\Program Files\MySQL\MySQL Server 8.0\bin
echo - Run: mysqld --skip-grant-tables --user=mysql
echo.

echo Step 3: Reset Password
echo - Open another Command Prompt
echo - Run: mysql -u root
echo - In MySQL prompt, run:
echo   ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';
echo   FLUSH PRIVILEGES;
echo   EXIT;
echo.

echo Step 4: Restart MySQL Service
echo - Go back to Services
echo - Start "MySQL80" service
echo.

echo Step 5: Update .env File
echo - Update DB_PASSWORD in .env file with new password
echo.

echo 💡 Alternative: Use XAMPP MySQL Instead
echo - Stop Windows MySQL service
echo - Start XAMPP MySQL (no password needed)
echo.

echo 🔍 Current MySQL Status:
Get-Service | Where-Object {$_.Name -like "*mysql*"}

echo.
pause 