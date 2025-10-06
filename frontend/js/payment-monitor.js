// Global payment status monitoring
let globalPaymentMonitor = {
  isMonitoring: false,
  currentTransaction: null,
  statusInterval: null,
  callbacks: []
};

// Initialize global payment monitoring
function initializeGlobalPaymentMonitor() {
  // Check if there's a pending payment on page load
  const waitingData = localStorage.getItem('waitingApproval');
  if (waitingData) {
    const data = JSON.parse(waitingData);
    startGlobalPaymentMonitoring(data.transactionNumber, data);
  }
}

// Start global payment monitoring
function startGlobalPaymentMonitoring(transactionNumber, paymentData) {
  if (globalPaymentMonitor.isMonitoring) {
    return; // Already monitoring
  }
  
  globalPaymentMonitor.isMonitoring = true;
  globalPaymentMonitor.currentTransaction = transactionNumber;
  
  console.log('🔍 Starting global payment monitoring for:', transactionNumber);
  
  // Check status immediately
  checkGlobalPaymentStatus();
  
  // Set up periodic checking every 30 seconds
  globalPaymentMonitor.statusInterval = setInterval(checkGlobalPaymentStatus, 30000);
  
  // Store payment data for UI updates
  globalPaymentMonitor.paymentData = paymentData;
}

// Check global payment status
async function checkGlobalPaymentStatus() {
  try {
    const userToken = localStorage.getItem('token');
    if (!userToken) {
      stopGlobalPaymentMonitoring();
      return;
    }
    
    const response = await fetch(`${window.location.origin}/api/payments/status/${globalPaymentMonitor.currentTransaction}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.status === 'approved' || result.status === 'rejected') {
        // Payment is no longer pending
        stopGlobalPaymentMonitoring();
        
        // Show notification to user
        showGlobalPaymentNotification(result.status, result.reason);
        
        // Clear localStorage
        localStorage.removeItem('waitingApproval');
        
        // Execute callbacks
        globalPaymentMonitor.callbacks.forEach(callback => {
          try {
            callback(result.status, result.reason);
          } catch (error) {
            console.error('Error in payment status callback:', error);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking global payment status:', error);
  }
}

// Stop global payment monitoring
function stopGlobalPaymentMonitoring() {
  if (globalPaymentMonitor.statusInterval) {
    clearInterval(globalPaymentMonitor.statusInterval);
  }
  
  globalPaymentMonitor.isMonitoring = false;
  globalPaymentMonitor.currentTransaction = null;
  globalPaymentMonitor.statusInterval = null;
  globalPaymentMonitor.callbacks = [];
  
  console.log('🛑 Stopped global payment monitoring');
}

// Show global payment notification
function showGlobalPaymentNotification(status, reason) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'global-payment-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${status === 'approved' ? '#4caf50' : '#f44336'};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 300px;
    font-family: Arial, sans-serif;
    animation: slideIn 0.3s ease-out;
  `;
  
  const icon = status === 'approved' ? '✅' : '❌';
  const title = status === 'approved' ? 'Payment Approved!' : 'Payment Rejected';
  const message = status === 'approved' 
    ? 'Your recharge has been approved and added to your wallet!' 
    : (reason || 'Your recharge request was rejected.');
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 20px; margin-right: 10px;">${icon}</span>
      <strong>${title}</strong>
    </div>
    <div style="font-size: 14px; line-height: 1.4;">${message}</div>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Register callback for payment status changes
function onPaymentStatusChange(callback) {
  globalPaymentMonitor.callbacks.push(callback);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeGlobalPaymentMonitor);
