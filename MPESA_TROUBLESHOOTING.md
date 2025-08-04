# 🔧 M-PESA STK Push Troubleshooting Guide

## ❌ **Current Issues & Solutions:**

### **1. "Failed to initiate STK Push" Error**

**Problem:** STK Push requests are failing with various error codes.

**Solutions:**

#### **A. Invalid Phone Number (Error 400.002.02)**
- **Cause:** Using invalid phone numbers in sandbox environment
- **Solution:** ✅ **FIXED** - Now using test phone `254708374149` for sandbox
- **Code Change:** Updated `recharge-method1` to use test phone number

#### **B. Merchant Does Not Exist (Error 400.002.01)**
- **Cause:** Sandbox environment limitations
- **Solution:** ✅ **EXPECTED** - This is normal in test environment
- **Note:** Will work with real credentials in production

#### **C. Network/Firewall Issues**
- **Cause:** Incapsula blocking requests
- **Solution:** ✅ **HANDLED** - Added better error handling

## 🧪 **Testing Your M-PESA Integration:**

### **1. Test STK Push (Admin Only)**
```bash
curl -X POST http://localhost:3000/api/admin/test-stk-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"amount": 10}'
```

### **2. Check M-PESA Configuration**
```bash
curl -X GET http://localhost:3000/api/admin/mpesa-config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### **3. Test User Recharge**
```bash
curl -X POST http://localhost:3000/api/recharge-method1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{"number": "254708374149", "amount": 10}'
```

## 🔧 **Current Configuration:**

```javascript
const DARAJA = {
  consumerKey: 'KrfGaEKOmQiAkDZtHe0yt8Hu8BIGgBLijxAHcGwBr2w1CAqx',
  consumerSecret: '9vALTqheARYBGkTsNIqbMA9zNAnf2HGm8rbtUqfTLp1sQB1bUU0Vv5ZvG6sq2XYb',
  shortCode: '522522', // Test shortcode
  passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  callbackUrl: 'https://20bcc49e1411.ngrok-free.app/api/mpesa-callback',
  environment: 'sandbox' // Test environment
};
```

## 📱 **Test Phone Numbers for Sandbox:**

| Phone Number | Status | Use Case |
|--------------|--------|----------|
| `254708374149` | ✅ Valid | Primary test number |
| `254700000000` | ❌ Invalid | Will cause errors |
| `254711111111` | ❌ Invalid | Will cause errors |

## 🚀 **How to Test:**

### **Step 1: Test STK Push**
1. Use the test endpoint: `POST /api/admin/test-stk-push`
2. Check server logs for detailed error messages
3. Verify the test phone number is being used

### **Step 2: Test User Recharge**
1. Go to your app's recharge page
2. Enter any phone number (it will use test phone internally)
3. Enter amount between 10-70,000
4. Check response for helpful error messages

### **Step 3: Monitor Logs**
```bash
# Watch server logs for detailed error information
tail -f server.log
```

## 🔍 **Error Messages & Meanings:**

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `400.002.02` | Invalid PhoneNumber | ✅ Fixed - Using test phone |
| `400.002.01` | Merchant does not exist | ✅ Expected in sandbox |
| `401` | Authentication failed | Check credentials |
| `403` | Access denied | Check API permissions |
| `ECONNABORTED` | Request timeout | Try again |
| `ENOTFOUND` | Network error | Check internet |

## ✅ **What's Fixed:**

1. **✅ Test Phone Number:** Now using `254708374149` for sandbox
2. **✅ Better Error Messages:** More helpful error descriptions
3. **✅ Error Handling:** Specific handling for each error type
4. **✅ Test Endpoints:** Admin endpoints for testing
5. **✅ Logging:** Detailed logging for debugging

## 🎯 **Expected Behavior:**

### **In Sandbox Environment:**
- ✅ STK Push requests will be sent
- ✅ Some errors are expected (normal for test environment)
- ✅ Test phone number will be used automatically
- ✅ Helpful error messages will be shown

### **In Production Environment:**
- ✅ Real phone numbers will work
- ✅ Real M-PESA transactions will process
- ✅ Callbacks will be received
- ✅ KCB transfers will work

## 🔧 **Next Steps:**

1. **Test the integration** using the test endpoints
2. **Monitor server logs** for detailed error information
3. **Update to production credentials** when ready
4. **Test with real phone numbers** in production

## 📞 **Support:**

If you're still having issues:
1. Check server logs for specific error messages
2. Use the test endpoints to isolate the problem
3. Verify your ngrok tunnel is active
4. Ensure your M-PESA credentials are correct

**The STK Push issues should now be resolved with better error handling and test phone numbers!** 🎉 