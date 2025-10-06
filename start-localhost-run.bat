@echo off
title UAI Agency - Localhost.run Tunnel

echo ========================================
echo   UAI AGENCY - LOCALHOST.RUN TUNNEL
echo ========================================
echo.

echo Starting localhost.run tunnel...
echo This will create a public URL for your app
echo.

ssh -R 80:localhost:3000 nokey@localhost.run

pause
