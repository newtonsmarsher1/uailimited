#!/bin/bash

# UAI Agency Production Deployment Script
# This script sets up your UAI Agency application for production deployment

echo "🚀 Starting UAI Agency Production Setup..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed. Please install MySQL first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p backups

# Set up environment file
if [ ! -f .env ]; then
    echo "⚙️ Creating environment configuration..."
    cp production.env.example .env
    echo "📝 Please edit .env file with your production settings"
    echo "🔑 Don't forget to change JWT_SECRET and database credentials!"
else
    echo "✅ Environment file already exists"
fi

# Set up database
echo "🗄️ Setting up production database..."
echo "Please ensure your MySQL server is running and create a production database"

# Create systemd service file for Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔧 Creating systemd service..."
    sudo tee /etc/systemd/system/uai-agency.service > /dev/null <<EOF
[Unit]
Description=UAI Agency Application
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$(pwd)/.env

[Install]
WantedBy=multi-user.target
EOF

    echo "✅ Systemd service created"
    echo "🔧 To enable the service, run:"
    echo "   sudo systemctl enable uai-agency"
    echo "   sudo systemctl start uai-agency"
fi

# Create Windows service script
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "🔧 Creating Windows service script..."
    cat > install-windows-service.bat <<EOF
@echo off
echo Installing UAI Agency as Windows Service...
nssm install "UAI Agency" "$(pwd)\backend\server.js"
nssm set "UAI Agency" AppDirectory "$(pwd)"
nssm set "UAI Agency" AppParameters ""
nssm set "UAI Agency" DisplayName "UAI Agency Application"
nssm set "UAI Agency" Description "UAI Agency Recharge and Investment Platform"
nssm set "UAI Agency" Start SERVICE_AUTO_START
nssm start "UAI Agency"
echo Service installed and started!
pause
EOF
    echo "✅ Windows service script created (install-windows-service.bat)"
fi

# Set proper permissions
echo "🔐 Setting proper permissions..."
chmod 755 backend/server.js
chmod 644 .env

echo ""
echo "🎉 Production setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your production settings"
echo "2. Set up your MySQL production database"
echo "3. Configure Cloudflare Tunnel (see cloudflare-tunnel-setup.md)"
echo "4. Start your application:"
echo "   - Linux: sudo systemctl start uai-agency"
echo "   - Windows: Run install-windows-service.bat"
echo "   - Manual: npm start"
echo ""
echo "🌐 Your application will be available at:"
echo "   - Local: http://localhost:3000"
echo "   - Public: https://your-domain.com (via Cloudflare Tunnel)"

