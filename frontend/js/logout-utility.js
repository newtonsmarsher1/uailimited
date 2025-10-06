// Logout Utility for UAI Agency
// This file provides consistent logout functionality across all pages

// Global logout function
function logoutUser() {
  // Show confirmation dialog
  if (confirm('Are you sure you want to log out? You will need to enter your credentials again to access the system.')) {
    // Clear all authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    // Clear any cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Show logout notification
    showLogoutNotification();
    
    // Redirect to login page after a short delay
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  }
}

// Show logout notification
function showLogoutNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ff4757, #c62828);
    color: white;
    padding: 20px 30px;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(198, 40, 40, 0.4);
    z-index: 10000;
    font-weight: 600;
    text-align: center;
    animation: fadeInScale 0.3s ease-out;
    font-size: 1.1em;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
      <span style="font-size: 2em;">🚪</span>
      <div>
        <div style="font-size: 1.2em; margin-bottom: 5px;">Logging Out...</div>
        <div style="font-size: 0.9em; opacity: 0.9;">Please wait while we secure your session</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Add animation CSS if not already present
  if (!document.getElementById('logout-animations')) {
    const style = document.createElement('style');
    style.id = 'logout-animations';
    style.textContent = `
      @keyframes fadeInScale {
        from { 
          opacity: 0; 
          transform: translate(-50%, -50%) scale(0.8); 
        }
        to { 
          opacity: 1; 
          transform: translate(-50%, -50%) scale(1); 
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Add logout button to any element
function addLogoutButton(elementId, buttonText = '🚪 Logout') {
  const element = document.getElementById(elementId);
  if (element) {
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = buttonText;
    logoutBtn.onclick = logoutUser;
    logoutBtn.style.cssText = `
      background: linear-gradient(135deg, #ff4757, #c62828);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.9em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin: 5px;
    `;
    logoutBtn.onmouseover = function() {
      this.style.background = 'linear-gradient(135deg, #ff3742, #b71c1c)';
      this.style.transform = 'translateY(-1px)';
    };
    logoutBtn.onmouseout = function() {
      this.style.background = 'linear-gradient(135deg, #ff4757, #c62828)';
      this.style.transform = 'translateY(0)';
    };
    element.appendChild(logoutBtn);
  }
}

// Auto-add logout button to profile pages
document.addEventListener('DOMContentLoaded', function() {
  // Add logout button to profile page if it exists
  if (window.location.pathname.includes('profile.html')) {
    // The profile page already has logout functionality
    return;
  }
  
  // Add logout button to other pages that have bottom navigation
  const bottomNav = document.querySelector('nav.bottom-nav');
  if (bottomNav) {
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.onclick = function(e) {
      e.preventDefault();
      logoutUser();
    };
    logoutLink.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; margin-bottom: 2px; fill: currentColor;">
        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
      </svg>
      <span style="font-size: 0.85em;">Logout</span>
    `;
    logoutLink.style.cssText = `
      background: transparent;
      border: none;
      color: #ff4757;
      font-size: 0.85em;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      transition: color 0.3s;
      padding: 2px 4px;
    `;
    logoutLink.onmouseover = function() {
      this.style.color = '#c62828';
    };
    logoutLink.onmouseout = function() {
      this.style.color = '#ff4757';
    };
    bottomNav.appendChild(logoutLink);
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { logoutUser, showLogoutNotification, addLogoutButton };
}
