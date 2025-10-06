@echo off
echo ========================================
echo   CLOUDFLARE TUNNEL SETUP FOR UAI AGENCY
echo ========================================
echo.

echo Step 1: Downloading cloudflared...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing"
echo Download complete!
echo.

echo Step 2: Testing cloudflared...
cloudflared.exe version
echo.

echo Step 3: Authenticating with Cloudflare...
echo This will open your browser to login to Cloudflare.
pause
cloudflared.exe tunnel login
echo.

echo Step 4: Creating tunnel...
cloudflared.exe tunnel create uai-agency
echo.

echo Step 5: Creating configuration file...
echo tunnel: uai-agency > config.yml
echo credentials-file: C:\Users\PC\.cloudflared\^>uai-agency^<.json >> config.yml
echo. >> config.yml
echo ingress: >> config.yml
echo   - hostname: uai-agency.your-domain.com >> config.yml
echo     service: http://localhost:3000 >> config.yml
echo   - service: http_status:404 >> config.yml
echo.

echo Step 6: Starting tunnel...
echo Your tunnel will be available at: https://uai-agency.your-domain.com
echo Press Ctrl+C to stop the tunnel.
echo.
cloudflared.exe tunnel run uai-agency


