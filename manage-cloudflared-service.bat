@echo off
echo ========================================
echo   CLOUDFLARED SERVICE MANAGER
echo ========================================
echo.

echo Current cloudflared service status:
sc query cloudflared
echo.

echo Choose an option:
echo 1. Start cloudflared service
echo 2. Stop cloudflared service
echo 3. Restart cloudflared service
echo 4. Check service status
echo 5. View service logs
echo 6. Exit
echo.

set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
    echo Starting cloudflared service...
    net start cloudflared
    echo Service started!
) else if "%choice%"=="2" (
    echo Stopping cloudflared service...
    net stop cloudflared
    echo Service stopped!
) else if "%choice%"=="3" (
    echo Restarting cloudflared service...
    net stop cloudflared
    timeout /t 2 >nul
    net start cloudflared
    echo Service restarted!
) else if "%choice%"=="4" (
    echo Checking service status...
    sc query cloudflared
) else if "%choice%"=="5" (
    echo Opening service logs...
    eventvwr.msc /c:Application
) else if "%choice%"=="6" (
    echo Goodbye!
    exit /b
) else (
    echo Invalid choice!
)

echo.
pause
