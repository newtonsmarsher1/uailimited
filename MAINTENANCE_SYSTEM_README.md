# UAI Agency - Offline Maintenance System

## Overview
This system provides a professional maintenance page that automatically displays when the UAI Agency server is offline or under maintenance. It includes service worker functionality for offline support and automatic server status checking.

## Features

### 🚧 Maintenance Page (`/maintenance.html`)
- **Professional Design**: Modern gradient background with glassmorphism effects
- **Real-time Countdown**: Shows estimated completion time
- **Server Status Checking**: Automatic retry functionality
- **Contact Information**: Support details for users
- **Responsive Design**: Works on all devices
- **Animated Elements**: Floating elements and progress indicators

### 🔧 Service Worker (`/sw.js`)
- **Offline Support**: Automatically serves maintenance page when server is down
- **Cache Management**: Caches essential files for offline use
- **Background Sync**: Checks server status periodically
- **Push Notifications**: Can send maintenance updates
- **Auto-recovery**: Detects when server comes back online

### 🛠️ Maintenance Manager (`backend/maintenance-manager.js`)
- **Manual Control**: Enable/disable maintenance mode
- **Status Checking**: Monitor maintenance mode status
- **CLI Interface**: Easy command-line management

## Usage

### Automatic Maintenance Mode
The maintenance page automatically appears when:
- Server is completely offline
- Server returns 5xx errors
- Network connection is lost
- Service worker detects server unavailability

### Manual Maintenance Mode
To manually enable maintenance mode:

```bash
# Enable maintenance mode
node backend/maintenance-manager.js enable

# Disable maintenance mode
node backend/maintenance-manager.js disable

# Check status
node backend/maintenance-manager.js status
```

### Service Worker Registration
The service worker is automatically registered on all pages. It provides:
- Offline functionality
- Background server monitoring
- Automatic maintenance page serving
- Cache management

## Files Structure

```
frontend/
├── maintenance.html          # Main maintenance page
├── sw.js                     # Service worker
├── sw-maintenance.js         # Maintenance-specific service worker
├── test-maintenance.js       # Testing utilities
└── index.html               # Updated with service worker registration

backend/
└── maintenance-manager.js   # CLI maintenance control
```

## Testing

### Test Maintenance Page
1. Access `/maintenance.html` directly
2. Use the "Check Server Status" button
3. Verify countdown timer works
4. Test responsive design on different devices

### Test Offline Functionality
1. Stop the server
2. Try to access any page
3. Verify maintenance page is served
4. Check service worker cache

### Test Service Worker
```javascript
// In browser console
testServiceWorker();
testOfflineFunctionality();
simulateServerOffline();
```

## Configuration

### Maintenance Page Settings
Edit `frontend/maintenance.html` to customize:
- Estimated maintenance duration
- Contact information
- Company branding
- Color scheme
- Animation effects

### Service Worker Settings
Edit `frontend/sw.js` to modify:
- Cache duration
- Server check interval
- Offline behavior
- Notification settings

## Security Features
- **CSP Compliant**: Works with Content Security Policy
- **Secure Headers**: Includes security headers
- **Rate Limiting**: Prevents abuse during maintenance
- **Input Validation**: Safe user interactions

## Browser Support
- ✅ Chrome/Edge (full support)
- ✅ Firefox (full support)
- ✅ Safari (full support)
- ✅ Mobile browsers (responsive design)

## Monitoring
The system logs all maintenance events:
- Server status changes
- Maintenance mode toggles
- User interactions
- Service worker activities

## Best Practices
1. **Test Regularly**: Verify maintenance page works
2. **Update Estimates**: Keep completion times accurate
3. **Monitor Logs**: Watch for maintenance-related issues
4. **User Communication**: Provide clear status updates
5. **Quick Recovery**: Ensure fast server restart procedures

## Troubleshooting

### Maintenance Page Not Showing
- Check service worker registration
- Verify cache is working
- Test network connectivity
- Review browser console errors

### Service Worker Issues
- Clear browser cache
- Check service worker scope
- Verify file paths
- Test in incognito mode

### Server Status Detection
- Verify `/api/health` endpoint
- Check network requests
- Review service worker logs
- Test manual server checks

## Support
For issues with the maintenance system:
- Check browser console for errors
- Review service worker logs
- Test with different browsers
- Verify server configuration

---

**Note**: This maintenance system is designed to provide a professional user experience during server downtime while maintaining security and functionality.


