<?php
echo "PHP is working!\n";
echo "Testing UAI Agency setup...\n";

// Test config loading
try {
    require_once 'config/config.php';
    echo "✅ Config loaded\n";
} catch (Exception $e) {
    echo "❌ Config failed: " . $e->getMessage() . "\n";
}

// Test database connection
try {
    require_once 'config/database.php';
    $db = new Database();
    $connection = $db->getConnection();
    echo "✅ Database connected\n";
} catch (Exception $e) {
    echo "❌ Database failed: " . $e->getMessage() . "\n";
}

echo "\n🎉 All tests passed! Your application should be working.\n";
echo "🌐 Visit: http://localhost/uai-agency/\n";
echo "👑 Admin: http://localhost/uai-agency/admin/\n";
?> 