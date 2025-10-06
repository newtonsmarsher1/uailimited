// Trial Countdown Component
class TrialCountdown {
    constructor() {
        this.trialInfo = null;
        this.countdownInterval = null;
        this.updateInterval = null;
        this.isInitialized = false;
    }

    // Initialize the countdown system
    async init() {
        try {
            console.log('🕐 Initializing trial countdown...');
            
            // Get trial information from API
            await this.fetchTrialInfo();
            
            // Start countdown if user is on trial
            if (this.trialInfo && this.trialInfo.isTemporaryWorker) {
                this.startCountdown();
                this.createCountdownUI();
            }
            
            this.isInitialized = true;
            console.log('✅ Trial countdown initialized');
            
        } catch (error) {
            console.error('❌ Error initializing trial countdown:', error.message);
        }
    }

    // Fetch trial information from API
    async fetchTrialInfo() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('⚠️ No authentication token found');
                return;
            }

            const response = await fetch('/api/trial/trial-info', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.trialInfo = data.trialInfo;
                console.log('📊 Trial info fetched:', this.trialInfo);
            } else {
                console.log('⚠️ Failed to fetch trial info:', response.status);
            }
        } catch (error) {
            console.error('❌ Error fetching trial info:', error.message);
        }
    }

    // Start the countdown timer
    startCountdown() {
        if (!this.trialInfo || !this.trialInfo.isTrialActive) {
            console.log('⚠️ No active trial to countdown');
            return;
        }

        // Update countdown every second
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);

        // Update trial info every minute
        this.updateInterval = setInterval(() => {
            this.fetchTrialInfo();
        }, 60000);

        console.log('⏰ Countdown started');
    }

    // Update the countdown display
    updateCountdown() {
        if (!this.trialInfo || !this.trialInfo.countdown) {
            return;
        }

        const countdown = this.trialInfo.countdown;
        
        // Calculate remaining time
        const now = new Date();
        const trialEndDate = new Date(this.trialInfo.trialEndDate);
        const timeRemaining = trialEndDate - now;

        if (timeRemaining <= 0) {
            this.handleTrialExpired();
            return;
        }

        // Update countdown values
        const days = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60 * 24)));
        const hours = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
        const minutes = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));
        const seconds = Math.max(0, Math.floor((timeRemaining % (1000 * 60)) / 1000));

        // Update UI elements
        this.updateCountdownDisplay(days, hours, minutes, seconds);
        this.updateProgressBar(timeRemaining);
    }

    // Update countdown display elements
    updateCountdownDisplay(days, hours, minutes, seconds) {
        const elements = {
            days: document.getElementById('trial-days'),
            hours: document.getElementById('trial-hours'),
            minutes: document.getElementById('trial-minutes'),
            seconds: document.getElementById('trial-seconds')
        };

        if (elements.days) elements.days.textContent = days.toString().padStart(2, '0');
        if (elements.hours) elements.hours.textContent = hours.toString().padStart(2, '0');
        if (elements.minutes) elements.minutes.textContent = minutes.toString().padStart(2, '0');
        if (elements.seconds) elements.seconds.textContent = seconds.toString().padStart(2, '0');

        // Update status message
        const statusElement = document.getElementById('trial-status');
        if (statusElement) {
            if (days > 0) {
                statusElement.textContent = `${days} day${days !== 1 ? 's' : ''} remaining in your free trial`;
            } else if (hours > 0) {
                statusElement.textContent = `${hours} hour${hours !== 1 ? 's' : ''} remaining in your free trial`;
            } else {
                statusElement.textContent = `${minutes} minute${minutes !== 1 ? 's' : ''} remaining in your free trial`;
            }
        }
    }

    // Update progress bar
    updateProgressBar(timeRemaining) {
        const progressBar = document.getElementById('trial-progress-bar');
        const progressText = document.getElementById('trial-progress-text');
        
        if (progressBar && this.trialInfo) {
            const totalTrialTime = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
            const elapsedTime = totalTrialTime - timeRemaining;
            const progressPercentage = Math.min(100, Math.max(0, (elapsedTime / totalTrialTime) * 100));
            
            progressBar.style.width = `${progressPercentage}%`;
            
            if (progressText) {
                progressText.textContent = `${Math.round(progressPercentage)}% Complete`;
            }
        }
    }

    // Handle trial expiration
    handleTrialExpired() {
        console.log('⏰ Trial expired');
        
        // Clear intervals
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Update UI to show expired state
        this.showTrialExpired();
        
        // Show upgrade prompt
        this.showUpgradePrompt();
    }

    // Show trial expired UI
    showTrialExpired() {
        const countdownContainer = document.getElementById('trial-countdown-container');
        if (countdownContainer) {
            countdownContainer.innerHTML = `
                <div class="trial-expired">
                    <div class="expired-icon">⏰</div>
                    <h3>Free Trial Expired</h3>
                    <p>Your 5-day free trial has ended. Upgrade to continue earning!</p>
                    <button onclick="trialCountdown.showUpgradeOptions()" class="upgrade-btn">
                        Upgrade Now
                    </button>
                </div>
            `;
        }
    }

    // Create countdown UI
    createCountdownUI() {
        // Check if countdown UI already exists
        if (document.getElementById('trial-countdown-container')) {
            return;
        }

        // Create countdown container
        const countdownContainer = document.createElement('div');
        countdownContainer.id = 'trial-countdown-container';
        countdownContainer.className = 'trial-countdown-container';
        countdownContainer.innerHTML = `
            <div class="trial-countdown">
                <div class="trial-header">
                    <h3>🆓 Free Trial</h3>
                    <p id="trial-status">Loading...</p>
                </div>
                
                <div class="countdown-display">
                    <div class="time-unit">
                        <span id="trial-days">00</span>
                        <label>Days</label>
                    </div>
                    <div class="time-separator">:</div>
                    <div class="time-unit">
                        <span id="trial-hours">00</span>
                        <label>Hours</label>
                    </div>
                    <div class="time-separator">:</div>
                    <div class="time-unit">
                        <span id="trial-minutes">00</span>
                        <label>Minutes</label>
                    </div>
                    <div class="time-separator">:</div>
                    <div class="time-unit">
                        <span id="trial-seconds">00</span>
                        <label>Seconds</label>
                    </div>
                </div>
                
                <div class="progress-container">
                    <div class="progress-bar">
                        <div id="trial-progress-bar" class="progress-fill"></div>
                    </div>
                    <span id="trial-progress-text">0% Complete</span>
                </div>
                
                <div class="trial-actions">
                    <button onclick="trialCountdown.showUpgradeOptions()" class="upgrade-btn">
                        Upgrade to Continue
                    </button>
                </div>
            </div>
        `;

        // Add styles
        this.addCountdownStyles();

        // Insert countdown into page
        const targetElement = document.querySelector('.main-content') || 
                             document.querySelector('main') || 
                             document.querySelector('.container') ||
                             document.body;
        
        if (targetElement) {
            targetElement.insertBefore(countdownContainer, targetElement.firstChild);
        }
    }

    // Add countdown styles
    addCountdownStyles() {
        if (document.getElementById('trial-countdown-styles')) {
            return;
        }

        const styles = document.createElement('style');
        styles.id = 'trial-countdown-styles';
        styles.textContent = `
            .trial-countdown-container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                margin: 10px 0;
                border-radius: 15px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            }

            .trial-countdown {
                text-align: center;
            }

            .trial-header h3 {
                margin: 0 0 5px 0;
                font-size: 1.5em;
                font-weight: bold;
            }

            .trial-header p {
                margin: 0 0 20px 0;
                opacity: 0.9;
                font-size: 1.1em;
            }

            .countdown-display {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 15px;
                margin: 20px 0;
                flex-wrap: wrap;
            }

            .time-unit {
                background: rgba(255,255,255,0.2);
                padding: 15px;
                border-radius: 10px;
                min-width: 80px;
                backdrop-filter: blur(5px);
            }

            .time-unit span {
                display: block;
                font-size: 2em;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .time-unit label {
                font-size: 0.9em;
                opacity: 0.8;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .time-separator {
                font-size: 2em;
                font-weight: bold;
                opacity: 0.7;
            }

            .progress-container {
                margin: 20px 0;
            }

            .progress-bar {
                background: rgba(255,255,255,0.2);
                height: 8px;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 10px;
            }

            .progress-fill {
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                height: 100%;
                width: 0%;
                transition: width 0.3s ease;
            }

            .trial-actions {
                margin-top: 20px;
            }

            .upgrade-btn {
                background: linear-gradient(45deg, #FF6B6B, #FF8E53);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 25px;
                font-size: 1.1em;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(255,107,107,0.3);
            }

            .upgrade-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(255,107,107,0.4);
            }

            .trial-expired {
                text-align: center;
                padding: 20px;
            }

            .expired-icon {
                font-size: 3em;
                margin-bottom: 15px;
            }

            .trial-expired h3 {
                margin: 0 0 10px 0;
                color: #FF6B6B;
            }

            .trial-expired p {
                margin: 0 0 20px 0;
                opacity: 0.9;
            }

            @media (max-width: 768px) {
                .countdown-display {
                    gap: 10px;
                }
                
                .time-unit {
                    min-width: 60px;
                    padding: 10px;
                }
                
                .time-unit span {
                    font-size: 1.5em;
                }
                
                .time-separator {
                    font-size: 1.5em;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    // Show upgrade options
    showUpgradeOptions() {
        // This would typically redirect to upgrade page or show upgrade modal
        console.log('🔄 Showing upgrade options...');
        
        // For now, redirect to level page
        if (window.location.pathname !== '/level.html') {
            window.location.href = '/level.html';
        }
    }

    // Show upgrade prompt
    showUpgradePrompt() {
        // Create a modal or notification for upgrade
        const upgradeModal = document.createElement('div');
        upgradeModal.className = 'upgrade-prompt-modal';
        upgradeModal.innerHTML = `
            <div class="upgrade-modal-content">
                <div class="upgrade-icon">🚀</div>
                <h3>Free Trial Expired!</h3>
                <p>Your 5-day free trial has ended. Upgrade now to continue earning money!</p>
                <div class="upgrade-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="close-btn">
                        Maybe Later
                    </button>
                    <button onclick="trialCountdown.showUpgradeOptions()" class="upgrade-btn">
                        Upgrade Now
                    </button>
                </div>
            </div>
        `;

        // Add modal styles
        const modalStyles = document.createElement('style');
        modalStyles.textContent = `
            .upgrade-prompt-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
            }

            .upgrade-modal-content {
                background: white;
                padding: 30px;
                border-radius: 20px;
                text-align: center;
                max-width: 400px;
                margin: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }

            .upgrade-icon {
                font-size: 4em;
                margin-bottom: 20px;
            }

            .upgrade-modal-content h3 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 1.8em;
            }

            .upgrade-modal-content p {
                margin: 0 0 25px 0;
                color: #666;
                line-height: 1.5;
            }

            .upgrade-actions {
                display: flex;
                gap: 15px;
                justify-content: center;
            }

            .close-btn, .upgrade-btn {
                padding: 12px 25px;
                border: none;
                border-radius: 25px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .close-btn {
                background: #f0f0f0;
                color: #666;
            }

            .upgrade-btn {
                background: linear-gradient(45deg, #FF6B6B, #FF8E53);
                color: white;
            }

            .close-btn:hover, .upgrade-btn:hover {
                transform: translateY(-2px);
            }
        `;

        document.head.appendChild(modalStyles);
        document.body.appendChild(upgradeModal);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (upgradeModal.parentElement) {
                upgradeModal.remove();
            }
        }, 10000);
    }

    // Cleanup method
    destroy() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        const countdownContainer = document.getElementById('trial-countdown-container');
        if (countdownContainer) {
            countdownContainer.remove();
        }
        
        const styles = document.getElementById('trial-countdown-styles');
        if (styles) {
            styles.remove();
        }
    }
}

// Global instance
window.trialCountdown = new TrialCountdown();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.trialCountdown.init();
    });
} else {
    window.trialCountdown.init();
}
