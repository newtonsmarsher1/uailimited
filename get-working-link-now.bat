@echo off
echo ========================================
echo   GETTING YOUR WORKING LINK NOW
echo ========================================
echo.

echo Step 1: Stopping any existing tunnels...
taskkill /f /im cloudflared.exe >nul 2>&1
timeout /t 2 >nul

echo Step 2: Starting new tunnel...
echo.
echo ========================================
echo   YOUR NEW WORKING LINK:
echo ========================================
echo.
echo Starting tunnel... The link will appear below:
echo.

cloudflared.exe tunnel --url http://localhost:3000
