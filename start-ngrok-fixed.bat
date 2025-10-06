@echo off
setlocal ENABLEDELAYEDEXPANSION

title UAI Agency - ngrok (Fixed Domain)

echo ========================================
echo   UAI AGENCY - NGROK (FIXED DOMAIN)
echo ========================================
echo.

REM Ensure ngrok.exe is available
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%~dp0ngrok.exe" (
        set "PATH=%~dp0;%PATH%"
    ) else (
        echo ngrok not found. Place ngrok.exe next to this script or install it.
        echo Download: https://dashboard.ngrok.com/get-started/setup
        pause
        exit /b 1
    )
)

REM Read or ask for NGROK_AUTHTOKEN
if "%NGROK_AUTHTOKEN%"=="" (
    set /p NGROK_AUTHTOKEN="Enter your ngrok authtoken: "
)

REM Configure authtoken
ngrok config add-authtoken %NGROK_AUTHTOKEN% >nul 2>nul

REM Prompt for reserved domain if not provided as arg1
if "%~1"=="" (
    set /p NGROK_DOMAIN="Enter your reserved domain (e.g., myapp.ngrok-free.app): "
) else (
    set NGROK_DOMAIN=%~1
)

REM Port (default 3000) from arg2
set PORT=3000
if not "%~2"=="" set PORT=%~2

echo Using domain: %NGROK_DOMAIN%
echo Forwarding   : http://localhost:%PORT%
echo.

echo Tip: Reserve a domain at: https://dashboard.ngrok.com/cloud-edge/domains

echo Starting ngrok. This window will auto-restart on failure.
:loop
ngrok http --domain=%NGROK_DOMAIN% %PORT%
echo ngrok exited with code %errorlevel%. Restarting in 3 seconds...
timeout /t 3 >nul
goto loop

endlocal
