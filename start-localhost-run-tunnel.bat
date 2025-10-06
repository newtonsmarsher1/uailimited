@echo off
title UAI Agency - localhost.run

echo ========================================
echo   UAI AGENCY - LOCALHOST.RUN TUNNEL
echo ========================================
echo.

echo Starting localhost.run tunnel...
echo Your website will be available at a public URL
echo.

echo yes | ssh -R 80:localhost:3000 nokey@localhost.run

pause
