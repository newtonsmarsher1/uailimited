<?php
// Admin Router
session_start();

// Simple admin login check
if (!isset($_SESSION['admin_logged_in'])) {
    $_SESSION['admin_logged_in'] = false;
}

// Admin login
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'login') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    
    if ($username === 'admin' && $password === 'admin123') {
        $_SESSION['admin_logged_in'] = true;
        header('Location: /admin/');
        exit;
    }
}

// Admin logout
if (isset($_GET['logout'])) {
    $_SESSION['admin_logged_in'] = false;
    header('Location: /admin/');
    exit;
}

// Admin dashboard
if ($_SESSION['admin_logged_in']) {
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>UAI Agency - Admin Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 2em; font-weight: bold; }
            .logout { text-align: right; margin-bottom: 20px; }
            .logout a { color: #dc3545; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logout">
                <a href="?logout=1">Logout</a>
            </div>
            <div class="header">
                <h1>🎯 UAI Agency - Admin Dashboard</h1>
                <p>Welcome, Admin! Here's your control center.</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">1,234</div>
                    <div>Total Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">567</div>
                    <div>Active Tasks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">$89,123</div>
                    <div>Total Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">99.9%</div>
                    <div>Uptime</div>
                </div>
            </div>
            
            <h2>🚀 Quick Actions</h2>
            <p>Your UAI Agency is running perfectly! Ready to scale and grow.</p>
        </div>
    </body>
    </html>
    <?php
} else {
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>UAI Agency - Admin Login</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .login-form { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
            .header { text-align: center; margin-bottom: 30px; }
            input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
            button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
        </style>
    </head>
    <body>
        <div class="login-form">
            <div class="header">
                <h1>🎯 UAI Agency</h1>
                <p>Admin Login</p>
            </div>
            <form method="POST">
                <input type="hidden" name="action" value="login">
                <input type="text" name="username" placeholder="Username" required>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit">Login</button>
            </form>
            <p style="text-align: center; margin-top: 20px; color: #666;">
                Username: admin<br>
                Password: admin123
            </p>
        </div>
    </body>
    </html>
    <?php
}
?> 