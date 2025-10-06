# Set Supabase Environment Variables for Vercel
Write-Host "Setting up Supabase environment variables..." -ForegroundColor Green

# Get the password from user
$password = Read-Host "Enter your Supabase database password" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

Write-Host "Setting DB_HOST..." -ForegroundColor Yellow
echo "db.ijplqoyoicvutbzawtaj.supabase.co" | vercel env add DB_HOST production

Write-Host "Setting DB_USER..." -ForegroundColor Yellow  
echo "postgres" | vercel env add DB_USER production

Write-Host "Setting DB_PASSWORD..." -ForegroundColor Yellow
echo $passwordPlain | vercel env add DB_PASSWORD production

Write-Host "Setting DB_NAME..." -ForegroundColor Yellow
echo "postgres" | vercel env add DB_NAME production

Write-Host "Setting DB_PORT..." -ForegroundColor Yellow
echo "5432" | vercel env add DB_PORT production

Write-Host "Environment variables setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your Supabase connection details:" -ForegroundColor Cyan
Write-Host "Host: db.ijplqoyoicvutbzawtaj.supabase.co"
Write-Host "User: postgres" 
Write-Host "Database: postgres"
Write-Host "Port: 5432"
Write-Host ""
