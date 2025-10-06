// Maintenance mode middleware
const fs = require('fs');
const path = require('path');

// Admin user IDs that are exempt from maintenance mode
const MAINTENANCE_EXEMPT_USERS = [20, 21];

// Maintenance mode configuration
let maintenanceMode = {
    enabled: false,
    startTime: null,
    endTime: null,
    message: "System is under maintenance. Please come back later."
};

// Function to enable/disable maintenance mode
function setMaintenanceMode(enabled, durationHours = 2) {
    maintenanceMode.enabled = enabled;
    
    if (enabled) {
        maintenanceMode.startTime = new Date();
        maintenanceMode.endTime = new Date(Date.now() + (durationHours * 60 * 60 * 1000));
        console.log(`🔧 Maintenance mode ENABLED until ${maintenanceMode.endTime.toLocaleString()}`);
    } else {
        maintenanceMode.startTime = null;
        maintenanceMode.endTime = null;
        console.log('✅ Maintenance mode DISABLED');
    }
    
    // Save maintenance state to file
    saveMaintenanceState();
}

// Function to save maintenance state
function saveMaintenanceState() {
    const stateFile = path.join(__dirname, 'maintenance-state.json');
    try {
        fs.writeFileSync(stateFile, JSON.stringify(maintenanceMode, null, 2));
    } catch (error) {
        console.error('Error saving maintenance state:', error.message);
    }
}

// Function to load maintenance state
function loadMaintenanceState() {
    const stateFile = path.join(__dirname, 'maintenance-state.json');
    try {
        if (fs.existsSync(stateFile)) {
            const data = fs.readFileSync(stateFile, 'utf8');
            const savedState = JSON.parse(data);
            
            // Load the saved state
            if (savedState.enabled && savedState.endTime) {
                const endTime = new Date(savedState.endTime);
                if (endTime < new Date()) {
                    console.log('⏰ Maintenance period has expired, disabling maintenance mode');
                    maintenanceMode.enabled = false;
                    maintenanceMode.startTime = null;
                    maintenanceMode.endTime = null;
                    saveMaintenanceState();
                } else {
                    maintenanceMode = savedState;
                    console.log(`🔧 Maintenance mode loaded: Active until ${endTime.toLocaleString()}`);
                }
            } else {
                // Load disabled state
                maintenanceMode = savedState;
                console.log('✅ Maintenance mode loaded: Disabled');
            }
        }
    } catch (error) {
        console.error('Error loading maintenance state:', error.message);
    }
}

// Middleware to check maintenance mode
function maintenanceCheck(req, res, next) {
    // Load current maintenance state
    loadMaintenanceState();
    
    // Check if maintenance mode is enabled
    if (maintenanceMode.enabled) {
        // Check if user is exempt (for login attempts)
        if (req.body && req.body.phone) {
            // This is a login attempt, check if user is exempt
            const phone = req.body.phone;
            
            // Check if this phone belongs to an exempt user
            const exemptPhones = [
                '+254114710035', // User ID 20
                '0708288313'     // User ID 21
            ];
            
            if (exemptPhones.includes(phone)) {
                console.log(`✅ Exempt user ${phone} bypassed maintenance mode`);
                return next();
            }
        }
        
        // Check if user is logged in and exempt (for other requests)
        if (req.user && MAINTENANCE_EXEMPT_USERS.includes(req.user.id)) {
            console.log(`✅ Exempt user ID ${req.user.id} bypassed maintenance mode`);
            return next();
        }
        
        // Serve maintenance page
        console.log(`🔧 Serving maintenance page to ${req.ip}`);
        return res.status(503).sendFile(path.join(process.cwd(), 'frontend/maintenance.html'));
    }
    
    // Maintenance mode is disabled, continue normally
    next();
}

// API endpoint to toggle maintenance mode (admin only)
function maintenanceToggle(req, res) {
    // Check if user is admin and exempt
    if (!req.user || !MAINTENANCE_EXEMPT_USERS.includes(req.user.id)) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    
    const { action, duration } = req.body;
    
    if (action === 'enable') {
        const hours = duration || 2;
        setMaintenanceMode(true, hours);
        res.json({ 
            success: true, 
            message: `Maintenance mode enabled for ${hours} hours`,
            endTime: maintenanceMode.endTime
        });
    } else if (action === 'disable') {
        setMaintenanceMode(false);
        res.json({ 
            success: true, 
            message: 'Maintenance mode disabled' 
        });
    } else if (action === 'status') {
        res.json({
            enabled: maintenanceMode.enabled,
            startTime: maintenanceMode.startTime,
            endTime: maintenanceMode.endTime,
            exemptUsers: MAINTENANCE_EXEMPT_USERS
        });
    } else {
        res.status(400).json({ error: 'Invalid action. Use "enable", "disable", or "status"' });
    }
}

// Initialize maintenance state on startup
loadMaintenanceState();

module.exports = {
    maintenanceCheck,
    maintenanceToggle,
    setMaintenanceMode,
    maintenanceMode,
    MAINTENANCE_EXEMPT_USERS
};
