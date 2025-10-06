@echo off
echo ========================================
echo   CREATING PERMANENT LINK FOR UAI AGENCY
echo ========================================
echo.

echo This will create a permanent link that never changes!
echo.

echo Step 1: Downloading latest cloudflared...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared-permanent.exe' -UseBasicParsing"
echo Download complete!
echo.

echo Step 2: Authenticating with Cloudflare...
echo This will open your browser to login to Cloudflare.
echo You need a FREE Cloudflare account for a permanent link.
echo.
pause
cloudflared-permanent.exe tunnel login
echo.

echo Step 3: Creating permanent tunnel...
cloudflared-permanent.exe tunnel create uai-agency-permanent
echo.

echo Step 4: Creating configuration file...
if not exist ".cloudflared" mkdir ".cloudflared"

echo tunnel: uai-agency-permanent > .cloudflared\config.yml
echo credentials-file: C:\Users\%USERNAME%\.cloudflared\uai-agency-permanent.json >> .cloudflared\config.yml
echo. >> .cloudflared\config.yml
echo ingress: >> .cloudflared\config.yml
echo   - hostname: uai-agency-permanent.trycloudflare.com >> .cloudflared\config.yml
echo     service: http://localhost:3000 >> .cloudflared\config.yml
echo   - service: http_status:404 >> .cloudflared\config.yml
echo.

echo Step 5: Starting permanent tunnel...
echo Your PERMANENT link will be: https://uai-agency-permanent.trycloudflare.com
echo This link will NEVER change!
echo.
echo Press Ctrl+C to stop the tunnel.
echo.

cloudflared-permanent.exe tunnel run uai-agency-permanent
