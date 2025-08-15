<?php
session_start();
require_once 'config/database.php';
require_once 'config/config.php';
require_once 'includes/functions.php';

// Handle routing
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);

// Remove base path if exists
$base_path = dirname($_SERVER['SCRIPT_NAME']);
if ($base_path !== '/') {
    $path = str_replace($base_path, '', $path);
}

// API routes
if (strpos($path, '/api/') === 0) {
    require_once 'api/router.php';
    exit;
}

// Admin routes
if (strpos($path, '/admin') === 0) {
    require_once 'admin/router.php';
    exit;
}

// Static file serving
if (file_exists('public' . $path)) {
    $mime_types = [
        '.html' => 'text/html',
        '.css' => 'text/css',
        '.js' => 'application/javascript',
        '.png' => 'image/png',
        '.jpg' => 'image/jpeg',
        '.jpeg' => 'image/jpeg',
        '.gif' => 'image/gif',
        '.svg' => 'image/svg+xml',
        '.ico' => 'image/x-icon'
    ];
    
    $extension = pathinfo($path, PATHINFO_EXTENSION);
    if (isset($mime_types['.' . $extension])) {
        header('Content-Type: ' . $mime_types['.' . $extension]);
    }
    
    readfile('public' . $path);
    exit;
}

// Default route - serve main page
if ($path === '/' || $path === '') {
    include 'public/index.html';
    exit;
}

// 404 - Page not found
http_response_code(404);
include 'public/404.html';
?> 