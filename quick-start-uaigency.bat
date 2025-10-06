@echo off
echo ========================================
echo   UAI AGENCY QUICK START
echo ========================================
echo.

echo Step 1: Starting UAI Agency server...
start /B npm start

echo Step 2: Waiting for server to start...
timeout /t 5 /nobreak

echo Step 3: Starting professional tunnel...
echo Your professional URL will be displayed below:
echo.

cloudflared.exe tunnel --url http://localhost:3000
