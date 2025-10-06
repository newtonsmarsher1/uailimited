# Cloudflare Tunnel Deployment Guide for UAI Agency

## Prerequisites
1. Cloudflare account (free tier works)
2. Your server with Node.js and MySQL installed
3. Domain name (optional, can use Cloudflare subdomain)

## Step 1: Install Cloudflare Tunnel

### On Windows Server:
```powershell
# Download cloudflared
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"

# Move to system PATH or create a dedicated folder
mkdir C:\cloudflare-tunnel
move cloudflared.exe C:\cloudflare-tunnel\
```

### On Linux Server:
```bash
# Download and install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

## Step 2: Authenticate with Cloudflare
```bash
cloudflared tunnel login
```
This will open a browser window to authenticate with your Cloudflare account.

## Step 3: Create a Tunnel
```bash
cloudflared tunnel create uai-agency
```
This will create a tunnel and give you a tunnel ID.

## Step 4: Configure the Tunnel

Create a configuration file `config.yml`:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: C:\Users\PC\.cloudflared\YOUR_TUNNEL_ID.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - hostname: www.your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

## Step 5: Run the Tunnel
```bash
cloudflared tunnel run uai-agency
```

## Step 6: Configure DNS (Optional)
If you have a custom domain:
```bash
cloudflared tunnel route dns uai-agency your-domain.com
```

## Step 7: Set up as Windows Service (Optional)
```powershell
# Install as Windows service
cloudflared service install
```

## Benefits:
- ✅ No need to open ports on your server
- ✅ Automatic HTTPS/SSL
- ✅ DDoS protection
- ✅ Global CDN
- ✅ Free tier available
- ✅ Easy to manage

