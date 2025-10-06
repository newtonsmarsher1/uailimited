@echo off
echo ========================================
echo   UAI AGENCY QUICK ACCESS SETUP
echo ========================================
echo.
echo Your server is running on:
echo   Local: http://localhost:3000
echo   Network: http://192.168.100.4:3000
echo.
echo Admin Portal: http://localhost:3001
echo.
echo Press any key to open local access...
pause >nul
start http://localhost:3000
echo.
echo Press any key to open admin portal...
pause >nul
start http://localhost:3001
echo.
echo ========================================
echo   CLOUDFLARE TUNNEL SETUP (Optional)
echo ========================================
echo.
echo 1. Download cloudflared.exe from:
echo    https://github.com/cloudflare/cloudflared/releases/latest
echo.
echo 2. Run: cloudflared.exe tunnel login
echo 3. Run: cloudflared.exe tunnel create uai-agency
echo 4. Run: cloudflared.exe tunnel run uai-agency
echo.
pause


