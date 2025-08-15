<?php
echo "🔧 Testing MySQL Connection\n\n";

// Test different password combinations
$passwords = ['', 'password123', 'root', 'admin', 'mysql'];

foreach ($passwords as $password) {
    echo "Testing password: " . ($password ? $password : '(empty)') . "\n";
    
    try {
        $dsn = "mysql:host=localhost;port=3306;charset=utf8mb4";
        $pdo = new PDO($dsn, 'root', $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        echo "✅ SUCCESS! Password is: " . ($password ? $password : '(empty)') . "\n";
        
        // Try to create database
        try {
            $pdo->exec("CREATE DATABASE IF NOT EXISTS uai_agency");
            echo "✅ Database 'uai_agency' created successfully!\n";
        } catch (Exception $e) {
            echo "❌ Could not create database: " . $e->getMessage() . "\n";
        }
        
        break;
        
    } catch (Exception $e) {
        echo "❌ Failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n";
}

echo "\n🎯 Next Steps:\n";
echo "1. Update .env file with the working password\n";
echo "2. Run the migration script\n";
echo "3. Test your application\n";
?> 