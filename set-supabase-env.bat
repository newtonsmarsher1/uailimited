@echo off
echo Setting up Supabase environment variables for Vercel...

echo.
echo Please provide your Supabase password when prompted for each variable.
echo.

echo Setting DB_HOST...
vercel env add DB_HOST production
echo.

echo Setting DB_USER...
vercel env add DB_USER production
echo.

echo Setting DB_PASSWORD...
vercel env add DB_PASSWORD production
echo.

echo Setting DB_NAME...
vercel env add DB_NAME production
echo.

echo Setting DB_PORT...
vercel env add DB_PORT production
echo.

echo Environment variables setup complete!
echo.
echo Your Supabase connection details:
echo Host: db.ijplqoyoicvutbzawtaj.supabase.co
echo User: postgres
echo Database: postgres
echo Port: 5432
echo.
pause
