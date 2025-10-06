<?php
// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
        }
    }
}

// Load .env file if it exists
loadEnv(__DIR__ . '/../.env');

// Application configuration
define('APP_NAME', 'UAI Agency');
define('APP_VERSION', '1.0.0');
define('APP_URL', array_key_exists('APP_URL', $_ENV) ? $_ENV['APP_URL'] : 'http://localhost');

// JWT Configuration
define('JWT_SECRET', array_key_exists('JWT_SECRET', $_ENV) ? $_ENV['JWT_SECRET'] : 'your-secret-key-change-this');
define('JWT_ALGORITHM', 'HS256');
define('JWT_EXPIRY', 86400); // 24 hours

// M-PESA Configuration
define('DARAJA_CONSUMER_KEY', array_key_exists('DARAJA_CONSUMER_KEY', $_ENV) ? $_ENV['DARAJA_CONSUMER_KEY'] : '');
define('DARAJA_CONSUMER_SECRET', array_key_exists('DARAJA_CONSUMER_SECRET', $_ENV) ? $_ENV['DARAJA_CONSUMER_SECRET'] : '');
define('DARAJA_SHORTCODE', array_key_exists('DARAJA_SHORTCODE', $_ENV) ? $_ENV['DARAJA_SHORTCODE'] : '522522');
define('DARAJA_PASSKEY', array_key_exists('DARAJA_PASSKEY', $_ENV) ? $_ENV['DARAJA_PASSKEY'] : '');
define('DARAJA_CALLBACK_URL', array_key_exists('DARAJA_CALLBACK_URL', $_ENV) ? $_ENV['DARAJA_CALLBACK_URL'] : '');
define('DARAJA_ENVIRONMENT', (array_key_exists('NODE_ENV', $_ENV) && $_ENV['NODE_ENV'] === 'production') ? 'production' : 'sandbox');

// CORS Configuration
define('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:3000',
    'https://your-app-name.vercel.app'
]);

// Error reporting
if (!array_key_exists('APP_ENV', $_ENV) || $_ENV['APP_ENV'] === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// Timezone
date_default_timezone_set('Africa/Nairobi');

// Session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', (array_key_exists('APP_ENV', $_ENV) && $_ENV['APP_ENV'] === 'production') ? 1 : 0);
ini_set('session.use_strict_mode', 1);

// Helper functions
function isProduction() {
    return array_key_exists('APP_ENV', $_ENV) && $_ENV['APP_ENV'] === 'production';
}

function isDevelopment() {
    return !array_key_exists('APP_ENV', $_ENV) || $_ENV['APP_ENV'] === 'development';
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