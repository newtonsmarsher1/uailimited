<?php
echo "🚀 UAI Agency - Local Development Setup\n\n";

echo "📋 Prerequisites:\n";
echo "1. PHP 8.0+ installed\n";
echo "2. MySQL/MariaDB installed\n";
echo "3. Web server (Apache/XAMPP/WAMP)\n\n";

echo "🔧 Step 1: Database Setup\n";
echo "Create a MySQL database:\n";
echo "CREATE DATABASE uai_agency;\n";
echo "CREATE USER 'uai_user'@'localhost' IDENTIFIED BY 'password123';\n";
echo "GRANT ALL PRIVILEGES ON uai_agency.* TO 'uai_user'@'localhost';\n";
echo "FLUSH PRIVILEGES;\n\n";

echo "🔧 Step 2: Environment Configuration\n";
echo "Create a .env file with:\n";
echo "DB_HOST=localhost\n";
echo "DB_USER=uai_user\n";
echo "DB_PASSWORD=password123\n";
echo "DB_NAME=uai_agency\n";
echo "APP_ENV=development\n";
echo "JWT_SECRET=your-secret-key-here\n\n";

echo "🔧 Step 3: Start Local Server\n";
echo "Option A - PHP Built-in Server:\n";
echo "php -S localhost:8000\n\n";

echo "Option B - XAMPP/WAMP:\n";
echo "1. Copy files to htdocs/www folder\n";
echo "2. Start Apache and MySQL\n";
echo "3. Visit http://localhost/uai-agency\n\n";

echo "🔧 Step 4: Test the Application\n";
echo "1. Visit: http://localhost:8000 (or your local URL)\n";
echo "2. Register a new account\n";
echo "3. Login and test features\n\n";

echo "📊 Available Features:\n";
echo "✅ User Registration/Login\n";
echo "✅ Task Management\n";
echo "✅ Investment System\n";
echo "✅ Multi-language Support\n";
echo "✅ Admin Panel\n";
echo "✅ API Endpoints\n\n";

echo "🎯 Next Steps:\n";
echo "1. Set up database\n";
echo "2. Configure environment\n";
echo "3. Start development server\n";
echo "4. Test application\n";
echo "5. Deploy to hosting\n";
?> 