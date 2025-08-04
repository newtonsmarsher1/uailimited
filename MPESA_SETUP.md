# M-PESA API Setup Guide

## 🚀 Production M-PESA Integration

### 1. **Safaricom Daraja API Registration**

1. **Register for Daraja API:**
   - Visit: https://developer.safaricom.co.ke/
   - Create an account and apply for Daraja API access
   - Wait for approval (usually 1-2 business days)

2. **Get Your Credentials:**
   - Consumer Key
   - Consumer Secret
   - Paybill Number (Shortcode)
   - Passkey
   - Callback URL

### 2. **Environment Configuration**

Create a `.env` file in your project root:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=uai_db

# JWT Secret (Change this in production!)
JWT_SECRET=UAI_SECRET_CHANGE_IN_PRODUCTION

# M-PESA Daraja API Configuration
DARAJA_CONSUMER_KEY=your_actual_consumer_key
DARAJA_CONSUMER_SECRET=your_actual_consumer_secret
DARAJA_SHORTCODE=your_actual_paybill_number
DARAJA_PASSKEY=your_actual_passkey
DARAJA_CALLBACK_URL=https://yourdomain.com/api/mpesa-callback

# Environment
NODE_ENV=production
PORT=3000
ADMIN_PORT=4000
```

### 3. **Production Deployment**

#### Option A: VPS/Cloud Server
```bash
# Install Node.js and MySQL
sudo apt update
sudo apt install nodejs npm mysql-server

# Clone your repository
git clone your-repo-url
cd your-project

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual credentials

# Start the servers
npm start
```

#### Option B: Heroku/Railway
```bash
# Set environment variables in your hosting platform
DARAJA_CONSUMER_KEY=your_key
DARAJA_CONSUMER_SECRET=your_secret
DARAJA_SHORTCODE=your_shortcode
DARAJA_PASSKEY=your_passkey
DARAJA_CALLBACK_URL=https://your-app.herokuapp.com/api/mpesa-callback
NODE_ENV=production
```

### 4. **Callback URL Configuration**

Your callback URL must be publicly accessible. Options:

1. **Production Domain:** `https://yourdomain.com/api/mpesa-callback`
2. **Heroku:** `https://your-app.herokuapp.com/api/mpesa-callback`
3. **Railway:** `https://your-app.railway.app/api/mpesa-callback`
4. **ngrok (Development):** `https://your-ngrok-subdomain.ngrok.io/api/mpesa-callback`

### 5. **Testing M-PESA Integration**

#### Test with Sandbox (Development)
```bash
# Use sandbox credentials
DARAJA_CONSUMER_KEY=sandbox_consumer_key
DARAJA_CONSUMER_SECRET=sandbox_consumer_secret
DARAJA_SHORTCODE=174379
DARAJA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

#### Test with Production (Live)
```bash
# Use your actual production credentials
DARAJA_CONSUMER_KEY=your_production_key
DARAJA_CONSUMER_SECRET=your_production_secret
DARAJA_SHORTCODE=your_paybill_number
DARAJA_PASSKEY=your_production_passkey
```

### 6. **Payment Flow**

1. **User initiates payment** → `/api/recharge-method1`
2. **STK Push sent** → User receives prompt on phone
3. **User enters PIN** → Payment processed by Safaricom
4. **Callback received** → `/api/mpesa-callback`
5. **Balance updated** → User balance increased automatically

### 7. **Monitoring & Debugging**

#### Check Payment Status
```sql
-- View all payments
SELECT * FROM payments ORDER BY created_at DESC;

-- View successful payments
SELECT * FROM payments WHERE status = 'confirmed';

-- View failed payments
SELECT * FROM payments WHERE status = 'failed';
```

#### Server Logs
```bash
# Check server logs for M-PESA callbacks
tail -f logs/server.log | grep "M-PESA"

# Monitor callback endpoint
curl -X POST https://yourdomain.com/api/mpesa-callback
```

### 8. **Security Considerations**

1. **Environment Variables:** Never commit credentials to git
2. **HTTPS Only:** Production callbacks must use HTTPS
3. **Input Validation:** All amounts and phone numbers validated
4. **Rate Limiting:** Implement rate limiting for payment endpoints
5. **Logging:** Log all payment attempts for audit trail

### 9. **Troubleshooting**

#### Common Issues:

1. **"Invalid consumer key"**
   - Check your Daraja credentials
   - Ensure you're using the correct environment (sandbox vs production)

2. **"Callback URL not accessible"**
   - Ensure your callback URL is publicly accessible
   - Test with ngrok for development

3. **"Payment not confirmed"**
   - Check server logs for callback errors
   - Verify callback URL is correct in Daraja dashboard

4. **"Amount validation failed"**
   - Ensure amount is between KES 10 and KES 70,000
   - Amount must be an integer (no decimals)

### 10. **Production Checklist**

- [ ] Environment variables configured
- [ ] Database connection stable
- [ ] Callback URL publicly accessible
- [ ] HTTPS enabled
- [ ] Error logging implemented
- [ ] Payment monitoring set up
- [ ] Backup system configured
- [ ] Rate limiting enabled
- [ ] Security headers set
- [ ] SSL certificate valid

### 11. **Support**

For M-PESA API issues:
- Safaricom Developer Portal: https://developer.safaricom.co.ke/
- Daraja API Documentation: https://developer.safaricom.co.ke/docs
- Support Email: apisupport@safaricom.co.ke

---

## 🎯 **Current System Status**

✅ **Task System:** Fully functional with level-based rewards  
✅ **Level System:** Complete with upgrade/refund logic  
⚠️ **M-PESA API:** Ready for production deployment  

**Next Steps:**
1. Get your Daraja API credentials from Safaricom
2. Configure environment variables
3. Deploy to production server
4. Test payment flow end-to-end
5. Monitor and optimize 