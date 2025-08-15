<?php
// Disable all errors and warnings
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 0);

// Application configuration - hardcoded values only
define('APP_NAME', 'UAI Agency');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'http://localhost/uai-agency');

// JWT Configuration
define('JWT_SECRET', 'your-secret-key-change-this-in-production');
define('JWT_ALGORITHM', 'HS256');
define('JWT_EXPIRY', 86400); // 24 hours

// M-PESA Configuration
define('DARAJA_CONSUMER_KEY', '');
define('DARAJA_CONSUMER_SECRET', '');
define('DARAJA_SHORTCODE', '522522');
define('DARAJA_PASSKEY', '');
define('DARAJA_CALLBACK_URL', '');
define('DARAJA_ENVIRONMENT', 'sandbox');

// CORS Configuration
define('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://your-app-name.vercel.app'
]);

// Timezone
date_default_timezone_set('Africa/Nairobi');

// Session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 0);
ini_set('session.use_strict_mode', 1);

// Helper functions
function isProduction() {
    return false;
}

function isDevelopment() {
    return true;
}

function asset($path) {
    return APP_URL . '/assets/' . ltrim($path, '/');
}

function url($path = '') {
    return APP_URL . '/' . ltrim($path, '/');
}

function redirect($path) {
    header('Location: ' . url($path));
    exit;
}

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function errorResponse($message, $status = 400) {
    jsonResponse(['error' => $message], $status);
}

function successResponse($data = null, $message = 'Success') {
    jsonResponse([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
}
?> 