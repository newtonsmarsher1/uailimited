@echo off
title WireGuard Client Setup

echo ========================================
echo   WIREGUARD CLIENT SETUP
echo ========================================
echo.

REM Check if WireGuard is installed
where wg >nul 2>nul
if %errorlevel% neq 0 (
    echo WireGuard is not installed. Please install it first:
    echo 1. Download from: https://www.wireguard.com/install/
    echo 2. Or use winget: winget install WireGuard.WireGuard
    echo.
    pause
    exit /b 1
)

echo WireGuard found! Setting up client configuration...
echo.

REM Create WireGuard directory if it doesn't exist
if not exist "%USERPROFILE%\WireGuard" mkdir "%USERPROFILE%\WireGuard"

REM Generate client keys
cd /d "%USERPROFILE%\WireGuard"
wg genkey > client_private_key.txt
wg pubkey < client_private_key.txt > client_public_key.txt

echo Client keys generated!
echo.

REM Get server details from user
set /p SERVER_IP="Enter your VPS IP address: "
set /p SERVER_PUBLIC_KEY="Enter server public key: "

REM Create client configuration
echo [Interface] > client.conf
echo PrivateKey = %~dp0client_private_key.txt >> client.conf
echo Address = 10.0.0.2/24 >> client.conf
echo DNS = 8.8.8.8 >> client.conf
echo. >> client.conf
echo [Peer] >> client.conf
echo PublicKey = %SERVER_PUBLIC_KEY% >> client.conf
echo Endpoint = %SERVER_IP%:51820 >> client.conf
echo AllowedIPs = 0.0.0.0/0 >> client.conf
echo PersistentKeepalive = 25 >> client.conf

echo ========================================
echo   CLIENT CONFIGURATION CREATED!
echo ========================================
echo.
echo Configuration saved to: %USERPROFILE%\WireGuard\client.conf
echo.
echo Your client public key is:
type client_public_key.txt
echo.
echo IMPORTANT: Add this public key to your server configuration!
echo.
echo Next steps:
echo 1. Add the client public key to your server's /etc/wireguard/wg0.conf
echo 2. Run the tunnel management script
echo.
pause
