# UAI AGENCY - Public Access Setup Options

## 🎯 Your Goal: https://uaigency.xxx (Custom Subdomain)

## ✅ Option 1: DuckDNS (Recommended - FREE)
**Result**: https://uaigency.duckdns.org

### Steps:
1. Go to https://duckdns.org
2. Login with Google/GitHub/Twitter (free)
3. Create subdomain: `uaigency`
4. Add your IP: `102.0.11.44`
5. Set up port forwarding on your router (port 3000 → 192.168.100.4:3000)

---

## ✅ Option 2: Freenom (FREE Domain)
**Result**: https://uaigency.tk

### Steps:
1. Go to https://freenom.com
2. Search for: `uaigency`
3. Register: `uaigency.tk` (FREE)
4. Point DNS to your IP: `102.0.11.44`
5. Set up port forwarding

---

## ✅ Option 3: No-IP (FREE Subdomain)
**Result**: https://uaigency.ddns.net

### Steps:
1. Go to https://noip.com
2. Sign up for free account
3. Create hostname: `uaigency`
4. Install No-IP client or use port forwarding

---

## ✅ Option 4: Cloudflare Tunnel (FREE, No Port Forwarding)
**Result**: https://uaigency.yourdomain.com

### Steps:
1. Get a free domain (from Freenom, Namecheap, etc.)
2. Add domain to Cloudflare (free)
3. Set up Cloudflare Tunnel
4. Configure custom subdomain

---

## 🚀 Quick Start Commands:

### Start Server Only:
```bash
npm start
```

### Start with Current Tunnels:
```bash
# Localtunnel (with password)
lt --port 3000 --subdomain uaigency

# Serveo (random subdomain)
ssh -R 80:localhost:3000 serveo.net

# Cloudflare (random subdomain)
cloudflared.exe tunnel --url http://localhost:3000
```

---

## 📋 Your Current Access:
- **Local**: http://localhost:3000
- **Network**: http://192.168.100.4:3000
- **Admin**: http://localhost:3001
- **Public IP**: 102.0.11.44

---

## 🔧 Port Forwarding Setup:
1. Access your router admin panel
2. Go to Port Forwarding/Virtual Server
3. Add rule: External Port 3000 → Internal IP 192.168.100.4:3000
4. Save and restart router

---

## 💡 Recommendation:
**Use DuckDNS** - it's free, reliable, and gives you exactly what you want: `uaigency.duckdns.org`


