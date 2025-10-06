@echo off
echo Setting up Supabase DATABASE_URL for Vercel...

echo.
echo Your Supabase connection details:
echo Host: db.ijplqoyoicvutbzawtaj.supabase.co
echo User: postgres
echo Password: Mirinewton@1!
echo Database: postgres
echo Port: 5432
echo.

echo Setting DATABASE_URL environment variable...
echo postgresql://postgres:Mirinewton@1!@db.ijplqoyoicvutbzawtaj.supabase.co:5432/postgres | vercel env add DATABASE_URL production

echo.
echo Environment variable setup complete!
echo.
pause
