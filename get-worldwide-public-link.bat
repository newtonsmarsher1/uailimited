@echo off
echo ========================================
echo   GETTING WORLDWIDE PUBLIC LINK
echo ========================================
echo.

echo Step 1: Checking if cloudflared is available...
if not exist "cloudflared.exe" (
    echo Downloading cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing"
    echo Download complete!
)

echo.
echo Step 2: Starting temporary public tunnel...
echo This will create a public link that works worldwide without password.
echo The link will be displayed below and saved to public-link.txt
echo.
echo Press Ctrl+C to stop the tunnel when you're done.
echo.

cloudflared.exe tunnel --url http://localhost:3000 > public-link.txt 2>&1 &

echo.
echo Your worldwide public link has been created!
echo Check the file "public-link.txt" for the link.
echo.
echo The link will work for anyone in the world without password.
echo Share this link with anyone you want!
echo.

pause
