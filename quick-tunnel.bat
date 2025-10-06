@echo off
echo ========================================
echo   QUICK CLOUDFLARE TUNNEL SETUP
echo ========================================
echo.

echo Starting tunnel directly...
echo Your tunnel will be available shortly.
echo Press Ctrl+C to stop.
echo.

cloudflared.exe tunnel --url http://localhost:3000


