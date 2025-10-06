@echo off
echo ========================================
echo   QUICK WORLDWIDE PUBLIC LINK
echo ========================================
echo.

echo Creating a worldwide public link for your UAI Agency...
echo This link will work for anyone in the world without password.
echo.

REM Check if your server is running on port 3000
echo Checking if your server is running...
netstat -an | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Your server is not running on port 3000!
    echo Please start your UAI Agency server first.
    echo.
    echo To start your server, run: npm start
    echo Then run this script again.
    echo.
    pause
    exit /b
)

echo Server is running! Creating public link...
echo.

REM Download cloudflared if not exists
if not exist "cloudflared.exe" (
    echo Downloading cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing"
)

echo.
echo Starting tunnel to create your worldwide public link...
echo.
echo ========================================
echo   YOUR WORLDWIDE PUBLIC LINK:
echo ========================================
echo.
echo The link will appear below in a moment...
echo Copy and share this link with anyone worldwide!
echo.
echo Press Ctrl+C to stop the tunnel.
echo.

cloudflared.exe tunnel --url http://localhost:3000

echo.
echo Tunnel stopped. The link is no longer active.
echo Run this script again to get a new link.
echo.
pause
