# 🔍 How to Find Your Ngrok URL

## Step-by-Step Guide

### 1. **Run the Batch File**
Double-click `start-ngrok-simple.bat` to start ngrok

### 2. **Look for the Ngrok Window**
A new command prompt window will open with ngrok running

### 3. **Find Your URL**
In the ngrok window, look for a line like this:

```
Forwarding    https://abc123.ngrok.io -> http://localhost:3000
```

### 4. **Copy the HTTPS URL**
Copy the part that starts with `https://` (e.g., `https://abc123.ngrok.io`)

### 5. **Share the URL**
Share that URL with me so I can update your M-PESA configuration

## 📸 Visual Example

When ngrok is running, you'll see something like this:

```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                       United States (us)
Latency                       51ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the URL:** `https://abc123.ngrok.io`

## 🚀 What Happens Next

Once you share the URL, I will:

1. ✅ Update the callback URL in `server.js`
2. ✅ Configure M-PESA to use your ngrok tunnel
3. ✅ Test the M-PESA integration
4. ✅ Ready for production testing

## 🔧 Current M-PESA Configuration

- **Consumer Key:** `KrfGaEKOmQiAkDZtHe0yt8Hu8BIGgBLijxAHcGwBr2w1CAqx`
- **Consumer Secret:** `9vALTqheARYBGkTsNIqbMA9zNAnf2HGm8rbtUqfTLp1sQB1bUU0Vv5ZvG6sq2XYb`
- **Passkey:** `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
- **Shortcode:** `522522` (test)
- **Environment:** `sandbox`

## 🎯 Ready to Test!

Your server is running on port 3000 and ready for M-PESA integration testing! 