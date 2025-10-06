const fs = require('fs');
const path = require('path');

class SecurityMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/security.log');
    this.suspiciousActivities = [];
    this.blockedIPs = new Set();
    this.failedAttempts = new Map();
    
    // Ensure logs directory exists
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  logSecurityEvent(type, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      details,
      ip: details.ip || 'unknown'
    };

    // Write to log file
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');

    // Track suspicious activities
    if (this.isSuspiciousActivity(type, details)) {
      this.suspiciousActivities.push(logEntry);
      console.log(`🚨 SECURITY ALERT: ${type} - ${JSON.stringify(details)}`);
    }

    // Track failed attempts
    if (type === 'FAILED_LOGIN' || type === 'FAILED_REGISTRATION') {
      const ip = details.ip;
      if (!this.failedAttempts.has(ip)) {
        this.failedAttempts.set(ip, []);
      }
      this.failedAttempts.get(ip).push(logEntry);
    }
  }

  isSuspiciousActivity(type, details) {
    const suspiciousTypes = [
      'SQL_INJECTION_ATTEMPT',
      'RATE_LIMIT_EXCEEDED',
      'UNAUTHORIZED_ADMIN_ACCESS',
      'MALICIOUS_FILE_UPLOAD',
      'SUSPICIOUS_DOWNLOAD'
    ];

    return suspiciousTypes.includes(type) || 
           (type === 'FAILED_LOGIN' && this.getFailedAttempts(details.ip) > 5) ||
           (type === 'FAILED_REGISTRATION' && this.getFailedAttempts(details.ip) > 3);
  }

  getFailedAttempts(ip) {
    const attempts = this.failedAttempts.get(ip) || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return attempts.filter(attempt => new Date(attempt.timestamp) > oneHourAgo).length;
  }

  shouldBlockIP(ip) {
    const failedAttempts = this.getFailedAttempts(ip);
    return failedAttempts > 10 || this.blockedIPs.has(ip);
  }

  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    this.logSecurityEvent('IP_BLOCKED', { ip, reason });
    console.log(`🚫 IP ${ip} blocked: ${reason}`);
  }

  getSecurityReport() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivities = this.suspiciousActivities.filter(
      activity => new Date(activity.timestamp) > oneDayAgo
    );

    return {
      totalSuspiciousActivities: recentActivities.length,
      blockedIPs: Array.from(this.blockedIPs),
      topSuspiciousIPs: this.getTopSuspiciousIPs(),
      recentActivities: recentActivities.slice(-10)
    };
  }

  getTopSuspiciousIPs() {
    const ipCounts = {};
    this.suspiciousActivities.forEach(activity => {
      const ip = activity.details.ip;
      ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    });

    return Object.entries(ipCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([ip, count]) => ({ ip, count }));
  }

  // Clean up old data
  cleanup() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Remove old suspicious activities
    this.suspiciousActivities = this.suspiciousActivities.filter(
      activity => new Date(activity.timestamp) > oneWeekAgo
    );

    // Remove old failed attempts
    for (const [ip, attempts] of this.failedAttempts.entries()) {
      const recentAttempts = attempts.filter(
        attempt => new Date(attempt.timestamp) > oneWeekAgo
      );
      if (recentAttempts.length === 0) {
        this.failedAttempts.delete(ip);
      } else {
        this.failedAttempts.set(ip, recentAttempts);
      }
    }
  }
}

// Export singleton instance
const securityMonitor = new SecurityMonitor();

// Cleanup every hour
setInterval(() => {
  securityMonitor.cleanup();
}, 60 * 60 * 1000);

module.exports = securityMonitor;


