@echo off
echo ========================================
echo   GETTING YOUR WORLDWIDE PUBLIC LINK
echo ========================================
echo.

echo Starting tunnel and showing your public link...
echo.

REM Download cloudflared if not exists
if not exist "cloudflared.exe" (
    echo Downloading cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing"
)

echo.
echo ========================================
echo   YOUR WORLDWIDE PUBLIC LINK:
echo ========================================
echo.
echo Starting tunnel... The link will appear below:
echo.

cloudflared.exe tunnel --url http://localhost:3000
