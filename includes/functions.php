<?php
require_once __DIR__ . '/../config/database.php';

// Authentication functions
function generateJWT($payload) {
    $header = json_encode(['typ' => 'JWT', 'alg' => JWT_ALGORITHM]);
    $payload = json_encode($payload);
    
    $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
    $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    $header = $parts[0];
    $payload = $parts[1];
    $signature = $parts[2];
    
    $expectedSignature = hash_hmac('sha256', $header . "." . $payload, JWT_SECRET, true);
    $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expectedSignature));
    
    if (!hash_equals($signature, $expectedSignature)) {
        return false;
    }
    
    $payloadData = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
    
    if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
        return false;
    }
    
    return $payloadData;
}

function getCurrentUser() {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    } elseif (isset($_COOKIE['token'])) {
        $token = $_COOKIE['token'];
    }
    
    if (!$token) {
        return null;
    }
    
    $payload = verifyJWT($token);
    if (!$payload) {
        return null;
    }
    
    global $db;
    $user = $db->fetch("SELECT * FROM users WHERE id = ? AND is_active = 1", [$payload['user_id']]);
    return $user;
}

function requireAuth() {
    $user = getCurrentUser();
    if (!$user) {
        errorResponse('Authentication required', 401);
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if (!$user['is_admin']) {
        errorResponse('Admin access required', 403);
    }
    return $user;
}

// User functions
function createUser($phone, $password, $name = null, $email = null, $referralCode = null) {
    global $db;
    
    // Check if user already exists
    $existingUser = $db->fetch("SELECT id FROM users WHERE phone = ?", [$phone]);
    if ($existingUser) {
        return false;
    }
    
    // Generate referral code
    $userReferralCode = generateReferralCode();
    
    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // Insert user
    $userId = $db->insert(
        "INSERT INTO users (phone, password, name, email, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)",
        [$phone, $hashedPassword, $name, $email, $userReferralCode, $referralCode]
    );
    
    return $userId;
}

function authenticateUser($phone, $password) {
    global $db;
    
    $user = $db->fetch("SELECT * FROM users WHERE phone = ? AND is_active = 1", [$phone]);
    if (!$user) {
        return false;
    }
    
    if (!password_verify($password, $user['password'])) {
        return false;
    }
    
    return $user;
}

function generateReferralCode() {
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $code = '';
    for ($i = 0; $i < 8; $i++) {
        $code .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $code;
}

// Task functions
function getTasks($userId = null) {
    global $db;
    
    if ($userId) {
        return $db->fetchAll(
            "SELECT t.*, 
                    CASE WHEN ut.id IS NOT NULL THEN 1 ELSE 0 END as completed_today
             FROM tasks t 
             LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.user_id = ? AND DATE(ut.completed_at) = CURDATE()
             WHERE t.is_active = 1
             ORDER BY t.type, t.id",
            [$userId]
        );
    }
    
    return $db->fetchAll("SELECT * FROM tasks WHERE is_active = 1 ORDER BY type, id");
}

function completeTask($userId, $taskId) {
    global $db;
    
    // Check if task exists and is active
    $task = $db->fetch("SELECT * FROM tasks WHERE id = ? AND is_active = 1", [$taskId]);
    if (!$task) {
        return false;
    }
    
    // Check if already completed today
    $completed = $db->fetch(
        "SELECT id FROM user_tasks WHERE user_id = ? AND task_id = ? AND DATE(completed_at) = CURDATE()",
        [$userId, $taskId]
    );
    
    if ($completed) {
        return false;
    }
    
    // Record task completion
    $db->insert(
        "INSERT INTO user_tasks (user_id, task_id, reward_earned) VALUES (?, ?, ?)",
        [$userId, $taskId, $task['reward']]
    );
    
    // Update user wallet
    $db->update(
        "UPDATE users SET wallet_balance = wallet_balance + ?, total_earned = total_earned + ? WHERE id = ?",
        [$task['reward'], $task['reward'], $userId]
    );
    
    return $task['reward'];
}

// Investment functions
function createInvestment($userId, $fundName, $amount, $roiPercentage, $durationDays, $walletType = 'wallet') {
    global $db;
    
    // Check if user has sufficient balance
    $user = $db->fetch("SELECT wallet_balance, bond_balance FROM users WHERE id = ?", [$userId]);
    if (!$user) {
        return false;
    }
    
    $balance = $walletType === 'bond' ? $user['bond_balance'] : $user['wallet_balance'];
    if ($balance < $amount) {
        return false;
    }
    
    // Calculate end date
    $endDate = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));
    
    // Deduct amount from wallet
    $balanceColumn = $walletType === 'bond' ? 'bond_balance' : 'wallet_balance';
    $db->update(
        "UPDATE users SET {$balanceColumn} = {$balanceColumn} - ? WHERE id = ?",
        [$amount, $userId]
    );
    
    // Create investment
    $investmentId = $db->insert(
        "INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, end_date, wallet_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        [$userId, $fundName, $amount, $roiPercentage, $durationDays, $endDate, $walletType]
    );
    
    return $investmentId;
}

function processInvestmentPayouts() {
    global $db;
    
    // Get matured investments
    $maturedInvestments = $db->fetchAll(
        "SELECT * FROM investments 
         WHERE status = 'active' AND end_date <= NOW()"
    );
    
    foreach ($maturedInvestments as $investment) {
        // Calculate earnings
        $earnings = $investment['amount'] * ($investment['roi_percentage'] / 100) * $investment['duration_days'];
        $totalAmount = $investment['amount'] + $earnings;
        
        // Update investment status
        $db->update(
            "UPDATE investments SET status = 'completed', total_earned = ? WHERE id = ?",
            [$earnings, $investment['id']]
        );
        
        // Add to user wallet
        $balanceColumn = $investment['wallet_type'] === 'bond' ? 'bond_balance' : 'wallet_balance';
        $db->update(
            "UPDATE users SET {$balanceColumn} = {$balanceColumn} + ?, total_earned = total_earned + ? WHERE id = ?",
            [$totalAmount, $earnings, $investment['user_id']]
        );
        
        // Create notification
        createNotification(
            $investment['user_id'],
            "Your investment in {$investment['fund_name']} has matured! You earned KES " . number_format($earnings, 2),
            'investment'
        );
    }
    
    return count($maturedInvestments);
}

// Notification functions
function createNotification($userId, $message, $type = 'info') {
    global $db;
    
    return $db->insert(
        "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
        [$userId, $message, $type]
    );
}

function getNotifications($userId, $limit = 10) {
    global $db;
    
    return $db->fetchAll(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        [$userId, $limit]
    );
}

// Language functions
function getLanguage($userId) {
    global $db;
    
    $user = $db->fetch("SELECT language FROM users WHERE id = ?", [$userId]);
    return $user ? $user['language'] : 'en';
}

function getTranslations($language = 'en') {
    $translations = [
        'en' => [
            'login_success' => 'Login successful!',
            'login_failed' => 'Login failed. Please check your credentials.',
            'home' => 'Home',
            'profile' => 'Profile',
            'tasks' => 'Tasks',
            'recharge' => 'Recharge',
            'today_earning' => "Today's Earnings",
            'month_earning' => 'This Month',
            'total_revenue' => 'Total Revenue',
            'total_withdrawal' => 'Total Withdrawn',
            'wallet_balance' => 'Wallet Balance',
            'bond' => 'Bond',
            'profit' => 'Profit',
            'tasks_done' => 'Tasks Done',
            'logout' => 'Log Out',
            'language_select' => 'Select Language',
            'notification' => 'Notification',
            'withdraw' => 'Withdraw',
            'bind_details' => 'Bind Withdrawal Details',
            'privacy_policy' => 'Privacy Policy',
            'welcome' => 'Welcome to UAI',
            'welcome_trial' => 'Welcome back! Trial Worker',
            'start_msg' => 'Start your work journey'
        ],
        'sw' => [
            'login_success' => 'Ingia imefanikiwa!',
            'login_failed' => 'Ingia imeshindwa. Tafadhali angalia maelezo yako.',
            'home' => 'Nyumbani',
            'profile' => 'Wasifu',
            'tasks' => 'Kazi',
            'recharge' => 'Malipo',
            'today_earning' => 'Mapato ya Leo',
            'month_earning' => 'Mwezi Huu',
            'total_revenue' => 'Jumla ya Mapato',
            'total_withdrawal' => 'Jumla ya Kutoa',
            'wallet_balance' => 'Salio la Mfuko',
            'bond' => 'Dhamana',
            'profit' => 'Faida',
            'tasks_done' => 'Kazi Zilizokamilika',
            'logout' => 'Ondoka',
            'language_select' => 'Chagua Lugha',
            'notification' => 'Taarifa',
            'withdraw' => 'Toa',
            'bind_details' => 'Unganisha Maelezo ya Kutoa',
            'privacy_policy' => 'Sera ya Faragha',
            'welcome' => 'Karibu kwenye UAI',
            'welcome_trial' => 'Karibu tena! Mfanyakazi wa Jaribio',
            'start_msg' => 'Anza safari yako ya kazi'
        ],
        'fr' => [
            'login_success' => 'Connexion réussie!',
            'login_failed' => 'Échec de la connexion. Veuillez vérifier vos identifiants.',
            'home' => 'Accueil',
            'profile' => 'Profil',
            'tasks' => 'Tâches',
            'recharge' => 'Recharger',
            'today_earning' => 'Gains d\'Aujourd\'hui',
            'month_earning' => 'Ce Mois',
            'total_revenue' => 'Revenu Total',
            'total_withdrawal' => 'Retrait Total',
            'wallet_balance' => 'Solde du Portefeuille',
            'bond' => 'Obligation',
            'profit' => 'Profit',
            'tasks_done' => 'Tâches Terminées',
            'logout' => 'Se Déconnecter',
            'language_select' => 'Sélectionner la Langue',
            'notification' => 'Notification',
            'withdraw' => 'Retirer',
            'bind_details' => 'Lier les Détails de Retrait',
            'privacy_policy' => 'Politique de Confidentialité',
            'welcome' => 'Bienvenue chez UAI',
            'welcome_trial' => 'Bon retour! Travailleur d\'Essai',
            'start_msg' => 'Commencez votre voyage de travail'
        ]
    ];
    
    return $translations[$language] ?? $translations['en'];
}

// Utility functions
function formatCurrency($amount) {
    return 'KES ' . number_format($amount, 2);
}

function sanitizeInput($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

function validatePhone($phone) {
    // Remove any non-digit characters
    $phone = preg_replace('/[^0-9]/', '', $phone);
    
    // Check if it's a valid Kenyan phone number
    if (strlen($phone) === 11 && substr($phone, 0, 1) === '0') {
        return '254' . substr($phone, 1);
    } elseif (strlen($phone) === 12 && substr($phone, 0, 3) === '254') {
        return $phone;
    }
    
    return false;
}

function logActivity($userId, $action, $details = null) {
    global $db;
    
    $db->insert(
        "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        [$userId, $action, $details, $_SERVER['REMOTE_ADDR'] ?? '']
    );
}
?> 