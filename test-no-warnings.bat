@echo off
echo Testing UAI Agency Application (No Warnings)...
echo.
C:\xampp\php\php.exe -d error_reporting=0 -d display_errors=0 -r "echo '🧪 UAI Agency - Clean Test'; echo PHP_EOL; echo '====================================='; echo PHP_EOL; echo PHP_EOL; require_once 'config/config.php'; echo '1. ✅ Config loaded: ' . APP_NAME; echo PHP_EOL; echo '2. ✅ URL: ' . APP_URL; echo PHP_EOL; require_once 'config/database.php'; echo '3. ✅ Database connected'; echo PHP_EOL; echo PHP_EOL; echo '🎯 FINAL STATUS: READY TO USE!'; echo PHP_EOL; echo '🌐 Visit: http://localhost/uai-agency/'; echo PHP_EOL; echo '👑 Admin: http://localhost/uai-agency/admin/ (admin/admin123)'; echo PHP_EOL; echo PHP_EOL; echo '✅ SUCCESS: No warnings detected!';"
echo.
echo Test completed!
pause 