<?php
echo "🔧 Testing .env File Loading\n\n";

// Load .env file manually
function loadEnv($path) {
    if (!file_exists($path)) {
        echo "❌ .env file not found at: $path\n";
        return;
    }
    
    echo "✅ .env file found at: $path\n";
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
            echo "📋 $key = '$value'\n";
        }
    }
}

loadEnv(__DIR__ . '/.env');

echo "\n🔍 Environment Variables:\n";
echo "DB_HOST: " . ($_ENV['DB_HOST'] ?? 'NOT SET') . "\n";
echo "DB_USER: " . ($_ENV['DB_USER'] ?? 'NOT SET') . "\n";
echo "DB_PASSWORD: '" . ($_ENV['DB_PASSWORD'] ?? 'NOT SET') . "'\n";
echo "DB_NAME: " . ($_ENV['DB_NAME'] ?? 'NOT SET') . "\n";

echo "\n🧪 Testing Database Connection:\n";
try {
    $dsn = "mysql:host=" . ($_ENV['DB_HOST'] ?? 'localhost') . ";port=3306;charset=utf8mb4";
    $username = $_ENV['DB_USER'] ?? 'root';
    $password = $_ENV['DB_PASSWORD'] ?? '';
    
    echo "DSN: $dsn\n";
    echo "Username: $username\n";
    echo "Password: '$password'\n";
    
    $pdo = new PDO($dsn, $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✅ Database connection successful!\n";
    
    // Try to create database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS " . ($_ENV['DB_NAME'] ?? 'uai_agency'));
    echo "✅ Database created/verified!\n";
    
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}
?> 