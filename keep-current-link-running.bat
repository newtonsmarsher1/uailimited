@echo off
echo ========================================
echo   KEEPING YOUR CURRENT LINK RUNNING
echo ========================================
echo.

echo Your current link: https://custom-mainstream-psychiatry-inc.trycloudflare.com
echo This script will keep it running permanently.
echo.

:restart
echo Starting tunnel...
echo Link: https://custom-mainstream-psychiatry-inc.trycloudflare.com
echo.
echo Press Ctrl+C to stop permanently.
echo.

cloudflared.exe tunnel --url http://localhost:3000

echo.
echo Tunnel stopped. Restarting in 5 seconds...
echo Press Ctrl+C now to exit completely.
timeout /t 5 >nul
goto restart
