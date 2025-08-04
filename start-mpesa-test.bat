@echo off
echo Starting ngrok tunnel for M-PESA testing...
echo.

REM Start ngrok in background
start /B "%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 3000

echo Waiting for ngrok to start...
timeout /t 3 /nobreak > nul

echo.
echo Ngrok is running! Please check the ngrok window for your public URL.
echo.
echo Your M-PESA configuration is ready with:
echo - Consumer Key: KrfGaEKOmQiAkDZtHe0yt8Hu8BIGgBLijxAHcGwBr2w1CAqx
echo - Consumer Secret: 9vALTqheARYBGkTsNIqbMA9zNAnf2HGm8rbtUqfTLp1sQB1bUU0Vv5ZvG6sq2XYb
echo - Passkey: bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
echo - Shortcode: 522522 (test)
echo.
echo Next steps:
echo 1. Copy the HTTPS URL from the ngrok window
echo 2. Update the callback URL in server.js
echo 3. Start your server: node server.js
echo 4. Test M-PESA integration
echo.
pause 