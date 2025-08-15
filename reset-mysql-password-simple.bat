@echo off
echo 🔧 MySQL Password Reset - Simple Method
echo.

echo 📋 Current Situation:
echo - Windows MySQL is running on port 3306
echo - We need to reset the root password
echo - Then update the .env file
echo.

echo 🎯 Step-by-Step Instructions:
echo.
echo 1. Open Command Prompt as Administrator:
echo    - Press Windows Key + X
echo    - Select "Windows PowerShell (Admin)"
echo.
echo 2. Navigate to MySQL bin folder:
echo    cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
echo.
echo 3. Stop MySQL service:
echo    net stop MySQL80
echo.
echo 4. Start MySQL in safe mode:
echo    mysqld --skip-grant-tables --user=mysql
echo.
echo 5. Open another Command Prompt and run:
echo    mysql -u root
echo.
echo 6. In MySQL prompt, run these commands:
echo    ALTER USER 'root'@'localhost' IDENTIFIED BY 'password123';
echo    FLUSH PRIVILEGES;
echo    EXIT;
echo.
echo 7. Stop the safe mode MySQL (Ctrl+C)
echo.
echo 8. Start MySQL service:
echo    net start MySQL80
echo.
echo 9. Test connection:
echo    mysql -u root -ppassword123
echo.

echo 💡 Alternative: Use XAMPP MySQL
echo - Stop Windows MySQL service manually
echo - Start XAMPP MySQL instead
echo.

echo 🔍 Current MySQL Status:
netstat -ano | findstr :3306

echo.
pause 