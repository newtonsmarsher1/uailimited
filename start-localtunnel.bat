@echo off
title UAI Agency - LocalTunnel (Unlimited)

echo ========================================
echo   UAI AGENCY - LOCALTUNNEL RUNNING
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Please install Node.js first.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if localtunnel is installed
where lt >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing localtunnel...
    npm install -g localtunnel
)

REM Prompt for subdomain (optional)
set /p SUBDOMAIN="Enter subdomain (optional, leave blank for random): "

REM Port (default 3000) from arg1
set PORT=3000
if not "%~1"=="" set PORT=%~1

echo.
echo Starting LocalTunnel...
echo Port: %PORT%
if not "%SUBDOMAIN%"=="" echo Subdomain: %SUBDOMAIN%
echo.

:loop
if "%SUBDOMAIN%"=="" (
    lt --port %PORT%
) else (
    lt --port %PORT% --subdomain %SUBDOMAIN%
)

echo.
echo LocalTunnel stopped. Restarting in 3 seconds...
timeout /t 3 >nul
goto loop
