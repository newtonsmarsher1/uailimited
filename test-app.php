<?php
echo "🧪 Testing UAI Agency Application\n\n";

// Test 1: Check if config loads
echo "1. Testing config loading...\n";
try {
    require_once 'config/config.php';
    echo "✅ Config loaded successfully\n";
    echo "   APP_NAME: " . APP_NAME . "\n";
    echo "   APP_URL: " . APP_URL . "\n";
} catch (Exception $e) {
    echo "❌ Config failed: " . $e->getMessage() . "\n";
}

// Test 2: Check if database connects
echo "\n2. Testing database connection...\n";
try {
    require_once 'config/database.php';
    $db = new Database();
    $connection = $db->getConnection();
    echo "✅ Database connected successfully\n";
} catch (Exception $e) {
    echo "❌ Database failed: " . $e->getMessage() . "\n";
}

// Test 3: Check if functions load
echo "\n3. Testing functions loading...\n";
try {
    require_once 'includes/functions.php';
    echo "✅ Functions loaded successfully\n";
} catch (Exception $e) {
    echo "❌ Functions failed: " . $e->getMessage() . "\n";
}

// Test 4: Check if index.php exists
echo "\n4. Testing main files...\n";
$files = ['index.php', '.htaccess', 'api/router.php'];
foreach ($files as $file) {
    if (file_exists($file)) {
        echo "✅ $file exists\n";
    } else {
        echo "❌ $file missing\n";
    }
}

// Test 5: Check environment variables
echo "\n5. Testing environment variables...\n";
$envFile = '.env';
if (file_exists($envFile)) {
    echo "✅ .env file exists\n";
    $content = file_get_contents($envFile);
    echo "   Content: " . trim($content) . "\n";
} else {
    echo "❌ .env file missing\n";
}

echo "\n🎯 Application Status: ";
if (file_exists('index.php') && file_exists('config/config.php') && file_exists('config/database.php')) {
    echo "READY TO USE\n";
    echo "🌐 Visit: http://localhost/uai-agency/\n";
    echo "👑 Admin: http://localhost/uai-agency/admin/ (admin/admin123)\n";
} else {
    echo "NOT READY - Missing files\n";
}
?> 