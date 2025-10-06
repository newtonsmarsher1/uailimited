@echo off
title UAI Agency - WireGuard Tunnel

REM Check if WireGuard is running
wg show >nul 2>nul
if %errorlevel% neq 0 (
    echo WireGuard tunnel is not active. Starting...
    wg-quick up "%USERPROFILE%\WireGuard\client.conf"
    if %errorlevel% neq 0 (
        echo Failed to start WireGuard tunnel!
        echo Please check your configuration.
        pause
        exit /b 1
    )
)

:loop
echo ========================================
echo   UAI AGENCY - WIREGUARD TUNNEL RUNNING
echo ========================================
echo.
echo Tunnel Status: ACTIVE
echo Local App: http://localhost:3000
echo Public Access: http://YOUR_VPS_IP (replace with your VPS IP)
echo.
echo Press Ctrl+C to stop the tunnel
echo.

REM Keep the script running and monitor the tunnel
:monitor
wg show >nul 2>nul
if %errorlevel% neq 0 (
    echo Tunnel disconnected! Attempting to reconnect...
    wg-quick up "%USERPROFILE%\WireGuard\client.conf"
    timeout /t 5 >nul
)
timeout /t 10 >nul
goto monitor
