# WireGuard + VPS Tunnel Setup Guide

## Overview
This setup replaces Cloudflare Tunnel with a WireGuard VPN tunnel through your own VPS, giving you full control and better security.

## Prerequisites
- A VPS (Virtual Private Server) with Ubuntu/Debian
- Root access to your VPS
- Windows machine with admin privileges

## Step 1: VPS Setup

### 1.1 Connect to your VPS
```bash
ssh root@your-vps-ip
```

### 1.2 Run the server setup script
```bash
wget https://raw.githubusercontent.com/your-repo/setup-wireguard-server.sh
chmod +x setup-wireguard-server.sh
./setup-wireguard-server.sh
```

### 1.3 Configure firewall
```bash
# Allow WireGuard port
ufw allow 51820/udp

# Allow HTTP/HTTPS
ufw allow 80
ufw allow 443

# Enable firewall
ufw enable
```

### 1.4 Note the server public key
The script will display your server's public key. **Save this!**

## Step 2: Client Setup (Windows)

### 2.1 Install WireGuard
- Download from: https://www.wireguard.com/install/
- Or use: `winget install WireGuard.WireGuard`

### 2.2 Run the client setup script
```cmd
setup-wireguard-client.bat
```

### 2.3 Add client to server
On your VPS, edit the WireGuard config:
```bash
nano /etc/wireguard/wg0.conf
```

Add this section (replace with your client's public key):
```
[Peer]
PublicKey = YOUR_CLIENT_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32
```

Restart WireGuard:
```bash
systemctl restart wg-quick@wg0
```

## Step 3: Configure Domain (Optional)

### 3.1 Point domain to VPS
- Set your domain's A record to your VPS IP
- Update nginx config with your domain

### 3.2 SSL Certificate (Optional)
```bash
# Install certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d your-domain.com
```

## Step 4: Start the Tunnel

### 4.1 Run your application
Make sure your app is running on `localhost:3000`

### 4.2 Start the WireGuard tunnel
Run the updated `auto-restart-tunnel.bat` script

### 4.3 Optional: Use ngrok with a fixed (non-random) domain
1. Reserve a domain in ngrok dashboard: `https://dashboard.ngrok.com/cloud-edge/domains`
2. Get your authtoken: `https://dashboard.ngrok.com/get-started/your-authtoken`
3. Run the script:
   - Double-click `start-ngrok-fixed.bat`
   - Enter your authtoken and reserved domain (e.g., `myapp.ngrok-free.app`)
   - The script restarts ngrok automatically if it stops

## Troubleshooting

### Check WireGuard status
```bash
# On VPS
wg show

# On Windows
wg show
```

### Check nginx status
```bash
systemctl status nginx
```

### View logs
```bash
# WireGuard logs
journalctl -u wg-quick@wg0 -f

# Nginx logs
tail -f /var/log/nginx/access.log
```

## Security Benefits

1. **Full Control**: You own the entire infrastructure
2. **Better Security**: Encrypted VPN tunnel vs HTTP tunnel
3. **No Third Party**: No dependency on Cloudflare
4. **Custom Domain**: Use your own domain without restrictions
5. **Bandwidth Control**: No artificial limits

## Cost Comparison

- **Cloudflare Tunnel**: Free but limited
- **WireGuard + VPS**: ~$5-10/month for VPS
- **Benefits**: Full control, better performance, no limits

## Maintenance

### Regular Updates
```bash
# On VPS
apt update && apt upgrade -y
```

### Backup Configuration
```bash
# Backup WireGuard config
cp /etc/wireguard/wg0.conf ~/wg0.conf.backup
```

## Support

If you encounter issues:
1. Check WireGuard status on both ends
2. Verify firewall settings
3. Check nginx configuration
4. Review logs for errors

---

**Note**: Replace `YOUR_VPS_IP` in the tunnel script with your actual VPS IP address.
