// Admin Notification Popup System
// This script handles popup notifications sent by admins

class AdminNotificationPopup {
  constructor() {
    this.popups = new Map();
    this.init();
  }

  async init() {
    // Check for new admin notifications every 30 seconds
    setInterval(() => {
      this.checkForNotifications();
    }, 30000);

    // Check immediately on page load
    this.checkForNotifications();
  }

  async checkForNotifications() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const notifications = await response.json();
        this.processNotifications(notifications);
      }
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  }

  processNotifications(notifications) {
    // Filter for admin notifications that should be shown as popups
    const adminNotifications = notifications.filter(n => 
      n.type === 'admin_notification' && 
      !this.popups.has(n.id) &&
      !this.isNotificationDismissed(n.id)
    );

    adminNotifications.forEach(notification => {
      this.showPopup(notification);
    });
  }

  showPopup(notification) {
    // Create popup element
    const popup = document.createElement('div');
    popup.id = `admin-popup-${notification.id}`;
    popup.className = 'admin-notification-popup';
    
    // Determine popup style based on notification type
    const typeStyles = {
      info: { bg: '#d1ecf1', border: '#bee5eb', color: '#0c5460' },
      success: { bg: '#d4edda', border: '#c3e6cb', color: '#155724' },
      warning: { bg: '#fff3cd', border: '#ffeaa7', color: '#856404' },
      error: { bg: '#f8d7da', border: '#f5c6cb', color: '#721c24' },
      promotion: { bg: '#e2e3f0', border: '#c5c6d0', color: '#4a4b5a' }
    };

    const style = typeStyles[notification.type] || typeStyles.info;

    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${style.bg};
      border: 2px solid ${style.border};
      border-radius: 12px;
      padding: 20px;
      max-width: 400px;
      width: 90%;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      animation: slideInRight 0.3s ease-out;
      color: ${style.color};
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Extract title and message from notification
    const messageParts = notification.message.split(': ');
    const title = messageParts[0].replace('📢 ', '');
    const message = messageParts.slice(1).join(': ');

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: ${style.color};">
          ${title}
        </h3>
        <button onclick="adminNotificationPopup.dismissPopup(${notification.id})" 
                style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: ${style.color}; opacity: 0.7; padding: 0; margin-left: 10px;">
          &times;
        </button>
      </div>
      <div style="line-height: 1.5; margin-bottom: 15px; font-size: 0.95rem;">
        ${message}
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="adminNotificationPopup.dismissPopup(${notification.id})" 
                style="background: ${style.color}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500;">
          Dismiss
        </button>
      </div>
    `;

    // Add CSS animation
    if (!document.getElementById('admin-popup-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'admin-popup-styles';
      styleSheet.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .admin-notification-popup {
          transition: all 0.3s ease;
        }
        
        .admin-notification-popup.dismissing {
          animation: slideOutRight 0.3s ease-in forwards;
        }
      `;
      document.head.appendChild(styleSheet);
    }

    // Add to page
    document.body.appendChild(popup);
    
    // Store popup reference
    this.popups.set(notification.id, popup);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      this.dismissPopup(notification.id);
    }, 10000);
  }

  dismissPopup(notificationId) {
    const popup = this.popups.get(notificationId);
    if (!popup) return;

    // Add dismissing animation
    popup.classList.add('dismissing');

    // Remove from DOM after animation
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
      this.popups.delete(notificationId);
    }, 300);

    // Mark as dismissed in localStorage
    this.markAsDismissed(notificationId);
  }

  markAsDismissed(notificationId) {
    const dismissed = JSON.parse(localStorage.getItem('admin_notifications_dismissed') || '[]');
    if (!dismissed.includes(notificationId)) {
      dismissed.push(notificationId);
      localStorage.setItem('admin_notifications_dismissed', JSON.stringify(dismissed));
    }
  }

  isNotificationDismissed(notificationId) {
    const dismissed = JSON.parse(localStorage.getItem('admin_notifications_dismissed') || '[]');
    return dismissed.includes(notificationId);
  }

  // Method to manually check for notifications (can be called from other scripts)
  async forceCheck() {
    await this.checkForNotifications();
  }
}

// Initialize the popup system
const adminNotificationPopup = new AdminNotificationPopup();

// Make it globally available
window.adminNotificationPopup = adminNotificationPopup;
