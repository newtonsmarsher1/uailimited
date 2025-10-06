@echo off
title UAI Agency - LocalTunnel

echo ========================================
echo   UAI AGENCY - LOCALTUNNEL STARTING
echo ========================================
echo.

echo Starting LocalTunnel for port 3000...
echo Your link will appear below:
echo.

lt --port 3000 --print-requests

pause
