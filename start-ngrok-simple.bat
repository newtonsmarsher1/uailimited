@echo off
echo ========================================
echo Starting Ngrok for M-PESA Testing
echo ========================================
echo.
echo This will open ngrok in a new window.
echo.
echo IMPORTANT: Look for the HTTPS URL in the ngrok window!
echo It will look like: https://abc123.ngrok.io
echo.
echo Your server is running on port 3000
echo Ngrok will create a tunnel to it.
echo.
echo Press any key to start ngrok...
pause > nul

echo.
echo Starting ngrok...
echo.
echo ========================================
echo INSTRUCTIONS TO FIND YOUR URL:
echo ========================================
echo 1. A new ngrok window will open
echo 2. Look for the line that says "Forwarding"
echo 3. Copy the HTTPS URL (starts with https://)
echo 4. It will look like: https://abc123.ngrok.io
echo 5. Share that URL with me to update M-PESA config
echo ========================================
echo.

REM Start ngrok in a new window
start "" "%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 3000

echo.
echo Ngrok started! Check the new window for your URL.
echo.
echo Your M-PESA configuration is ready:
echo - Consumer Key: KrfGaEKOmQiAkDZtHe0yt8Hu8BIGgBLijxAHcGwBr2w1CAqx
echo - Consumer Secret: 9vALTqheARYBGkTsNIqbMA9zNAnf2HGm8rbtUqfTLp1sQB1bUU0Vv5ZvG6sq2XYb
echo - Passkey: bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
echo - Shortcode: 522522 (test)
echo.
echo Once you have the ngrok URL, I can update the callback URL!
echo.
pause 