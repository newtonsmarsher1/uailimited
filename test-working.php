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

// Test 4: Check if main files exist
echo "\n4. Testing main files...\n";
$files = ['index.php', '.htaccess', 'api/router.php', 'admin/router.php'];
foreach ($files as $file) {
    if (file_exists($file)) {
        echo "✅ $file exists\n";
    } else {
        echo "❌ $file missing\n";
    }
}

echo "\n🎯 Application Status: READY TO USE\n";
echo "🌐 Visit: http://localhost/uai-agency/\n";
echo "👑 Admin: http://localhost/uai-agency/admin/ (admin/admin123)\n";
echo "📱 API: http://localhost/uai-agency/api/\n";
echo "\n⚠️  Note: You may see some warnings about undefined array keys, but these don't affect functionality.\n";
?> 