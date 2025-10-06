@echo off
echo ========================================
echo   DIRECT TUNNEL (NO PASSWORD)
echo ========================================
echo.

echo Starting UAI Agency server...
start /B npm start

echo Waiting 5 seconds for server to start...
timeout /t 5 /nobreak >nul

echo Starting direct tunnel without password protection...
echo This will give you a direct link like the Cloudflare one.
echo.

REM Try serveo with different options
ssh -R 80:localhost:3000 serveo.net


