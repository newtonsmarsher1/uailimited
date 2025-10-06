# DuckDNS Professional Domain Setup Guide

## 🎯 Goal: Create `uaigency.duckdns.org`

### Step 1: Register on DuckDNS
1. Go to https://duckdns.org (already opened for you)
2. Click "Sign in with Google" or "Sign in with GitHub" (free)
3. After login, you'll see the DuckDNS dashboard

### Step 2: Create Your Subdomain
1. In the "Add Domain" section, enter: `uaigency`
2. Click "Add Domain"
3. Your domain will be: `uaigency.duckdns.org`

### Step 3: Configure DNS Settings
1. In your domain list, find `uaigency.duckdns.org`
2. In the IP field, enter your public IP: `102.0.11.44`
3. Click "Save" or "Update IP"

### Step 4: Set Up Port Forwarding (Router Configuration)
You need to forward external port 80 to your local server port 3000:

1. **Access your router admin panel:**
   - Usually: http://192.168.1.1 or http://192.168.0.1
   - Login with admin credentials

2. **Find Port Forwarding settings:**
   - Look for "Port Forwarding", "Virtual Server", or "NAT"
   - Create new rule:
     - **External Port:** 80
     - **Internal IP:** 192.168.100.4 (your local server IP)
     - **Internal Port:** 3000
     - **Protocol:** TCP
     - **Status:** Enabled

### Step 5: Alternative - Use DuckDNS Client (Automatic Updates)
If your IP changes frequently, install the DuckDNS client:

```bash
# Download DuckDNS client for Windows
# Or use the web interface to update IP automatically
```

### Step 6: Test Your Domain
Once configured, your professional domain will be:
**https://uaigency.duckdns.org**

## 🔧 Troubleshooting

### If Port Forwarding Doesn't Work:
1. Check if your ISP blocks port 80
2. Try using port 8080 instead:
   - External Port: 8080
   - Internal Port: 3000
   - Domain: `uaigency.duckdns.org:8080`

### Alternative: Use Cloudflare Tunnel
If port forwarding fails, we can set up Cloudflare Tunnel instead.

## ✅ Benefits of This Setup:
- ✅ Professional domain name
- ✅ No warning pages
- ✅ No restrictions
- ✅ Worldwide access
- ✅ Permanent solution
- ✅ Free to use

## 📱 Final Result:
Your users will access: **https://uaigency.duckdns.org**
