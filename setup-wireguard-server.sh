#!/bin/bash

# WireGuard Server Setup Script
# Run this on your VPS (Ubuntu/Debian)

echo "=========================================="
echo "  WIREGUARD SERVER SETUP"
echo "=========================================="

# Update system
sudo apt update && sudo apt upgrade -y

# Install WireGuard
sudo apt install wireguard -y

# Generate server keys
cd /etc/wireguard
sudo wg genkey | sudo tee server_private_key | wg pubkey | sudo tee server_public_key

# Create server configuration
sudo tee /etc/wireguard/wg0.conf > /dev/null <<EOF
[Interface]
PrivateKey = $(sudo cat server_private_key)
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Client configuration will be added here
EOF

# Enable IP forwarding
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Start WireGuard
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Install nginx for reverse proxy
sudo apt install nginx -y

# Create nginx configuration for your app
sudo tee /etc/nginx/sites-available/tunnel-proxy > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or VPS IP
    
    location / {
        proxy_pass http://10.0.0.2:3000;  # Forward to your local machine
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/tunnel-proxy /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "=========================================="
echo "  SERVER SETUP COMPLETE!"
echo "=========================================="
echo "Server Public Key: $(sudo cat server_public_key)"
echo "Server IP: $(curl -s ifconfig.me)"
echo "WireGuard Port: 51820"
echo ""
echo "Next steps:"
echo "1. Run the client setup script on your local machine"
echo "2. Update the nginx config with your domain/IP"
echo "3. Configure firewall to allow port 51820"
