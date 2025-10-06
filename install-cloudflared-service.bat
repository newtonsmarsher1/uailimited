@echo off
echo ========================================
echo   INSTALLING CLOUDFLARED AS WINDOWS SERVICE
echo ========================================
echo.

echo Step 1: Downloading latest cloudflared...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared-latest.exe' -UseBasicParsing"
echo Download complete!
echo.

echo Step 2: Installing cloudflared as Windows service...
cloudflared-latest.exe service install
echo Service installed!
echo.

echo Step 3: Starting the service...
net start cloudflared
echo Service started!
echo.

echo Step 4: Setting service to auto-start...
sc config cloudflared start= auto
echo Auto-start configured!
echo.

echo ========================================
echo   CLOUDFLARED SERVICE INSTALLED SUCCESSFULLY!
echo ========================================
echo.
echo Your cloudflared is now running as a Windows service.
echo It will start automatically when your PC boots up.
echo.
echo To manage the service:
echo - Start: net start cloudflared
echo - Stop: net stop cloudflared
echo - Status: sc query cloudflared
echo.

pause
